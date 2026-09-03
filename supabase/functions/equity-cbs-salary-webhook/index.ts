// equity-cbs-salary-webhook — inbound payroll-credit notification from Equity's core
// banking system (ISO 20022 camt.054-style credit notification or internal ESB event).
//
// Security: HMAC-SHA256 signature over the raw body using EQUITY_CBS_WEBHOOK_SECRET
// (mTLS terminates upstream in production). Payloads carry personal financial data, so
// nothing beyond amount / currency / value date / reference is retained.
//
// On accept: writes a salary_credit_events row, fires a "salary landed" nudge, and
// invokes mc-sweep-orchestrator. Duplicate references are ignored (idempotent ingest).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SECRET = Deno.env.get("EQUITY_CBS_WEBHOOK_SECRET");
const FX_AED_KES = Number(Deno.env.get("FX_AED_KES") ?? 35.2);
const FX_USD_KES = Number(Deno.env.get("FX_USD_KES") ?? 129);

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function verifySignature(raw: string, header: string | null): Promise<boolean> {
  if (!SECRET) return true; // pilot mode: signature enforced once Equity issues the secret
  if (!header) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const given = header.replace(/^sha256=/, "").toLowerCase();
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

const toKes = (amount: number, currency: string) =>
  currency === "KES" ? amount : currency === "AED" ? amount * FX_AED_KES : currency === "USD" ? amount * FX_USD_KES : amount;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const raw = await req.text();
    if (!(await verifySignature(raw, req.headers.get("x-cbs-signature")))) return json({ error: "invalid_signature" }, 401);

    const payload = JSON.parse(raw || "{}");
    const userId = String(payload.user_id ?? payload.customer_id ?? "");
    const amount = Number(payload.amount ?? payload.credit_amount ?? 0);
    const currency = String(payload.currency ?? "AED").toUpperCase();
    const source = ["WEBHOOK", "BATCH", "MANUAL"].includes(String(payload.source)) ? String(payload.source) : "WEBHOOK";
    const reference = String(payload.reference ?? payload.raw_reference ?? `CBS-${crypto.randomUUID().slice(0, 8)}`);

    if (!userId || !(amount > 0)) return json({ error: "user_id and a positive amount are required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Idempotent ingest on the CBS reference
    const { data: existing } = await admin.from("salary_credit_events")
      .select("id").eq("user_id", userId).eq("raw_reference", reference).maybeSingle();
    if (existing) return json({ ok: true, duplicate: true, salary_credit_event_id: existing.id });

    const amountKes = Math.round(toKes(amount, currency) * 100) / 100;
    const { data: event, error } = await admin.from("salary_credit_events").insert({
      user_id: userId, amount, currency, amount_kes: amountKes,
      value_date: payload.value_date ?? new Date().toISOString().slice(0, 10),
      source, raw_reference: reference,
    }).select().single();
    if (error) return json({ error: error.message }, 400);

    // Nudge BEFORE the sweep so the debit isn't a surprise (AI dispatcher, content-only).
    await admin.from("nudge_log").insert({
      user_id: userId, event_type: "SALARY_LANDED", channel: "IN_APP",
      message: `Your ${currency} salary just landed (${currency} ${amount.toLocaleString()} ≈ KES ${amountKes.toLocaleString()}). Rukisha will apply your loan repayment shortly — reply to change the amount.`,
      payload: { salary_credit_event_id: event.id },
    });

    // Hand off to the orchestrator (the only component that moves money).
    const sweep = await fetch(`${SUPABASE_URL}/functions/v1/mc-sweep-orchestrator`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
      body: JSON.stringify({ salary_credit_event_id: event.id }),
    }).then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));

    return json({ ok: true, salary_credit_event_id: event.id, sweep });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
