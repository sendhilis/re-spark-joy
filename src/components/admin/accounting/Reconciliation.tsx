import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";

interface ReconciliationRecord {
  id: string;
  reconciliationType: string;
  internalSystem: string;
  externalSystem: string;
  date: string;
  internalBalance: number;
  externalBalance: number;
  variance: number;
  matchedCount: number;
  unmatchedCount: number;
  status: "matched" | "variance" | "pending" | "failed";
  resolution: string | null;
}

const reconciliations: ReconciliationRecord[] = [
  { id: "REC-001", reconciliationType: "Pool GL vs Customer Aggregate", internalSystem: "Pool GL 1010 (Main)", externalSystem: "SUM(wallets.balance WHERE type='main')", date: "2026-03-24 06:00", internalBalance: 45670000, externalBalance: 45670000, variance: 0, matchedCount: 12450, unmatchedCount: 0, status: "matched", resolution: null },
  { id: "REC-002", reconciliationType: "Pool GL vs Customer Aggregate", internalSystem: "Pool GL 1015 (Pension)", externalSystem: "SUM(wallets.balance WHERE type='pension')", date: "2026-03-24 06:00", internalBalance: 6780000, externalBalance: 6779850, variance: 150, matchedCount: 3200, unmatchedCount: 1, status: "variance", resolution: "Timing difference: CPF contribution JE-2026-00457 posted at 14:00 but pension wallet credited at 14:02. Auto-resolves on next cycle." },
  { id: "REC-003", reconciliationType: "M-Pesa Settlement", internalSystem: "GL 1040 (M-Pesa Trust)", externalSystem: "Safaricom Settlement Report", date: "2026-03-24 06:00", internalBalance: 1250000, externalBalance: 1250000, variance: 0, matchedCount: 8920, unmatchedCount: 0, status: "matched", resolution: null },
  { id: "REC-004", reconciliationType: "Agent Float Reconciliation", internalSystem: "GL 1020 (Agent Float Pool)", externalSystem: "SUM(bank_agents.float_balance)", date: "2026-03-24 06:00", internalBalance: 23400000, externalBalance: 23400000, variance: 0, matchedCount: 156, unmatchedCount: 0, status: "matched", resolution: null },
  { id: "REC-005", reconciliationType: "Card Processor Settlement", internalSystem: "GL 1050 (Card Processor)", externalSystem: "JamboPay/VISA Settlement File", date: "2026-03-23 18:00", internalBalance: 890000, externalBalance: 890000, variance: 0, matchedCount: 2340, unmatchedCount: 0, status: "matched", resolution: null },
  { id: "REC-006", reconciliationType: "Core Banking Sync", internalSystem: "All Pool GLs", externalSystem: "KCB Core Banking (T24)", date: "2026-03-24 06:00", internalBalance: 104090000, externalBalance: 104090000, variance: 0, matchedCount: 1, unmatchedCount: 0, status: "matched", resolution: null },
  { id: "REC-007", reconciliationType: "Loan Portfolio Reconciliation", internalSystem: "GL 1100-1140 (Loans Receivable)", externalSystem: "SUM(loan_applications WHERE status='disbursed')", date: "2026-03-24 06:00", internalBalance: 34500000, externalBalance: 34500000, variance: 0, matchedCount: 890, unmatchedCount: 0, status: "matched", resolution: null },
  { id: "REC-008", reconciliationType: "Excise Duty Reconciliation", internalSystem: "GL 2050 (Excise Payable)", externalSystem: "SUM(daily_fee_income * 0.20)", date: "2026-03-24 06:00", internalBalance: 842000, externalBalance: 842100, variance: -100, matchedCount: 1, unmatchedCount: 0, status: "variance", resolution: "Rounding difference on micro-transactions. Within KES 500 tolerance threshold." },
  { id: "REC-009", reconciliationType: "Diaspora Remittance Settlement", internalSystem: "GL 1060 (Diaspora Inflow)", externalSystem: "UAE Exchange Partner Report", date: "2026-03-24 09:00", internalBalance: 0, externalBalance: 0, variance: 0, matchedCount: 0, unmatchedCount: 0, status: "pending", resolution: "Awaiting partner file upload for 2026-03-24" },
];

const statusConfig: Record<string, { icon: React.ComponentType<any>; color: string; label: string }> = {
  matched: { icon: CheckCircle2, color: "text-emerald-400 bg-emerald-500/10", label: "Matched" },
  variance: { icon: AlertTriangle, color: "text-yellow-400 bg-yellow-500/10", label: "Variance" },
  pending: { icon: Clock, color: "text-blue-400 bg-blue-500/10", label: "Pending" },
  failed: { icon: XCircle, color: "text-red-400 bg-red-500/10", label: "Failed" },
};

export function Reconciliation() {
  const [filterStatus, setFilterStatus] = useState("all");
  const filtered = reconciliations.filter(r => filterStatus === "all" || r.status === filterStatus);
  const matchedPct = Math.round(reconciliations.filter(r => r.status === "matched").length / reconciliations.length * 100);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{matchedPct}%</div>
          <div className="text-xs text-muted-foreground">Match Rate</div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{reconciliations.length}</div>
          <div className="text-xs text-muted-foreground">Reconciliation Points</div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{reconciliations.filter(r => r.status === "variance").length}</div>
          <div className="text-xs text-muted-foreground">Active Variances</div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-foreground">KES {Math.abs(reconciliations.reduce((s, r) => s + r.variance, 0)).toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Net Variance</div>
        </CardContent></Card>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="matched">Matched</SelectItem>
            <SelectItem value="variance">Variance</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="glass-card"><RefreshCw className="h-4 w-4 mr-2" />Run Reconciliation</Button>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" />Transaction Reconciliation Dashboard</CardTitle>
          <CardDescription>Automated reconciliation between internal ledger, pool GLs, customer aggregates, and external core banking systems</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Internal System</TableHead>
                <TableHead>External System</TableHead>
                <TableHead className="text-right">Internal Bal</TableHead>
                <TableHead className="text-right">External Bal</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => {
                const StatusIcon = statusConfig[r.status].icon;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs text-primary">{r.id}</TableCell>
                    <TableCell className="text-sm font-medium">{r.reconciliationType}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.internalSystem}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.externalSystem}</TableCell>
                    <TableCell className="text-right font-mono text-sm">KES {r.internalBalance.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm">KES {r.externalBalance.toLocaleString()}</TableCell>
                    <TableCell className={`text-right font-mono text-sm ${r.variance !== 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                      {r.variance === 0 ? "—" : `KES ${r.variance.toLocaleString()}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusConfig[r.status].color}>
                        <StatusIcon className="h-3 w-3 mr-1" />{statusConfig[r.status].label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {/* Resolution notes for variances */}
          {filtered.filter(r => r.resolution).map(r => (
            <div key={r.id} className="mt-3 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-xs">
              <span className="font-mono text-yellow-400">{r.id}</span>: {r.resolution}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
