# Lipafo Switch — Bank Test Instructions (Pilot v1.0)

Audience: Bank QA / Integration team. This package contains **only** the core
Fastify switching service. There is no UI, no admin console, and no dependency
on Lipafo-hosted infrastructure. Everything runs on your TEST server.

---

## 1. Prerequisites

| Requirement | Version |
|---|---|
| Docker Engine | 20.10+ |
| Docker Compose | v2+ |
| Open outbound HTTPS to your KCB BUNI sandbox | required |
| Open outbound HTTPS to the callback URL | required |
| Free local port `3000` | required |

No database. No cloud account. No Node install needed (Docker handles it).

---

## 2. Install (3 commands)

```bash
unzip lipafo-switch-bank-test-v1.zip
cd switch
cp .env.example .env        # edit BANK_CLIENT_ID / BANK_CLIENT_SECRET
docker compose up -d
```

Verify:

```bash
curl http://localhost:3000/healthz   # → {"ok":true}
curl http://localhost:3000/readyz    # → {"ok":true}  (Redis reachable)
```

---

## 3. The contract you are testing

**One endpoint:** `POST http://localhost:3000/v1/intents`

Request body:

```json
{
  "idempotency_key": "bank-qa-001",
  "payer_identifier": "MSISDN+254700000001",
  "payee_identifier": "PAYBILL-522522",
  "payee_bank": "KCB_BUNI",
  "amount": 1500,
  "currency": "KES",
  "rail": "bank_rail"
}
```

Headers Lipafo sends to **your** bank endpoint downstream
(`${BANK_BASE_URL}/lipafo/payment/initiate`):

| Header | Purpose |
|---|---|
| `Authorization: Bearer <oauth2-token>` | Token from `${BANK_BASE_URL}/lipafo/auth/token` (cached, 1h TTL) |
| `X-Lipafo-Intent-Key` | Idempotency key — replay-safe on your side |
| `X-Lipafo-Trace-Id` | Distributed trace ID — echo it back in your response |
| `X-Lipafo-Bank-Code` | Routing code (e.g. `KCB_BUNI`) |
| `X-Lipafo-Timestamp` | ISO-8601 request time |

Expected bank response (Daraja pattern):

```json
{ "ResultCode": 0, "ResultDesc": "Success", "bank_reference": "BNK-..." }
```

`ResultCode != 0` → switch marks intent FAILED and increments circuit-breaker
failure count for that bank. 5 consecutive failures → circuit OPEN for 30s.

---

## 4. The 8 test scenarios you should run

Each scenario uses the same `curl` shape. Vary `idempotency_key` and amount.

```bash
curl -sS -X POST http://localhost:3000/v1/intents \
  -H 'content-type: application/json' \
  -d '{
    "idempotency_key":"qa-T1-happy-path",
    "payer_identifier":"MSISDN+254700000001",
    "payee_identifier":"PAYBILL-522522",
    "payee_bank":"KCB_BUNI",
    "amount":1500,
    "currency":"KES"
  }' | jq
```

| # | Test | Input change | Expected switch behaviour | Bank-side check |
|---|---|---|---|---|
| T1 | Happy path | amount=1500 | `ok:true, state:COMPLETED, ResultCode:0` | Credit posted, bank_reference returned |
| T2 | Idempotency replay | re-send T1 same key | `replayed:true`, **bank not called again** | No duplicate posting on your side |
| T3 | Concurrent replay | T1 key sent twice in parallel | First wins, second gets `409 in_flight` | Single posting only |
| T4 | Schema rejection | drop `amount` field | `400` from switch, **bank never contacted** | No traffic to bank |
| T5 | Network cap | amount=10_000_001 | `422 amount_above_network_cap` | No traffic to bank |
| T6 | Bank business decline | amount=1 (your sandbox rule) | `state:FAILED`, switch surfaces your `ResultCode/ResultDesc` verbatim | Your decline reason preserved |
| T7 | Bank timeout | bank delays >8s | `state:FAILED, bank_status:TIMEOUT`, latency≈8000ms | Confirm 8s budget honoured |
| T8 | Circuit breaker | 5× T7 in a row, then valid request | 6th call gets `503 CIRCUIT_OPEN`, no bank traffic | No requests to bank for 30s |

---

## 5. What to capture and return to Lipafo

For each scenario, please share:

1. The **request body** sent to the switch.
2. The **response JSON + HTTP status** from the switch.
3. The matching **bank-side log line** (your access log) showing the `X-Lipafo-Trace-Id` we sent.
4. For T2/T3: confirmation that **only one debit/credit** was posted on your core.
5. For T7: a screenshot or extract of your gateway showing the call took ≥8s and was abandoned by the switch.

A simple spreadsheet with one row per scenario is fine. Trace IDs are the key
correlator — please always echo `X-Lipafo-Trace-Id` in your response logs.

---

## 6. Logs & troubleshooting

```bash
docker compose logs -f switch        # structured JSON via Pino
docker compose logs -f redis
docker compose restart switch        # after editing .env
docker compose down -v               # clean reset (clears Redis state)
```

Common issues:

- **`circuit_open` on first call** → previous test failures still in Redis. `docker compose down -v` to reset.
- **`401` from your gateway** → `BANK_CLIENT_ID` / `BANK_CLIENT_SECRET` mismatch in `.env`.
- **`/readyz` returns 503** → Redis container not up. `docker compose ps`.

---

## 7. Out of scope for this drop

The following are intentionally **not** included in this package and will be
delivered in later milestones:

- Admin / monitoring UI
- Settlement & reconciliation engine
- Fee computation engine
- Merchant surfacing engine
- Multi-tenant XOF / WAEMU corridor
- mTLS pinning (currently OAuth2 Bearer only)

If your QA team needs any of those for sign-off, please flag it now so we can
sequence the next drop accordingly.

---

## 8. Support

Trace IDs in your logs map 1:1 to ours. When raising a defect, please include:

- `X-Lipafo-Trace-Id`
- `idempotency_key`
- Timestamp (UTC)
- Switch response JSON
- Bank gateway log excerpt

Contact: Lipafo Integration Desk (per cover email).
