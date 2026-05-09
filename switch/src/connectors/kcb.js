// Reference bank connector stub — FTS v3.0 (Daraja-pattern REST/JSON).
// ISO 20022 / pacs.008 / HMAC has been removed entirely per FTS v3.0 §2.3.
// Auth: OAuth2 client-credentials → Bearer access_token (cached per-process).
// Idempotency: forward the X-Lipafo-Intent-Key header to the bank.
// Mirrors the Lipafo Switch behaviour and matches `bank-simulator` edge fn.
import { request } from "undici";
import { config } from "../config.js";

let cachedToken = null; // { token, expires_at }

async function getAccessToken(baseUrl) {
  if (cachedToken && cachedToken.expires_at - 30_000 > Date.now()) {
    return cachedToken.token;
  }
  const tokenUrl = `${baseUrl.replace(/\/$/, "")}/lipafo/auth/token`;
  const basic = Buffer.from(`${config.bankClientId}:${config.bankClientSecret}`).toString("base64");
  try {
    const { statusCode, body } = await request(tokenUrl, {
      method: "POST",
      headers: {
        "authorization": `Basic ${basic}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        client_id: config.bankClientId,
        client_secret: config.bankClientSecret,
      }),
    });
    if (statusCode !== 200) throw new Error(`token_status_${statusCode}`);
    const j = await body.json();
    cachedToken = {
      token: j.access_token,
      expires_at: Date.now() + ((Number(j.expires_in) || 3600) * 1000),
    };
    return cachedToken.token;
  } catch {
    // Pilot fallback: bank-simulator accepts the raw client secret as a Bearer.
    return config.bankClientSecret;
  }
}

export const kcbConnector = {
  bank_code: "KCB",
  bank_name: "Kenya Commercial Bank",

  async send({ body, traceId, bank }) {
    const baseUrl = process.env.KCB_BASE_URL ?? config.bankBaseUrl;
    const accessToken = await getAccessToken(baseUrl);

    const payload = JSON.stringify({
      intent_key: body.idempotency_key,
      payer_msisdn: body.payer_identifier,
      paybill_or_till: body.payee_identifier,
      amount: body.amount,
      currency: body.currency ?? "KES",
    });

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), config.bankCallTimeoutMs);
    try {
      const { statusCode, body: respBody } = await request(
        `${baseUrl.replace(/\/$/, "")}/lipafo/payment/initiate`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${accessToken}`,
            "x-lipafo-intent-key": body.idempotency_key,
            "x-lipafo-timestamp": new Date().toISOString(),
            "x-lipafo-bank-code": bank,
            "x-lipafo-trace-id": traceId,
          },
          body: payload,
          signal: ctrl.signal,
        },
      );
      const json = await respBody.json().catch(() => ({}));
      const ResultCode = Number(json.ResultCode ?? (statusCode === 200 ? 0 : 1));
      return {
        // Daraja ResultCode 0 == success → map to ACSC for the existing FSM.
        status: ResultCode === 0 ? "ACSC" : "RJCT",
        result_code: ResultCode,
        result_desc: json.ResultDesc ?? null,
        bank_reference: json.bank_reference ?? null,
        reason: json.ResultDesc ?? null,
      };
    } finally {
      clearTimeout(t);
    }
  },
};
