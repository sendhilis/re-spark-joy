import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Play, Pause, RotateCcw, CheckCircle2, AlertTriangle, XCircle, ArrowRight,
  Database, Users, Building2, FileSearch, Wrench, ShieldCheck, Clock, Zap
} from "lucide-react";

type Step = "idle" | "fetch" | "compare" | "classify" | "resolve" | "done";
type LegStatus = "pending" | "running" | "matched" | "variance" | "failed";

interface ReconLeg {
  id: string;
  name: string;
  poolGL: { code: string; label: string; balance: number };
  customer: { source: string; balance: number };
  core: { system: string; balance: number };
  variance: number;
  variancePct: number;
  status: LegStatus;
  reasonCode?: string;
  reasonDetail?: string;
  recommendedAction?: string;
  owner?: string;
  ageMinutes?: number;
}

const REASON_CODES: Record<string, { label: string; severity: "low" | "medium" | "high"; action: string; owner: string }> = {
  "RC-101": { label: "Timing Difference — In-flight JE", severity: "low", action: "Auto-resolves on next batch (T+1 06:00). No manual action.", owner: "System (auto)" },
  "RC-102": { label: "Rounding — Micro-transaction Tolerance", severity: "low", action: "Within KES 500 tolerance. Post adjusting JE to GL 5901 (Rounding Suspense).", owner: "Finance Ops" },
  "RC-201": { label: "Missing Settlement File", severity: "medium", action: "Contact partner (Safaricom/UAE Exchange). Escalate after 4h SLA breach.", owner: "Settlement Desk" },
  "RC-202": { label: "FX Rate Drift — Mid-rate vs Settlement", severity: "medium", action: "Revalue corridor at close-of-business rate. Post FX gain/loss to GL 4200.", owner: "Treasury" },
  "RC-301": { label: "Duplicate Posting Detected", severity: "high", action: "Reverse duplicate JE. Investigate idempotency key collision in switch logs.", owner: "Engineering + Finance" },
  "RC-302": { label: "Unauthorized Movement — Pool GL", severity: "high", action: "FREEZE Pool GL. Open SAR. Escalate to Compliance & Internal Audit immediately.", owner: "Compliance" },
};

const SEED_LEGS: ReconLeg[] = [
  { id: "L1", name: "Main Wallet Pool", poolGL: { code: "1010", label: "Pool GL — Main Wallets", balance: 45670000 }, customer: { source: "SUM(wallets WHERE type='main')", balance: 45670000 }, core: { system: "KCB T24", balance: 45670000 }, variance: 0, variancePct: 0, status: "pending" },
  { id: "L2", name: "Pension Pool (Taifa)", poolGL: { code: "1015", label: "Pool GL — Pension", balance: 6780000 }, customer: { source: "SUM(wallets WHERE type='pension')", balance: 6779850 }, core: { system: "KCB T24", balance: 6780000 }, variance: 150, variancePct: 0.0022, status: "pending", reasonCode: "RC-101" },
  { id: "L3", name: "M-Pesa Settlement Trust", poolGL: { code: "1040", label: "GL — M-Pesa Trust", balance: 1250000 }, customer: { source: "Safaricom Settlement Report", balance: 1250000 }, core: { system: "KCB T24", balance: 1250000 }, variance: 0, variancePct: 0, status: "pending" },
  { id: "L4", name: "Agent Float Pool", poolGL: { code: "1020", label: "GL — Agent Float", balance: 23400000 }, customer: { source: "SUM(bank_agents.float_balance)", balance: 23400000 }, core: { system: "Equity Bank", balance: 23400000 }, variance: 0, variancePct: 0, status: "pending" },
  { id: "L5", name: "Excise Duty Payable", poolGL: { code: "2050", label: "GL — Excise Payable", balance: 842000 }, customer: { source: "SUM(fee_income * 0.20)", balance: 842100 }, core: { system: "KRA Filing System", balance: 842000 }, variance: -100, variancePct: -0.0119, status: "pending", reasonCode: "RC-102" },
  { id: "L6", name: "Diaspora Inflow (UAE)", poolGL: { code: "1060", label: "GL — Diaspora Inflow", balance: 0 }, customer: { source: "UAE Exchange Partner File", balance: 0 }, core: { system: "Pending Upload", balance: 0 }, variance: 0, variancePct: 0, status: "pending", reasonCode: "RC-201" },
  { id: "L7", name: "Cross-border FX Corridor", poolGL: { code: "1070", label: "GL — FX Settlement", balance: 12300000 }, customer: { source: "Switch Outbound Ledger", balance: 12318500 }, core: { system: "Correspondent Bank", balance: 12300000 }, variance: 18500, variancePct: 0.1504, status: "pending", reasonCode: "RC-202" },
];

function classify(variance: number, balance: number): { status: LegStatus; reasonCode?: string } {
  if (variance === 0) return { status: "matched" };
  const pct = balance > 0 ? Math.abs(variance / balance) * 100 : 100;
  if (Math.abs(variance) <= 500) return { status: "variance", reasonCode: "RC-102" };
  if (pct < 0.01) return { status: "variance", reasonCode: "RC-101" };
  if (pct < 0.5) return { status: "variance", reasonCode: "RC-202" };
  return { status: "variance", reasonCode: "RC-301" };
}

const enrich = (leg: ReconLeg): ReconLeg => {
  const cls = classify(leg.variance, leg.poolGL.balance);
  const code = leg.reasonCode ?? cls.reasonCode;
  const meta = code ? REASON_CODES[code] : undefined;
  return {
    ...leg,
    status: cls.status,
    reasonCode: code,
    reasonDetail: meta?.label,
    recommendedAction: meta?.action,
    owner: meta?.owner,
    ageMinutes: leg.id === "L6" ? 245 : Math.floor(Math.random() * 60) + 5,
  };
};

const STEPS: { key: Step; label: string; icon: any }[] = [
  { key: "fetch", label: "Fetch balances", icon: Database },
  { key: "compare", label: "3-way compare", icon: FileSearch },
  { key: "classify", label: "Classify variances", icon: AlertTriangle },
  { key: "resolve", label: "Recommend actions", icon: Wrench },
  { key: "done", label: "Recon complete", icon: ShieldCheck },
];

export function ReconciliationFlow() {
  const [legs, setLegs] = useState<ReconLeg[]>(SEED_LEGS);
  const [step, setStep] = useState<Step>("idle");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeLeg, setActiveLeg] = useState<ReconLeg | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveLeg, setResolveLeg] = useState<ReconLeg | null>(null);
  const [resolveAction, setResolveAction] = useState("post-adjusting-je");
  const [resolveNote, setResolveNote] = useState("");

  useEffect(() => {
    if (!running) return;
    const order: Step[] = ["fetch", "compare", "classify", "resolve", "done"];
    const idx = order.indexOf(step === "idle" ? "fetch" : step);
    if (idx === -1 || step === "done") { setRunning(false); return; }

    const t = setTimeout(() => {
      const current = order[idx];
      if (current === "fetch") {
        setLegs(prev => prev.map(l => ({ ...l, status: "running" as LegStatus })));
      } else if (current === "compare" || current === "classify") {
        setLegs(prev => prev.map(enrich));
      } else if (current === "resolve") {
        setLegs(prev => prev.map(enrich));
      }
      setProgress(((idx + 1) / order.length) * 100);
      setStep(order[Math.min(idx + 1, order.length - 1)]);
    }, 1100);
    return () => clearTimeout(t);
  }, [running, step]);

  const start = () => {
    setLegs(SEED_LEGS.map(l => ({ ...l, status: "pending" })));
    setProgress(0);
    setStep("fetch");
    setRunning(true);
  };

  const reset = () => {
    setRunning(false);
    setStep("idle");
    setProgress(0);
    setLegs(SEED_LEGS);
  };

  const injectBreak = () => {
    setLegs(prev => prev.map(l => l.id === "L1"
      ? { ...enrich({ ...l, customer: { ...l.customer, balance: l.customer.balance - 75000 }, variance: -75000, variancePct: -0.164, reasonCode: "RC-301" }) }
      : l));
    toast.error("Break injected: KES 75,000 missing from Main Wallet aggregate", { description: "Reason RC-301 — Duplicate posting suspected" });
  };

  const openResolve = (leg: ReconLeg) => {
    setResolveLeg(leg);
    setResolveOpen(true);
    setResolveNote("");
  };

  const submitResolution = () => {
    if (!resolveLeg) return;
    setLegs(prev => prev.map(l => l.id === resolveLeg.id
      ? { ...l, status: "matched", variance: 0, variancePct: 0, reasonDetail: `Resolved: ${resolveAction}`, recommendedAction: resolveNote || "Manually resolved by admin" }
      : l));
    toast.success(`Variance resolved on ${resolveLeg.name}`, { description: `Action: ${resolveAction}` });
    setResolveOpen(false);
    setResolveLeg(null);
  };

  const matched = legs.filter(l => l.status === "matched").length;
  const variances = legs.filter(l => l.status === "variance").length;
  const failed = legs.filter(l => l.status === "failed").length;
  const totalVariance = legs.reduce((s, l) => s + Math.abs(l.variance), 0);
  const matchRate = legs.length ? Math.round((matched / legs.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Live Reconciliation Simulator — 3-Way Match
          </CardTitle>
          <CardDescription>
            Simulates the daily recon between <span className="text-primary font-medium">Pool GL</span> ↔{" "}
            <span className="text-primary font-medium">Customer Aggregate</span> ↔{" "}
            <span className="text-primary font-medium">Core Banking</span>. At equilibrium, all three must reconcile to the cent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={start} disabled={running} className="gap-2">
              <Play className="h-4 w-4" /> Run Recon Cycle
            </Button>
            <Button onClick={() => setRunning(false)} disabled={!running} variant="outline" className="gap-2">
              <Pause className="h-4 w-4" /> Pause
            </Button>
            <Button onClick={reset} variant="outline" className="gap-2">
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
            <Button onClick={injectBreak} variant="outline" className="gap-2 ml-auto border-red-500/30 text-red-400 hover:bg-red-500/10">
              <AlertTriangle className="h-4 w-4" /> Inject Break (Demo)
            </Button>
          </div>

          {/* Step pipeline */}
          <div className="flex items-center justify-between gap-2 mt-4">
            {STEPS.map((s, i) => {
              const idx = STEPS.findIndex(x => x.key === step);
              const done = step !== "idle" && i < idx;
              const active = step === s.key;
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex-1 flex items-center">
                  <div className={`flex flex-col items-center gap-1 flex-1 ${active ? "text-primary" : done ? "text-emerald-400" : "text-muted-foreground"}`}>
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center border ${active ? "border-primary bg-primary/20 animate-pulse" : done ? "border-emerald-500/40 bg-emerald-500/10" : "border-border bg-muted/20"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] text-center">{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground mx-1 shrink-0" />}
                </div>
              );
            })}
          </div>

          <Progress value={progress} className="h-1.5" />
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{matchRate}%</div>
          <div className="text-xs text-muted-foreground">Match Rate</div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{matched}</div>
          <div className="text-xs text-muted-foreground">Matched Legs</div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{variances}</div>
          <div className="text-xs text-muted-foreground">Variances</div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-foreground">KES {totalVariance.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Net Variance Exposure</div>
        </CardContent></Card>
      </div>

      {/* Recon legs */}
      <div className="grid gap-3">
        {legs.map(leg => {
          const cfg = leg.status === "matched" ? { color: "emerald", icon: CheckCircle2, label: "Matched" }
            : leg.status === "variance" ? { color: "yellow", icon: AlertTriangle, label: "Variance" }
            : leg.status === "failed" ? { color: "red", icon: XCircle, label: "Failed" }
            : leg.status === "running" ? { color: "blue", icon: Clock, label: "Running…" }
            : { color: "muted", icon: Clock, label: "Pending" };
          const Icon = cfg.icon;
          const sevMeta = leg.reasonCode ? REASON_CODES[leg.reasonCode] : undefined;

          return (
            <Card key={leg.id} className={`glass-card border-l-4 ${
              cfg.color === "emerald" ? "border-l-emerald-500" :
              cfg.color === "yellow" ? "border-l-yellow-500" :
              cfg.color === "red" ? "border-l-red-500" :
              cfg.color === "blue" ? "border-l-blue-500" : "border-l-border"
            }`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{leg.name}</h3>
                      <Badge variant="outline" className="font-mono text-[10px]">{leg.id}</Badge>
                    </div>
                    {leg.reasonCode && leg.status === "variance" && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="font-mono text-yellow-400">{leg.reasonCode}</span> — {leg.reasonDetail}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className={
                    cfg.color === "emerald" ? "bg-emerald-500/10 text-emerald-400" :
                    cfg.color === "yellow" ? "bg-yellow-500/10 text-yellow-400" :
                    cfg.color === "red" ? "bg-red-500/10 text-red-400" :
                    cfg.color === "blue" ? "bg-blue-500/10 text-blue-400" : ""
                  }>
                    <Icon className="h-3 w-3 mr-1" />{cfg.label}
                  </Badge>
                </div>

                {/* 3-way grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                      <Database className="h-3 w-3" /> POOL GL ({leg.poolGL.code})
                    </div>
                    <div className="font-mono text-sm font-semibold text-foreground">KES {leg.poolGL.balance.toLocaleString()}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                      <Users className="h-3 w-3" /> CUSTOMER AGG
                    </div>
                    <div className="font-mono text-sm font-semibold text-foreground">KES {leg.customer.balance.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground truncate mt-0.5">{leg.customer.source}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                      <Building2 className="h-3 w-3" /> CORE BANKING
                    </div>
                    <div className="font-mono text-sm font-semibold text-foreground">KES {leg.core.balance.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{leg.core.system}</div>
                  </div>
                </div>

                {/* Variance + action */}
                {leg.status === "variance" && (
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-3 pt-2 border-t border-border/50">
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">Variance</div>
                      <div className={`font-mono text-sm font-bold ${Math.abs(leg.variance) > 1000 ? "text-red-400" : "text-yellow-400"}`}>
                        KES {leg.variance.toLocaleString()} ({leg.variancePct.toFixed(4)}%)
                      </div>
                    </div>
                    <div className="flex-[2]">
                      <div className="text-xs text-muted-foreground">Recommended Action → <span className="text-primary">{leg.owner}</span></div>
                      <div className="text-xs text-foreground">{leg.recommendedAction}</div>
                    </div>
                    <Button size="sm" onClick={() => openResolve(leg)} className="gap-1">
                      <Wrench className="h-3 w-3" /> Resolve
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Reason code legend */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Reason Code Catalog</CardTitle>
          <CardDescription>Standard variance classifications and ownership</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {Object.entries(REASON_CODES).map(([code, meta]) => (
            <div key={code} className="p-3 rounded-lg bg-muted/10 border border-border/50">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-mono text-xs text-primary">{code}</span>
                <Badge variant="outline" className={
                  meta.severity === "high" ? "bg-red-500/10 text-red-400 text-[10px]" :
                  meta.severity === "medium" ? "bg-yellow-500/10 text-yellow-400 text-[10px]" :
                  "bg-emerald-500/10 text-emerald-400 text-[10px]"
                }>{meta.severity}</Badge>
              </div>
              <div className="text-xs font-medium text-foreground">{meta.label}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{meta.action}</div>
              <div className="text-[10px] text-primary mt-1">Owner: {meta.owner}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Resolve dialog */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="glass-card">
          <DialogHeader>
            <DialogTitle>Resolve Variance — {resolveLeg?.name}</DialogTitle>
            <DialogDescription>
              {resolveLeg?.reasonCode} — {resolveLeg?.reasonDetail}<br />
              Variance: <span className="font-mono text-yellow-400">KES {resolveLeg?.variance.toLocaleString()}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Resolution Action</label>
              <Select value={resolveAction} onValueChange={setResolveAction}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="post-adjusting-je">Post Adjusting Journal Entry</SelectItem>
                  <SelectItem value="reverse-duplicate">Reverse Duplicate Posting</SelectItem>
                  <SelectItem value="accept-tolerance">Accept within Tolerance (KES 500)</SelectItem>
                  <SelectItem value="escalate-treasury">Escalate to Treasury</SelectItem>
                  <SelectItem value="freeze-pool-gl">FREEZE Pool GL + Open SAR</SelectItem>
                  <SelectItem value="defer-next-cycle">Defer to Next Cycle (T+1)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Resolution Note (audit trail)</label>
              <Textarea value={resolveNote} onChange={e => setResolveNote(e.target.value)} placeholder="e.g. Confirmed timing diff with M-Pesa settlement file 2026-04-29..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(false)}>Cancel</Button>
            <Button onClick={submitResolution} className="gap-2"><CheckCircle2 className="h-4 w-4" />Submit Resolution</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
