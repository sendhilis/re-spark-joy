# Lipafo Switch — UAT Corridor Runbook

Target host (TEST): `https://41.242.3.83`
Build: Drop 2 (post security evidence pack)
Audience: Bank QA tester executing UAT corridor validation on behalf of KCB.

---

## 0. Pre-flight (5 min)

Run from the tester workstation that will be the system of record for evidence.

```bash
export SWITCH=https://41.242.3.83
curl -ksS -w "\nHTTP %{http_code} %{time_total}s\n" $SWITCH/healthz
curl -ksS -w "\nHTTP %{http_code} %{time_total}s\n" $SWITCH/readyz
```

Pass = both return `{"ok":true}` with HTTP 200. Record latency.

> TLS note: the TEST host uses a self-signed cert. Use `-k` (curl) and
> disable certificate validation in Postman (Settings → General →
> SSL certificate verification = OFF) for the duration of UAT only.

Capture the build hash:
```bash
curl -ksS $SWITCH/healthz -i | grep -i 'x-build\|x-version' || echo "no build header"
```

---

## 1. Happy-path corridor calls

Use the existing Postman collection
`switch/qa/lipafo-switch-gap-tests.postman_collection.json` **plus** the
main acceptance collection (`BANK-TEST-INSTRUCTIONS.md` T1–T8).

Set the Postman environment:

| Variable | Value |
|---|---|
| `baseUrl` | `https://41.242.3.83` |
| `payer` | `MSISDN+254700000001` |
| `payee` | `PAYBILL-522522` |
| `payeeBank` | `KCB_BUNI` (and re-run with `COOP`, `EQUITY`) |
| `timeoutPayee` | `PAYBILL-SLOW-STUB` |

### Corridor matrix (must all be executed)

| # | Source bank | Destination bank | Test set |
|---|---|---|---|
| C1 | KCB | COOP | T1, T2, T3, T6 |
| C2 | KCB | EQUITY | T1, T2, T3, T6 |
| C3 | KCB | KCB (intra-bank control) | T1 only |

Negatives (run once, any corridor):

| # | Test |
|---|---|
| N1 | V1 — missing field → 400 |
| N2 | V2 — amount > 10M → 422 |
| N3 | V3 — currency = GBP → 400 |
| N4 | V4a/V4b — amount 0 / -1 → 400 |
| N5 | R3 — timeout payee → 504 at 8s ±200ms |

For every call, record into the evidence pack:
- Request body (with idempotency key)
- HTTP status, response body
- `latency_ms` from response, Postman round-trip ms
- `trace_id` and `bank_reference` (if present)
- Time (UTC)

---

## 2. 150 TPS soak (10 minutes)

Use the dedicated k6 script `switch/bench/k6-150tps.js`.

```bash
k6 run -e SWITCH_URL=https://41.242.3.83/v1/intents \
       -e K6_INSECURE_SKIP_TLS_VERIFY=true \
       switch/bench/k6-150tps.js \
  | tee uat-150tps-$(date -u +%Y%m%dT%H%M%SZ).log
```

Pass criteria (must all be green in the k6 summary):
- `http_req_failed` rate < 1%
- `http_req_duration` p95 < 1500 ms
- `http_req_duration` p99 < 2500 ms
- `iterations` count ≈ 90,000 over 10 min (150 × 600)
- Zero `circuit_open` responses from the switch

Attach the full k6 stdout summary + the per-stage table to the evidence
pack. Also capture switch-side telemetry during the run:

```bash
# from the host running the switch (or via bank ops)
docker compose logs --since 12m switch > uat-soak-switch.log
docker stats --no-stream switch redis nginx > uat-soak-resources.txt
```

---

## 3. Post-run hygiene

1. Replay one idempotency key from C1 after the soak — must still return
   the cached response (proves Redis survived the load).
2. Hit `/readyz` once more — must still be `200 {"ok":true}`.
3. Tail `docker compose logs switch` for any `ERROR` or `FATAL` lines
   during the soak window. Zero is the pass bar.

---

## 4. Deliverables back to Lipafo

Bundle into a single zip named
`uat-evidence-<bank>-<YYYYMMDD>.zip` containing:

- Filled-in `UAT-EVIDENCE-PACK.md`
- Postman run export (`.json`) for the corridor matrix
- `uat-150tps-*.log`
- `uat-soak-switch.log`
- `uat-soak-resources.txt`
- Screenshots of `/healthz` and `/readyz` pre and post soak
- Any defect notes

Send to the Lipafo integration lead. We will produce the
**UAT Readiness Report v3** within 24h of receipt.
