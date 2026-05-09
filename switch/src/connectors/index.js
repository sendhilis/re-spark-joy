import { kcbConnector } from "./kcb.js";
import { config } from "../config.js";

// Connector registry. One file per bank in production; each exports
// { send(ctx) -> { status, bank_reference, reason? } }.
const REGISTRY = {
  KCB: kcbConnector,
  // EQUITY: equityConnector,
  // COOP:   coopConnector,
};

// Default fallback uses the same HMAC contract as the bank-simulator edge fn.
import { kcbConnector as defaultConnector } from "./kcb.js";

// Redis-backed circuit breaker. Keys:
//   lipafo:cb:<BANK>:state      = CLOSED | OPEN | HALF_OPEN
//   lipafo:cb:<BANK>:failures   = integer counter
async function breakerState(app, bank) {
  const state = await app.redis.get(`lipafo:cb:${bank}:state`);
  return state ?? "CLOSED";
}
async function recordFailure(app, bank) {
  const n = await app.redis.incr(`lipafo:cb:${bank}:failures`);
  if (n >= config.breakerFailureThreshold) {
    await app.redis.set(`lipafo:cb:${bank}:state`, "OPEN", "EX", config.breakerCooldownSeconds);
  }
  return n;
}
async function recordSuccess(app, bank) {
  await app.redis.del(`lipafo:cb:${bank}:failures`);
  await app.redis.set(`lipafo:cb:${bank}:state`, "CLOSED");
}

export async function dispatch({ app, body, traceId }) {
  const bank = body.payee_bank ?? "KCB";
  const intent_id = traceId;

  // Circuit-breaker gate
  const state = await breakerState(app, bank);
  if (state === "OPEN") {
    app.log.warn({ traceId, bank }, "circuit_open");
    return { ok: false, intent_id, state: "FAILED", bank_status: "CIRCUIT_OPEN", http_status: 503 };
  }

  const connector = REGISTRY[bank] ?? defaultConnector;
  try {
    const result = await connector.send({ app, body, traceId, bank });
    if (result.status === "ACSC") {
      await recordSuccess(app, bank);
      return {
        ok: true, intent_id, state: "COMPLETED",
        bank_status: result.status, bank_reference: result.bank_reference,
      };
    }
    await recordFailure(app, bank);
    return {
      ok: false, intent_id, state: "FAILED",
      bank_status: result.status, bank_reference: result.bank_reference, http_status: 422,
    };
  } catch (err) {
    app.log.error({ err, bank, traceId }, "connector_error");
    await recordFailure(app, bank);
    return { ok: false, intent_id, state: "FAILED", bank_status: "TIMEOUT", http_status: 504 };
  }
}
