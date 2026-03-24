import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Server, CheckCircle2, Clock, AlertTriangle, Play, RotateCcw } from "lucide-react";

interface PostingBatch {
  id: string;
  batchType: string;
  description: string;
  jeCount: number;
  totalAmount: number;
  createdAt: string;
  postedAt: string | null;
  coreSystem: string;
  status: "posted" | "queued" | "processing" | "failed" | "reconciled";
  responseCode: string | null;
  retryCount: number;
}

const postingBatches: PostingBatch[] = [
  { id: "BATCH-2026-0324-001", batchType: "Real-Time", description: "M-Pesa deposits — real-time posting", jeCount: 342, totalAmount: 4520000, createdAt: "2026-03-24 00:00", postedAt: "2026-03-24 09:45", coreSystem: "KCB T24", status: "posted", responseCode: "200-OK", retryCount: 0 },
  { id: "BATCH-2026-0324-002", batchType: "Real-Time", description: "P2P transfers with fees", jeCount: 891, totalAmount: 12340000, createdAt: "2026-03-24 00:00", postedAt: "2026-03-24 10:00", coreSystem: "KCB T24", status: "posted", responseCode: "200-OK", retryCount: 0 },
  { id: "BATCH-2026-0324-003", batchType: "Real-Time", description: "Loan disbursements", jeCount: 23, totalAmount: 3450000, createdAt: "2026-03-24 00:00", postedAt: "2026-03-24 10:15", coreSystem: "KCB T24", status: "posted", responseCode: "200-OK", retryCount: 0 },
  { id: "BATCH-2026-0324-004", batchType: "Batch", description: "Bill payments — batch post", jeCount: 567, totalAmount: 8900000, createdAt: "2026-03-24 12:00", postedAt: "2026-03-24 12:05", coreSystem: "KCB T24", status: "posted", responseCode: "200-OK", retryCount: 0 },
  { id: "BATCH-2026-0324-005", batchType: "Batch", description: "SAYS auto-sweep entries", jeCount: 445, totalAmount: 890000, createdAt: "2026-03-24 12:00", postedAt: "2026-03-24 12:05", coreSystem: "KCB T24", status: "posted", responseCode: "200-OK", retryCount: 0 },
  { id: "BATCH-2026-0324-006", batchType: "Batch", description: "Agent cash-in/cash-out", jeCount: 234, totalAmount: 5670000, createdAt: "2026-03-24 12:00", postedAt: "2026-03-24 12:06", coreSystem: "KCB T24", status: "posted", responseCode: "200-OK", retryCount: 0 },
  { id: "BATCH-2026-0324-007", batchType: "EOD", description: "M-Pesa settlement to bank", jeCount: 1, totalAmount: 2450000, createdAt: "2026-03-24 18:00", postedAt: null, coreSystem: "KCB T24", status: "queued", responseCode: null, retryCount: 0 },
  { id: "BATCH-2026-0324-008", batchType: "EOD", description: "Excise duty provision", jeCount: 1, totalAmount: 8420, createdAt: "2026-03-24 18:00", postedAt: null, coreSystem: "KRA iTax", status: "queued", responseCode: null, retryCount: 0 },
  { id: "BATCH-2026-0324-009", batchType: "EOD", description: "Interest accrual on loans", jeCount: 890, totalAmount: 125000, createdAt: "2026-03-24 18:00", postedAt: null, coreSystem: "KCB T24", status: "processing", responseCode: null, retryCount: 0 },
  { id: "BATCH-2026-0324-010", batchType: "EOD", description: "Card processor settlement", jeCount: 1, totalAmount: 890000, createdAt: "2026-03-24 18:00", postedAt: null, coreSystem: "KCB T24", status: "queued", responseCode: null, retryCount: 0 },
  { id: "BATCH-2026-0323-ERR", batchType: "Batch", description: "Diaspora remittance batch (yesterday)", jeCount: 12, totalAmount: 1200000, createdAt: "2026-03-23 14:00", postedAt: null, coreSystem: "Equity FCC", status: "failed", responseCode: "504-TIMEOUT", retryCount: 3 },
];

const statusConfig: Record<string, { icon: React.ComponentType<any>; color: string }> = {
  posted: { icon: CheckCircle2, color: "text-emerald-400 bg-emerald-500/10" },
  queued: { icon: Clock, color: "text-blue-400 bg-blue-500/10" },
  processing: { icon: Clock, color: "text-yellow-400 bg-yellow-500/10" },
  failed: { icon: AlertTriangle, color: "text-red-400 bg-red-500/10" },
  reconciled: { icon: CheckCircle2, color: "text-purple-400 bg-purple-500/10" },
};

export function CoreBankingPosting() {
  const posted = postingBatches.filter(b => b.status === "posted").length;
  const total = postingBatches.length;
  const totalPostedAmount = postingBatches.filter(b => b.status === "posted").reduce((s, b) => s + b.totalAmount, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{posted}/{total}</div>
          <div className="text-xs text-muted-foreground">Batches Posted Today</div>
          <Progress value={posted / total * 100} className="mt-2 h-1.5" />
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-xl font-bold text-foreground">KES {(totalPostedAmount / 1000000).toFixed(1)}M</div>
          <div className="text-xs text-muted-foreground">Total Posted Value</div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{postingBatches.filter(b => b.status === "queued" || b.status === "processing").length}</div>
          <div className="text-xs text-muted-foreground">Pending/Processing</div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{postingBatches.filter(b => b.status === "failed").length}</div>
          <div className="text-xs text-muted-foreground">Failed (Retry Required)</div>
        </CardContent></Card>
      </div>

      {/* Posting Flow */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Posting Modes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-muted/20">
              <div className="font-semibold text-foreground mb-1">🔴 Real-Time</div>
              <p className="text-xs text-muted-foreground">Critical transactions (deposits, disbursements, P2P) post immediately via API. Latency target: &lt;200ms. Fallback: queue for batch if API unavailable.</p>
            </div>
            <div className="p-4 rounded-lg border border-muted/20">
              <div className="font-semibold text-foreground mb-1">🟡 Batch</div>
              <p className="text-xs text-muted-foreground">Non-critical entries (bill payments, SAYS sweeps, agent transactions) aggregated and posted every 30 minutes. Reduces API calls and core banking load.</p>
            </div>
            <div className="p-4 rounded-lg border border-muted/20">
              <div className="font-semibold text-foreground mb-1">🔵 End-of-Day (EOD)</div>
              <p className="text-xs text-muted-foreground">Settlement entries, interest accruals, tax provisions, and reconciliation adjustments run at 18:00 EAT. Requires manual approval for entries &gt; KES 10M.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batch Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-primary" />Core Banking Posting Queue</CardTitle>
          <CardDescription>Wallet JEs aggregated into batches and posted to core banking systems (KCB T24, Equity FCC)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">JEs</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Core System</TableHead>
                <TableHead>Response</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {postingBatches.map(batch => {
                const StatusIcon = statusConfig[batch.status].icon;
                return (
                  <TableRow key={batch.id}>
                    <TableCell className="font-mono text-xs text-primary">{batch.id}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{batch.batchType}</Badge></TableCell>
                    <TableCell className="text-sm">{batch.description}</TableCell>
                    <TableCell className="text-right font-mono">{batch.jeCount}</TableCell>
                    <TableCell className="text-right font-mono">KES {batch.totalAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{batch.coreSystem}</TableCell>
                    <TableCell className="font-mono text-xs">{batch.responseCode || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusConfig[batch.status].color}>
                        <StatusIcon className="h-3 w-3 mr-1" />{batch.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {batch.status === "failed" && (
                        <Button variant="ghost" size="sm"><RotateCcw className="h-4 w-4" /></Button>
                      )}
                      {batch.status === "queued" && (
                        <Button variant="ghost" size="sm"><Play className="h-4 w-4" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
