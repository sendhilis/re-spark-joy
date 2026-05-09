// Centralised env config. Keep all process.env reads here.
// FTS v3.0: bank protocol is REST/JSON Daraja-pattern (OAuth2 Bearer).
// HMAC / ISO 20022 fields removed.
export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? "0.0.0.0",
  logLevel: process.env.LOG_LEVEL ?? "info",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  // Daraja-style base URL exposed by the participating bank (or simulator).
  bankBaseUrl: process.env.BANK_BASE_URL ?? "http://localhost:8787",
  bankClientId: process.env.BANK_CLIENT_ID ?? "lipafo-pilot-client",
  bankClientSecret: process.env.BANK_CLIENT_SECRET ?? "lipafo-pilot-secret",
  idempotencyTtlSeconds: Number(process.env.IDEMPOTENCY_TTL_SECONDS ?? 86_400),
  // FTS v3.0 §5: 8s hard timeout on credit leg.
  bankCallTimeoutMs: Number(process.env.BANK_CALL_TIMEOUT_MS ?? 8_000),
  // Circuit breaker thresholds
  breakerFailureThreshold: 5,
  breakerCooldownSeconds: 30,
};
