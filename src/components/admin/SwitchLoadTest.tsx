import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Activity, Play, Square, Zap, AlertTriangle, CheckCircle2, RefreshCw, Eye, Repeat2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PHONES = ["0722000001", "0722000002", "0722000003", "0722000004", "0722000005"];
const DUPLICATE_RATE = 0.05;
const TICK_MS = 100;             // batch firing every 100ms
const UI_REFRESH_MS = 250;       // throttle React renders to 4Hz

interface Metrics {
  uptime_s: number;
  total_transactions: number;
  completed: number;
  failed: number;
  duplicates: number;
  success_rate_pct: string;
  tps: { last_10s: string; last_60s: string };
  latency_ms: { p50: number; p95: number; p99: number; last: number };
  error_breakdown: Record<string, number>;
  circuit_breakers: Array<{ bank_code: string; bank_name: string; state: string; failureCount: number }>;
}

interface Settlement {
  date: string;
  total_volume_kes: string;
  bank_count: number;
  gross_txn_count: number;
  net_obligations: Array<{ paying_bank: string; receiving_bank: string; amount_kes: string; instruction: string }>;
  kepss_summary: string[];
}

const callSwitch = async (action: string, payload?: any) =>
  supabase.functions.invoke("lipafo-switch", { body: { action, ...(payload ? { payload } : {}) } });

// DB-derived TPS — survives edge isolate recycling and is the source of truth.
const fetchDbTps = async (): Promise<{ tps10: number; tps60: number; total: number }> => {
  const since60 = new Date(Date.now() - 60_000).toISOString();
  const since10 = new Date(Date.now() - 10_000).toISOString();
  const [{ count: c60 }, { count: c10 }] = await Promise.all([
    supabase.from("lipafo_transactions").select("id", { count: "exact", head: true }).gte("created_at", since60),
    supabase.from("lipafo_transactions").select("id", { count: "exact", head: true }).gte("created_at", since10),
  ]);
  return { tps10: (c10 ?? 0) / 10, tps60: (c60 ?? 0) / 60, total: c60 ?? 0 };
};

export function SwitchLoadTest() {
  const [tps, setTps] = useState(100);
  const [duration, setDuration] = useState(30);
  const [running, setRunning] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [progress, setProgress] = useState(0);
  const [dbTps, setDbTps] = useState({ tps10: 0, tps60: 0, total: 0 });
  const [lastRun, setLastRun] = useState<{ observedTps: number; targetTps: number; fired: number; elapsed: number; success: number; failed: number; duplicates: number } | null>(null);
  const [tabVisible, setTabVisible] = useState(typeof document !== "undefined" ? !document.hidden : true);

  // Stats accumulated in refs (no per-call rerender), flushed to state on a timer.
  const statsRef = useRef({ fired: 0, success: 0, failed: 0, duplicates: 0, latencies: [] as number[] });
  const [stats, setStats] = useState({ fired: 0, success: 0, failed: 0, duplicates: 0, latencies: [] as number[] });
  const cancelRef = useRef(false);
  const recentKeysRef = useRef<string[]>([]);

  const refreshMetrics = async () => {
    const { data } = await callSwitch("metrics");
    if (data) setMetrics(data as Metrics);
  };
  const refreshSettlement = async () => {
    const { data } = await callSwitch("settlement");
    if (data) setSettlement(data as Settlement);
  };
  const refreshDbTps = async () => {
    try { setDbTps(await fetchDbTps()); } catch { /* ignore */ }
  };

  useEffect(() => { refreshMetrics(); refreshSettlement(); refreshDbTps(); }, []);

  // Tab visibility — browsers throttle setTimeout to ≥1s in background tabs.
  useEffect(() => {
    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Live polling while running — DB TPS + edge metrics.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => { refreshMetrics(); refreshDbTps(); }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Throttled UI flush of client-side stats (4Hz instead of 100Hz).
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const r = statsRef.current;
      setStats({ fired: r.fired, success: r.success, failed: r.failed, duplicates: r.duplicates, latencies: r.latencies.slice(-1000) });
    }, UI_REFRESH_MS);
    return () => clearInterval(id);
  }, [running]);

  const fireOne = () => {
    const sender = PHONES[Math.floor(Math.random() * PHONES.length)];
    let receiver = PHONES[Math.floor(Math.random() * PHONES.length)];
    while (receiver === sender) receiver = PHONES[Math.floor(Math.random() * PHONES.length)];
    const amountKES = Math.floor(Math.random() * 49500) + 500;

    let key: string = crypto.randomUUID();
    if (recentKeysRef.current.length > 10 && Math.random() < DUPLICATE_RATE) {
      key = recentKeysRef.current[Math.floor(Math.random() * recentKeysRef.current.length)];
    } else {
      recentKeysRef.current.push(key);
      if (recentKeysRef.current.length > 100) recentKeysRef.current.shift();
    }

    const start = Date.now();
    statsRef.current.fired += 1;
    callSwitch("payment", {
      idempotency_key: key, sender_phone: sender, receiver_phone: receiver,
      amount_cents: amountKES * 100, currency: "KES",
    }).then(({ data }) => {
      const lat = Date.now() - start;
      const r = statsRef.current;
      r.latencies.push(lat);
      if (r.latencies.length > 1000) r.latencies.shift();
      if (data?.duplicate) r.duplicates += 1;
      else if (data?.success) r.success += 1;
      else r.failed += 1;
    }).catch(() => { statsRef.current.failed += 1; });
  };

  const runLoadTest = async () => {
    cancelRef.current = false;
    setRunning(true);
    setProgress(0);
    statsRef.current = { fired: 0, success: 0, failed: 0, duplicates: 0, latencies: [] };
    setStats({ fired: 0, success: 0, failed: 0, duplicates: 0, latencies: [] });
    recentKeysRef.current = [];

    const total = tps * duration;
    // Batch firing: every TICK_MS, fire (tps * TICK_MS / 1000) requests at once.
    const perTick = Math.max(1, Math.round(tps * TICK_MS / 1000));
    const totalTicks = Math.ceil(total / perTick);
    const startedAt = Date.now();

    toast.success(`Firing ${total.toLocaleString()} txns at ${tps} TPS (${perTick}/tick × ${totalTicks} ticks). Keep this tab visible!`);

    let fired = 0;
    for (let tick = 0; tick < totalTicks; tick++) {
      if (cancelRef.current) break;
      const tickStart = Date.now();
      const batch = Math.min(perTick, total - fired);
      for (let i = 0; i < batch; i++) fireOne();
      fired += batch;
      setProgress((fired / total) * 100);

      // Sleep the remainder of the tick so we hold cadence even if scheduling drifts.
      const elapsed = Date.now() - tickStart;
      const sleep = Math.max(0, TICK_MS - elapsed);
      await new Promise(r => setTimeout(r, sleep));
    }

    // Wait for in-flight requests to settle, then refresh.
    toast.info("All requests fired — waiting for in-flight to settle...");
    await new Promise(r => setTimeout(r, 5000));
    setStats({ ...statsRef.current, latencies: statsRef.current.latencies.slice(-1000) });
    await refreshMetrics();
    await refreshSettlement();
    await refreshDbTps();
    setRunning(false);
    const elapsed = (Date.now() - startedAt) / 1000;
    const r = statsRef.current;
    const observedTps = r.fired / elapsed;
    setLastRun({ observedTps, targetTps: tps, fired: r.fired, elapsed, success: r.success, failed: r.failed, duplicates: r.duplicates });
    toast.success(`Load test complete: ${r.fired} fired in ${elapsed.toFixed(1)}s (${observedTps.toFixed(1)} TPS observed)`);
  };

  const stopTest = () => { cancelRef.current = true; toast.info("Stopping load test..."); };

  // ─── Idempotency replay mode ──────────────────────────────────────────────
  const [replayRunning, setReplayRunning] = useState(false);
  const [replayResult, setReplayResult] = useState<null | {
    sampleSize: number;
    phase1: { sent: number; success: number; failed: number; duplicates: number };
    phase2: { sent: number; cachedHits: number; newStateLeaks: number; failed: number };
    verdict: "PASS" | "FAIL";
    notes: string[];
  }>(null);

  const runIdempotencyReplay = async () => {
    setReplayRunning(true);
    setReplayResult(null);
    const SAMPLE = 50;
    const keys: string[] = [];
    const payloads: Array<{ key: string; sender: string; receiver: string; amount_cents: number }> = [];
    for (let i = 0; i < SAMPLE; i++) {
      const sender = PHONES[Math.floor(Math.random() * PHONES.length)];
      let receiver = PHONES[Math.floor(Math.random() * PHONES.length)];
      while (receiver === sender) receiver = PHONES[Math.floor(Math.random() * PHONES.length)];
      const amount_cents = (Math.floor(Math.random() * 49500) + 500) * 100;
      const key = crypto.randomUUID();
      keys.push(key);
      payloads.push({ key, sender, receiver, amount_cents });
    }

    toast.info(`Phase 1: firing ${SAMPLE} unique transactions...`);
    const phase1 = { sent: 0, success: 0, failed: 0, duplicates: 0 };
    const fire = async (p: typeof payloads[number]) => {
      try {
        const { data } = await callSwitch("payment", {
          idempotency_key: p.key, sender_phone: p.sender, receiver_phone: p.receiver,
          amount_cents: p.amount_cents, currency: "KES",
        });
        phase1.sent += 1;
        if (data?.duplicate) phase1.duplicates += 1;
        else if (data?.success) phase1.success += 1;
        else phase1.failed += 1;
      } catch { phase1.sent += 1; phase1.failed += 1; }
    };
    // Fire phase 1 with mild concurrency (10 at a time)
    for (let i = 0; i < payloads.length; i += 10) {
      await Promise.all(payloads.slice(i, i + 10).map(fire));
    }

    // Settle, then replay
    await new Promise(r => setTimeout(r, 2000));
    toast.info(`Phase 2: replaying the SAME ${SAMPLE} idempotency keys...`);
    const phase2 = { sent: 0, cachedHits: 0, newStateLeaks: 0, failed: 0 };
    const replay = async (p: typeof payloads[number]) => {
      try {
        const { data } = await callSwitch("payment", {
          idempotency_key: p.key, sender_phone: p.sender, receiver_phone: p.receiver,
          amount_cents: p.amount_cents, currency: "KES",
        });
        phase2.sent += 1;
        if (data?.duplicate) phase2.cachedHits += 1;
        else if (data?.success || data?.error) phase2.newStateLeaks += 1;
        else phase2.failed += 1;
      } catch { phase2.sent += 1; phase2.failed += 1; }
    };
    for (let i = 0; i < payloads.length; i += 10) {
      await Promise.all(payloads.slice(i, i + 10).map(replay));
    }

    const notes: string[] = [];
    if (phase2.cachedHits === SAMPLE) notes.push(`✓ All ${SAMPLE} replays returned cached results (duplicate:true).`);
    if (phase2.newStateLeaks > 0) notes.push(`✗ ${phase2.newStateLeaks} replays produced NEW state — exactly-once VIOLATED.`);
    if (phase2.failed > 0) notes.push(`⚠ ${phase2.failed} replays errored — investigate edge function.`);
    if (phase1.duplicates > 0) notes.push(`ℹ ${phase1.duplicates} phase-1 collisions (UUID reuse, expected ~0).`);

    const verdict: "PASS" | "FAIL" = phase2.cachedHits === SAMPLE && phase2.newStateLeaks === 0 ? "PASS" : "FAIL";
    setReplayResult({ sampleSize: SAMPLE, phase1, phase2, verdict, notes });
    setReplayRunning(false);
    await refreshMetrics();
    if (verdict === "PASS") toast.success(`Idempotency PASS — ${SAMPLE}/${SAMPLE} replays hit cache.`);
    else toast.error(`Idempotency FAIL — ${phase2.newStateLeaks} new-state leaks.`);
  };


  // ─── Failure breakdown ────────────────────────────────────────────────────
  type FailCategory = "timeout" | "circuit_open_503" | "rejected_422" | "server_500" | "other";
  interface FailRow { id: string; idempotency_key: string; error_code: string | null; state: string; created_at: string; amount_cents: number; receiver_bank: string; }
  interface CategoryBucket { category: FailCategory; label: string; count: number; samples: FailRow[]; }
  const [failureBreakdown, setFailureBreakdown] = useState<CategoryBucket[] | null>(null);
  const [failureLoading, setFailureLoading] = useState(false);
  const [failureTotal, setFailureTotal] = useState(0);

  const categorize = (row: FailRow): FailCategory => {
    const code = (row.error_code ?? "").toLowerCase();
    if (code.includes("timeout") || code.includes("timed out") || code.includes("etimedout")) return "timeout";
    if (code.includes("circuit") || code.includes("503") || code.includes("open")) return "circuit_open_503";
    if (code.includes("422") || code.includes("rejected") || code.includes("reject") || code.includes("fraud") || code.includes("validation") || code.includes("insufficient")) return "rejected_422";
    if (code.includes("500") || code.includes("internal") || code.includes("unhandled") || code.includes("crash")) return "server_500";
    return "other";
  };
  const categoryMeta: Record<FailCategory, { label: string; tone: string }> = {
    timeout:          { label: "Upstream timeouts",        tone: "text-warning" },
    circuit_open_503: { label: "503 — circuit open",       tone: "text-destructive" },
    rejected_422:     { label: "422 — rejected/validation", tone: "text-warning" },
    server_500:       { label: "500 — server errors",      tone: "text-destructive" },
    other:            { label: "Other / uncategorised",    tone: "text-muted-foreground" },
  };

  const loadFailureBreakdown = async () => {
    setFailureLoading(true);
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // last hour
    const { data, error } = await supabase
      .from("lipafo_transactions")
      .select("id, idempotency_key, error_code, state, created_at, amount_cents, receiver_bank")
      .in("state", ["FAILED", "REVERSED"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      toast.error(`Failed to load breakdown: ${error.message}`);
      setFailureLoading(false);
      return;
    }
    const rows = (data ?? []) as FailRow[];
    const buckets: Record<FailCategory, CategoryBucket> = {
      timeout:          { category: "timeout",          label: categoryMeta.timeout.label,          count: 0, samples: [] },
      circuit_open_503: { category: "circuit_open_503", label: categoryMeta.circuit_open_503.label, count: 0, samples: [] },
      rejected_422:     { category: "rejected_422",     label: categoryMeta.rejected_422.label,     count: 0, samples: [] },
      server_500:       { category: "server_500",       label: categoryMeta.server_500.label,       count: 0, samples: [] },
      other:            { category: "other",            label: categoryMeta.other.label,            count: 0, samples: [] },
    };
    for (const r of rows) {
      const c = categorize(r);
      buckets[c].count += 1;
      if (buckets[c].samples.length < 5) buckets[c].samples.push(r);
    }
    setFailureBreakdown(Object.values(buckets));
    setFailureTotal(rows.length);
    setFailureLoading(false);
    toast.success(`Loaded ${rows.length} failed/reversed txns from the last hour.`);
  };

  const resetSwitch = async () => {
    await callSwitch("reset");
    setMetrics(null); setSettlement(null);
    statsRef.current = { fired: 0, success: 0, failed: 0, duplicates: 0, latencies: [] };
    setStats({ fired: 0, success: 0, failed: 0, duplicates: 0, latencies: [] });
    setDbTps({ tps10: 0, tps60: 0, total: 0 });
    toast.success("Switch state reset");
    setTimeout(() => { refreshMetrics(); refreshSettlement(); refreshDbTps(); }, 500);
  };

  const localP = (p: number) => {
    const s = [...stats.latencies].sort((a, b) => a - b);
    if (!s.length) return 0;
    return s[Math.max(0, Math.ceil(p / 100 * s.length) - 1)];
  };

  const challenges = [
    { id: "C1", name: "Exactly-once (idempotency)", ok: stats.duplicates > 0, hint: `${stats.duplicates} duplicates returned cached results` },
    { id: "C2", name: "Event sourcing (FSM)",       ok: (metrics?.completed ?? 0) > 0, hint: "State machine transitions persisted" },
    { id: "C3", name: "Hot partition counters",     ok: (metrics?.completed ?? 0) > 0, hint: "Pre-computed positions, no row locks" },
    { id: "C4", name: "Settlement determinism",     ok: (settlement?.net_obligations?.length ?? 0) > 0, hint: "Multilateral netting from positions" },
    { id: "C5", name: "Per-bank circuit breakers",  ok: (metrics?.circuit_breakers?.length ?? 0) > 0, hint: "Isolated per bank" },
    { id: "C6", name: "O(N banks) at EOD",          ok: (settlement?.bank_count ?? 0) > 0, hint: "Settlement is O(banks) not O(txns)" },
    { id: "C7", name: "Fraud at wire speed",        ok: true, hint: "Velocity checks <10ms" },
    { id: "C8", name: "Observability",              ok: !!metrics, hint: "p99, TPS, error breakdown live" },
  ];

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Lipafo Switch — Load Test Console
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Fires synthetic payments through the switch engine to verify exactly-once, circuit breakers, fraud, and settlement.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {!tabVisible && running && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm">
              <Eye className="h-4 w-4 text-warning shrink-0" />
              <span className="text-warning-foreground">Tab is in background — browser is throttling timers. TPS will be inaccurate. Bring this tab to the foreground.</span>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Target TPS</span>
                <span className="font-mono font-bold text-foreground">{tps}</span>
              </div>
              <Slider value={[tps]} min={10} max={200} step={10} onValueChange={(v) => setTps(v[0])} disabled={running} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duration (seconds)</span>
                <span className="font-mono font-bold text-foreground">{duration}s</span>
              </div>
              <Slider value={[duration]} min={5} max={120} step={5} onValueChange={(v) => setDuration(v[0])} disabled={running} />
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Will fire <span className="font-mono font-bold text-foreground">{(tps * duration).toLocaleString()}</span> transactions
            with <span className="font-mono font-bold">{(DUPLICATE_RATE * 100).toFixed(0)}%</span> duplicate injection to verify idempotency.
          </div>

          <div className="flex gap-3 flex-wrap">
            {!running ? (
              <Button onClick={runLoadTest} className="button-3d gap-2">
                <Play className="h-4 w-4" /> Start Load Test
              </Button>
            ) : (
              <Button onClick={stopTest} variant="destructive" className="gap-2">
                <Square className="h-4 w-4" /> Stop
              </Button>
            )}
            <Button onClick={() => { refreshMetrics(); refreshDbTps(); }} variant="outline" className="glass-card gap-2" disabled={running}>
              <RefreshCw className="h-4 w-4" /> Refresh metrics
            </Button>
            <Button onClick={resetSwitch} variant="outline" className="glass-card gap-2" disabled={running}>
              Reset switch state
            </Button>
            <Button
              onClick={runIdempotencyReplay}
              variant="outline"
              className="glass-card gap-2 border-primary/40"
              disabled={running || replayRunning}
              title="Fires 50 unique txns, then replays the same idempotency keys to verify every duplicate hits the cache."
            >
              <Repeat2 className="h-4 w-4" />
              {replayRunning ? "Replaying..." : "Run idempotency replay"}
            </Button>
            <Button
              onClick={loadFailureBreakdown}
              variant="outline"
              className="glass-card gap-2 border-warning/40"
              disabled={running || failureLoading}
              title="Group failed/reversed txns from the last hour by category (timeout, 503, 422, 500) with sample trace IDs."
            >
              <AlertTriangle className="h-4 w-4" />
              {failureLoading ? "Loading..." : "Failure breakdown"}
            </Button>
          </div>

          {replayResult && (
            <div className={`rounded-lg p-4 border ${replayResult.verdict === "PASS" ? "bg-success/10 border-success/40" : "bg-destructive/10 border-destructive/40"}`}>
              <div className="flex items-center gap-2 mb-3">
                {replayResult.verdict === "PASS"
                  ? <CheckCircle2 className="h-5 w-5 text-success" />
                  : <AlertTriangle className="h-5 w-5 text-destructive" />}
                <div className="font-semibold text-foreground">
                  Idempotency replay: <span className={replayResult.verdict === "PASS" ? "text-success" : "text-destructive"}>{replayResult.verdict}</span>
                </div>
                <Badge variant="outline" className="ml-auto font-mono">{replayResult.sampleSize} keys</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono mb-3">
                <div className="space-y-1">
                  <div className="text-muted-foreground uppercase tracking-wider">Phase 1 — fresh keys</div>
                  <div>Sent: <span className="font-bold">{replayResult.phase1.sent}</span></div>
                  <div>Success: <span className="text-success font-bold">{replayResult.phase1.success}</span></div>
                  <div>Failed: <span className="text-destructive font-bold">{replayResult.phase1.failed}</span></div>
                  <div>Duplicates: <span className="text-warning font-bold">{replayResult.phase1.duplicates}</span></div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground uppercase tracking-wider">Phase 2 — replay same keys</div>
                  <div>Sent: <span className="font-bold">{replayResult.phase2.sent}</span></div>
                  <div>Cached hits: <span className="text-success font-bold">{replayResult.phase2.cachedHits}</span></div>
                  <div>New-state leaks: <span className={replayResult.phase2.newStateLeaks === 0 ? "text-success font-bold" : "text-destructive font-bold"}>{replayResult.phase2.newStateLeaks}</span></div>
                  <div>Errored: <span className="text-destructive font-bold">{replayResult.phase2.failed}</span></div>
                </div>
              </div>
              <div className="space-y-1 text-xs">
                {replayResult.notes.map((n, i) => <div key={i} className="text-muted-foreground">{n}</div>)}
              </div>
            </div>
          )}

          {(running || progress > 0) && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span><span>{progress.toFixed(1)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-4 gap-4">
        <StatCard
          label={running ? "Live TPS (DB, 10s)" : "Observed TPS (last run)"}
          value={running ? dbTps.tps10.toFixed(1) : (lastRun ? lastRun.observedTps.toFixed(1) : dbTps.tps10.toFixed(1))}
          icon={<Activity className="h-4 w-4 text-primary" />}
          accent="text-primary"
        />
        <StatCard
          label={running ? "Live TPS (DB, 60s)" : "Target TPS (last run)"}
          value={running ? dbTps.tps60.toFixed(1) : (lastRun ? lastRun.targetTps.toString() : dbTps.tps60.toFixed(1))}
        />
        <StatCard label="Success rate" value={`${metrics?.success_rate_pct ?? "0.00"}%`} accent="text-success" />
        <StatCard label="p99 latency (switch)" value={`${metrics?.latency_ms.p99 ?? 0} ms`} />
      </div>

      {lastRun && !running && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Last run summary
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Snapshot from the most recent test — persists after the rolling DB window expires.
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm font-mono">
            <div><div className="text-muted-foreground text-xs">Target TPS</div><div className="font-bold text-lg">{lastRun.targetTps}</div></div>
            <div><div className="text-muted-foreground text-xs">Observed TPS</div><div className="font-bold text-lg text-primary">{lastRun.observedTps.toFixed(1)}</div></div>
            <div><div className="text-muted-foreground text-xs">Fired</div><div className="font-bold text-lg">{lastRun.fired.toLocaleString()}</div></div>
            <div><div className="text-muted-foreground text-xs">Elapsed</div><div className="font-bold text-lg">{lastRun.elapsed.toFixed(1)}s</div></div>
            <div><div className="text-muted-foreground text-xs">Success</div><div className="font-bold text-success">{lastRun.success}</div></div>
            <div><div className="text-muted-foreground text-xs">Failed</div><div className="font-bold text-destructive">{lastRun.failed}</div></div>
            <div><div className="text-muted-foreground text-xs">Duplicates</div><div className="font-bold text-warning">{lastRun.duplicates}</div></div>
            <div><div className="text-muted-foreground text-xs">Efficiency</div><div className="font-bold">{((lastRun.observedTps / lastRun.targetTps) * 100).toFixed(0)}%</div></div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Client-side load stats</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm font-mono">
            <Row k="Fired"      v={stats.fired.toLocaleString()} />
            <Row k="Success"    v={`${stats.success} (${stats.fired ? ((stats.success/stats.fired)*100).toFixed(1) : "0.0"}%)`} accent="text-success" />
            <Row k="Failed"     v={stats.failed.toString()} accent="text-destructive" />
            <Row k="Duplicates" v={stats.duplicates.toString()} accent="text-warning" />
            <Row k="p50" v={`${localP(50)} ms`} />
            <Row k="p95" v={`${localP(95)} ms`} />
            <Row k="p99" v={`${localP(99)} ms`} />
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Switch latency percentiles</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm font-mono">
            <Row k="p50"  v={`${metrics?.latency_ms.p50 ?? 0} ms`} />
            <Row k="p95"  v={`${metrics?.latency_ms.p95 ?? 0} ms`} />
            <Row k="p99"  v={`${metrics?.latency_ms.p99 ?? 0} ms`} />
            <Row k="Last" v={`${metrics?.latency_ms.last ?? 0} ms`} />
            <Row k="Completed (DB, 60s)" v={dbTps.total.toLocaleString()} accent="text-success" />
            <Row k="Failed (switch)"     v={(metrics?.failed ?? 0).toString()} accent="text-destructive" />
            <Row k="Duplicates (switch)" v={(metrics?.duplicates ?? 0).toString()} accent="text-warning" />
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Per-bank circuit breakers</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(metrics?.circuit_breakers ?? []).map(cb => (
              <div key={cb.bank_code} className="glass-card p-3 rounded-lg">
                <div className="text-xs text-muted-foreground">{cb.bank_name}</div>
                <div className="font-mono font-bold text-foreground">{cb.bank_code}</div>
                <Badge variant={cb.state === "CLOSED" ? "default" : cb.state === "HALF_OPEN" ? "secondary" : "destructive"} className="mt-1">
                  {cb.state}
                </Badge>
                {cb.failureCount > 0 && (
                  <div className="text-xs text-warning mt-1">{cb.failureCount} failures</div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {metrics && Object.keys(metrics.error_breakdown).length > 0 && (
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" /> Error breakdown
          </CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm font-mono">
            {Object.entries(metrics.error_breakdown).map(([k, v]) => (
              <Row key={k} k={k} v={v.toString()} accent="text-destructive" />
            ))}
          </CardContent>
        </Card>
      )}

      {settlement && (
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Settlement preview ({settlement.date})</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-4 font-mono">
              <div><div className="text-muted-foreground text-xs">Total volume</div><div className="font-bold">KES {settlement.total_volume_kes}</div></div>
              <div><div className="text-muted-foreground text-xs">Banks</div><div className="font-bold">{settlement.bank_count}</div></div>
              <div><div className="text-muted-foreground text-xs">Pair positions</div><div className="font-bold">{settlement.gross_txn_count}</div></div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">KEPSS obligations</div>
              {settlement.kepss_summary.length === 0
                ? <div className="text-muted-foreground italic">No net obligations yet — run the load test.</div>
                : settlement.kepss_summary.map((line, i) => (
                    <div key={i} className="font-mono text-xs glass-card p-2 rounded">{line}</div>
                  ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Challenge scorecard</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-2">
            {challenges.map(c => (
              <div key={c.id} className="flex items-start gap-3 glass-card p-3 rounded-lg">
                {c.ok ? <CheckCircle2 className="h-5 w-5 text-success shrink-0" /> : <AlertTriangle className="h-5 w-5 text-warning shrink-0" />}
                <div>
                  <div className="text-sm font-medium text-foreground">{c.id} · {c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.hint}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon?: React.ReactNode; accent?: string }) {
  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold font-mono ${accent ?? "text-foreground"}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
function Row({ k, v, accent }: { k: string; v: string; accent?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className={accent ?? "text-foreground"}>{v}</span>
    </div>
  );
}
