import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Layers, ArrowUpRight, ArrowDownRight, AlertTriangle } from "lucide-react";

interface PoolAccount {
  glCode: string;
  name: string;
  poolType: "customer" | "agent" | "settlement" | "tax";
  totalBalance: number;
  aggregateCustomerBalance: number;
  variance: number;
  lastReconciled: string;
  status: "balanced" | "variance" | "alert";
  bankPartner: string;
  accountNumber: string;
  description: string;
}

const poolAccounts: PoolAccount[] = [
  { glCode: "1010", name: "Customer Wallet Pool - Main", poolType: "customer", totalBalance: 45670000, aggregateCustomerBalance: 45670000, variance: 0, lastReconciled: "2026-03-24 06:00", status: "balanced", bankPartner: "KCB", accountNumber: "****4521", description: "Settlement bank account holding all main wallet funds. Must equal SUM of all customer main wallet liabilities (GL 2010)." },
  { glCode: "1011", name: "Customer Wallet Pool - Education", poolType: "customer", totalBalance: 8920000, aggregateCustomerBalance: 8920000, variance: 0, lastReconciled: "2026-03-24 06:00", status: "balanced", bankPartner: "KCB", accountNumber: "****4522", description: "Ring-fenced education funds. Regulatory requirement: must be segregated from operating funds." },
  { glCode: "1012", name: "Customer Wallet Pool - Medical", poolType: "customer", totalBalance: 3450000, aggregateCustomerBalance: 3450000, variance: 0, lastReconciled: "2026-03-24 06:00", status: "balanced", bankPartner: "KCB", accountNumber: "****4523", description: "Ring-fenced medical savings pool." },
  { glCode: "1013", name: "Customer Wallet Pool - Holiday", poolType: "customer", totalBalance: 1280000, aggregateCustomerBalance: 1280000, variance: 0, lastReconciled: "2026-03-24 06:00", status: "balanced", bankPartner: "KCB", accountNumber: "****4524", description: "Holiday savings pool." },
  { glCode: "1014", name: "Customer Wallet Pool - Retirement", poolType: "customer", totalBalance: 12500000, aggregateCustomerBalance: 12500000, variance: 0, lastReconciled: "2026-03-24 06:00", status: "balanced", bankPartner: "Equity", accountNumber: "****7801", description: "Long-term retirement savings. Subject to RBA Kenya guidelines." },
  { glCode: "1015", name: "Customer Wallet Pool - Pension (CPF)", poolType: "customer", totalBalance: 6780000, aggregateCustomerBalance: 6779850, variance: 150, lastReconciled: "2026-03-24 06:00", status: "variance", bankPartner: "Equity", accountNumber: "****7802", description: "Pension fund from CPF contributions. Variance of KES 150 under investigation (likely timing difference on late CPF posting)." },
  { glCode: "1020", name: "Agent Float Pool", poolType: "agent", totalBalance: 23400000, aggregateCustomerBalance: 23400000, variance: 0, lastReconciled: "2026-03-24 06:00", status: "balanced", bankPartner: "KCB", accountNumber: "****4530", description: "Aggregate of all agent float balances. Must reconcile to SUM(bank_agents.float_balance)." },
  { glCode: "1040", name: "M-Pesa Trust Account", poolType: "settlement", totalBalance: 1250000, aggregateCustomerBalance: 0, variance: 0, lastReconciled: "2026-03-24 06:00", status: "balanced", bankPartner: "Safaricom", accountNumber: "PAYBILL-XXX", description: "M-Pesa paybill settlement account. Clears to KCB daily at 18:00 EAT." },
  { glCode: "1050", name: "Card Processor Settlement", poolType: "settlement", totalBalance: 890000, aggregateCustomerBalance: 0, variance: 0, lastReconciled: "2026-03-23 18:00", status: "balanced", bankPartner: "JamboPay/VISA", accountNumber: "PROC-XXX", description: "VISA/MC processor receivable. Settles T+1 to settlement bank." },
  { glCode: "2050", name: "Excise Duty Reserve", poolType: "tax", totalBalance: 842000, aggregateCustomerBalance: 0, variance: 0, lastReconciled: "2026-03-24 06:00", status: "balanced", bankPartner: "KRA", accountNumber: "N/A", description: "20% excise duty on financial transaction fees per Finance Act. Remitted monthly to KRA." },
];

const poolTypeColors: Record<string, string> = {
  customer: "bg-blue-500/10 text-blue-400",
  agent: "bg-purple-500/10 text-purple-400",
  settlement: "bg-emerald-500/10 text-emerald-400",
  tax: "bg-orange-500/10 text-orange-400",
};

export function PoolGLManagement() {
  const totalPooled = poolAccounts.reduce((s, p) => s + p.totalBalance, 0);
  const customerPools = poolAccounts.filter(p => p.poolType === "customer");
  const totalCustomerFunds = customerPools.reduce((s, p) => s + p.totalBalance, 0);
  const totalVariance = poolAccounts.reduce((s, p) => s + Math.abs(p.variance), 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-xl font-bold text-foreground">KES {(totalPooled / 1000000).toFixed(1)}M</div>
          <div className="text-xs text-muted-foreground">Total Pooled Funds</div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-xl font-bold text-blue-400">KES {(totalCustomerFunds / 1000000).toFixed(1)}M</div>
          <div className="text-xs text-muted-foreground">Customer Funds (Ring-fenced)</div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-xl font-bold text-foreground">{poolAccounts.length}</div>
          <div className="text-xs text-muted-foreground">Pool Accounts</div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className={`text-xl font-bold ${totalVariance > 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>KES {totalVariance.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Total Variance</div>
        </CardContent></Card>
      </div>

      {/* Pool GL Cards */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5 text-primary" />Pool GL Accounts & Core Banking Mapping</CardTitle>
          <CardDescription>Each pool GL maps to a physical bank account. Customer funds are ring-fenced per CBK e-money regulations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {poolAccounts.map(pool => (
            <div key={pool.glCode} className={`p-4 rounded-lg border ${pool.status === "variance" ? "border-yellow-500/30 bg-yellow-500/5" : "border-muted/20 bg-muted/5"}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-primary font-bold">{pool.glCode}</span>
                    <span className="font-semibold text-foreground">{pool.name}</span>
                    <Badge variant="outline" className={poolTypeColors[pool.poolType]}>{pool.poolType}</Badge>
                    {pool.status === "variance" && <AlertTriangle className="h-4 w-4 text-yellow-400" />}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{pool.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Bank: <strong className="text-foreground">{pool.bankPartner}</strong></span>
                    <span>Account: <strong className="font-mono text-foreground">{pool.accountNumber}</strong></span>
                    <span>Last Reconciled: {pool.lastReconciled}</span>
                  </div>
                </div>
                <div className="text-right min-w-[180px]">
                  <div className="text-lg font-bold font-mono text-foreground">KES {pool.totalBalance.toLocaleString()}</div>
                  {pool.poolType === "customer" && (
                    <>
                      <div className="text-xs text-muted-foreground">Customer Aggregate: KES {pool.aggregateCustomerBalance.toLocaleString()}</div>
                      {pool.variance !== 0 && (
                        <div className="text-xs text-yellow-400 flex items-center justify-end gap-1 mt-1">
                          {pool.variance > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          Variance: KES {Math.abs(pool.variance).toLocaleString()}
                        </div>
                      )}
                      <Progress value={pool.aggregateCustomerBalance / pool.totalBalance * 100} className="mt-2 h-1.5" />
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pool GL Flow */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Pool GL → Core Banking Posting Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            {[
              { step: "1", title: "Transaction Capture", desc: "Every wallet transaction (deposit, transfer, payment, withdrawal) generates an event with amount, type, source, and wallet." },
              { step: "2", title: "GL Determination", desc: "Transaction engine maps the event to the correct debit/credit GL codes using the GL Mapping Matrix. Fee GLs are determined from the Fee Schedule." },
              { step: "3", title: "Journal Entry Creation", desc: "A balanced double-entry JE is created with all debit/credit lines. System validates total debits = total credits before posting." },
              { step: "4", title: "Pool GL Update", desc: "Pool GL balances are updated atomically. For customer wallets, both the asset pool (1010-1015) and liability (2010-2015) are updated." },
              { step: "5", title: "Core Banking Sync", desc: "At configurable intervals (real-time/batch), aggregated JEs are posted to the core banking system via API. Each pool GL maps to a physical bank ledger." },
              { step: "6", title: "Settlement Execution", desc: "For external payments (M-Pesa, bank, card), settlement files are generated and submitted. Settlement bank receives/sends funds." },
              { step: "7", title: "Reconciliation", desc: "Automated reconciliation compares pool GL balances vs. aggregate customer balances vs. core banking balances. Variances trigger alerts." },
            ].map(s => (
              <div key={s.step} className="flex gap-3 items-start">
                <div className="h-7 w-7 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">{s.step}</div>
                <div>
                  <div className="font-medium text-foreground">{s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
