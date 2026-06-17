#!/usr/bin/env node
/**
 * Lipafo Admin Console — smoke test
 *
 * Usage:
 *   ADMIN_URL=https://admin-qa.example.com \
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_ANON_KEY=ey... \
 *   ADMIN_EMAIL=qa-admin@example.com \
 *   ADMIN_PASSWORD='...' \
 *   USER_EMAIL=qa-user@example.com \
 *   USER_PASSWORD='...' \
 *   node scripts/smoke-test.mjs
 *
 * Exits non-zero on any failure. Designed for CI.
 *
 * Checks:
 *   1. /admin loads (200 + SPA shell present)
 *   2. /auth loads (200 + SPA shell present)
 *   3. Non-admin sign-in CANNOT read admin-only tables (RLS)
 *   4. Admin sign-in CAN read admin-only tables (role gating)
 *   5. switch-process-intent edge function reachable; cross-bank intent
 *      returns COMPLETED and writes a masked bank_payload_audit row
 *   6. bank-simulator + settlement-midnight-run + switch-seed-demo respond
 */

const required = [
  "ADMIN_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY",
  "ADMIN_EMAIL", "ADMIN_PASSWORD", "USER_EMAIL", "USER_PASSWORD",
];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`✗ Missing required env var: ${k}`);
    process.exit(2);
  }
}

const {
  ADMIN_URL, SUPABASE_URL, SUPABASE_ANON_KEY,
  ADMIN_EMAIL, ADMIN_PASSWORD, USER_EMAIL, USER_PASSWORD,
} = process.env;

const results = [];
let failed = 0;

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const tag = ok ? "✓" : "✗";
  console.log(`${tag} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failed++;
}

async function expectOk(name, p) {
  try {
    const detail = await p;
    record(name, true, detail ?? "");
  } catch (e) {
    record(name, false, e.message);
  }
}

// ── 1. SPA routes load ──────────────────────────────────────────────────────
async function loads(path) {
  const r = await fetch(`${ADMIN_URL}${path}`, { redirect: "manual" });
  const body = await r.text();
  if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
  if (!body.includes("<div id=\"root\">") && !body.includes("id=\"root\""))
    throw new Error("SPA shell missing");
  return `HTTP 200, ${body.length}B`;
}

// ── Auth helpers ────────────────────────────────────────────────────────────
async function signIn(email, password) {
  const r = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password }),
    },
  );
  const j = await r.json();
  if (!r.ok || !j.access_token)
    throw new Error(`auth failed: ${j.error_description || j.msg || r.status}`);
  return j.access_token;
}

async function selectFrom(table, token) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=5`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    },
  );
  const body = await r.json().catch(() => []);
  return { status: r.status, rows: Array.isArray(body) ? body.length : 0, body };
}

// ── Edge function helpers ───────────────────────────────────────────────────
async function callFn(name, body, token) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: r.status, json };
}

// ── Run ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`▶ Lipafo Admin smoke test against ${ADMIN_URL}\n`);

  // 1. SPA routes
  await expectOk("/admin loads",       loads("/admin"));
  await expectOk("/auth  loads",       loads("/auth"));
  await expectOk("/      loads",       loads("/"));

  // 2. Sign in both identities
  let adminToken, userToken;
  await expectOk("admin user sign-in", (async () => {
    adminToken = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
    return `token len=${adminToken.length}`;
  })());
  await expectOk("non-admin sign-in",  (async () => {
    userToken = await signIn(USER_EMAIL, USER_PASSWORD);
    return `token len=${userToken.length}`;
  })());

  // 3. Role gating — non-admin must NOT see admin-only tables
  if (userToken) {
    for (const t of ["participating_banks", "lipafo_alias_registry",
                     "merchant_listing_revenue", "settlement_instructions"]) {
      await expectOk(`RLS denies non-admin on ${t}`, (async () => {
        const r = await selectFrom(t, userToken);
        if (r.rows > 0) throw new Error(`leaked ${r.rows} rows`);
        return `status=${r.status}, rows=0`;
      })());
    }
  }

  // 4. Admin must see them
  if (adminToken) {
    for (const t of ["participating_banks", "bank_payload_audit",
                     "settlement_instructions"]) {
      await expectOk(`admin can read ${t}`, (async () => {
        const r = await selectFrom(t, adminToken);
        if (r.status !== 200) throw new Error(`status=${r.status}`);
        return `status=200, rows=${r.rows}`;
      })());
    }
  }

  // 5. switch-process-intent — masked cross-bank flow (GAB → KCB)
  const idem = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await expectOk("switch-process-intent: GAB→KCB COMPLETED", (async () => {
    const r = await callFn("switch-process-intent", {
      idempotency_key: idem,
      payer_identifier: "+254700111222",
      payer_bank: "GAB",
      payee_identifier: "VOOMA-NAIVAS-001",
      payee_bank: "KCB",
      amount: 1500,
      currency: "KES",
    }, adminToken);
    if (r.status !== 200) throw new Error(`status=${r.status}: ${JSON.stringify(r.json)}`);
    if (r.json.state !== "COMPLETED")
      throw new Error(`state=${r.json.state} ResultDesc=${r.json.ResultDesc}`);
    return `intent ${r.json.intent_id} in ${r.json.latency_ms}ms`;
  })());

  // 5b. Audit row written with masking applied + payer_msisdn null in terminating payload
  if (adminToken) {
    await expectOk("masking proof: bank_payload_audit row is masked", (async () => {
      // Give Postgres a moment for the insert to land.
      await new Promise(r => setTimeout(r, 600));
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/bank_payload_audit` +
          `?select=masking_applied,terminating_payload,switch_stored_payload` +
          `&order=created_at.desc&limit=1`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${adminToken}` } },
      );
      const rows = await r.json();
      if (!rows.length) throw new Error("no audit row");
      const row = rows[0];
      if (!row.masking_applied) throw new Error("masking_applied=false");
      if (row.terminating_payload?.payer_msisdn !== null)
        throw new Error(`leaked MSISDN: ${row.terminating_payload?.payer_msisdn}`);
      if (!String(row.terminating_payload?.payer_token ?? "").startsWith("tok_"))
        throw new Error("payer_token missing");
      return `token=${row.terminating_payload.payer_token.slice(0, 12)}…`;
    })());
  }

  // 6. Other edge functions reachable
  for (const fn of ["bank-simulator", "switch-seed-demo", "settlement-midnight-run"]) {
    await expectOk(`edge fn reachable: ${fn}`, (async () => {
      const r = await callFn(fn, { dry_run: true }, adminToken);
      // 200, 400, 422 = function executed and responded; anything else = transport failure
      if (![200, 400, 422].includes(r.status))
        throw new Error(`status=${r.status}: ${JSON.stringify(r.json).slice(0, 200)}`);
      return `status=${r.status}`;
    })());
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n──────────────────────────────────────────");
  console.log(`Passed: ${results.length - failed}/${results.length}`);
  if (failed) {
    console.log(`Failed: ${failed}`);
    process.exit(1);
  }
  console.log("All smoke checks passed.");
})().catch((e) => {
  console.error("Smoke runner crashed:", e);
  process.exit(3);
});
