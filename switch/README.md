# Lipafo Switch — Fastify Reference Service

A production-shaped reference for the Lipafo core switching layer, intended to replace the Supabase Edge Function prototype (`switch-process-intent`) when the pilot graduates to >1k sustained TPS.

> **Status:** scaffold for benchmarking and team reference. Not production hardened. Pairs with the existing edge-function prototype — the contracts (`/v1/intents` body, pacs.008 envelope, HMAC headers) match `supabase/functions/switch-process-intent/index.ts` and `bank-simulator/index.ts` so you can swap implementations behind the same client.

## Why Fastify

- ~30–45k req/s per core (vs Express ~10k) thanks to schema-based serialization
- Built-in JSON Schema request validation (zero extra middleware)
- Encapsulated plugin system — clean isolation per bank connector
- Pino structured logging out of the box

## Layout

```text
switch/
├── src/
│   ├── server.js              # Fastify bootstrap, plugin registration, graceful shutdown
│   ├── config.js              # Env-driven config (PORT, REDIS_URL, BANK_SIM_URL, ...)
│   ├── plugins/
│   │   ├── redis.js           # ioredis client decorator
│   │   └── idempotency.js     # SETNX-based idempotency middleware
│   ├── routes/
│   │   ├── health.js          # /healthz, /readyz
│   │   └── intents.js         # POST /v1/intents — main switch ingress
│   ├── connectors/
│   │   ├── index.js           # Bank registry + circuit breaker state
│   │   └── kcb.js             # Reference bank connector stub (HMAC-signed pacs.008)
│   └── lib/
│       ├── hmac.js            # HMAC-SHA256 helpers
│       └── trace.js           # Trace-id generation
├── bench/
│   └── k6-script.js           # k6 load profile: ramp to 5k VUs
├── Dockerfile
├── docker-compose.yml         # Service + Redis for local benchmarking
└── package.json
```

## Quick start

```bash
cd switch
npm install
docker compose up -d redis    # or: redis-server
npm run dev
```

```bash
curl -X POST http://localhost:3000/v1/intents \
  -H 'content-type: application/json' \
  -d '{
    "idempotency_key":"demo-001",
    "payer_identifier":"MSISDN+254700000001",
    "payee_identifier":"NAIVAS-001",
    "payee_bank":"KCB",
    "amount":1500,
    "currency":"KES"
  }'
```

Replay the same `idempotency_key` — second response returns `replayed: true` from Redis without re-hitting the bank.

## Benchmark

```bash
# autocannon: 200 connections × 30s
npm run bench:autocannon

# k6: ramp 0 → 5000 VU over 5 min
npm run bench:k6
```

Targets on a single 4-vCPU node (Redis local):
- **p50 latency:** < 8 ms (validation + idempotency only, bank stub mocked inline)
- **p99 latency:** < 40 ms
- **Sustained throughput:** ≥ 8,000 RPS

With the real bank connector enabled, throughput is bounded by the downstream — typically 300–800 RPS per bank link.

## Env vars

| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | `3000` | HTTP listen port |
| `REDIS_URL` | `redis://localhost:6379` | Idempotency + circuit breaker store |
| `BANK_SIM_URL` | `http://localhost:8787/pacs008` | Default endpoint when a bank has no profile |
| `HMAC_SECRET` | `lipafo-pilot-shared-secret` | Shared HMAC for bank simulator (matches edge fn) |
| `IDEMPOTENCY_TTL_SECONDS` | `86400` | How long to remember keys |
| `LOG_LEVEL` | `info` | Pino level |

## Next steps to harden

1. Replace in-memory circuit breaker with Redis-backed state (already stubbed)
2. Add OpenTelemetry exporter (OTLP) — trace IDs already propagated
3. Add Postgres write path for `transaction_intents` + `switch_events` (mirror current schema)
4. Per-bank connector plugins under `connectors/` (one file per bank)
5. mTLS to bank endpoints + per-bank HMAC key from secrets manager
