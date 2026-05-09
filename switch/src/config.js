// Centralised env config. Keep all process.env reads here.
export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? "0.0.0.0",
  logLevel: process.env.LOG_LEVEL ?? "info",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  bankSimUrl: process.env.BANK_SIM_URL ?? "http://localhost:8787/pacs008",
  hmacSecret: process.env.HMAC_SECRET ?? "lipafo-pilot-shared-secret",
  idempotencyTtlSeconds: Number(process.env.IDEMPOTENCY_TTL_SECONDS ?? 86_400),
  bankCallTimeoutMs: Number(process.env.BANK_CALL_TIMEOUT_MS ?? 2_000),
  // Circuit breaker thresholds
  breakerFailureThreshold: 5,
  breakerCooldownSeconds: 30,
};
