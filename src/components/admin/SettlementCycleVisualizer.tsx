import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Clock, PlayCircle, Mail, Banknote, CheckCircle2, Building2,
  ArrowDown, ArrowUp, MoonStar, Send, Landmark, Sparkles, RefreshCw,
  Activity, ArrowRight, AlertTriangle, ShieldCheck,
} from "lucide-react";

type Advice = {
  id: string;
  cycle_date: string;
  bank_name: string;
  bank_email: string;
  direction: "LIPAFO_PAYS_BANK" | "BANK_PAYS_LIPAFO" | "FLAT";
  net_amount: number;
  inbound_volume: number;
  outbound_volume: number;
  transaction_count: number;
  subject: string;
  body: string;
  status: "sent" | "acknowledged" | "rtgs_completed" | "squared_off" | "failed";
  sent_at: string;
  acknowledged_at: string | null;
  rtgs_reference: string | null;
  rtgs_completed_at: string | null;
  squared_off_at: string | null;
};

const fmtKES = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);

const STAGE_ORDER = ["sent", "acknowledged", "rtgs_completed", "squared_off"] as const;
const stageIndex = (s: string) => STAGE_ORDER.indexOf(s as typeof STAGE_ORDER[number]);

// Daraja-pattern lifecycle stages we project switch_events into.
// Maps to FTS v3.0 §5 event names: intent.received → intent.authorized →
// debit.posted → credit.confirmed (with intent.failed as a terminal branch).
type DarajaStage = "received" | "authorized" | "debited" | "credited" | "failed";
const DARAJA_FLOW: DarajaStage[] = ["received", "authorized", "debited", "credited"];

type SwitchEvent = {
  id: number;
  intent_id: string | null;
  event_type: string;
  from_state: string | null;
  to_state: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type IntentRow = {
  id: string;
  idempotency_key: string;
  payer_identifier: string;
  payee_identifier: string;
  payee_bank: string | null;
  amount: number;
  currency: string;
  state: string;
  trace_id: string;
  created_at: string;
  completed_at: string | null;
  last_error: string | null;
};

type IntentTimeline = {
  intent: IntentRow;
  events: SwitchEvent[];
  reachedStages: Set<DarajaStage>;
  finalResultCode: number | null;
  finalResultDesc: string | null;
  totalLatencyMs: number | null;
};

const EVENT_TO_STAGE: Record<string, DarajaStage> = {
  "intent.received": "received",
  "intent.authorized": "authorized",
  "debit.posted": "debited",
  "credit.confirmed": "credited",
  "intent.failed": "failed",
  // legacy event names (pre-v3.0) still seen in old rows
  "intent.created": "received",
  "debit.requested": "authorized",
  "debit.confirmed": "debited",
  "bank.rejected": "failed",
};

const stageColor = (s: DarajaStage) =>
  s === "credited" ? "bg-emerald-500" :
  s === "debited" ? "bg-blue-500" :
  s === "authorized" ? "bg-amber-500" :
  s === "received" ? "bg-primary" :
  "bg-destructive";

const resultCodeTone = (code: number | null) =>
  code === null ? "secondary" :
  code === 0 ? "default" :
  code >= 500 ? "destructive" : "outline";

export function SettlementCycleVisualizer() {
  const [advice, setAdvice] = useState<Advice[]>([]);
  const [loading, setLoading] = useState(false);
  const [cycleFilter, setCycleFilter] = useState<string>("");
  const [openEmail, setOpenEmail] = useState<Advice | null>(null);
  const [timelines, setTimelines] = useState<IntentTimeline[]>([]);
  const [openTimeline, setOpenTimeline] = useState<IntentTimeline | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("settlement_advice_emails")
      .select("*")
      .order("cycle_date", { ascending: false })
      .order("net_amount", { ascending: true })
      .limit(200);
    if (data) {
      setAdvice(data as Advice[]);
      if (!cycleFilter && data.length > 0) setCycleFilter((data[0] as Advice).cycle_date);
    }
  };

  // Fetch the Daraja intent timelines that contributed to the active cycle.
  const loadTimelines = async (cycleDate: string) => {
    if (!cycleDate) { setTimelines([]); return; }
    // Window = cycle date 00:00 EAT through next day 00:00 EAT.
    const start = `${cycleDate}T00:00:00+03:00`;
    const next = new Date(`${cycleDate}T00:00:00+03:00`);
    next.setUTCDate(next.getUTCDate() + 1);
    const end = next.toISOString();

    const { data: intents } = await supabase
      .from("transaction_intents")
      .select("id,idempotency_key,payer_identifier,payee_identifier,payee_bank,amount,currency,state,trace_id,created_at,completed_at,last_error")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false })
      .limit(150);

    if (!intents || intents.length === 0) { setTimelines([]); return; }
    const ids = intents.map((i) => i.id);
    const { data: events } = await supabase
      .from("switch_events")
      .select("id,intent_id,event_type,from_state,to_state,payload,created_at")
      .in("intent_id", ids)
      .order("id", { ascending: true });

    const eventsByIntent = new Map<string, SwitchEvent[]>();
    (events ?? []).forEach((e) => {
      if (!e.intent_id) return;
      const list = eventsByIntent.get(e.intent_id) ?? [];
      list.push(e as SwitchEvent);
      eventsByIntent.set(e.intent_id, list);
    });

    const built: IntentTimeline[] = (intents as IntentRow[]).map((intent) => {
      const evs = eventsByIntent.get(intent.id) ?? [];
      const reachedStages = new Set<DarajaStage>();
      let finalResultCode: number | null = null;
      let finalResultDesc: string | null = null;
      let totalLatencyMs: number | null = null;
      evs.forEach((e) => {
        const stg = EVENT_TO_STAGE[e.event_type];
        if (stg) reachedStages.add(stg);
        const p = e.payload ?? {};
        if ("ResultCode" in p) {
          finalResultCode = Number((p as any).ResultCode);
          finalResultDesc = String((p as any).ResultDesc ?? "");
        }
        if ("latency_ms" in p && typeof (p as any).latency_ms === "number") {
          totalLatencyMs = (totalLatencyMs ?? 0) + (p as any).latency_ms;
        }
      });
      // Infer ResultCode from terminal state if not explicitly logged.
      if (finalResultCode === null) {
        if (intent.state === "COMPLETED") { finalResultCode = 0; finalResultDesc = "Success"; }
        else if (intent.state === "FAILED") { finalResultCode = 1; finalResultDesc = intent.last_error ?? "bank_error"; }
      }
      return { intent, events: evs, reachedStages, finalResultCode, finalResultDesc, totalLatencyMs };
    });
    setTimelines(built);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadTimelines(cycleFilter); }, [cycleFilter]);

  const cycles = Array.from(new Set(advice.map((a) => a.cycle_date)));
  const current = advice.filter((a) => a.cycle_date === cycleFilter);

  const totals = {
    payable: current.filter((a) => a.direction === "LIPAFO_PAYS_BANK").reduce((s, a) => s + Math.abs(Number(a.net_amount)), 0),
    receivable: current.filter((a) => a.direction === "BANK_PAYS_LIPAFO").reduce((s, a) => s + Number(a.net_amount), 0),
    sent: current.filter((a) => a.status === "sent").length,
    acked: current.filter((a) => a.status === "acknowledged").length,
    rtgs: current.filter((a) => a.status === "rtgs_completed").length,
    squared: current.filter((a) => a.status === "squared_off").length,
  };

  const triggerNow = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("settlement-midnight-run", {
        body: { trigger: "manual" },
      });
      if (error) throw error;
      toast.success(`Midnight cycle ran — ${data.advice_emails_sent} bank advices generated`);
      await load();
    } catch (e) {
      toast.error(`Run failed: ${(e as Error).message}`);
    } finally { setLoading(false); }
  };

  const advance = async (a: Advice, to: Advice["status"], extra: Partial<Advice> = {}) => {
    const patch: Record<string, unknown> = { status: to, ...extra };
    if (to === "acknowledged") patch.acknowledged_at = new Date().toISOString();
    if (to === "rtgs_completed") {
      patch.rtgs_completed_at = new Date().toISOString();
      if (!a.rtgs_reference) patch.rtgs_reference = `RTGS-${a.bank_name.split(" ")[0].toUpperCase()}-${Date.now().toString().slice(-8)}`;
    }
    if (to === "squared_off") patch.squared_off_at = new Date().toISOString();
    const { error } = await supabase.from("settlement_advice_emails").update(patch).eq("id", a.id);
    if (error) toast.error(error.message);
    else { toast.success(`${a.bank_name} → ${to.replace(/_/g, " ")}`); load(); }
  };

  const simulateAllRTGS = async () => {
    const targets = current.filter((a) => a.direction !== "FLAT" && stageIndex(a.status) < 2);
    for (const a of targets) {
      await advance(a, "rtgs_completed");
    }
    toast.success(`${targets.length} RTGS legs simulated`);
  };

  const squareOffAll = async () => {
    const targets = current.filter((a) => a.status === "rtgs_completed");
    for (const a of targets) await advance(a, "squared_off");
    toast.success(`${targets.length} positions squared off`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <MoonStar className="h-5 w-5 text-primary" /> Midnight Settlement Cycle
          </h2>
          <p className="text-sm text-muted-foreground">
            Daily cron at <span className="font-mono">00:05 EAT</span> ·
            Snapshot positions → Email net advice → Bank RTGS → Square-off.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
          <Button onClick={triggerNow} disabled={loading} className="button-3d">
            <PlayCircle className="h-4 w-4 mr-2" />{loading ? "Running…" : "Trigger Midnight Run Now"}
          </Button>
        </div>
      </div>

      {/* Cycle timeline visual */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">End-to-End Cycle</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
            {[
              { icon: MoonStar, label: "00:05 Cron Cutoff", sub: "Snapshot net positions", tone: "text-primary" },
              { icon: Mail, label: "Advice Emails", sub: `${current.length} banks notified`, tone: "text-blue-400" },
              { icon: Send, label: "RTGS Initiated", sub: `${totals.acked + totals.rtgs + totals.squared}/${current.length} acknowledged`, tone: "text-amber-400" },
              { icon: Landmark, label: "RTGS Posted", sub: `${totals.rtgs + totals.squared} legs cleared`, tone: "text-green-400" },
              { icon: CheckCircle2, label: "Squared Off", sub: `${totals.squared}/${current.length} closed`, tone: "text-emerald-400" },
            ].map((s, i, arr) => (
              <div key={i} className="relative">
                <div className="rounded-lg border bg-card/50 p-3">
                  <s.icon className={`h-6 w-6 mx-auto ${s.tone}`} />
                  <div className="mt-1.5 font-semibold text-xs text-foreground">{s.label}</div>
                  <div className="text-[10px] text-muted-foreground">{s.sub}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-2 text-muted-foreground">→</div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Lipafo Payable</CardTitle>
            <ArrowUp className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-warning">{fmtKES(totals.payable)}</div></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Lipafo Receivable</CardTitle>
            <ArrowDown className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-success">{fmtKES(totals.receivable)}</div></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Advice Sent</CardTitle>
            <Mail className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-foreground">{current.length}</div></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Squared Off</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-emerald-400">{totals.squared}/{current.length}</div></CardContent>
        </Card>
      </div>

      {/* Cycle picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">Cycle:</span>
        {cycles.length === 0 && <span className="text-sm text-muted-foreground">No cycles yet — trigger one above.</span>}
        {cycles.map((c) => (
          <Button key={c} size="sm" variant={c === cycleFilter ? "default" : "outline"} onClick={() => setCycleFilter(c)}>
            {c}
          </Button>
        ))}
        {current.length > 0 && (
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={simulateAllRTGS}>
              <Sparkles className="h-3.5 w-3.5 mr-1" />Simulate All Bank RTGS
            </Button>
            <Button size="sm" variant="outline" onClick={squareOffAll}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Square Off All
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="advice" className="space-y-4">
        <TabsList className="glass-card">
          <TabsTrigger value="advice"><Mail className="h-4 w-4 mr-2" />Bank Advice Emails</TabsTrigger>
          <TabsTrigger value="rtgs"><Banknote className="h-4 w-4 mr-2" />RTGS & Square-Off Tracker</TabsTrigger>
          <TabsTrigger value="daraja"><Activity className="h-4 w-4 mr-2" />Daraja Flow ({timelines.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="advice">
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {current.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />{a.bank_name}
                      </TableCell>
                      <TableCell className="font-mono text-[11px]">{a.bank_email}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={a.direction === "LIPAFO_PAYS_BANK" ? "destructive" : a.direction === "BANK_PAYS_LIPAFO" ? "default" : "secondary"}>
                          {a.direction === "LIPAFO_PAYS_BANK" ? "Lipafo → Bank" : a.direction === "BANK_PAYS_LIPAFO" ? "Bank → Lipafo" : "Flat"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold">{fmtKES(Math.abs(Number(a.net_amount)))}</TableCell>
                      <TableCell className="text-xs max-w-[280px] truncate" title={a.subject}>{a.subject}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{a.status.replace(/_/g, " ")}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setOpenEmail(a)}>View Email</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {current.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No advice for this cycle.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rtgs">
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>RTGS Ref</TableHead>
                    <TableHead>RTGS At</TableHead>
                    <TableHead>Squared Off</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {current.map((a) => {
                    const idx = stageIndex(a.status);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.bank_name}</TableCell>
                        <TableCell className="text-right text-xs font-semibold">{fmtKES(Math.abs(Number(a.net_amount)))}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {STAGE_ORDER.map((s, i) => (
                              <div key={s} className={`h-1.5 w-8 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`} title={s} />
                            ))}
                          </div>
                          <div className="text-[10px] text-muted-foreground capitalize mt-0.5">{a.status.replace(/_/g, " ")}</div>
                        </TableCell>
                        <TableCell className="font-mono text-[11px]">{a.rtgs_reference ?? "—"}</TableCell>
                        <TableCell className="text-xs">{a.rtgs_completed_at ? new Date(a.rtgs_completed_at).toLocaleString("en-KE") : "—"}</TableCell>
                        <TableCell className="text-xs">{a.squared_off_at ? new Date(a.squared_off_at).toLocaleString("en-KE") : "—"}</TableCell>
                        <TableCell>
                          {a.status === "sent" && a.direction !== "FLAT" && (
                            <Button size="sm" variant="outline" onClick={() => advance(a, "acknowledged")}>Mark Ack</Button>
                          )}
                          {a.status === "acknowledged" && (
                            <Button size="sm" variant="outline" onClick={() => advance(a, "rtgs_completed")}>
                              <Banknote className="h-3 w-3 mr-1" />RTGS Done
                            </Button>
                          )}
                          {a.status === "rtgs_completed" && (
                            <Button size="sm" onClick={() => advance(a, "squared_off")}>
                              <CheckCircle2 className="h-3 w-3 mr-1" />Square Off
                            </Button>
                          )}
                          {a.status === "squared_off" && <span className="text-xs text-emerald-400">✓ Closed</span>}
                          {a.direction === "FLAT" && <span className="text-xs text-muted-foreground">No movement</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Email preview dialog */}
      <Dialog open={!!openEmail} onOpenChange={(o) => !o && setOpenEmail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />Settlement Advice (mock)
            </DialogTitle>
          </DialogHeader>
          {openEmail && (
            <div className="space-y-3">
              <div className="text-xs space-y-1 border-b pb-2">
                <div><span className="text-muted-foreground">From:</span> settlement@lipafo.co.ke</div>
                <div><span className="text-muted-foreground">To:</span> {openEmail.bank_email}</div>
                <div><span className="text-muted-foreground">Sent:</span> {new Date(openEmail.sent_at).toLocaleString("en-KE")}</div>
                <div><span className="text-muted-foreground">Subject:</span> <span className="font-semibold">{openEmail.subject}</span></div>
              </div>
              <pre className="whitespace-pre-wrap text-xs font-mono bg-muted/30 p-4 rounded-md max-h-[50vh] overflow-y-auto">
{openEmail.body}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
