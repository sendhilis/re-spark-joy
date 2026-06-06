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
  payer_bank?: string;         // originating bank code (e.g. GAB)
  payee_identifier: string;    // Paybill or Till number
  payee_bank?: string;
  amount: number;
  currency?: string;
  rail?: string;
  trace_id?: string;
}

// ── MSISDN masking helpers (FTS v3.0 §2.5 — minimum-necessary-data).
//    HMAC-SHA256(secret, msisdn|date) → stable token used for idempotency / velocity.
//    The raw MSISDN is wrapped in an HSM cipher_ref (decryptable only by the
//    originating bank); only a masked-visible form is exposed in cross-bank views.
async function hmacToken(secret: string, msisdn: string): Promise<string> {
  const enc = new TextEncoder();
  const date = new Date().toISOString().slice(0, 10);
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${msisdn}|${date}`));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `tok_${hex.slice(0, 24)}`;
}
function maskMsisdn(msisdn: string): string {
  if (!msisdn || msisdn.length < 4) return "XXXX";
  return msisdn.slice(0, 4) + "X".repeat(Math.max(0, msisdn.length - 6)) + msisdn.slice(-2);
}
async function cipherRef(secret: string, msisdn: string): Promise<string> {
  // Demo placeholder: SHA-256(secret|msisdn) → opaque cipher reference.
  // Real deployment hands msisdn to an HSM and stores the returned ciphertext blob.
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`${secret}|${msisdn}`));
  const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `enc:aes256gcm:${hex.slice(0, 32)}`;
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

    // ── Resolve originating-bank masking policy. GAB-style banks demand the
    //    payer MSISDN never crosses to the terminating bank. We compute the
    //    HMAC token + masked + cipher-ref ONCE, here, before persistence.
    let maskingApplied = false;
    let maskingSecretRef: string | null = null;
    let payerToken: string | null = null;
    let payerVisible: string | null = null;
    let payerCipher: string | null = null;
    if (body.payer_bank) {
      const { data: payerBankRow } = await supabase
        .from("participating_banks")
        .select("msisdn_masking_enabled,masking_secret_ref")
        .eq("bank_code", body.payer_bank).maybeSingle();
      if (payerBankRow?.msisdn_masking_enabled) {
        maskingApplied = true;
        maskingSecretRef = payerBankRow.masking_secret_ref ?? `hsm:${body.payer_bank}:msisdn:v1`;
        const secret = `${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "lipafo"}::${maskingSecretRef}`;
        payerToken = await hmacToken(secret, body.payer_identifier);
        payerVisible = maskMsisdn(body.payer_identifier);
        payerCipher = await cipherRef(secret, body.payer_identifier);
      }
    }

    // ── Insert intent in NEW state, then drive FSM and append events.
    //    UNIQUE(idempotency_key) makes this race-safe.
    const { data: intent, error: insErr } = await supabase
      .from("transaction_intents").insert({
        idempotency_key: body.idempotency_key,
        trace_id,
        // Persist the masked-visible form when masking is on; otherwise raw.
        payer_identifier: maskingApplied ? (payerVisible ?? body.payer_identifier) : body.payer_identifier,
        payer_bank: body.payer_bank ?? null,
        payer_token: payerToken,
        payer_msisdn_encrypted: payerCipher,
        payer_msisdn_visible: payerVisible,
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

    await logEvent("intent.received", null, "NEW", { amount: body.amount, masking_applied: maskingApplied });

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
          .select("pacs008_endpoint,timeout_ms,hmac_key_ref,is_active,environment")
          .eq("bank_id", bankRow.id).eq("is_active", true).maybeSingle();
        if (profile?.pacs008_endpoint) baseUrl = profile.pacs008_endpoint;
        if (profile?.timeout_ms) timeoutMs = profile.timeout_ms;
      }
    }
    if (!baseUrl) {
      baseUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/bank-simulator`;
    }

    // ── OAuth2 token (Daraja-pattern). Cached per-bank with TTL.
    const accessToken = await getBankToken(body.payee_bank ?? "DEFAULT", baseUrl, clientId, clientSecret);

    // ── Daraja-style payment initiate (debit leg) — payload sent to TERMINATING bank.
    //    When masking is on, payer_msisdn is STRIPPED. The terminating bank only
    //    sees a payer_token + the originating bank code. They can credit the
    //    merchant without ever learning the payer's number.
    const terminatingPayload: Record<string, unknown> = {
      intent_key: body.idempotency_key,
      paybill_or_till: body.payee_identifier,
      amount: body.amount,
      currency: body.currency ?? "KES",
      intent_id: intent.id,
      payer_bank: body.payer_bank ?? null,
    };
    if (maskingApplied) {
      terminatingPayload.payer_token = payerToken;
      terminatingPayload.payer_msisdn = null; // explicit absence for auditability
      terminatingPayload.masking_policy = "FTS-v3.0-MSISDN-MASK";
    } else {
      terminatingPayload.payer_msisdn = body.payer_identifier;
    }
    const initiateBody = JSON.stringify(terminatingPayload);


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

    // ── Cross-bank payload audit (proof artefact for masking compliance).
    //    Captures: what the originating bank sent, what Lipafo stored,
    //    and what the terminating bank actually received.
    const originatingPayload = {
      intent_key: body.idempotency_key,
      payer_msisdn: body.payer_identifier,
      payer_bank: body.payer_bank ?? null,
      paybill_or_till: body.payee_identifier,
      amount: body.amount,
      currency: body.currency ?? "KES",
    };
    const switchStoredPayload = {
      intent_id: intent.id,
      payer_bank: body.payer_bank ?? null,
      payer_token: payerToken,
      payer_msisdn_visible: payerVisible,
      payer_msisdn_encrypted: payerCipher,
      masking_secret_ref: maskingSecretRef,
      payee_bank: body.payee_bank ?? null,
      payee_identifier: body.payee_identifier,
      amount: body.amount,
    };
    const merchantReceipt = `KES ${Number(body.amount).toLocaleString()} received via LipafoPay. Ref: ${bankRef ?? intent.id}.`;
    await supabase.from("bank_payload_audit").insert({
      intent_id: intent.id,
      trace_id,
      originating_bank: body.payer_bank ?? "UNKNOWN",
      terminating_bank: body.payee_bank ?? "UNKNOWN",
      masking_applied: maskingApplied,
      originating_payload: originatingPayload,
      switch_stored_payload: switchStoredPayload,
      terminating_payload: terminatingPayload,
      merchant_receipt_text: merchantReceipt,
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
