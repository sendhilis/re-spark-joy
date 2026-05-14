# Bank QA Acceptance Criteria — Lipafo Switch Pilot v1.0

This document defines what the bank QA team must validate to certify the
Lipafo Switch for connection to the bank's TEST environment. Sign-off on
all items below allows progression to UAT with real corridor traffic.

---

## A. Functional Acceptance (must-pass)

| ID | Criterion | Pass = |
|---|---|---|
| F1 | Service starts on Docker Compose with no manual steps beyond `.env` | `docker compose up -d` returns healthy in ≤30s |
| F2 | `/healthz` and `/readyz` return 200 | Liveness + readiness probes work for bank's K8s/monitoring |
| F3 | Successful debit-credit round-trip against bank sandbox | T1 produces a settled transaction visible on bank core |
| F4 | OAuth2 token acquisition + caching against bank's `/lipafo/auth/token` | One token request per hour per bank, not per intent |
| F5 | All required Lipafo headers are sent on every downstream call | Bank logs show `X-Lipafo-Intent-Key`, `X-Lipafo-Trace-Id`, `X-Lipafo-Bank-Code`, `X-Lipafo-Timestamp` |
| F6 | Bank `ResultCode` / `ResultDesc` surfaced verbatim to caller | T6 response preserves bank's decline reason |

## B. Resilience Acceptance (must-pass)

| ID | Criterion | Pass = |
|---|---|---|
| R1 | Idempotency: same key → no duplicate bank call | T2: bank receives exactly one `/lipafo/payment/initiate` |
| R2 | Concurrent duplicate requests serialised | T3: one succeeds, second returns `409 in_flight` |
| R3 | Hard 8-second timeout on bank credit leg | T7: switch abandons at 8000±200ms |
| R4 | Circuit breaker opens after 5 consecutive failures | T8: 6th call rejected locally with `503` |
| R5 | Circuit breaker auto-recovers | After 30s cooldown, traffic resumes |
| R6 | Service survives Redis restart | `docker restart redis` does not crash switch process |

## C. Security Acceptance (must-pass)

| ID | Criterion | Pass = |
|---|---|---|
| S1 | No bank credentials in code or container image | Grep of unzipped source returns zero secrets |
| S2 | Credentials only sourced from `.env` at runtime | `docker inspect` shows env injection, not baked in |
| S3 | OAuth2 Bearer token never logged | `docker compose logs switch` contains no `Bearer ey…` strings |
| S4 | Container runs as non-root user | `docker exec switch id` returns uid≠0 |
| S5 | Outbound traffic restricted to `BANK_BASE_URL` + callback URL | Network capture shows no other egress destinations |

## D. Validation Acceptance (must-pass)

| ID | Criterion | Pass = |
|---|---|---|
| V1 | Schema rejection at the edge | T4: malformed body → `400` without touching bank |
| V2 | Network structural cap enforced | T5: amount >10M → `422` without touching bank |
| V3 | Currency whitelist enforced | Body with `"currency":"GBP"` → `400` |
| V4 | Negative / zero amounts rejected | `"amount":0` and `"amount":-1` → `400` |

## E. Observability Acceptance (should-pass)

| ID | Criterion | Pass = |
|---|---|---|
| O1 | Every request has a propagated `trace_id` | Switch logs and bank logs share same trace ID |
| O2 | Logs are structured JSON | Bank's log shipper can parse without regex |
| O3 | Per-request latency reported | Response body includes `latency_ms` |
| O4 | Bank reference echoed back in response | `bank_reference` field present on success |

## F. Performance Targets (informational for pilot)

These are **not** acceptance gates for this drop — they are the SLOs we will
measure together during UAT load testing using `bench/k6-script.js`.

| Metric | Target |
|---|---|
| Switch internal p50 latency (excl. bank) | < 8 ms |
| Switch internal p99 latency (excl. bank) | < 40 ms |
| End-to-end p99 (incl. bank sandbox) | < 1500 ms |
| Sustained throughput (single 4-vCPU node) | ≥ 8000 RPS schema-only, ≥ 300 RPS with bank |
| Idempotency cache hit latency | < 5 ms |

---

## Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Bank QA Lead |  |  |  |
| Bank Integration Engineer |  |  |  |
| Bank Security Officer |  |  |  |
| Lipafo Integration Lead |  |  |  |

Once Sections A–E are fully green, this pilot drop is certified for connection
to the bank's TEST corridor. Section F is exercised in the subsequent UAT
load-test phase.
