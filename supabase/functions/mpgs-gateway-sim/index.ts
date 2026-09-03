// MPGS / MDES Gateway Simulator — stands in for Mastercard Payment Gateway Services
// and the Mastercard Digital Enablement Service until the real MTF credentials
// (MPGS merchant id + API password, MDES TRID) are issued.
//
// PCI DSS NOTE (SAQ A intent):
//   This function represents the *Mastercard side* of the hosted session boundary.
//   In production it is replaced by Mastercard's own hosted-session endpoint and
//   checkout.js iframe. It therefore MUST behave exactly like the real gateway:
//     - PAN / CVV are accepted only inside `session.update`
//     - PAN / CVV are NEVER persisted, NEVER logged, NEVER returned
//     - Only a masked summary + opaque token reference leaves this boundary
//
// Operations implemented (mirroring MPGS REST verbs):
//   session.create  -> { session: { id } }
//   session.update  -> { sourceOfFunds: { provided: { card: { masked summary } } } }
//   verify          -> zero-value account verification + EMV 3DS2 result
//   token.create    -> MPGS token ref + (simulated) MDES network token id
//   pay             -> authorize+capture, MIT / STANDING_INSTRUCTION aware
//   refund          -> reversal of an over-sweep or duplicate sweep
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Json = Record<string, unknown>;

const sessions = new Map<string, Json>(); // ephemeral, in-memory only

const luhnOk = (pan: string) => {
  let sum = 0, dbl = false;
  for (let i = pan.length - 1; i >= 0; i--) {
    let d = pan.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d; dbl = !dbl;
  }
  return sum % 10 === 0;
};

const schemeOf = (pan: string) => {
  if (/^5[1-5]/.test(pan) || /^2[2-7]/.test(pan)) return "MASTERCARD";
  if (/^4/.test(pan)) return "VISA";
  if (/^3[47]/.test(pan)) return "AMEX";
  return "UNKNOWN";
};

// Sessions are ephemeral in-memory; because edge isolates may differ between calls,
// the gateway also returns an opaque `sessionBlob` (base64 of the MASKED summary only —
// never PAN/CVV) that verify/token.create accept as a fallback. This mirrors the real
// gateway keeping session state on Mastercard's side, not ours.
const encodeBlob = (summary: Json) => btoa(JSON.stringify(summary));
const decodeBlob = (blob?: string): Json | null => {
  try { return blob ? JSON.parse(atob(blob)) as Json : null; } catch { return null; }
};
const loadSummary = (body: Record<string, unknown>): Json | null => {
  const s = sessions.get(String(body.sessionId ?? ""));
  if (s?.summary) return s.summary as Json;
  return decodeBlob(body.sessionBlob as string | undefined);
};

const ref = (p: string) => `${p}-${crypto.randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase()}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: Json, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json();
    const op = String(body.operation ?? "");

    switch (op) {
      case "session.create": {
        const id = `SESSION${crypto.randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase()}`;
        sessions.set(id, { createdAt: Date.now() });
        return json({ result: "SUCCESS", session: { id, updateStatus: "NO_UPDATE", version: "1" } });
      }

      case "session.update": {
        // Hosted-field submit. PAN/CVV live only in this scope.
        const { sessionId, pan, expiryMonth, expiryYear, cvv, cardholderName } = body as Record<string, string>;
        if (!sessionId || !sessions.has(String(sessionId))) return json({ result: "ERROR", error: { cause: "INVALID_REQUEST", explanation: "unknown session" } }, 400);
        const clean = String(pan ?? "").replace(/\D/g, "");
        if (clean.length < 13 || clean.length > 19 || !luhnOk(clean)) {
          return json({ result: "ERROR", error: { cause: "INVALID_REQUEST", explanation: "card number failed checksum" } }, 400);
        }
        if (!/^\d{3,4}$/.test(String(cvv ?? ""))) {
          return json({ result: "ERROR", error: { cause: "INVALID_REQUEST", explanation: "invalid security code" } }, 400);
        }
        const summary = {
          scheme: schemeOf(clean),
          number: `${clean.slice(0, 6)}${"x".repeat(Math.max(0, clean.length - 10))}${clean.slice(-4)}`,
          last4: clean.slice(-4),
          expiry: { month: Number(expiryMonth), year: Number(expiryYear) },
          nameOnCard: cardholderName ?? null,
          fundingMethod: schemeOf(clean) === "MASTERCARD" ? "DEBIT" : "CREDIT",
        };
        // Only the masked summary is retained against the session. PAN/CVV are dropped here.
        sessions.set(String(sessionId), { createdAt: Date.now(), summary });
        return json({ result: "SUCCESS", session: { id: sessionId, updateStatus: "SUCCESS", blob: encodeBlob(summary) }, sourceOfFunds: { provided: { card: summary } } });
      }

      case "verify": {
        const summary = loadSummary(body);
        if (!summary) return json({ result: "ERROR", error: { cause: "INVALID_REQUEST", explanation: "session has no card" } }, 400);
        const declined = String((summary as { last4: string }).last4).endsWith("00"); // test PAN ending 00 => decline
        return json({
          result: declined ? "FAILURE" : "SUCCESS",
          response: { gatewayCode: declined ? "DECLINED" : "APPROVED", acquirerCode: declined ? "05" : "00" },
          authentication: { "3ds": { version: "2.2.0" }, status: declined ? "AUTHENTICATION_FAILED" : "AUTHENTICATION_SUCCESSFUL" },
          transaction: { id: ref("VERIFY"), type: "VERIFICATION", amount: 0 },
          sourceOfFunds: { provided: { card: summary } },
        });
      }

      case "token.create": {
        const summary = loadSummary(body);
        if (!summary) return json({ result: "ERROR", error: { cause: "INVALID_REQUEST", explanation: "session has no card" } }, 400);
        sessions.delete(String(body.sessionId ?? "")); // single-use session, like MPGS
        return json({
          result: "SUCCESS",
          token: ref("MCTOKEN"),
          mdes: { tokenUniqueReference: ref("DWSPMC"), tokenStatus: "ACTIVE", tokenRequestorId: Deno.env.get("MDES_TRID") ?? "SIM-TRID-50120340" },
          agreement: { id: ref("SI"), type: "STANDING_INSTRUCTION", recurringPaymentSequenceIndicator: "FIRST" },
          sourceOfFunds: { provided: { card: summary } },
        });
      }

      case "pay": {
        const { token, amount, currency, idempotencyKey, agreementId } = body as Record<string, string | number>;
        if (!token) return json({ result: "ERROR", error: { cause: "INVALID_REQUEST", explanation: "missing token" } }, 400);
        const amt = Number(amount);
        if (!(amt > 0)) return json({ result: "ERROR", error: { cause: "INVALID_REQUEST", explanation: "invalid amount" } }, 400);

        // Deterministic simulated issuer behaviour, keyed off the idempotency key so
        // retries of the same sweep behave identically.
        const seedStr = String(idempotencyKey ?? token);
        let h = 0; for (const c of seedStr) h = (h * 31 + c.charCodeAt(0)) | 0;
        const roll = Math.abs(h) % 100;
        let gatewayCode = "APPROVED";
        if (roll >= 97) gatewayCode = "INSUFFICIENT_FUNDS";
        else if (roll >= 95) gatewayCode = "EXPIRED_CARD";
        else if (roll >= 93) gatewayCode = "AUTHENTICATION_REQUIRED"; // issuer soft-decline / step-up

        return json({
          result: gatewayCode === "APPROVED" ? "SUCCESS" : "FAILURE",
          order: { id: ref("ORDER"), amount: amt, currency: currency ?? "KES" },
          transaction: { id: ref("TXN"), type: "PAYMENT", source: "MERCHANT_INITIATED_TRANSACTION" },
          agreement: { id: agreementId ?? null, type: "STANDING_INSTRUCTION", recurringPaymentSequenceIndicator: "SUBSEQUENT" },
          response: { gatewayCode, acquirerCode: gatewayCode === "APPROVED" ? "00" : "51" },
        });
      }

      case "refund": {
        const { orderId, amount } = body as Record<string, string | number>;
        return json({
          result: "SUCCESS",
          order: { id: orderId ?? ref("ORDER"), amount: Number(amount) },
          transaction: { id: ref("REFUND"), type: "REFUND" },
          response: { gatewayCode: "APPROVED" },
        });
      }

      default:
        return json({ result: "ERROR", error: { cause: "INVALID_REQUEST", explanation: `unknown operation ${op}` } }, 400);
    }
  } catch (e) {
    return json({ result: "ERROR", error: { cause: "SERVER_BUSY", explanation: String(e) } }, 500);
  }
});
