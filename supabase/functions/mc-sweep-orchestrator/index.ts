// mc-sweep-orchestrator — turns a salary_credit_event into an idempotent
// Mastercard MPGS PAY (MERCHANT_INITIATED_TRANSACTION against a stored token under a
// STANDING_INSTRUCTION agreement), then an ATOMIC wallet-credit + loan-repayment posting.
//
// Money movement lives here and only here. No LLM is in the payment path.
// Idempotency: deterministic key (salary_credit_event.id | mandate.id | attempt) is
// written BEFORE the gateway call, so a duplicated CBS notification can never double-sweep.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GATEWAY_URL = `${SUPABASE_URL}/functions/v1/mpgs-gateway-sim`;
const FX_AED_KES = Number(Deno.env.get("FX_AED_KES") ?? 35.2);
const FX_USD_KES = Number(Deno.env.get("FX_USD_KES") ?? 129);
const MAX_ATTEMPTS = 3;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const toKes = (amount: number, currency: string) =>
  currency === "KES" ? amount : currency === "AED" ? amount * FX_AED_KES : currency === "USD" ? amount * FX_USD_KES : amount;

async function gateway(payload: Record<string, unknown>) {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

type Admin = ReturnType<typeof createClient>;

async function processEvent(admin: Admin, event: Record<string, any>) {
  const amountKes = Number(event.amount_kes ?? toKes(Number(event.amount), String(event.currency ?? "KES")));

  const { data: mandate } = await admin.from("sweep_mandates")
    .select("*, linked_cards(*)").eq("user_id", event.user_id).eq("status", "ACTIVE")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (!mandate) {
    await admin.from("salary_credit_events").update({ processed: true }).eq("id", event.id);
    await admin.from("nudge_log").insert({
      user_id: event.user_id, event_type: "NO_MANDATE", channel: "IN_APP",
      message: `Your salary of ${event.currency} ${Number(event.amount).toLocaleString()} landed, but no salary-day sweep is set up. Link your Mastercard salary card to repay your loan automatically.`,
      payload: { salary_credit_event_id: event.id },
    });
    return { event_id: event.id, status: "SKIPPED", reason: "no_active_mandate" };
  }

  const card = mandate.linked_cards as Record<string, any> | null;
  if (!card || card.status !== "ACTIVE") {
    await admin.from("salary_credit_events").update({ processed: true }).eq("id", event.id);
    await admin.from("nudge_log").insert({
      user_id: event.user_id, event_type: "CARD_INACTIVE", channel: "IN_APP",
      message: "We couldn't collect your loan repayment — your linked salary card is no longer active. Re-link your card to resume automatic repayments.",
      payload: { mandate_id: mandate.id },
    });
    return { event_id: event.id, status: "FAILED", reason: "card_inactive" };
  }

  // Loan + policy → sweep amount, capped.
  const { data: loan } = mandate.loan_account_id
    ? await admin.from("loan_accounts").select("*").eq("id", mandate.loan_account_id).maybeSingle()
    : { data: null as Record<string, any> | null };

  const emi = Number(loan?.emi_amount ?? 0);
  const outstanding = Number(loan?.outstanding_balance ?? 0);
  let sweep = mandate.policy === "FULL_SALARY"
    ? amountKes
    : mandate.policy === "PERCENTAGE"
      ? amountKes * (Number(mandate.percentage) / 100)
      : emi;
  sweep = Math.min(sweep, Number(mandate.cap_amount), amountKes);
  if (outstanding > 0) sweep = Math.min(sweep, outstanding);
  sweep = Math.round(sweep * 100) / 100;

  if (!(sweep > 0)) {
    await admin.from("salary_credit_events").update({ processed: true }).eq("id", event.id);
    return { event_id: event.id, status: "SKIPPED", reason: "nothing_due" };
  }

  // Existing attempts (retry ladder, max 3)
  const { data: prior } = await admin.from("sweep_executions")
    .select("id, status, attempt_number").eq("salary_credit_event_id", event.id).order("attempt_number", { ascending: false });
  if (prior?.some((p) => p.status === "SUCCESS")) {
    await admin.from("salary_credit_events").update({ processed: true }).eq("id", event.id);
    return { event_id: event.id, status: "ALREADY_SWEPT" };
  }
  const attempt = (prior?.[0]?.attempt_number ?? 0) + 1;
  if (attempt > MAX_ATTEMPTS) {
    await admin.from("salary_credit_events").update({ processed: true }).eq("id", event.id);
    return { event_id: event.id, status: "EXHAUSTED" };
  }

  const idempotencyKey = `${event.id}|${mandate.id}|${attempt}`;
  const { data: exec, error: execErr } = await admin.from("sweep_executions").insert({
    user_id: event.user_id, salary_credit_event_id: event.id, mandate_id: mandate.id,
    idempotency_key: idempotencyKey, amount: sweep, currency: "KES", attempt_number: attempt, status: "PENDING",
  }).select().single();
  if (execErr) return { event_id: event.id, status: "DUPLICATE", reason: execErr.message };

  // MPGS PAY — MIT against the stored token under the standing instruction.
  const pay = await gateway({
    operation: "pay",
    token: card.mc_token_ref,
    mdesTokenId: card.mdes_token_id,
    agreementId: card.mpgs_agreement_id,
    transactionSource: "MERCHANT_INITIATED_TRANSACTION",
    recurringPaymentSequenceIndicator: "SUBSEQUENT",
    amount: sweep, currency: "KES", idempotencyKey,
  });
  const gatewayCode = pay?.response?.gatewayCode ?? "UNKNOWN";

  if (pay.result === "SUCCESS") {
    await admin.from("sweep_executions").update({
      status: "SUCCESS", mpgs_order_id: pay.order?.id ?? null, mpgs_transaction_id: pay.transaction?.id ?? null,
      mc_response_code: pay.response?.acquirerCode ?? null, gateway_code: gatewayCode,
    }).eq("id", exec.id);

    const { data: posting } = await admin.rpc("apply_sweep_posting", {
      _execution_id: exec.id,
      _user_id: event.user_id,
      _amount: sweep,
      _loan_account_id: mandate.loan_account_id,
      _description: `Salary-day sweep from ${card.scheme} ${card.masked_pan} (MPGS MIT ${pay.transaction?.id ?? ""})`,
    });

    await admin.from("salary_credit_events").update({ processed: true, amount_kes: amountKes }).eq("id", event.id);
    const repaid = Number((posting as any)?.repaid ?? 0);
    const newBalance = Number((posting as any)?.new_loan_balance ?? outstanding - repaid);
    await admin.from("nudge_log").insert({
      user_id: event.user_id, event_type: "SWEEP_SUCCESS", channel: "IN_APP",
      message: `Repayment applied: KES ${repaid.toLocaleString()} collected from your ${card.scheme} ending ${String(card.masked_pan).slice(-4)} and posted to your loan. New balance: KES ${newBalance.toLocaleString()}.`,
      payload: { execution_id: exec.id, amount: sweep, new_loan_balance: newBalance },
    });
    return { event_id: event.id, execution_id: exec.id, status: "SUCCESS", amount: sweep, repaid, new_loan_balance: newBalance };
  }

  // Declines: record, schedule capped retry, nudge with a manual fallback.
  const stepUp = gatewayCode === "AUTHENTICATION_REQUIRED";
  await admin.from("sweep_executions").update({
    status: "FAILED", gateway_code: gatewayCode, mc_response_code: pay?.response?.acquirerCode ?? null,
    failure_reason: stepUp ? "issuer_step_up_required" : gatewayCode.toLowerCase(),
  }).eq("id", exec.id);

  if (attempt >= MAX_ATTEMPTS) await admin.from("salary_credit_events").update({ processed: true }).eq("id", event.id);

  await admin.from("nudge_log").insert({
    user_id: event.user_id, event_type: stepUp ? "SWEEP_REAUTH_REQUIRED" : "SWEEP_FAILED", channel: "IN_APP",
    message: stepUp
      ? "Your bank needs you to re-authorise the card before we can collect your loan repayment. Tap to re-verify with 3-D Secure."
      : `We couldn't collect KES ${sweep.toLocaleString()} from your salary card (${gatewayCode.replace(/_/g, " ").toLowerCase()}). We'll retry, or you can top up manually now.`,
    payload: { execution_id: exec.id, gateway_code: gatewayCode, attempt, next_retry: attempt < MAX_ATTEMPTS ? (stepUp ? "after_reauth" : "+4h") : "none" },
  });

  return { event_id: event.id, execution_id: exec.id, status: "FAILED", gateway_code: gatewayCode, attempt };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));

    let events: Record<string, any>[] = [];
    if (body.salary_credit_event_id) {
      const { data } = await admin.from("salary_credit_events").select("*").eq("id", body.salary_credit_event_id).maybeSingle();
      if (data) events = [data];
    } else {
      // pg_cron / manual safety-net scan of unresolved events
      const { data } = await admin.from("salary_credit_events")
        .select("*").eq("processed", false).order("created_at", { ascending: true }).limit(50);
      events = data ?? [];
    }

    const results = [];
    for (const e of events) results.push(await processEvent(admin, e));
    return json({ ok: true, processed: results.length, results });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
