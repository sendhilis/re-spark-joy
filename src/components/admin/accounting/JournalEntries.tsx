import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, CheckCircle, Clock, AlertCircle, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  source: string;
  status: "posted" | "pending" | "reversed" | "failed";
  lines: { glCode: string; glName: string; debit: number; credit: number }[];
  totalDebit: number;
  totalCredit: number;
  postedBy: string;
  approvedBy: string | null;
}

const journalEntries: JournalEntry[] = [
  {
    id: "JE-2026-00451", date: "2026-03-24 09:15:32", reference: "TXN-MPE-88291", description: "M-Pesa deposit - Customer wallet top-up",
    source: "AUTO-MPESA", status: "posted",
    lines: [
      { glCode: "1040", glName: "M-Pesa Trust Account", debit: 5000, credit: 0 },
      { glCode: "2010", glName: "Customer Balances - Main", debit: 0, credit: 5000 },
    ],
    totalDebit: 5000, totalCredit: 5000, postedBy: "SYSTEM", approvedBy: "AUTO"
  },
  {
    id: "JE-2026-00452", date: "2026-03-24 09:16:01", reference: "TXN-P2P-44821", description: "P2P Transfer with fee - KES 2,000 + KES 15 fee",
    source: "AUTO-P2P", status: "posted",
    lines: [
      { glCode: "2010", glName: "Sender Wallet Liability", debit: 2015, credit: 0 },
      { glCode: "2010", glName: "Receiver Wallet Liability", debit: 0, credit: 2000 },
      { glCode: "4010", glName: "P2P Transfer Fees", debit: 0, credit: 15 },
    ],
    totalDebit: 2015, totalCredit: 2015, postedBy: "SYSTEM", approvedBy: "AUTO"
  },
  {
    id: "JE-2026-00453", date: "2026-03-24 09:20:15", reference: "TXN-SAYS-11092", description: "Save-As-You-Spend auto-sweep 5% of KES 2,000 to Retirement",
    source: "AUTO-SAYS", status: "posted",
    lines: [
      { glCode: "2010", glName: "Customer Main Wallet", debit: 100, credit: 0 },
      { glCode: "2014", glName: "Customer Retirement Wallet", debit: 0, credit: 100 },
    ],
    totalDebit: 100, totalCredit: 100, postedBy: "SYSTEM", approvedBy: "AUTO"
  },
  {
    id: "JE-2026-00454", date: "2026-03-24 10:05:00", reference: "TXN-LOAN-77201", description: "Instant loan disbursement KES 10,000 + 2.5% origination fee",
    source: "AUTO-LOAN", status: "posted",
    lines: [
      { glCode: "1110", glName: "Loans Receivable - Instant", debit: 10000, credit: 0 },
      { glCode: "2010", glName: "Customer Main Wallet", debit: 0, credit: 9750 },
      { glCode: "4110", glName: "Loan Origination Fees", debit: 0, credit: 250 },
    ],
    totalDebit: 10000, totalCredit: 10000, postedBy: "SYSTEM", approvedBy: "AUTO"
  },
  {
    id: "JE-2026-00455", date: "2026-03-24 10:30:00", reference: "TXN-BILL-55123", description: "KPLC bill payment KES 3,500 + KES 30 fee",
    source: "AUTO-BILL", status: "posted",
    lines: [
      { glCode: "2010", glName: "Customer Main Wallet", debit: 3530, credit: 0 },
      { glCode: "2030", glName: "Pending Settlement - M-Pesa", debit: 0, credit: 3500 },
      { glCode: "4020", glName: "Bill Payment Fees", debit: 0, credit: 30 },
    ],
    totalDebit: 3530, totalCredit: 3530, postedBy: "SYSTEM", approvedBy: "AUTO"
  },
  {
    id: "JE-2026-00456", date: "2026-03-24 11:00:00", reference: "TXN-AGT-33109", description: "Agent cash-in KES 15,000 + KES 50 fee",
    source: "AUTO-AGENT", status: "posted",
    lines: [
      { glCode: "1020", glName: "Agent Float Pool", debit: 15000, credit: 0 },
      { glCode: "2010", glName: "Customer Main Wallet", debit: 0, credit: 14950 },
      { glCode: "4060", glName: "Agent Transaction Fees", debit: 0, credit: 50 },
    ],
    totalDebit: 15000, totalCredit: 15000, postedBy: "SYSTEM", approvedBy: "AUTO"
  },
  {
    id: "JE-2026-00457", date: "2026-03-24 14:00:00", reference: "TXN-CPF-90012", description: "CPF pension contribution from fee delta KES 12.50",
    source: "AUTO-CPF", status: "posted",
    lines: [
      { glCode: "1010", glName: "Wallet Pool - Main", debit: 0, credit: 12.50 },
      { glCode: "1015", glName: "Wallet Pool - Pension", debit: 12.50, credit: 0 },
      { glCode: "2010", glName: "Customer Main Wallet", debit: 12.50, credit: 0 },
      { glCode: "2015", glName: "Customer Pension Wallet", debit: 0, credit: 12.50 },
    ],
    totalDebit: 25, totalCredit: 25, postedBy: "SYSTEM", approvedBy: "AUTO"
  },
  {
    id: "JE-2026-00458", date: "2026-03-24 18:00:00", reference: "SETTLE-MPESA-0324", description: "M-Pesa end-of-day settlement to KCB",
    source: "AUTO-SETTLE", status: "pending",
    lines: [
      { glCode: "1030", glName: "Settlement Bank - KCB", debit: 2450000, credit: 0 },
      { glCode: "1040", glName: "M-Pesa Trust Account", debit: 0, credit: 2450000 },
    ],
    totalDebit: 2450000, totalCredit: 2450000, postedBy: "SYSTEM", approvedBy: null
  },
  {
    id: "JE-2026-00459", date: "2026-03-24 18:05:00", reference: "TAX-EXCISE-0324", description: "Daily excise duty provision on fees (20%)",
    source: "AUTO-TAX", status: "pending",
    lines: [
      { glCode: "4000", glName: "Transaction Fee Income", debit: 8420, credit: 0 },
      { glCode: "2050", glName: "Taxes Payable - Excise Duty", debit: 0, credit: 8420 },
    ],
    totalDebit: 8420, totalCredit: 8420, postedBy: "SYSTEM", approvedBy: null
  },
  {
    id: "JE-2026-00460", date: "2026-03-24 09:17:00", reference: "TXN-P2P-44822", description: "P2P Transfer reversed - recipient account frozen",
    source: "AUTO-P2P", status: "reversed",
    lines: [
      { glCode: "2010", glName: "Receiver Wallet Liability", debit: 1500, credit: 0 },
      { glCode: "2010", glName: "Sender Wallet Liability", debit: 0, credit: 1500 },
    ],
    totalDebit: 1500, totalCredit: 1500, postedBy: "SYSTEM", approvedBy: "ADMIN-001"
  },
];

const statusConfig: Record<string, { icon: React.ComponentType<any>; color: string }> = {
  posted: { icon: CheckCircle, color: "text-emerald-400 bg-emerald-500/10" },
  pending: { icon: Clock, color: "text-yellow-400 bg-yellow-500/10" },
  reversed: { icon: AlertCircle, color: "text-orange-400 bg-orange-500/10" },
  failed: { icon: AlertCircle, color: "text-red-400 bg-red-500/10" },
};

export function JournalEntries() {
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedJE, setSelectedJE] = useState<JournalEntry | null>(null);

  const filtered = journalEntries.filter(je => filterStatus === "all" || je.status === filterStatus);

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{journalEntries.length}</div>
          <div className="text-xs text-muted-foreground">Total JEs Today</div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{journalEntries.filter(j => j.status === "posted").length}</div>
          <div className="text-xs text-muted-foreground">Posted</div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{journalEntries.filter(j => j.status === "pending").length}</div>
          <div className="text-xs text-muted-foreground">Pending Approval</div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-orange-400">{journalEntries.filter(j => j.status === "reversed").length}</div>
          <div className="text-xs text-muted-foreground">Reversed</div>
        </CardContent></Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reversed">Reversed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* JE Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" />Journal Entries</CardTitle>
          <CardDescription>Double-entry bookkeeping — every transaction posts balanced debit/credit entries</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>JE ID</TableHead>
                <TableHead>Date/Time</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(je => {
                const StatusIcon = statusConfig[je.status].icon;
                return (
                  <TableRow key={je.id}>
                    <TableCell className="font-mono text-primary text-sm">{je.id}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{je.date}</TableCell>
                    <TableCell className="font-mono text-xs">{je.reference}</TableCell>
                    <TableCell className="max-w-[250px] text-sm">{je.description}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{je.source}</Badge></TableCell>
                    <TableCell className="text-right font-mono">KES {je.totalDebit.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusConfig[je.status].color}>
                        <StatusIcon className="h-3 w-3 mr-1" />{je.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedJE(je)}><Eye className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* JE Detail Dialog */}
      <Dialog open={!!selectedJE} onOpenChange={() => setSelectedJE(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Journal Entry Detail — {selectedJE?.id}</DialogTitle></DialogHeader>
          {selectedJE && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Reference:</span> <span className="font-mono">{selectedJE.reference}</span></div>
                <div><span className="text-muted-foreground">Date:</span> {selectedJE.date}</div>
                <div><span className="text-muted-foreground">Source:</span> {selectedJE.source}</div>
                <div><span className="text-muted-foreground">Posted By:</span> {selectedJE.postedBy}</div>
              </div>
              <p className="text-sm text-foreground">{selectedJE.description}</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>GL Code</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Debit (KES)</TableHead>
                    <TableHead className="text-right">Credit (KES)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedJE.lines.map((line, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-primary">{line.glCode}</TableCell>
                      <TableCell>{line.glName}</TableCell>
                      <TableCell className="text-right font-mono">{line.debit > 0 ? line.debit.toLocaleString() : "—"}</TableCell>
                      <TableCell className="text-right font-mono">{line.credit > 0 ? line.credit.toLocaleString() : "—"}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={2}>Totals</TableCell>
                    <TableCell className="text-right font-mono">KES {selectedJE.totalDebit.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">KES {selectedJE.totalCredit.toLocaleString()}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <div className={`p-3 rounded-lg text-center text-sm font-medium ${selectedJE.totalDebit === selectedJE.totalCredit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                {selectedJE.totalDebit === selectedJE.totalCredit ? "✓ Journal Entry is BALANCED" : "✗ IMBALANCED — Requires correction"}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
