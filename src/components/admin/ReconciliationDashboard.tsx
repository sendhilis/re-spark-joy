import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, ScanSearch, TrendingUp, XCircle } from "lucide-react";

type Position = { id: string; position_date: string; participating_bank: string; net_position: number; transaction_count: number; status: string };
type Instruction = { id: string; cycle_date: string; debtor_bank: string; creditor_bank: string; amount: number; status: string; payload: any };
type Confirmation = { id: string; instruction_id: string; outcome: string; settled_amount: number | null };

type Row = {
  key: string;
  cycle: string;
  bank: string;
  positionAmount: number;
  positionCount: number;
  instructionAmount: number;
  instructionCount: number;
  confirmedAmount: number;
  confirmedCount: number;
  status: "RECONCILED" | "MISSING_INSTRUCTION" | "MISSING_CONFIRMATION" | "AMOUNT_MISMATCH" | "REJECTED" | "NO_POSITION";
  variance: number;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);

const statusMeta: Record<Row["status"], { label: string; variant: any; icon: any; tone: string }> = {
  RECONCILED: { label: "Reconciled", variant: "default", icon: CheckCircle2, tone: "text-success" },
  MISSING_INSTRUCTION: { label: "Missing Instruction", variant: "destructive", icon: XCircle, tone: "text-destructive" },
  MISSING_CONFIRMATION: { label: "Pending Confirmation", variant: "secondary", icon: Activity, tone: "text-warning" },
  AMOUNT_MISMATCH: { label: "Amount Mismatch", variant: "destructive", icon: AlertTriangle, tone: "text-destructive" },
  REJECTED: { label: "Rejected", variant: "destructive", icon: XCircle, tone: "text-destructive" },
  NO_POSITION: { label: "Orphan Instruction", variant: "outline", icon: AlertTriangle, tone: "text-warning" },
};

export function ReconciliationDashboard() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [p, i, c] = await Promise.all([
      supabase.from("settlement_positions").select("*").order("position_date", { ascending: false }).limit(500),
      supabase.from("settlement_instructions").select("*").order("cycle_date", { ascending: false }).limit(1000),
      supabase.from("settlement_confirmations").select("*").limit(1000),
    ]);
    if (p.data) setPositions(p.data as Position[]);
    if (i.data) setInstructions(i.data as Instruction[]);
    if (c.data) setConfirmations(c.data as Confirmation[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("recon-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "settlement_positions" }, () => {
        setPulse("positions"); load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "settlement_instructions" }, () => {
        setPulse("instructions"); load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "settlement_confirmations" }, () => {
        setPulse("confirmations"); load();
        toast.success("New confirmation received from KCB");
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (!pulse) return;
    const t = setTimeout(() => setPulse(null), 1500);
    return () => clearTimeout(t);
  }, [pulse]);

  const rows = useMemo<Row[]>(() => {
    const confByInstr = new Map<string, Confirmation>();
    confirmations.forEach((c) => confByInstr.set(c.instruction_id, c));

    const map = new Map<string, Row>();

    // Seed with positions (one row per cycle+bank)
    positions.forEach((p) => {
      const key = `${p.position_date}|${p.participating_bank}`;
      const amt = Math.abs(Number(p.net_position));
      map.set(key, {
        key,
        cycle: p.position_date,
        bank: p.participating_bank,
        positionAmount: amt,
        positionCount: p.transaction_count ?? 0,
        instructionAmount: 0,
        instructionCount: 0,
        confirmedAmount: 0,
        confirmedCount: 0,
        status: "MISSING_INSTRUCTION",
        variance: amt,
      });
    });

    // Layer instructions (a position's bank can appear as either debtor or creditor)
    instructions.forEach((ins) => {
      const bank = ins.debtor_bank !== "LIPAFO_POOL" ? ins.debtor_bank : ins.creditor_bank;
      const key = `${ins.cycle_date}|${bank}`;
      const r = map.get(key) ?? {
        key, cycle: ins.cycle_date, bank,
        positionAmount: 0, positionCount: 0,
        instructionAmount: 0, instructionCount: 0,
        confirmedAmount: 0, confirmedCount: 0,
        status: "NO_POSITION" as Row["status"], variance: 0,
      };
      r.instructionAmount += Number(ins.amount);
      r.instructionCount += 1;
      const conf = confByInstr.get(ins.id);
      if (conf && conf.outcome === "settled") {
        r.confirmedAmount += Number(conf.settled_amount ?? ins.amount);
        r.confirmedCount += 1;
      } else if (conf && conf.outcome === "rejected") {
        r.status = "REJECTED";
      }
      map.set(key, r);
    });

    // Determine status & variance
    map.forEach((r) => {
      if (r.status === "REJECTED") return;
      if (r.positionAmount === 0 && r.instructionAmount > 0) {
        r.status = "NO_POSITION";
        r.variance = r.instructionAmount;
        return;
      }
      if (r.instructionAmount === 0) {
        r.status = "MISSING_INSTRUCTION";
        r.variance = r.positionAmount;
        return;
      }
      const posInstrDiff = Math.abs(r.positionAmount - r.instructionAmount);
      if (posInstrDiff > 1) {
        r.status = "AMOUNT_MISMATCH";
        r.variance = posInstrDiff;
        return;
      }
      if (r.confirmedAmount === 0 || Math.abs(r.confirmedAmount - r.instructionAmount) > 1) {
        r.status = "MISSING_CONFIRMATION";
        r.variance = r.instructionAmount - r.confirmedAmount;
        return;
      }
      r.status = "RECONCILED";
      r.variance = 0;
    });

    return Array.from(map.values()).sort((a, b) =>
      a.cycle === b.cycle ? a.bank.localeCompare(b.bank) : b.cycle.localeCompare(a.cycle)
    );
  }, [positions, instructions, confirmations]);

  const summary = useMemo(() => {
    const s = { total: rows.length, reconciled: 0, mismatched: 0, pending: 0, value: 0, variance: 0 };
    rows.forEach((r) => {
      s.value += r.positionAmount || r.instructionAmount;
      s.variance += r.variance;
      if (r.status === "RECONCILED") s.reconciled++;
      else if (r.status === "MISSING_CONFIRMATION") s.pending++;
      else s.mismatched++;
    });
    return s;
  }, [rows]);

  const reconRate = summary.total ? Math.round((summary.reconciled / summary.total) * 100) : 0;

  const filtered = (status?: Row["status"]) => (status ? rows.filter((r) => r.status === status) : rows);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ScanSearch className="h-5 w-5 text-primary" />
            Live Reconciliation
            <span className={`inline-flex h-2 w-2 rounded-full ${pulse ? "bg-success animate-ping" : "bg-success/50"}`} />
            <span className="text-xs font-normal text-muted-foreground">realtime</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Three-way match: <strong>Positions</strong> (clearing) ⇄ <strong>Instructions</strong> (pacs.009) ⇄ <strong>Confirmations</strong> (KCB).
            Mismatches surface within seconds.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={<TrendingUp className="h-4 w-4 text-primary" />} title="Recon Rate" value={`${reconRate}%`} sub={`${summary.reconciled}/${summary.total} legs`} pulsing={pulse === "confirmations"} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4 text-success" />} title="Reconciled" value={summary.reconciled.toString()} sub="fully matched" />
        <StatCard icon={<Activity className="h-4 w-4 text-warning" />} title="Pending Confirmation" value={summary.pending.toString()} sub="awaiting KCB" pulsing={pulse === "instructions"} />
        <StatCard icon={<AlertTriangle className="h-4 w-4 text-destructive" />} title="Mismatched" value={summary.mismatched.toString()} sub="action required" />
        <StatCard icon={<XCircle className="h-4 w-4 text-destructive" />} title="Total Variance" value={fmt(summary.variance)} sub={`of ${fmt(summary.value)}`} />
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="glass-card flex-wrap h-auto">
          <TabsTrigger value="all">All ({rows.length})</TabsTrigger>
          <TabsTrigger value="exceptions">Exceptions ({summary.mismatched + summary.pending})</TabsTrigger>
          <TabsTrigger value="reconciled">Reconciled ({summary.reconciled})</TabsTrigger>
        </TabsList>
        <TabsContent value="all"><RowsTable rows={rows} /></TabsContent>
        <TabsContent value="exceptions"><RowsTable rows={rows.filter((r) => r.status !== "RECONCILED")} /></TabsContent>
        <TabsContent value="reconciled"><RowsTable rows={filtered("RECONCILED")} /></TabsContent>
      </Tabs>
    </div>
  );
}

function RowsTable({ rows }: { rows: Row[] }) {
  return (
    <Card className="glass-card">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cycle</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead className="text-right">Position</TableHead>
              <TableHead className="text-right">Instructed</TableHead>
              <TableHead className="text-right">Confirmed</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const m = statusMeta[r.status];
              const Icon = m.icon;
              const rowClass =
                r.status === "RECONCILED" ? "" :
                r.status === "MISSING_CONFIRMATION" ? "bg-warning/5" : "bg-destructive/5";
              return (
                <TableRow key={r.key} className={rowClass}>
                  <TableCell className="text-xs font-mono">{r.cycle}</TableCell>
                  <TableCell className="text-xs font-medium">{r.bank}</TableCell>
                  <TableCell className="text-right text-xs">{fmt(r.positionAmount)}<div className="text-[10px] text-muted-foreground">{r.positionCount} txn</div></TableCell>
                  <TableCell className="text-right text-xs">{fmt(r.instructionAmount)}<div className="text-[10px] text-muted-foreground">{r.instructionCount} instr</div></TableCell>
                  <TableCell className="text-right text-xs">{fmt(r.confirmedAmount)}<div className="text-[10px] text-muted-foreground">{r.confirmedCount} conf</div></TableCell>
                  <TableCell className={`text-right text-xs font-semibold ${r.variance > 0 ? "text-destructive" : "text-success"}`}>{fmt(r.variance)}</TableCell>
                  <TableCell>
                    <Badge variant={m.variant} className="gap-1"><Icon className={`h-3 w-3 ${m.tone}`} />{m.label}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No rows match this filter.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function StatCard({ icon, title, value, sub, pulsing }: { icon: React.ReactNode; title: string; value: string; sub?: string; pulsing?: boolean }) {
  return (
    <Card className={`glass-card transition-all ${pulsing ? "ring-2 ring-primary/60" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-base font-bold text-foreground truncate">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
      </CardContent>
    </Card>
  );
}
