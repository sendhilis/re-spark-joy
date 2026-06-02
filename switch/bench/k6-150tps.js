// Lipafo Switch — UAT corridor soak at 150 TPS for 10 minutes.
//
// Run:
//   k6 run -e SWITCH_URL=https://41.242.3.83/v1/intents \
//          -e K6_INSECURE_SKIP_TLS_VERIFY=true \
//          bench/k6-150tps.js
//
// Profile: constant-arrival-rate at 150 req/s for 10 minutes, with enough
// pre-allocated VUs to absorb tail latency from the bank leg without
// dropping the arrival rate.

import http from "k6/http";
import { check } from "k6";

const URL = __ENV.SWITCH_URL ?? "https://41.242.3.83/v1/intents";

export const options = {
  insecureSkipTLSVerify: true, // TEST host uses self-signed cert
  scenarios: {
    uat_150tps: {
      executor: "constant-arrival-rate",
      rate: 150,
      timeUnit: "1s",
      duration: "10m",
      preAllocatedVUs: 200,
      maxVUs: 600,
    },
  },
  thresholds: {
    http_req_failed:   ["rate<0.01"],
    http_req_duration: ["p(95)<1500", "p(99)<2500"],
    checks:            ["rate>0.99"],
  },
};

const BANKS  = ["KCB_BUNI", "COOP", "EQUITY"];
const PAYEES = ["PAYBILL-522522", "PAYBILL-888880", "TILL-123456"];

export default function () {
  const idem = `uat-150-${__VU}-${__ITER}-${Date.now()}`;
  const body = JSON.stringify({
    idempotency_key: idem,
    payer_identifier: `MSISDN+2547${10000000 + ((__VU * 1000 + __ITER) % 89999999)}`,
    payee_identifier: PAYEES[__ITER % PAYEES.length],
    payee_bank: BANKS[__ITER % BANKS.length],
    amount: 100 + (__ITER % 25000),
    currency: "KES",
  });

  const res = http.post(URL, body, {
    headers: { "content-type": "application/json" },
    timeout: "15s",
    tags: { name: "POST /v1/intents" },
  });

  check(res, {
    "status is 200/202": (r) => r.status === 200 || r.status === 202,
    "not circuit_open":  (r) => !(r.body && r.body.includes("circuit_open")),
    "has bank_reference or trace_id": (r) => {
      try {
        const b = r.json();
        return Boolean(b && (b.bank_reference || b.trace_id));
      } catch {
        return false;
      }
    },
  });
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(
      {
        url: URL,
        iterations: data.metrics.iterations?.values?.count,
        http_req_failed_rate: data.metrics.http_req_failed?.values?.rate,
        p50_ms: data.metrics.http_req_duration?.values?.["p(50)"],
        p95_ms: data.metrics.http_req_duration?.values?.["p(95)"],
        p99_ms: data.metrics.http_req_duration?.values?.["p(99)"],
        max_ms: data.metrics.http_req_duration?.values?.max,
        checks_rate: data.metrics.checks?.values?.rate,
      },
      null,
      2,
    ) + "\n",
  };
}
