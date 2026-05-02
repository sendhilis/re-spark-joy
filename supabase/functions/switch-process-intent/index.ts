// LipafoPay Switch — reference processor.
// Demonstrates: idempotency, state machine, event sourcing, sharded ledger,
// circuit breaker, fraud velocity check, distributed tracing.
// NOT a 5,000 TPS production switch — see /admin Switch Ops banner.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHARD_COUNT = 16;
const hashShard = (key: string): number => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % SHARD_COUNT;
};
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

interface IntentReq {
  idempotency_key: string;
  payer_identifier: string;
  payee_identifier: string;
  payee_bank?: string;
  amount: number;
  currency?: string;
  rail?: string;
  trace_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body: IntentReq = await req.json();
    if (!body.idempotency_key || !body.amount || !body.payer_identifier || !body.payee_identifier) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trace_id = body.trace_id ?? newId();
    const startedAt = Date.now();

    // ── Pattern 1: Idempotency. Same key => return existing intent, do not double-process.
    const { data: existing } = await supabase
      .from("transaction_intents")
      .select("*")
      .eq("idempotency_key", body.idempotency_key)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ replayed: true, intent: existing }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Pattern 5: Circuit breaker — refuse if downstream bank is OPEN.
    let bankConn: any = null;
    if (body.payee_bank) {
      const { data: bc } = await supabase
        .from("bank_connectors")
        .select("*").eq("bank_code", body.payee_bank).maybeSingle();
      bankConn = bc;
      if (bc && bc.circuit_state === "OPEN") {
        await supabase.from("trace_spans").insert({
          trace_id, span_id: newId(), service: "switch", operation: "circuit_check",
          status: "rejected", duration_ms: 1, attributes: { bank: body.payee_bank, reason: "circuit_open" },
        });
        return new Response(JSON.stringify({
          error: "circuit_open", bank: body.payee_bank,
          message: `Circuit breaker OPEN for ${bc.bank_name} — try later`,
        }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ── Pattern 7: Fraud velocity check (pre-aggregated 60s bucket).
    const windowStart = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
    const { data: vel } = await supabase
      .from("velocity_counters")
      .select("count,total_amount")
      .eq("subject", body.payer_identifier).eq("bucket", "1m")
      .eq("window_start", windowStart).maybeSingle();
    const velCount = (vel?.count ?? 0) + 1;
    const velAmt = Number(vel?.total_amount ?? 0) + Number(body.amount);

    let fraudFlag: string | null = null;
    if (velCount > 10) fraudFlag = "VEL_TXN_1M";
    if (Number(body.amount) > 1_000_000) fraudFlag = "AMT_SINGLE";

    // ── Pattern 1+2: Insert intent in NEW state, then drive state machine,
    //    appending an event at every transition (event log = source of truth).
    const { data: intent, error: insErr } = await supabase
      .from("transaction_intents").insert({
        idempotency_key: body.idempotency_key,
        trace_id,
        payer_identifier: body.payer_identifier,
        payee_identifier: body.payee_identifier,
        payee_bank: body.payee_bank ?? null,
        amount: body.amount,
        currency: body.currency ?? "KES",
        rail: body.rail ?? "bank_rail",
        state: "NEW",
        attempt_count: 1,
      }).select().single();
    if (insErr) throw insErr;

    const logEvent = async (event_type: string, from_state: string | null, to_state: string | null, payload: any = {}) => {
      await supabase.from("switch_events").insert({
        intent_id: intent.id, trace_id, span_id: newId(),
        event_type, from_state, to_state, payload,
      });
    };

    await logEvent("intent.created", null, "NEW", { amount: body.amount });

    if (fraudFlag) {
      await supabase.from("transaction_intents").update({
        state: "FAILED", last_error: `fraud_flag:${fraudFlag}`, completed_at: new Date().toISOString(),
      }).eq("id", intent.id);
      await logEvent("fraud.blocked", "NEW", "FAILED", { rule: fraudFlag });
      return new Response(JSON.stringify({ error: "fraud_blocked", rule: fraudFlag }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Move to IN_FLIGHT
    await supabase.from("transaction_intents").update({ state: "IN_FLIGHT" }).eq("id", intent.id);
    await logEvent("debit.requested", "NEW", "IN_FLIGHT");

    // ── Real outbound pacs.008 to the bank (or simulator fallback).
    // Look up the bank's active integration profile for endpoint + signing key.
    let pacs008Url: string | null = null;
    let timeoutMs = 2000;
    let hmacSecret = Deno.env.get("BANK_SIM_HMAC_SECRET") ?? "lipafo-pilot-shared-secret";
    if (body.payee_bank) {
      const { data: bankRow } = await supabase
        .from("participating_banks").select("id").eq("bank_code", body.payee_bank).maybeSingle();
      if (bankRow?.id) {
        const { data: profile } = await supabase
          .from("bank_integration_profiles")
          .select("pacs008_endpoint,timeout_ms,hmac_key_ref,is_active,environment")
          .eq("bank_id", bankRow.id).eq("is_active", true).maybeSingle();
        if (profile?.pacs008_endpoint) pacs008Url = profile.pacs008_endpoint;
        if (profile?.timeout_ms) timeoutMs = profile.timeout_ms;
      }
    }
    // Default to bank simulator if no endpoint configured (pilot behaviour).
    if (!pacs008Url) {
      pacs008Url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/bank-simulator`;
    }

    const pacs008Body = JSON.stringify({
      message_type: "pacs.008",
      trace_id,
      idempotency_key: body.idempotency_key,
      payer_identifier: body.payer_identifier,
      payee_identifier: body.payee_identifier,
      amount: body.amount,
      currency: body.currency ?? "KES",
    });
    // HMAC-SHA256 of raw body
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", enc.encode(hmacSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sigBytes = await crypto.subtle.sign("HMAC", key, enc.encode(pacs008Body));
    const signature = Array.from(new Uint8Array(sigBytes))
      .map((b) => b.toString(16).padStart(2, "0")).join("");

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const callStart = Date.now();
    let bankStatus = "ACSC";
    let bankRef: string | null = null;
    let bankRejection: string | null = null;
    try {
      const resp = await fetch(pacs008Url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Lipafo-Signature": signature,
          "X-Lipafo-Bank-Code": body.payee_bank ?? "UNKNOWN",
          "X-Lipafo-Trace-Id": trace_id,
          // bank-simulator is hosted on Supabase, so include service auth
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: pacs008Body,
        signal: ctrl.signal,
      });
      const respJson = await resp.json().catch(() => ({}));
      bankStatus = respJson.status ?? (resp.ok ? "ACSC" : "RJCT");
      bankRef = respJson.bank_reference ?? null;
      bankRejection = respJson.reason ?? null;
    } catch (e) {
      bankStatus = "TIMEOUT";
      bankRejection = (e as Error).name === "AbortError" ? "timeout" : (e as Error).message;
    } finally {
      clearTimeout(t);
    }
    const callLatency = Date.now() - callStart;

    if (bankStatus !== "ACSC") {
      // Bank rejected or timed out — fail the intent, increment breaker stats.
      await supabase.from("transaction_intents").update({
        state: "FAILED",
        last_error: `bank:${bankStatus}:${bankRejection ?? ""}`,
        completed_at: new Date().toISOString(),
      }).eq("id", intent.id);
      await logEvent("bank.rejected", "IN_FLIGHT", "FAILED", {
        status: bankStatus, reason: bankRejection, latency_ms: callLatency,
      });
      if (bankConn) {
        const newFails = bankConn.failure_count + 1;
        const open = newFails >= 5;
        await supabase.from("bank_connectors").update({
          failure_count: newFails,
          last_failure_at: new Date().toISOString(),
          circuit_state: open ? "OPEN" : bankConn.circuit_state,
          opened_at: open ? new Date().toISOString() : bankConn.opened_at,
        }).eq("id", bankConn.id);
      }
      await supabase.from("trace_spans").insert({
        trace_id, span_id: newId(), service: "switch", operation: "pacs008_send",
        status: "error", duration_ms: callLatency,
        attributes: { bank: body.payee_bank, reason: bankRejection },
      });
      return new Response(JSON.stringify({
        ok: false, trace_id, intent_id: intent.id, state: "FAILED",
        bank_status: bankStatus, reason: bankRejection,
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // DEBITED — bank accepted
    await supabase.from("transaction_intents").update({ state: "DEBITED" }).eq("id", intent.id);
    await logEvent("debit.confirmed", "IN_FLIGHT", "DEBITED", {
      latency_ms: callLatency, bank_reference: bankRef,
    });

    // ── Pattern 3: Hot-account sharding. Pick a shard for the payee account.
    const shardNo = hashShard(body.idempotency_key);
    const { data: shard } = await supabase
      .from("position_ledger_shards")
      .select("*")
      .eq("account_identifier", body.payee_identifier)
      .eq("shard_no", shardNo).maybeSingle();

    if (shard) {
      await supabase.from("position_ledger_shards").update({
        balance: Number(shard.balance) + Number(body.amount),
        credit_count: shard.credit_count + 1,
        updated_at: new Date().toISOString(),
      }).eq("id", shard.id);
    } else {
      await supabase.from("position_ledger_shards").insert({
        account_identifier: body.payee_identifier,
        shard_no: shardNo, balance: body.amount, credit_count: 1,
      });
    }

    await supabase.from("transaction_intents").update({
      state: "COMPLETED", completed_at: new Date().toISOString(),
    }).eq("id", intent.id);
    await logEvent("credit.confirmed", "DEBITED", "COMPLETED", { shard: shardNo });

    // Update velocity counter
    await supabase.from("velocity_counters").upsert({
      subject: body.payer_identifier, bucket: "1m",
      window_start: windowStart, count: velCount, total_amount: velAmt,
    }, { onConflict: "subject,bucket,window_start" });

    // Bank connector latency stats + close half-open circuit
    if (bankConn) {
      await supabase.from("bank_connectors").update({
        success_count: bankConn.success_count + 1,
        circuit_state: "CLOSED", failure_count: 0,
      }).eq("id", bankConn.id);
    }

    // ── Pattern 8: Root trace span
    const total = Date.now() - startedAt;
    await supabase.from("trace_spans").insert({
      trace_id, span_id: newId(), service: "switch", operation: "process_intent",
      status: "ok", duration_ms: total,
      attributes: { amount: body.amount, rail: body.rail, bank: body.payee_bank, shard: shardNo },
    });

    return new Response(JSON.stringify({
      ok: true, trace_id, intent_id: intent.id, state: "COMPLETED",
      latency_ms: total, shard: shardNo,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
