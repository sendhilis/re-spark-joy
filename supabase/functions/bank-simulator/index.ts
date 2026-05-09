// Lipafo Bank Simulator — v3.0 (Daraja-pattern REST/JSON)
//
// Stand-in for a participating bank's Lipafo Merchant Integration endpoint.
// ISO 20022 / pacs.008 / HMAC has been REMOVED in FTS v3.0.
// Protocol now mirrors MPESA Daraja exactly:
//   • OAuth2 client-credentials → Bearer access_token
//   • POST /lipafo/payment/initiate   (debit leg, like stkpush)
//   • POST /lipafo/payment/credit     (credit leg, like b2c paymentrequest)
//   • GET  /lipafo/payment/status     (probe by intent_key)
//   • Response envelope: { ResultCode, ResultDesc, intent_id, bank_reference }
//
// Headers expected from the Lipafo switch on every write:
//   Authorization:        Bearer <access_token>
//   X-Lipafo-Intent-Key:  <uuid v4>   (idempotency)
//   X-Lipafo-Timestamp:   <ISO8601>
//   X-Lipafo-Bank-Code:   e.g. "KCB"
//   X-Lipafo-Trace-Id:    trace correlation id

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lipafo-intent-key, x-lipafo-timestamp, x-lipafo-bank-code, x-lipafo-trace-id",
};

// Pilot OAuth2 credentials. In production each bank issues its own.
const CLIENT_ID = Deno.env.get("BANK_SIM_CLIENT_ID") ?? "lipafo-pilot-client";
const CLIENT_SECRET = Deno.env.get("BANK_SIM_CLIENT_SECRET") ?? "lipafo-pilot-secret";
const TOKEN_TTL_SEC = 3600;

// In-memory token cache (fine for the simulator — production banks use Redis/DB).
const issuedTokens = new Map<string, number>(); // token -> expires_at (ms)

const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Idempotency cache (per intent_key) → last response, so retries replay safely.
const idempotencyStore = new Map<string, { ts: number; response: any }>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
function rememberIdempotent(key: string, resp: any) {
  idempotencyStore.set(key, { ts: Date.now(), response: resp });
}
function lookupIdempotent(key: string) {
  const hit = idempotencyStore.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > IDEMPOTENCY_TTL_MS) {
    idempotencyStore.delete(key);
    return null;
  }
  return hit.response;
}

function verifyBearer(req: Request): { ok: boolean; reason?: string } {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return { ok: false, reason: "missing_bearer" };
  const token = auth.slice(7).trim();
  // Allow either an issued token from /lipafo/auth/token or the pilot service shortcut
  if (token === CLIENT_SECRET) return { ok: true };
  const exp = issuedTokens.get(token);
  if (!exp) return { ok: false, reason: "invalid_token" };
  if (Date.now() > exp) {
    issuedTokens.delete(token);
    return { ok: false, reason: "token_expired" };
  }
  return { ok: true };
}

// ── Daraja-style result codes ───────────────────────────────────────────────
// 0 = success. Non-zero = bank rejected. We mirror MPESA's pattern.
function buildResult(code: number, desc: string, extra: Record<string, unknown> = {}) {
  return { ResultCode: code, ResultDesc: desc, ...extra };
}

async function handleAuthToken(req: Request): Promise<Response> {
  // Daraja accepts either Basic auth or JSON body. Support both.
  let clientId = CLIENT_ID;
  let clientSecret = "";
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = atob(auth.slice(6).trim());
      const idx = decoded.indexOf(":");
      clientId = decoded.slice(0, idx);
      clientSecret = decoded.slice(idx + 1);
    } catch { /* ignore */ }
  } else {
    try {
      const b = await req.json();
      clientId = b.client_id ?? clientId;
      clientSecret = b.client_secret ?? "";
    } catch { /* ignore */ }
  }
  if (clientId !== CLIENT_ID || clientSecret !== CLIENT_SECRET) {
    return json(401, buildResult(401, "invalid_client"));
  }
  const access_token = newId() + newId();
  issuedTokens.set(access_token, Date.now() + TOKEN_TTL_SEC * 1000);
  return json(200, { access_token, token_type: "Bearer", expires_in: TOKEN_TTL_SEC });
}

interface PaymentBody {
  intent_key?: string;
  payer_msisdn?: string;
  payer_identifier?: string;
  paybill_or_till?: string;
  payee_identifier?: string;
  merchant_account_ref?: string;
  amount?: number;
  currency?: string;
  intent_id?: string;
  credit_key?: string;
}

async function handlePayment(req: Request, leg: "initiate" | "credit"): Promise<Response> {
  const auth = verifyBearer(req);
  if (!auth.ok) return json(401, buildResult(401, auth.reason ?? "unauthorized"));

  const intentKey =
    req.headers.get("x-lipafo-intent-key") ??
    (leg === "credit" ? null : null);
  const bankCode = req.headers.get("x-lipafo-bank-code") ?? "UNKNOWN";
  const traceId = req.headers.get("x-lipafo-trace-id") ?? newId();

  let body: PaymentBody = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const idemKey = intentKey ?? body.intent_key ?? body.credit_key;
  if (!idemKey) {
    return json(400, buildResult(400, "missing_intent_key", { trace_id: traceId }));
  }
  const cached = lookupIdempotent(idemKey);
  if (cached) {
    return json(cached.ResultCode === 0 ? 200 : 422, { ...cached, replayed: true });
  }

  const amount = Number(body.amount ?? 0);
  if (!amount || amount <= 0) {
    const r = buildResult(400, "invalid_amount", { trace_id: traceId });
    rememberIdempotent(idemKey, r);
    return json(400, r);
  }

  // Simulate processing latency
  const simLatency = Math.round(40 + Math.random() * 120);
  await new Promise((r) => setTimeout(r, simLatency));

  // Deterministic failure injection (matches v2 behaviour for tests)
  if (amount > 9_999_999) {
    const r = buildResult(1, "insufficient_funds", {
      trace_id: traceId, bank_code: bankCode, simulated_latency_ms: simLatency,
    });
    rememberIdempotent(idemKey, r);
    return json(422, r);
  }
  if (amount % 1000 === 13) {
    const r = buildResult(2001, "unknown_creditor", {
      trace_id: traceId, bank_code: bankCode, simulated_latency_ms: simLatency,
    });
    rememberIdempotent(idemKey, r);
    return json(422, r);
  }
  if (amount % 1000 === 17) {
    // Simulate a hung downstream — caller will time out
    await new Promise((r) => setTimeout(r, 6000));
  }

  const ok = buildResult(0, leg === "initiate" ? "debit_accepted" : "credit_accepted", {
    trace_id: traceId,
    bank_code: bankCode,
    intent_id: body.intent_id ?? newId(),
    bank_reference: `${bankCode}-${newId()}`,
    simulated_latency_ms: simLatency,
  });
  rememberIdempotent(idemKey, ok);
  return json(200, ok);
}

async function handleStatus(req: Request, url: URL): Promise<Response> {
  const auth = verifyBearer(req);
  if (!auth.ok) return json(401, buildResult(401, auth.reason ?? "unauthorized"));
  const key = url.searchParams.get("intent_key") ?? url.searchParams.get("bank_reference") ?? "";
  if (!key) return json(400, buildResult(400, "missing_intent_key_or_reference"));
  const cached = lookupIdempotent(key);
  if (!cached) return json(404, buildResult(404, "unknown_transaction"));
  return json(200, { ...cached, replayed: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Support both root invocation (legacy: POST /) and Daraja paths.
    // Path may be either "/lipafo/payment/initiate" or
    // "/bank-simulator/lipafo/payment/initiate" depending on how it's called.
    const path = url.pathname;

    const matches = (suffix: string) => path === suffix || path.endsWith(suffix);

    if (req.method === "POST" && matches("/lipafo/auth/token")) {
      return await handleAuthToken(req);
    }
    if (req.method === "POST" && matches("/lipafo/payment/initiate")) {
      return await handlePayment(req, "initiate");
    }
    if (req.method === "POST" && matches("/lipafo/payment/credit")) {
      return await handlePayment(req, "credit");
    }
    if (req.method === "GET" && matches("/lipafo/payment/status")) {
      return await handleStatus(req, url);
    }

    // ── Backwards-compatible default: POST / behaves like /lipafo/payment/initiate.
    // The Lipafo switch (switch-process-intent) calls the simulator at its root
    // function URL, so this keeps the pilot working without per-bank routing.
    if (req.method === "POST") {
      // Synthesize a Bearer token if the caller didn't supply one (pilot only).
      if (!req.headers.get("authorization")) {
        const fakeReq = new Request(req.url, {
          method: req.method,
          headers: new Headers([
            ...Array.from(req.headers.entries()),
            ["authorization", `Bearer ${CLIENT_SECRET}`],
          ]),
          body: await req.clone().text(),
        });
        return await handlePayment(fakeReq, "initiate");
      }
      return await handlePayment(req, "initiate");
    }

    return json(404, buildResult(404, "unknown_endpoint", { path }));
  } catch (e) {
    return json(500, buildResult(500, (e as Error).message));
  }
});
