// Lipafo Switch Engine — ported from the standalone Node prototype.
// Single edge function exposing actions: payment | metrics | settlement | positions | reset
// Implements the 8 challenges: idempotency, FSM event log, hot-partition counters,
// settlement determinism, per-bank circuit breakers, pre-computed positions,
// fraud velocity, and observability.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trace-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Config (from config.js) ─────────────────────────────────────────────────
const TXN_STATE = {
  INITIATED: "INITIATED", VALIDATED: "VALIDATED", DEBITED: "DEBITED",
  CREDITED: "CREDITED", COMPLETED: "COMPLETED", FAILED: "FAILED", REVERSED: "REVERSED",
};
const FRAUD_LIMITS = { TXN_PER_MINUTE: 200, TXN_PER_HOUR: 1000, AMOUNT_PER_DAY: 500000_00 };
const MAX_TXN_AMOUNT = 999999_00;

const BANK_REGISTRY: Record<string, { name: string; bic: string; latency_ms: number; failure_rate: number }> = {
  KCB:     { name: "KCB Bank Kenya",     bic: "KCBLKENX", latency_ms: 80,  failure_rate: 0.02 },
  COOP:    { name: "Co-operative Bank",  bic: "COOPKENA", latency_ms: 150, failure_rate: 0.03 },
  EQUITY:  { name: "Equity Bank Kenya",  bic: "EQBLKENA", latency_ms: 120, failure_rate: 0.02 },
  ABSA:    { name: "Absa Bank Kenya",    bic: "BARCKENX", latency_ms: 200, failure_rate: 0.04 },
  FAMILY:  { name: "Family Bank Kenya",  bic: "FABLKENA", latency_ms: 300, failure_rate: 0.05 },
  DTB:     { name: "Diamond Trust Bank", bic: "DTKEKENA", latency_ms: 250, failure_rate: 0.03 },
  NCBA:    { name: "NCBA Bank Kenya",    bic: "CBAFKENX", latency_ms: 180, failure_rate: 0.03 },
  STANBIC: { name: "Stanbic Bank Kenya", bic: "SBICKENX", latency_ms: 220, failure_rate: 0.04 },
};

const ALIAS_SEED: Record<string, { bank_code: string; account_name: string; account_ref: string }> = {
  "0722000001": { bank_code: "KCB",    account_name: "Jane Wanjiku",          account_ref: "KCB-001" },
  "0722000002": { bank_code: "COOP",   account_name: "Mama Mboga Supermarket",account_ref: "COOP-001" },
  "0722000003": { bank_code: "EQUITY", account_name: "John Kamau",            account_ref: "EQ-001" },
  "0722000004": { bank_code: "ABSA",   account_name: "Wairimu Holdings Ltd",  account_ref: "ABSA-001" },
  "0722000005": { bank_code: "FAMILY", account_name: "Mwangi Traders",        account_ref: "FAM-001" },
};

const SANCTIONS = new Set(["0700000000", "9999999999"]);

// ─── Module-scoped in-memory store (Redis surrogate per warm instance) ───────
type State = {
  startTime: number;
  total: number; completed: number; failed: number; duplicates: number;
  tps_window: number[]; latencies: number[];
  errors: Record<string, number>;
  // idempotency: key -> cached result
  idem: Map<string, any>;
  // velocity: subject:bucket -> { count, total, expires }
  vel: Map<string, { count: number; total: number; expires: number }>;
  // positions: date:from:to -> netCents
  pos: Map<string, number>;
  // circuit breakers
  cb: Record<string, { state: "CLOSED" | "OPEN" | "HALF_OPEN"; failureCount: number; openedAt: number | null; lastFailureAt: number | null }>;
};
// deno-lint-ignore no-explicit-any
const g = globalThis as any;
if (!g.__lipafo) {
  g.__lipafo = {
    startTime: Date.now(),
    total: 0, completed: 0, failed: 0, duplicates: 0,
    tps_window: [], latencies: [], errors: {},
    idem: new Map(), vel: new Map(), pos: new Map(), cb: {},
  } as State;
}
const S: State = g.__lipafo;

const FAILURE_THRESHOLD = 5;
const RECOVERY_TIMEOUT  = 30_000;

function getBreaker(code: string) {
  if (!S.cb[code]) S.cb[code] = { state: "CLOSED", failureCount: 0, openedAt: null, lastFailureAt: null };
  return S.cb[code];
}
function canCall(code: string) {
  const b = getBreaker(code);
  if (b.state === "CLOSED") return true;
  if (b.state === "OPEN") {
    if (Date.now() - (b.openedAt ?? 0) > RECOVERY_TIMEOUT) { b.state = "HALF_OPEN"; return true; }
    return false;
  }
  return true;
}
function recordSuccess(code: string) {
  const b = getBreaker(code);
  b.failureCount = 0;
  if (b.state === "HALF_OPEN") b.state = "CLOSED";
}
function recordFailure(code: string) {
  const b = getBreaker(code);
  b.failureCount++;
  b.lastFailureAt = Date.now();
  if (b.failureCount >= FAILURE_THRESHOLD && b.state === "CLOSED") {
    b.state = "OPEN"; b.openedAt = Date.now();
  }
}

const uuid = () => crypto.randomUUID();
function ltr() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 99999999).toString().padStart(8, "0");
  return `LTR-${date}-${rand}`;
}

// ─── Fraud (in-memory velocity, <10ms) ───────────────────────────────────────
function evaluateFraud(txn: any) {
  const start = Date.now();
  if (SANCTIONS.has(txn.sender_phone) || SANCTIONS.has(txn.receiver_phone)) {
    return { score: 1.0, flags: ["SANCTIONS_MATCH"], blocked: true, latency_ms: Date.now() - start };
  }
  if (txn.amount_cents > MAX_TXN_AMOUNT) return { score: 0.9, flags: ["AMOUNT_EXCEEDS_LIMIT"], blocked: true, latency_ms: Date.now() - start };
  if (txn.amount_cents <= 0)             return { score: 0.9, flags: ["INVALID_AMOUNT"], blocked: true, latency_ms: Date.now() - start };

  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const hour   = Math.floor(now / 3600000);
  const day    = new Date().toISOString().slice(0, 10);
  const flags: string[] = []; const scores: number[] = [];

  const bump = (k: string, n: number, ttlMs: number) => {
    const cur = S.vel.get(k);
    if (cur && cur.expires > now) { cur.count += 1; cur.total += n; return cur; }
    const next = { count: 1, total: n, expires: now + ttlMs };
    S.vel.set(k, next);
    return next;
  };
  const m = bump(`min:${txn.sender_phone}:${minute}`, txn.amount_cents, 120_000);
  if (m.count > FRAUD_LIMITS.TXN_PER_MINUTE) { scores.push(0.8); flags.push(`VELOCITY_MINUTE:${m.count}`); }
  const h = bump(`hr:${txn.sender_phone}:${hour}`, txn.amount_cents, 7_200_000);
  if (h.count > FRAUD_LIMITS.TXN_PER_HOUR) { scores.push(0.7); flags.push(`VELOCITY_HOUR:${h.count}`); }
  const d = bump(`amt:${txn.sender_phone}:${day}`, txn.amount_cents, 90_000_000);
  if (d.total > FRAUD_LIMITS.AMOUNT_PER_DAY) { scores.push(0.75); flags.push(`DAILY_LIMIT:${d.total}`); }

  const score = scores.length ? Math.max(...scores) : 0.05;
  return { score, flags, blocked: score >= 0.8, latency_ms: Date.now() - start };
}

// ─── Bank connector simulation ───────────────────────────────────────────────
async function bankCall(code: string, op: "DEBIT" | "CREDIT", txnId: string) {
  const bank = BANK_REGISTRY[code];
  if (!bank) throw new Error(`Unknown bank: ${code}`);
  const jitter = (Math.random() - 0.5) * 40;
  const latency = Math.max(20, bank.latency_ms + jitter);
  await new Promise(r => setTimeout(r, latency));
  if (Math.random() < bank.failure_rate) throw new Error(`${code} ${op} failed: upstream timeout`);
  return { reference: `${code}-${Date.now()}-${txnId.slice(0, 6)}` };
}
async function debit(code: string, txnId: string) {
  if (!canCall(code)) throw new Error(`Circuit OPEN for ${code}`);
  try { const r = await bankCall(code, "DEBIT", txnId); recordSuccess(code); return r; }
  catch (e) { recordFailure(code); throw e; }
}
async function credit(code: string, txnId: string) {
  if (!canCall(code)) throw new Error(`Circuit OPEN for ${code}`);
  try { const r = await bankCall(code, "CREDIT", txnId); recordSuccess(code); return r; }
  catch (e) { recordFailure(code); throw e; }
}

// ─── Settlement ──────────────────────────────────────────────────────────────
function bumpPosition(from: string, to: string, amountCents: number) {
  const date = new Date().toISOString().slice(0, 10);
  const key  = `${date}:${from}:${to}`;
  const cur  = S.pos.get(key) ?? 0;
  const next = cur + amountCents;
  S.pos.set(key, next);
  return { date, key, next };
}

function computeSettlement(date = new Date().toISOString().slice(0, 10)) {
  const gross: Record<string, { sent: number; received: number }> = {};
  let totalVolume = 0;
  let txnCount = 0;
  for (const [k, amount] of S.pos.entries()) {
    if (!k.startsWith(date + ":")) continue;
    const [, from, to] = k.split(":");
    if (amount <= 0) continue;
    gross[from]   ??= { sent: 0, received: 0 };
    gross[to]     ??= { sent: 0, received: 0 };
    gross[from].sent     += amount;
    gross[to].received   += amount;
    totalVolume          += amount;
    txnCount++;
  }
  const net = Object.entries(gross).map(([bank, p]) => ({
    bank, net_cents: p.received - p.sent, gross_sent_cents: p.sent, gross_received_cents: p.received,
  }));
  const payers    = net.filter(b => b.net_cents < 0).sort((a, b) => a.net_cents - b.net_cents)
                       .map(p => ({ ...p, remaining: -p.net_cents }));
  const receivers = net.filter(b => b.net_cents > 0).sort((a, b) => b.net_cents - a.net_cents)
                       .map(r => ({ ...r, remaining: r.net_cents }));
  const obligations: any[] = [];
  let pi = 0, ri = 0;
  while (pi < payers.length && ri < receivers.length) {
    const amt = Math.min(payers[pi].remaining, receivers[ri].remaining);
    if (amt > 0.01) obligations.push({
      paying_bank: payers[pi].bank, receiving_bank: receivers[ri].bank,
      amount_cents: Math.round(amt), amount_kes: (amt / 100).toFixed(2),
      instruction: `KEPSS: ${payers[pi].bank} → ${receivers[ri].bank} KES ${(amt/100).toFixed(2)}`,
    });
    payers[pi].remaining -= amt; receivers[ri].remaining -= amt;
    if (payers[pi].remaining < 0.01) pi++;
    if (receivers[ri].remaining < 0.01) ri++;
  }
  return {
    date, settlement_id: `SETTLE-${date}-${Date.now()}`,
    generated_at: new Date().toISOString(),
    total_volume_cents: Math.round(totalVolume),
    total_volume_kes: (totalVolume / 100).toFixed(2),
    bank_count: Object.keys(gross).length, gross_txn_count: txnCount,
    positions: net, net_obligations: obligations,
    kepss_summary: obligations.map(o => o.instruction),
  };
}

// ─── Supabase async persistence (fire-and-forget) ────────────────────────────
function getSupabase() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}
function persistTxn(sb: any, txn: any) {
  sb.from("lipafo_transactions").upsert({
    id: txn.txn_id, idempotency_key: txn.idempotency_key, state: txn.state, ltr: txn.ltr,
    sender_phone: txn.sender_phone, sender_bank: txn.sender_bank,
    receiver_phone: txn.receiver_phone, receiver_bank: txn.receiver_bank, receiver_name: txn.receiver_name,
    amount_cents: txn.amount_cents, currency: txn.currency,
    fraud_score: txn.fraud_score, latency_ms: txn.latency_ms,
    error_code: txn.error_code ?? null, debit_ref: txn.debit_ref ?? null, credit_ref: txn.credit_ref ?? null,
    completed_at: txn.state === "COMPLETED" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" }).then(() => {}, () => {});
}
function persistPos(sb: any, date: string, from: string, to: string, netCents: number) {
  sb.from("lipafo_positions").upsert({
    id: `${date}_${from}_${to}`, date, sending_bank: from, receiving_bank: to,
    net_cents: netCents, updated_at: new Date().toISOString(),
  }, { onConflict: "id" }).then(() => {}, () => {});
}

// ─── Main pipeline ───────────────────────────────────────────────────────────
async function processPayment(req: any, sb: any) {
  const start = Date.now();
  const { idempotency_key, sender_phone, receiver_phone, amount_cents, currency } = req;
  if (!idempotency_key || !sender_phone || !receiver_phone || !amount_cents) {
    return { success: false, error: "MISSING_FIELDS" };
  }

  // C1 idempotency
  if (S.idem.has(idempotency_key)) {
    return { success: true, duplicate: true, txn: S.idem.get(idempotency_key) };
  }

  const senderAlias   = ALIAS_SEED[sender_phone];
  const receiverAlias = ALIAS_SEED[receiver_phone];
  if (!receiverAlias) return { success: false, error: "ALIAS_NOT_FOUND" };

  const sender_bank   = senderAlias?.bank_code || "KCB";
  const receiver_bank = receiverAlias.bank_code;
  if (!BANK_REGISTRY[sender_bank] || !BANK_REGISTRY[receiver_bank]) {
    return { success: false, error: "BANK_NOT_FOUND" };
  }

  let txn: any = {
    txn_id: uuid(), idempotency_key, ltr: ltr(), state: TXN_STATE.INITIATED,
    sender_phone, sender_bank, receiver_phone, receiver_bank,
    receiver_name: receiverAlias.account_name,
    amount_cents, currency: currency || "KES", fraud_score: 0,
  };
  persistTxn(sb, txn);

  try {
    // C7 fraud
    const fraud = evaluateFraud(txn);
    txn.fraud_score = fraud.score; txn.state = TXN_STATE.VALIDATED;
    persistTxn(sb, txn);
    if (fraud.blocked) {
      txn.state = TXN_STATE.FAILED; txn.error_code = `FRAUD_BLOCKED:${fraud.flags.join(",")}`;
      persistTxn(sb, txn);
      return { success: false, error: "FRAUD_BLOCKED", flags: fraud.flags, txn_id: txn.txn_id, ltr: txn.ltr };
    }

    // C5 bank calls
    let debitResult: any, creditResult: any;
    if (sender_bank === receiver_bank) {
      [debitResult, creditResult] = await Promise.all([debit(sender_bank, txn.txn_id), credit(receiver_bank, txn.txn_id)]);
    } else {
      debitResult = await debit(sender_bank, txn.txn_id);
    }
    txn.state = TXN_STATE.DEBITED; txn.debit_ref = debitResult.reference; persistTxn(sb, txn);

    if (!creditResult) {
      try { creditResult = await credit(receiver_bank, txn.txn_id); }
      catch (err) {
        txn.state = TXN_STATE.REVERSED; txn.error_code = `CREDIT_FAILED:${(err as Error).message}`;
        persistTxn(sb, txn);
        return { success: false, error: "CREDIT_FAILED", txn_id: txn.txn_id, ltr: txn.ltr };
      }
    }
    txn.state = TXN_STATE.CREDITED; txn.credit_ref = creditResult.reference; persistTxn(sb, txn);

    const latency_ms = Date.now() - start;
    txn.state = TXN_STATE.COMPLETED; txn.latency_ms = latency_ms;
    persistTxn(sb, txn);

    // C3+C6 pre-computed positions
    const { date, next } = bumpPosition(sender_bank, receiver_bank, amount_cents);
    persistPos(sb, date, sender_bank, receiver_bank, next);

    const result = {
      success: true, txn_id: txn.txn_id, ltr: txn.ltr, state: TXN_STATE.COMPLETED,
      sender_bank, receiver_bank, receiver_name: txn.receiver_name,
      amount_cents, amount_kes: (amount_cents / 100).toFixed(2),
      latency_ms, fraud_score: fraud.score,
    };
    S.idem.set(idempotency_key, result);
    return result;
  } catch (err) {
    txn.state = TXN_STATE.FAILED; txn.error_code = (err as Error).message; persistTxn(sb, txn);
    return { success: false, error: "SWITCH_ERROR", message: (err as Error).message, txn_id: txn.txn_id, ltr: txn.ltr };
  }
}

function recordMetric(result: any, latency_ms: number) {
  S.total++;
  S.tps_window.push(Date.now());
  const cutoff = Date.now() - 60_000;
  S.tps_window = S.tps_window.filter(t => t > cutoff);
  S.latencies.push(latency_ms);
  if (S.latencies.length > 1000) S.latencies.shift();
  if (result?.duplicate) S.duplicates++;
  else if (result?.success) S.completed++;
  else { S.failed++; const k = result?.error || "UNKNOWN"; S.errors[k] = (S.errors[k] || 0) + 1; }
}
function pct(arr: number[], p: number) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil(p / 100 * s.length) - 1)];
}
function getMetrics() {
  const now = Date.now();
  const w10 = S.tps_window.filter(t => t > now - 10_000);
  return {
    uptime_s: Math.round((now - S.startTime) / 1000),
    total_transactions: S.total, completed: S.completed, failed: S.failed, duplicates: S.duplicates,
    success_rate_pct: S.total > 0 ? ((S.completed / S.total) * 100).toFixed(2) : "0.00",
    tps: { last_10s: w10.length ? (w10.length / 10).toFixed(1) : "0.0",
           last_60s: S.tps_window.length ? (S.tps_window.length / 60).toFixed(1) : "0.0" },
    latency_ms: { p50: pct(S.latencies, 50), p95: pct(S.latencies, 95), p99: pct(S.latencies, 99),
                  last: S.latencies[S.latencies.length - 1] || 0 },
    error_breakdown: S.errors,
    circuit_breakers: Object.entries(BANK_REGISTRY).map(([code, bank]) => ({
      bank_code: code, bank_name: bank.name, ...getBreaker(code),
    })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "payment";
    const sb = getSupabase();

    if (action === "payment") {
      const start = Date.now();
      const result = await processPayment(body.payload || body, sb);
      const latency_ms = Date.now() - start;
      recordMetric(result, latency_ms);
      return new Response(JSON.stringify({ ...result, latency_ms }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "metrics")    return json(getMetrics());
    if (action === "settlement") return json(computeSettlement());
    if (action === "positions") {
      const date = new Date().toISOString().slice(0, 10);
      const positions = [...S.pos.entries()].filter(([k]) => k.startsWith(date + ":")).map(([k, v]) => {
        const [, from, to] = k.split(":");
        return { sending_bank: from, receiving_bank: to, net_cents: Math.round(v), net_kes: (v / 100).toFixed(2) };
      });
      return json({ date, positions });
    }
    if (action === "reset") {
      g.__lipafo = undefined;
      return json({ ok: true, message: "Switch state reset (current instance)" });
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
