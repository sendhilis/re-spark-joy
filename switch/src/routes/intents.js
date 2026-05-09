import { dispatch } from "../connectors/index.js";

// JSON schema gives Fastify both validation AND fast-json-stringify on responses.
const intentSchema = {
  body: {
    type: "object",
    required: ["idempotency_key", "payer_identifier", "payee_identifier", "amount"],
    properties: {
      idempotency_key:   { type: "string", minLength: 8, maxLength: 128 },
      payer_identifier:  { type: "string", minLength: 3, maxLength: 64 },
      payee_identifier:  { type: "string", minLength: 1, maxLength: 64 },
      payee_bank:        { type: "string", maxLength: 16 },
      amount:            { type: "number", exclusiveMinimum: 0, maximum: 9_999_999 },
      currency:          { type: "string", enum: ["KES", "XOF", "USD"], default: "KES" },
      rail:              { type: "string", default: "bank_rail" },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
        replayed: { type: "boolean" },
        trace_id: { type: "string" },
        intent_id: { type: "string" },
        state: { type: "string" },
        latency_ms: { type: "number" },
        bank_status: { type: "string" },
        bank_reference: { type: ["string", "null"] },
      },
    },
  },
};

export default async function intentRoutes(app) {
  app.post("/intents", { schema: intentSchema }, async (req, reply) => {
    const startedAt = process.hrtime.bigint();
    const traceId = req.id;
    const body = req.body;

    // 1. Idempotency claim (single Redis hop on the hot path)
    const claim = await app.idempotency.claim(body.idempotency_key, traceId);
    if (!claim.firstSeen) {
      // Replay: if we have the final response, return it. Else 409 (still in flight).
      if (claim.cached?.status === "complete") {
        reply.header("x-idempotent-replay", "1");
        return { ...claim.cached.response, replayed: true };
      }
      reply.code(409);
      return { ok: false, error: "in_flight", trace_id: claim.cached?.trace_id ?? traceId };
    }

    // 2. Dispatch to bank connector (Daraja REST: OAuth2 Bearer + X-Lipafo-Intent-Key)
    const result = await dispatch({ app, body, traceId });

    const latency_ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const response = {
      ok: result.ok,
      trace_id: traceId,
      intent_id: result.intent_id,
      state: result.state,
      bank_status: result.bank_status,
      bank_reference: result.bank_reference ?? null,
      latency_ms: Math.round(latency_ms * 100) / 100,
    };

    if (result.ok) {
      // Cache final response so client retries are cheap and safe.
      await app.idempotency.commit(body.idempotency_key, response);
    } else {
      // Hard failure: free the key so the client can resubmit cleanly.
      await app.idempotency.release(body.idempotency_key);
      reply.code(result.http_status ?? 422);
    }
    return response;
  });
}
