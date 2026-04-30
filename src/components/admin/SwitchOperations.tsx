import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, CircuitBoard, Database, GitBranch,
  PlayCircle, Search, ShieldAlert, Zap, RefreshCw, Cpu,
} from "lucide-react";

const fmt = (n: number) => new Intl.NumberFormat("en-KE").format(n);
const fmtKES = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);

type Intent = {
  id: string; idempotency_key: string; trace_id: string; state: string;
  amount: number; payer_identifier: string; payee_identifier: string;
  payee_bank: string | null; rail: string; created_at: string; last_error: string | null;
};
type BankConn = {
  id: string; bank_code: string; bank_name: string; circuit_state: string;
  failure_count: number; success_count: number; p50_latency_ms: number;
  p99_latency_ms: number; opened_at: string | null;
};
type Run = {
  id: string; run_date: string; status: string; last_processed_event_id: number;
  events_processed: number; banks_settled: number; total_volume: number;
  started_at: string | null; completed_at: string | null;
};
type Span = {
  id: number; trace_id: string; service: string; operation: string;
  status: string; duration_ms: number | null; started_at: string;
  attributes: Record<string, any>;
};

export function SwitchOperations() {
  const [intents, setIntents] = useState<Intent[]>([]);
  const [stateCounts, setStateCounts] = useState<Record<string, number>>({});
  const [banks, setBanks] = useState<BankConn[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [spans, setSpans] = useState<Span[]>([]);
  const [traceQuery, setTraceQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [iRes, bRes, rRes, sRes] = await Promise.all([
      supabase.from("transaction_intents").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("bank_connectors").select("*").order("bank_code"),
      supabase.from("settlement_runs").select("*").order("run_date", { ascending: false }).limit(10),
      supabase.from("trace_spans").select("*").order("started_at", { ascending: false }).limit(50),
    ]);
    if (iRes.data) {
      setIntents(iRes.data as Intent[]);
      const counts: Record<string, number> = {};
      for (const i of iRes.data as Intent[]) counts[i.state] = (counts[i.state] ?? 0) + 1;
      setStateCounts(counts);
    }
    if (bRes.data) setBanks(bRes.data as BankConn[]);
    if (rRes.data) setRuns(rRes.data as Run[]);
    if (sRes.data) setSpans(sRes.data as Span[]);
  };

  useEffect(() => { load(); }, []);

  const seedLoad = async (count: number) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("switch-seed-demo", { body: { count } });
      if (error) throw error;
      toast.success(`Seeded ${data.success}/${count} (${data.circuit_blocked ?? 0} blocked by circuit)`);
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const tripCircuit = async (bank_code: string) => {
    setBusy(true);
    try {
      await supabase.functions.invoke("switch-seed-demo", { body: { open_circuit: bank_code } });
      toast.success(`Circuit OPEN for ${bank_code}`);
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const closeCircuit = async (id: string) => {
    await supabase.from("bank_connectors").update({
      circuit_state: "CLOSED", failure_count: 0, opened_at: null,
    }).eq("id", id);
    toast.success("Circuit closed");
    await load();
  };

  const runSettlement = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("switch-settlement-run");
      if (error) throw error;
      toast.success(`Settlement: ${data.processed ?? 0} events, ${data.banks ?? 0} banks${data.more ? " (more remaining)" : ""}`);
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const searchTrace = async () => {
    if (!traceQuery.trim()) return load();
    const { data } = await supabase.from("trace_spans")
      .select("*").eq("trace_id", traceQuery.trim()).order("started_at");
    setSpans((data ?? []) as Span[]);
  };

  const stateOrder = ["NEW", "IN_FLIGHT", "DEBITED", "COMPLETED", "FAILED", "REVERSED"];
  const stateColor = (s: string) => ({
    NEW: "outline", IN_FLIGHT: "secondary", DEBITED: "secondary",
    COMPLETED: "default", FAILED: "destructive", REVERSED: "destructive",
  }[s] ?? "outline") as any;

  const circuitColor = (s: string) =>
    s === "CLOSED" ? "default" : s === "HALF_OPEN" ? "secondary" : "destructive";

  return (
    <div className="space-y-6">
      <Alert className="glass-card border-warning/40">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertTitle className="text-foreground">Reference architecture — ~100 TPS ceiling on Lovable Cloud</AlertTitle>
        <AlertDescription className="text-muted-foreground text-sm">
          This panel demonstrates the 8 design patterns of a real payment switch (idempotency,
          event sourcing, hot-account sharding, circuit breakers, resumable settlement, fraud at wire
          speed, distributed tracing). The business logic is production-correct.
          <strong className="text-foreground"> Production target is 5,000 TPS on Kafka + ScyllaDB + Flink + Redis</strong>
          {" "}— see the architecture document for the migration path. Postgres will not sustain 5,000 TPS.
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Switch Operations</h2>
          <p className="text-sm text-muted-foreground">State machine · circuit breakers · settlement checkpoint · trace search</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => seedLoad(20)} disabled={busy} variant="outline" size="sm">
            <Zap className="h-4 w-4 mr-2" /> Generate 20 txns
          </Button>
          <Button onClick={() => seedLoad(100)} disabled={busy} variant="outline" size="sm">
            <Zap className="h-4 w-4 mr-2" /> Generate 100 txns
          </Button>
          <Button onClick={runSettlement} disabled={busy} className="button-3d" size="sm">
            <PlayCircle className="h-4 w-4 mr-2" /> Run settlement batch
          </Button>
          <Button onClick={load} variant="ghost" size="sm"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* State machine distribution */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" /> State machine distribution (recent 50)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {stateOrder.map((s) => (
              <div key={s} className="glass-card p-3 text-center">
                <div className="text-xs text-muted-foreground">{s}</div>
                <div className="text-2xl font-bold text-foreground">{stateCounts[s] ?? 0}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="intents" className="space-y-4">
        <TabsList className="glass-card flex-wrap h-auto">
          <TabsTrigger value="intents"><Activity className="h-4 w-4 mr-2" />Intents (idempotency)</TabsTrigger>
          <TabsTrigger value="circuits"><CircuitBoard className="h-4 w-4 mr-2" />Bank circuit breakers</TabsTrigger>
          <TabsTrigger value="settlement"><Database className="h-4 w-4 mr-2" />Settlement checkpoints</TabsTrigger>
          <TabsTrigger value="trace"><Search className="h-4 w-4 mr-2" />Trace search</TabsTrigger>
          <TabsTrigger value="patterns"><Cpu className="h-4 w-4 mr-2" />8 patterns map</TabsTrigger>
        </TabsList>

        <TabsContent value="intents">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Last 50 intents — replays return the same state, never double-debit</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Created</TableHead>
                    <TableHead>Idempotency key</TableHead>
                    <TableHead>Payer → Payee</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Trace</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {intents.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="text-xs">{new Date(i.created_at).toLocaleTimeString("en-KE")}</TableCell>
                      <TableCell className="font-mono text-[11px] truncate max-w-[180px]" title={i.idempotency_key}>{i.idempotency_key}</TableCell>
                      <TableCell className="text-xs">{i.payer_identifier.slice(0, 12)}… → {i.payee_identifier}</TableCell>
                      <TableCell className="text-xs">{i.payee_bank ?? "—"}</TableCell>
                      <TableCell className="text-right text-xs font-semibold">{fmtKES(Number(i.amount))}</TableCell>
                      <TableCell><Badge variant={stateColor(i.state)}>{i.state}</Badge></TableCell>
                      <TableCell>
                        <button className="font-mono text-[10px] text-primary underline"
                          onClick={() => { setTraceQuery(i.trace_id); }}>
                          {i.trace_id.slice(0, 8)}
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {intents.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No intents yet — click "Generate 20 txns".
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="circuits">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Per-bank circuit breakers — slow/failing banks are isolated</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank</TableHead>
                    <TableHead>Circuit</TableHead>
                    <TableHead className="text-right">P50</TableHead>
                    <TableHead className="text-right">P99</TableHead>
                    <TableHead className="text-right">Success</TableHead>
                    <TableHead className="text-right">Failures</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banks.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium text-sm">{b.bank_name} <span className="font-mono text-[10px] text-muted-foreground">({b.bank_code})</span></TableCell>
                      <TableCell><Badge variant={circuitColor(b.circuit_state) as any}>{b.circuit_state}</Badge></TableCell>
                      <TableCell className="text-right text-xs">{b.p50_latency_ms}ms</TableCell>
                      <TableCell className="text-right text-xs">{b.p99_latency_ms}ms</TableCell>
                      <TableCell className="text-right text-xs text-success">{fmt(b.success_count)}</TableCell>
                      <TableCell className="text-right text-xs text-warning">{fmt(b.failure_count)}</TableCell>
                      <TableCell>
                        {b.circuit_state === "CLOSED" ? (
                          <Button size="sm" variant="outline" onClick={() => tripCircuit(b.bank_code)}>Trip</Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => closeCircuit(b.id)}>Reset</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settlement">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Resumable settlement — crash mid-run resumes from `last_processed_event_id`</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Checkpoint event id</TableHead>
                    <TableHead className="text-right">Events processed</TableHead>
                    <TableHead className="text-right">Banks</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{r.run_date}</TableCell>
                      <TableCell><Badge variant={r.status === "completed" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                      <TableCell className="text-right font-mono text-xs">{r.last_processed_event_id}</TableCell>
                      <TableCell className="text-right text-xs">{fmt(r.events_processed)}</TableCell>
                      <TableCell className="text-right text-xs">{r.banks_settled}</TableCell>
                      <TableCell className="text-right text-xs">{fmtKES(Number(r.total_volume))}</TableCell>
                      <TableCell className="text-xs">{r.started_at ? new Date(r.started_at).toLocaleTimeString("en-KE") : "—"}</TableCell>
                      <TableCell className="text-xs">{r.completed_at ? new Date(r.completed_at).toLocaleTimeString("en-KE") : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {runs.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No runs yet — click "Run settlement batch".
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trace">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Search className="h-4 w-4" /> Distributed trace search
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Paste trace_id (or click one in the Intents tab)"
                  value={traceQuery} onChange={(e) => setTraceQuery(e.target.value)}
                  className="font-mono text-xs" />
                <Button onClick={searchTrace} variant="outline">Search</Button>
                <Button onClick={() => { setTraceQuery(""); load(); }} variant="ghost">Latest</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Operation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead>Attributes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {spans.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs">{new Date(s.started_at).toLocaleTimeString("en-KE")}</TableCell>
                      <TableCell className="text-xs">{s.service}</TableCell>
                      <TableCell className="text-xs font-medium">{s.operation}</TableCell>
                      <TableCell><Badge variant={s.status === "ok" ? "default" : "destructive"}>{s.status}</Badge></TableCell>
                      <TableCell className="text-right text-xs">{s.duration_ms ?? "—"}ms</TableCell>
                      <TableCell className="text-[10px] font-mono text-muted-foreground max-w-[300px] truncate" title={JSON.stringify(s.attributes)}>
                        {JSON.stringify(s.attributes)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {spans.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No spans for that trace.
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-primary" /> 8 patterns — reference (Lovable Cloud) → production
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Pattern</TableHead>
                    <TableHead>Reference impl here</TableHead>
                    <TableHead>Production replacement (target 5,000 TPS)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ["1", "Exactly-once / idempotency", "transaction_intents.idempotency_key UNIQUE + state machine", "Redis SETNX + Kafka transactional producer"],
                    ["2", "Dual-write / event sourcing", "Append-only switch_events as source of truth", "Kafka topic + Flink/KSQL projection to ScyllaDB"],
                    ["3", "Hot account contention", "16 shards per merchant in position_ledger_shards", "ScyllaDB wide-row + counter columns"],
                    ["4", "Resumable settlement", "settlement_runs.last_processed_event_id checkpoint", "Flink savepoints + Kafka consumer offsets"],
                    ["5", "Bank API heterogeneity", "bank_connectors circuit_state per bank, async edge fn", "Resilience4j + Netty/Vert.x async clients"],
                    ["6", "Thundering herd at settlement", "Batched settlement-run with BATCH=500 + checkpoint", "Kafka partition fan-out + backpressure"],
                    ["7", "Fraud at wire speed (<50ms)", "Pre-aggregated velocity_counters per 60s bucket", "Flink CEP + Redis sliding windows"],
                    ["8", "Observability at granularity", "trace_spans table + admin trace search", "OpenTelemetry → Tempo / Jaeger"],
                  ].map(([n, p, r, prod]) => (
                    <TableRow key={n}>
                      <TableCell className="font-mono">{n}</TableCell>
                      <TableCell className="font-medium text-sm">{p}</TableCell>
                      <TableCell className="text-xs">{r}</TableCell>
                      <TableCell className="text-xs text-primary">{prod}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
