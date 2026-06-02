# Lipafo Switch — UAT Evidence Pack

Fill one of these per UAT run. Target host: `https://41.242.3.83` (TEST).

---

## Header

| Field | Value |
|---|---|
| Run ID |  |
| Date (UTC start / end) |  |
| Tester name |  |
| Tester organisation |  |
| Build / commit hash |  |
| Switch URL | `https://41.242.3.83` |
| Postman collection version |  |
| k6 version (`k6 version`) |  |

---

## A. Pre-flight

| Check | Command | Result | Latency | Pass? |
|---|---|---|---|---|
| Liveness | `curl -ksS $SWITCH/healthz` |  |  | ☐ |
| Readiness | `curl -ksS $SWITCH/readyz` |  |  | ☐ |
| TLS cert seen | `openssl s_client -connect 41.242.3.83:443 -servername 41.242.3.83 </dev/null 2>/dev/null \| openssl x509 -noout -subject -issuer -dates` |  | — | ☐ |

Notes:
```
<paste here>
```

---

## B. Corridor matrix — happy path & idempotency

For each cell: paste request body, response body, HTTP status, `latency_ms`,
`trace_id`, `bank_reference`. Use one block per test.

### C1  KCB → COOP

#### T1 happy path
```
REQUEST:
RESPONSE (HTTP ___, ___ ms):
trace_id:          bank_reference:
```
Result: ☐ PASS ☐ FAIL

#### T2 idempotency replay (same key twice)
```
1st CALL (HTTP ___):
2nd CALL (HTTP ___, must echo same bank_reference):
```
Result: ☐ PASS ☐ FAIL

#### T3 concurrent replay (parallel, same key)
```
Outcome: one 200, one 409 in_flight? ☐ yes ☐ no
```
Result: ☐ PASS ☐ FAIL

#### T6 bank decline (amount=1)
```
RESPONSE (verbatim ResultCode/ResultDesc):
```
Result: ☐ PASS ☐ FAIL

### C2  KCB → EQUITY
*(Repeat T1, T2, T3, T6 blocks above.)*

### C3  KCB → KCB (intra-bank control)
*(T1 only.)*

---

## C. Negative tests

| ID | Test | Expected | Actual HTTP | Actual body excerpt | Pass? |
|---|---|---|---|---|---|
| N1 | V1 missing field | 400 |  |  | ☐ |
| N2 | V2 amount > 10M | 422 |  |  | ☐ |
| N3 | V3 currency=GBP | 400 |  |  | ☐ |
| N4a | V4a amount=0 | 400 |  |  | ☐ |
| N4b | V4b amount=-1 | 400 |  |  | ☐ |
| N5 | R3 timeout payee | 504 @ 8000±200 ms |  |  | ☐ |

---

## D. 150 TPS soak (10 minutes)

Command used:
```
k6 run -e SWITCH_URL=https://41.242.3.83/v1/intents \
       -e K6_INSECURE_SKIP_TLS_VERIFY=true \
       bench/k6-150tps.js
```

k6 summary:

| Metric | Target | Actual | Pass? |
|---|---|---|---|
| Iterations | ≈ 90,000 |  | ☐ |
| `http_req_failed` rate | < 1% |  | ☐ |
| p50 latency | informational |  | — |
| p95 latency | < 1500 ms |  | ☐ |
| p99 latency | < 2500 ms |  | ☐ |
| Max latency | informational |  | — |
| `circuit_open` responses | 0 |  | ☐ |
| `checks` pass rate | > 99% |  | ☐ |

Resource snapshot during soak (`docker stats`):
```
<paste>
```

Switch error/fatal lines during soak window:
```
<paste output of: grep -iE 'error|fatal' uat-soak-switch.log | head -50>
```

---

## E. Post-soak hygiene

| Check | Result | Pass? |
|---|---|---|
| Replay of pre-soak idempotency key still returns cached response |  | ☐ |
| `/readyz` still 200 |  | ☐ |
| Zero ERROR/FATAL lines in switch logs during soak |  | ☐ |

---

## F. Defects raised

| # | Severity | Description | Repro | Owner |
|---|---|---|---|---|
|  |  |  |  |  |

---

## G. Verdict

Overall corridor readiness: ☐ READY FOR UAT TRAFFIC ☐ CONDITIONAL ☐ NOT READY

Tester comments:
```
```

### Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Bank QA Tester |  |  |  |
| Bank QA Lead |  |  |  |
| Lipafo Integration Lead |  |  |  |
