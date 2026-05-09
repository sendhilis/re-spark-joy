// k6 ramp profile: 0 → 5000 VU over 5 minutes, hold 2 min, ramp down.
// Run: k6 run bench/k6-script.js
import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    ramp_to_5k: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 500 },
        { duration: "2m", target: 2000 },
        { duration: "2m", target: 5000 },
        { duration: "2m", target: 5000 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_duration: ["p(50)<15", "p(99)<80"],
    http_req_failed:   ["rate<0.01"],
  },
};

const BANKS = ["KCB", "EQUITY", "COOP", "FAMILY"];
const PAYEES = ["NAIVAS-001", "KPLC-MAIN", "JAVA-WST", "CARREFOUR-LAV"];
const URL = __ENV.SWITCH_URL ?? "http://localhost:3000/v1/intents";

export default function () {
  const body = JSON.stringify({
    idempotency_key: `k6-${__VU}-${__ITER}-${Date.now()}`,
    payer_identifier: `MSISDN+2547${10000000 + (__VU * 1000 + __ITER) % 89999999}`,
    payee_identifier: PAYEES[__ITER % PAYEES.length],
    payee_bank: BANKS[__ITER % BANKS.length],
    amount: 100 + (__ITER % 25000),
    currency: "KES",
  });
  const res = http.post(URL, body, { headers: { "content-type": "application/json" } });
  check(res, { "200": (r) => r.status === 200 });
}
