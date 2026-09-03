// mc-card-link — Mastercard card linking (MPGS Hosted Session + VERIFY/3DS + MDES token
// + STANDING_INSTRUCTION agreement) and sweep-mandate creation.
//
// PCI DSS scope: this function NEVER receives a PAN, expiry or CVV. Those fields are
// submitted by the browser straight to the gateway's hosted-session endpoint
// (Mastercard checkout.js in production, mpgs-gateway-sim here). This function only
// ever handles a session id / masked summary — keeping Rukisha at SAQ A.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GATEWAY_URL = `${SUPABASE_URL}/functions/v1/mpgs-gateway-sim`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function gateway(payload: Record<string, unknown>) {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

const POLICIES = new Set(["FULL_SALARY", "EMI_ONLY", "PERCENTAGE"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    // ── 1. Create the hosted session. Only session.id goes to the browser.
    if (action === "create_session") {
      const g = await gateway({ operation: "session.create" });
      if (g.result !== "SUCCESS") return json({ error: "gateway_session_failed", detail: g }, 502);
      return json({
        session_id: g.session.id,
        hosted_capture_url: GATEWAY_URL,
        pci_scope: "SAQ_A — card fields are rendered and submitted by the gateway; Rukisha never receives PAN/CVV",
      });
    }

    // ── 2. Confirm: VERIFY + 3DS, create MDES token + STANDING_INSTRUCTION agreement, persist.
    if (action === "confirm_link") {
      const sessionId = String(body.session_id ?? "");
      const sessionBlob = body.session_blob as string | undefined;
      if (!sessionId) return json({ error: "session_id required" }, 400);

      const verify = await gateway({ operation: "verify", sessionId, sessionBlob });
      if (verify.result !== "SUCCESS") {
        return json({
          error: "verification_declined",
          gateway_code: verify?.response?.gatewayCode ?? "DECLINED",
          three_ds: verify?.authentication?.status ?? "AUTHENTICATION_FAILED",
        }, 402);
      }

      const tok = await gateway({ operation: "token.create", sessionId, sessionBlob });
      if (tok.result !== "SUCCESS") return json({ error: "tokenization_failed", detail: tok }, 502);

      const card = tok.sourceOfFunds?.provided?.card ?? {};
      const { data: linked, error: linkErr } = await admin.from("linked_cards").insert({
        user_id: user.id,
        mc_token_ref: tok.token,
        mdes_token_id: tok.mdes?.tokenUniqueReference ?? null,
        mpgs_agreement_id: tok.agreement?.id ?? null,
        scheme: card.scheme ?? "MASTERCARD",
        masked_pan: card.number ?? `xxxx${card.last4 ?? "0000"}`,
        cardholder_name: card.nameOnCard ?? null,
        expiry_month: card.expiry?.month ?? null,
        expiry_year: card.expiry?.year ?? null,
        issuer_country: body.issuer_country ?? null,
        three_ds_status: verify.authentication?.status ?? null,
        verify_gateway_code: verify.response?.gatewayCode ?? null,
        status: "ACTIVE",
      }).select().single();
      if (linkErr) return json({ error: linkErr.message }, 400);

      // Mandate (standing instruction the customer consented to)
      const policy = POLICIES.has(String(body.policy)) ? String(body.policy) : "EMI_ONLY";
      const percentage = Math.min(100, Math.max(1, Number(body.percentage ?? 20)));
      const capAmount = Math.max(0, Number(body.cap_amount ?? 50000));

      // Attach to the customer's active loan, creating a demo obligation if none exists.
      let { data: loan } = await admin.from("loan_accounts")
        .select("id").eq("user_id", user.id).eq("status", "ACTIVE").maybeSingle();
      if (!loan && body.create_demo_loan !== false) {
        const { data: created } = await admin.from("loan_accounts").insert({
          user_id: user.id, principal: 180000, outstanding_balance: 180000, emi_amount: 15000, due_day: 25,
        }).select("id").single();
        loan = created;
      }

      const consentText =
        `I authorise Equity Bank (Rukisha) to debit my ${card.scheme ?? "Mastercard"} ending ${card.last4 ?? "****"} ` +
        `on each detected salary credit under a Mastercard standing instruction, applying ` +
        `${policy === "FULL_SALARY" ? "the full salary credit" : policy === "PERCENTAGE" ? `${percentage}% of the credit` : "my monthly instalment"} ` +
        `to my loan, capped at KES ${capAmount.toLocaleString()} per debit. I may pause or cancel this mandate at any time.`;

      const { data: mandate, error: mErr } = await admin.from("sweep_mandates").insert({
        user_id: user.id,
        linked_card_id: linked.id,
        loan_account_id: loan?.id ?? null,
        policy, percentage, cap_amount: capAmount,
        debit_window: String(body.debit_window ?? "SAME_DAY"),
        consent_text: consentText,
        consented_at: new Date().toISOString(),
        status: "ACTIVE",
      }).select().single();
      if (mErr) return json({ error: mErr.message }, 400);

      await admin.from("nudge_log").insert({
        user_id: user.id, event_type: "MANDATE_ACTIVATED", channel: "IN_APP",
        message: `Salary-day sweep is live on your ${card.scheme ?? "Mastercard"} ending ${card.last4}. We'll apply your loan repayment automatically the day your salary lands.`,
        payload: { mandate_id: mandate.id },
      });

      return json({
        ok: true,
        card: {
          id: linked.id, scheme: linked.scheme, masked_pan: linked.masked_pan,
          expiry: `${String(linked.expiry_month ?? "").padStart(2, "0")}/${String(linked.expiry_year ?? "").slice(-2)}`,
        },
        token: { mpgs_token_ref: linked.mc_token_ref, mdes_token_id: linked.mdes_token_id, agreement_id: linked.mpgs_agreement_id },
        authentication: verify.authentication,
        mandate,
        pci_scope: "SAQ_A — only the token reference and masked PAN are persisted",
      });
    }

    // ── 3. Mandate lifecycle (CBK: revocable consent, must always be pausable)
    if (action === "update_mandate") {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.status && ["ACTIVE", "PAUSED", "CANCELLED"].includes(String(body.status))) patch.status = body.status;
      if (body.policy && POLICIES.has(String(body.policy))) patch.policy = body.policy;
      if (body.percentage != null) patch.percentage = Math.min(100, Math.max(1, Number(body.percentage)));
      if (body.cap_amount != null) patch.cap_amount = Math.max(0, Number(body.cap_amount));
      const { data, error } = await userClient.from("sweep_mandates")
        .update(patch).eq("id", String(body.mandate_id)).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, mandate: data });
    }

    return json({ error: `unknown action ${action}` }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
