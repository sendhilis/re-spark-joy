// Reference bank connector stub.
// Mirrors the contract used by `supabase/functions/bank-simulator/index.ts`:
//   POST <endpoint> with HMAC-SHA256 signature in X-Lipafo-Signature.
// Replace `endpoint` with the real KCB pacs.008 receiver in production
// (typically loaded from a per-bank integration profile in Postgres).
import { request } from "undici";
import { hmacSha256Hex } from "../lib/hmac.js";
import { config } from "../config.js";

export const kcbConnector = {
  bank_code: "KCB",
  bank_name: "Kenya Commercial Bank",

  async send({ body, traceId, bank }) {
    const endpoint = process.env.KCB_PACS008_URL ?? config.bankSimUrl;
    const payload = JSON.stringify({
      message_type: "pacs.008",
      trace_id: traceId,
      idempotency_key: body.idempotency_key,
      payer_identifier: body.payer_identifier,
      payee_identifier: body.payee_identifier,
      amount: body.amount,
      currency: body.currency ?? "KES",
    });
    const signature = await hmacSha256Hex(config.hmacSecret, payload);

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), config.bankCallTimeoutMs);
    try {
      const { statusCode, body: respBody } = await request(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-lipafo-signature": signature,
          "x-lipafo-bank-code": bank,
          "x-lipafo-trace-id": traceId,
        },
        body: payload,
        signal: ctrl.signal,
      });
      const json = await respBody.json().catch(() => ({}));
      return {
        status: json.status ?? (statusCode === 200 ? "ACSC" : "RJCT"),
        bank_reference: json.bank_reference ?? null,
        reason: json.reason ?? null,
      };
    } finally {
      clearTimeout(t);
    }
  },
};
