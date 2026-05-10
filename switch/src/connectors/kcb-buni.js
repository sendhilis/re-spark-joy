// KCB BUNI connector — talks to the real KCB sandbox / production gateway.
// Portal: https://buni.kcbgroup.com  Sandbox: https://sandbox.buni.kcbgroup.com
//
// Auth:        OAuth2 client-credentials → Bearer access_token (cached per-process).
// Debit leg:   MpesaExpress STK Push          POST /mpesa-express/v1/stkpush
// Credit leg:  Send Money (Pesalink/IFT)      POST /send-money/v1/transfer
//
// Endpoint paths are configurable via env so we can adapt without redeploys
// when KCB confirms the final URIs from the BUNI OpenAPI spec.
//
// Env (set in Lovable Cloud secrets / .env on standalone switch):
//   KCB_BUNI_BASE_URL          default https://sandbox.buni.kcbgroup.com
//   KCB_BUNI_CLIENT_ID         consumer_key from BUNI portal
//   KCB_BUNI_CLIENT_SECRET     consumer_secret from BUNI portal
//   KCB_BUNI_TOKEN_PATH        default /token/v1/generate?grant_type=client_credentials
//   KCB_BUNI_STK_PATH          default /mpesa-express/v1/stkpush
//   KCB_BUNI_SEND_PATH         default /send-money/v1/transfer
//   KCB_BUNI_SHORTCODE         business shortcode (paybill/till) for STK push
//   KCB_BUNI_CALLBACK_URL      https://<your-host>/webhooks/kcb-buni
//   KCB_BUNI_RAIL              "stk" | "send" — which leg to use (default "stk")
//
// Returns the same shape as kcbConnector: { status, bank_reference, ... }
// where status === "ACSC" maps to FSM COMPLETED in routes/intents.js.
import { request } from "undici";
import { config } from "../config.js";

const env = (k, d) => process.env[k] ?? d;

const BUNI = {
  baseUrl:     () => env("KCB_BUNI_BASE_URL", "https://sandbox.buni.kcbgroup.com").replace(/\/$/, ""),
  clientId:    () => env("KCB_BUNI_CLIENT_ID", ""),
  clientSecret:() => env("KCB_BUNI_CLIENT_SECRET", ""),
  tokenPath:   () => env("KCB_BUNI_TOKEN_PATH", "/token/v1/generate?grant_type=client_credentials"),
  stkPath:     () => env("KCB_BUNI_STK_PATH", "/mpesa-express/v1/stkpush"),
  sendPath:    () => env("KCB_BUNI_SEND_PATH", "/send-money/v1/transfer"),
  shortcode:   () => env("KCB_BUNI_SHORTCODE", "174379"),
  callbackUrl: () => env("KCB_BUNI_CALLBACK_URL", "https://example.invalid/webhooks/kcb-buni"),
  rail:        () => env("KCB_BUNI_RAIL", "stk"),
};

let cachedToken = null; // { token, expires_at }

async function getAccessToken() {
  if (cachedToken && cachedToken.expires_at - 30_000 > Date.now()) return cachedToken.token;
  const id = BUNI.clientId(), secret = BUNI.clientSecret();
  if (!id || !secret) throw new Error("kcb_buni_missing_credentials");

  const url = `${BUNI.baseUrl()}${BUNI.tokenPath()}`;
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const { statusCode, body } = await request(url, {
    method: "GET",   // BUNI token endpoint accepts GET with Basic auth
    headers: { authorization: `Basic ${basic}`, accept: "application/json" },
  });
  const j = await body.json().catch(() => ({}));
  if (statusCode !== 200 || !j.access_token) {
    throw new Error(`kcb_buni_token_status_${statusCode}_${JSON.stringify(j).slice(0, 200)}`);
  }
  cachedToken = {
    token: j.access_token,
    expires_at: Date.now() + ((Number(j.expires_in) || 3600) * 1000),
  };
  return cachedToken.token;
}

// ── STK Push (debit a payer's M-PESA wallet held at KCB)
async function stkPush({ token, body, traceId }) {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14); // yyyymmddHHMMSS
  const password = Buffer.from(
    `${BUNI.shortcode()}${BUNI.clientSecret()}${ts}`
  ).toString("base64");

  const payload = {
    BusinessShortCode: BUNI.shortcode(),
    Password: password,
    Timestamp: ts,
    TransactionType: "CustomerPayBillOnline",
    Amount: Number(body.amount),
    PartyA: body.payer_identifier,           // payer MSISDN 2547XXXXXXXX
    PartyB: BUNI.shortcode(),
    PhoneNumber: body.payer_identifier,
    CallBackURL: BUNI.callbackUrl(),
    AccountReference: body.payee_identifier, // paybill account ref
    TransactionDesc: `Lipafo ${body.idempotency_key.slice(0, 12)}`,
  };

  return await postJson(`${BUNI.baseUrl()}${BUNI.stkPath()}`, payload, token, body.idempotency_key, traceId);
}

// ── Send Money / Pesalink (credit a beneficiary account at any bank)
async function sendMoney({ token, body, traceId }) {
  const payload = {
    transactionReference: body.idempotency_key,
    amount: Number(body.amount),
    currency: body.currency ?? "KES",
    debitAccount: env("KCB_BUNI_DEBIT_ACCOUNT", "1234567890"),
    creditAccount: body.payee_identifier,
    beneficiaryBankCode: env("KCB_BUNI_BENEFICIARY_BANK_CODE", "01"),
    narration: `Lipafo ${body.idempotency_key.slice(0, 12)}`,
    callbackUrl: BUNI.callbackUrl(),
  };
  return await postJson(`${BUNI.baseUrl()}${BUNI.sendPath()}`, payload, token, body.idempotency_key, traceId);
}

async function postJson(url, payload, token, intentKey, traceId) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), config.bankCallTimeoutMs);
  try {
    const { statusCode, body: respBody } = await request(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${token}`,
        "x-lipafo-intent-key": intentKey,
        "x-lipafo-trace-id": traceId,
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const j = await respBody.json().catch(() => ({}));

    // BUNI success conventions (vary by API):
    //  - MpesaExpress:  ResponseCode "0" + CheckoutRequestID
    //  - SendMoney:     status "SUCCESS" / responseCode "0000"
    const ok =
      String(j.ResponseCode ?? j.responseCode ?? j.ResultCode ?? "").match(/^0+$/) ||
      String(j.status ?? "").toUpperCase() === "SUCCESS" ||
      (statusCode >= 200 && statusCode < 300 && (j.CheckoutRequestID || j.transactionId));

    return {
      status: ok ? "ACSC" : "RJCT",
      http_status: statusCode,
      result_code: j.ResponseCode ?? j.responseCode ?? j.ResultCode ?? null,
      result_desc: j.ResponseDescription ?? j.responseDescription ?? j.ResultDesc ?? j.message ?? null,
      bank_reference: j.CheckoutRequestID ?? j.transactionId ?? j.MerchantRequestID ?? null,
      raw: j,
      reason: ok ? null : (j.errorMessage ?? j.ResponseDescription ?? `http_${statusCode}`),
    };
  } finally {
    clearTimeout(t);
  }
}

export const kcbBuniConnector = {
  bank_code: "KCB_BUNI",
  bank_name: "KCB Bank Kenya (BUNI)",

  async send({ app, body, traceId }) {
    try {
      const token = await getAccessToken();
      const rail = (body.rail === "send_money" || BUNI.rail() === "send") ? "send" : "stk";
      const result = rail === "send"
        ? await sendMoney({ token, body, traceId })
        : await stkPush({ token, body, traceId });

      app?.log?.info({ traceId, rail, status: result.status, ref: result.bank_reference }, "kcb_buni_call");
      return result;
    } catch (err) {
      app?.log?.error({ err: err.message, traceId }, "kcb_buni_error");
      return {
        status: "RJCT",
        http_status: err.name === "AbortError" ? 504 : 500,
        result_desc: err.message,
        bank_reference: null,
        reason: err.message,
      };
    }
  },
};
