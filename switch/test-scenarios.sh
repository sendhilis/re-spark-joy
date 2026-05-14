#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Lipafo Switch — Bank QA test runner
# Executes the 8 acceptance scenarios from BANK-TEST-INSTRUCTIONS.md
# Usage:  ./test-scenarios.sh            (assumes switch on http://localhost:3000)
#         BASE=http://10.0.0.5:3000 ./test-scenarios.sh
# -----------------------------------------------------------------------------
set -u
BASE="${BASE:-http://localhost:3000}"
PAYER="MSISDN+254700000001"
PAYEE="PAYBILL-522522"
BANK="KCB_BUNI"

post() {
  local key="$1" amount="$2" extra="${3:-}"
  curl -sS -o /tmp/resp.json -w "HTTP %{http_code}  %{time_total}s\n" \
    -X POST "$BASE/v1/intents" \
    -H 'content-type: application/json' \
    -d "{\"idempotency_key\":\"$key\",\"payer_identifier\":\"$PAYER\",\"payee_identifier\":\"$PAYEE\",\"payee_bank\":\"$BANK\",\"amount\":$amount,\"currency\":\"KES\"$extra}"
  cat /tmp/resp.json | (command -v jq >/dev/null && jq . || cat); echo
}

echo "== T1  Happy path =================================================="
post "qa-T1-$(date +%s)" 1500

echo "== T2  Idempotency replay (same key) ==============================="
KEY="qa-T2-fixed-key"
post "$KEY" 1500
echo "--- replay ---"
post "$KEY" 1500

echo "== T3  Concurrent replay (parallel) ================================"
KEY="qa-T3-$(date +%s)"
( post "$KEY" 1500 & post "$KEY" 1500 & wait )

echo "== T4  Schema rejection (missing amount) ==========================="
curl -sS -o /tmp/resp.json -w "HTTP %{http_code}\n" -X POST "$BASE/v1/intents" \
  -H 'content-type: application/json' \
  -d "{\"idempotency_key\":\"qa-T4-$(date +%s)\",\"payer_identifier\":\"$PAYER\",\"payee_identifier\":\"$PAYEE\"}"
cat /tmp/resp.json; echo

echo "== T5  Network structural cap (>10M) ==============================="
post "qa-T5-$(date +%s)" 10000001

echo "== T6  Bank business decline (amount=1, sandbox rule) =============="
post "qa-T6-$(date +%s)" 1

echo "== T7  Bank timeout (sandbox-induced delay) ========================"
echo "  Configure bank sandbox to delay >8000ms for this payee, then run:"
post "qa-T7-$(date +%s)" 1500

echo "== T8  Circuit breaker (5x T7 then valid request) =================="
for i in 1 2 3 4 5; do post "qa-T8-fail-$i-$(date +%s)" 1500; done
echo "--- 6th request should be rejected locally (503 circuit_open) ---"
post "qa-T8-blocked-$(date +%s)" 1500

echo "== Done. Capture switch logs:  docker compose logs switch > switch.log"
