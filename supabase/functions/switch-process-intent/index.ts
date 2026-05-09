// LipafoPay Switch — reference processor (FTS v3.0).
// Bank protocol: REST/JSON Daraja-pattern (OAuth2 Bearer + intent-key headers).
// ISO 20022 / pacs.008 / HMAC has been removed entirely per FTS v3.0 §2.3.
//
// Patterns demonstrated: idempotency, FSM, event sourcing, sharded ledger,
// circuit breaker, network-level structural limits (no AML — banks own that),
// distributed tracing.
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
  idempotency_key: string;     // == X-Lipafo-Intent-Key (UUID v4)
  payer_identifier: string;    // payer MSISDN or account
  payee_identifier: string;    // Paybill or Till number
  payee_bank?: string;
  amount: number;
  currency?: string;
  rail?: string;
  trace_id?: string;
}

// Per-bank OAuth2 token cache. Tokens TTL ~1h; we refresh slightly early.
interface CachedToken { token: string; expires_at: number }
const tokenCache = new Map<string, CachedToken>();

async function getBankToken(
  bankCode: string,
  baseUrl: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const cached = tokenCache.get(bankCode);
  if (cached && cached.expires_at - 30_000 > Date.now()) return cached.token;

  const tokenUrl = `${baseUrl.replace(/\/$/, "")}/lipafo/auth/token`;
  const basic = btoa(`${clientId}:${clientSecret}`);
  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
      "Content-Type": "application/json",
      // Bank-simulator runs on Supabase, so we still need the platform auth.
      "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  if (!resp.ok) {
    // Fallback for the pilot: use the shared secret directly as a Bearer.
    return clientSecret;
  }
  const j = await resp.json().catch(() => ({} as any));
  const token = j.access_token ?? clientSecret;
  const ttl = (Number(j.expires_in) || 3600) * 1000;
  tokenCache.set(bankCode, { token, expires_at: Date.now() + ttl });
  return token;
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

    // ── C1: Idempotency. Same intent_key => return existing intent.
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

    // ── C4: Circuit breaker — refuse if downstream bank is OPEN.
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

    // ── C5 (v3.0): Network-level structural cap only. AML/fraud is the bank's job.
    if (Number(body.amount) > 10_000_000) {
      await supabase.from("trace_spans").insert({
        trace_id, span_id: newId(), service: "switch", operation: "structural_cap",
        status: "rejected", duration_ms: 1,
        attributes: { reason: "amount_above_network_cap", amount: body.amount },
      });
      return new Response(JSON.stringify({
        error: "amount_above_network_cap",
        ResultCode: 400, ResultDesc: "Amount exceeds Lipafo network structural cap",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Insert intent in NEW state, then drive FSM and append events.
    //    UNIQUE(idempotency_key) makes this race-safe.
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
    if (insErr) {
      if ((insErr as any).code === "23505") {
        const { data: dup } = await supabase.from("transaction_intents")
          .select("*").eq("idempotency_key", body.idempotency_key).maybeSingle();
        if (dup) {
          return new Response(JSON.stringify({ replayed: true, intent: dup }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      throw insErr;
    }

    const logEvent = async (event_type: string, from_state: string | null, to_state: string | null, payload: any = {}) => {
      await supabase.from("switch_events").insert({
        intent_id: intent.id, trace_id, span_id: newId(),
        event_type, from_state, to_state, payload,
      });
    };

    await logEvent("intent.received", null, "NEW", { amount: body.amount });

    // Move to IN_FLIGHT
    await supabase.from("transaction_intents").update({ state: "IN_FLIGHT" }).eq("id", intent.id);
    await logEvent("intent.authorized", "NEW", "IN_FLIGHT");

    // ── Look up the bank's Daraja-style integration profile.
    let baseUrl: string | null = null;
    let timeoutMs = 8000;  // FTS v3.0 §5: 8s hard timeout on credit leg
    let clientId = Deno.env.get("BANK_SIM_CLIENT_ID") ?? "lipafo-pilot-client";
    let clientSecret = Deno.env.get("BANK_SIM_CLIENT_SECRET") ?? "lipafo-pilot-secret";
    if (body.payee_bank) {
      const { data: bankRow } = await supabase
        .from("participating_banks").select("id").eq("bank_code", body.payee_bank).maybeSingle();
      if (bankRow?.id) {
        const { data: profile } = await supabase
          .from("bank_integration_profiles")
          // pacs008_endpoint column re-purposed as the bank's Daraja base URL during pilot.
          .select("pacs008_endpoint,timeout_ms,hmac_key_ref,is_active,environment")
          .eq("bank_id", bankRow.id).eq("is_active", true).maybeSingle();
        if (profile?.pacs008_endpoint) baseUrl = profile.pacs008_endpoint;
        if (profile?.timeout_ms) timeoutMs = profile.timeout_ms;
      }
    }
    // Default to bank simulator if no endpoint configured (pilot behaviour).
    if (!baseUrl) {
      baseUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/bank-simulator`;
    }

    // ── OAuth2 token (Daraja-pattern). Cached per-bank with TTL.
    const accessToken = await getBankToken(body.payee_bank ?? "DEFAULT", baseUrl, clientId, clientSecret);

    // ── Daraja-style payment initiate (debit leg).
    const initiateBody = JSON.stringify({
      intent_key: body.idempotency_key,
      payer_msisdn: body.payer_identifier,
      paybill_or_till: body.payee_identifier,
      amount: body.amount,
      currency: body.currency ?? "KES",
      intent_id: intent.id,
    });

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const callStart = Date.now();
    let resultCode = -1;
    let resultDesc = "no_response";
    let bankRef: string | null = null;
    try {
      const resp = await fetch(`${baseUrl.replace(/\/$/, "")}/lipafo/payment/initiate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          "X-Lipafo-Intent-Key": body.idempotency_key,
          "X-Lipafo-Timestamp": new Date().toISOString(),
          "X-Lipafo-Bank-Code": body.payee_bank ?? "UNKNOWN",
          "X-Lipafo-Trace-Id": trace_id,
          // Bank simulator runs on Supabase platform, so include service auth.
          "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        },
        body: initiateBody,
        signal: ctrl.signal,
      });
      const respJson = await resp.json().catch(() => ({} as any));
      resultCode = Number(respJson.ResultCode ?? (resp.ok ? 0 : 1));
      resultDesc = String(respJson.ResultDesc ?? (resp.ok ? "ok" : "bank_error"));
      bankRef = respJson.bank_reference ?? null;
    } catch (e) {
      resultCode = 504;
      resultDesc = (e as Error).name === "AbortError" ? "timeout" : (e as Error).message;
    } finally {
      clearTimeout(t);
    }
    const callLatency = Date.now() - callStart;

    if (resultCode !== 0) {
      // Bank rejected or timed out.
      await supabase.from("transaction_intents").update({
        state: "FAILED",
        last_error: `bank:ResultCode=${resultCode}:${resultDesc}`,
        completed_at: new Date().toISOString(),
      }).eq("id", intent.id);
      await logEvent("intent.failed", "IN_FLIGHT", "FAILED", {
        ResultCode: resultCode, ResultDesc: resultDesc, latency_ms: callLatency,
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
        trace_id, span_id: newId(), service: "switch", operation: "daraja_initiate",
        status: "error", duration_ms: callLatency,
        attributes: { bank: body.payee_bank, ResultCode: resultCode, ResultDesc: resultDesc },
      });
      return new Response(JSON.stringify({
        ok: false, trace_id, intent_id: intent.id, state: "FAILED",
        ResultCode: resultCode, ResultDesc: resultDesc,
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // DEBITED — bank accepted (Daraja ResultCode=0).
    await supabase.from("transaction_intents").update({ state: "DEBITED" }).eq("id", intent.id);
    await logEvent("debit.posted", "IN_FLIGHT", "DEBITED", {
      latency_ms: callLatency, bank_reference: bankRef,
    });

    // ── C3: Hot-account sharding for the credit-side position ledger.
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

    // Bank connector latency stats + close half-open circuit
    if (bankConn) {
      await supabase.from("bank_connectors").update({
        success_count: bankConn.success_count + 1,
        circuit_state: "CLOSED", failure_count: 0,
      }).eq("id", bankConn.id);
    }

    const total = Date.now() - startedAt;
    await supabase.from("trace_spans").insert({
      trace_id, span_id: newId(), service: "switch", operation: "process_intent",
      status: "ok", duration_ms: total,
      attributes: { amount: body.amount, rail: body.rail, bank: body.payee_bank, shard: shardNo, protocol: "daraja-rest" },
    });

    return new Response(JSON.stringify({
      ok: true, trace_id, intent_id: intent.id, state: "COMPLETED",
      ResultCode: 0, ResultDesc: "Success",
      bank_reference: bankRef, latency_ms: total, shard: shardNo,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
