import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, FileText, ChevronRight, FolderTree } from "lucide-react";

interface GLAccount {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  subType: string;
  currency: string;
  status: "active" | "inactive" | "suspended";
  parentCode: string | null;
  description: string;
  normalBalance: "debit" | "credit";
}

const glAccounts: GLAccount[] = [
  // Assets
  { code: "1000", name: "Cash & Bank Balances", type: "asset", subType: "Current Asset", currency: "KES", status: "active", parentCode: null, description: "Top-level cash and bank balances", normalBalance: "debit" },
  { code: "1010", name: "Customer Wallet Pool - Main", type: "asset", subType: "Current Asset", currency: "KES", status: "active", parentCode: "1000", description: "Pooled funds for all main customer wallets held at settlement bank", normalBalance: "debit" },
  { code: "1011", name: "Customer Wallet Pool - Education", type: "asset", subType: "Current Asset", currency: "KES", status: "active", parentCode: "1000", description: "Pooled funds for education sub-wallets", normalBalance: "debit" },
  { code: "1012", name: "Customer Wallet Pool - Medical", type: "asset", subType: "Current Asset", currency: "KES", status: "active", parentCode: "1000", description: "Pooled funds for medical sub-wallets", normalBalance: "debit" },
  { code: "1013", name: "Customer Wallet Pool - Holiday", type: "asset", subType: "Current Asset", currency: "KES", status: "active", parentCode: "1000", description: "Pooled funds for holiday sub-wallets", normalBalance: "debit" },
  { code: "1014", name: "Customer Wallet Pool - Retirement", type: "asset", subType: "Current Asset", currency: "KES", status: "active", parentCode: "1000", description: "Pooled funds for retirement sub-wallets", normalBalance: "debit" },
  { code: "1015", name: "Customer Wallet Pool - Pension", type: "asset", subType: "Current Asset", currency: "KES", status: "active", parentCode: "1000", description: "Pooled pension (CPF) contributions", normalBalance: "debit" },
  { code: "1020", name: "Agent Float Pool", type: "asset", subType: "Current Asset", currency: "KES", status: "active", parentCode: "1000", description: "Aggregate agent float balances", normalBalance: "debit" },
  { code: "1030", name: "Settlement Bank Account - KCB", type: "asset", subType: "Current Asset", currency: "KES", status: "active", parentCode: "1000", description: "Primary settlement account at KCB", normalBalance: "debit" },
  { code: "1031", name: "Settlement Bank Account - Equity", type: "asset", subType: "Current Asset", currency: "KES", status: "active", parentCode: "1000", description: "Secondary settlement account at Equity", normalBalance: "debit" },
  { code: "1040", name: "M-Pesa Trust Account", type: "asset", subType: "Current Asset", currency: "KES", status: "active", parentCode: "1000", description: "Safaricom M-Pesa paybill settlement", normalBalance: "debit" },
  { code: "1050", name: "Card Processor Settlement", type: "asset", subType: "Current Asset", currency: "KES", status: "active", parentCode: "1000", description: "VISA/Mastercard processor receivable", normalBalance: "debit" },
  { code: "1060", name: "Diaspora Remittance Inflow", type: "asset", subType: "Current Asset", currency: "KES", status: "active", parentCode: "1000", description: "Inbound diaspora transfers pending credit", normalBalance: "debit" },
  { code: "1100", name: "Loans Receivable", type: "asset", subType: "Current Asset", currency: "KES", status: "active", parentCode: null, description: "Outstanding loan principal", normalBalance: "debit" },
  { code: "1110", name: "Loans Receivable - Instant", type: "asset", subType: "Current Asset", currency: "KES", status: "active", parentCode: "1100", description: "Short-term instant loans outstanding", normalBalance: "debit" },
  { code: "1120", name: "Loans Receivable - Personal", type: "asset", subType: "Current Asset", currency: "KES", status: "active", parentCode: "1100", description: "Personal loans outstanding", normalBalance: "debit" },
  { code: "1130", name: "Loans Receivable - Business", type: "asset", subType: "Current Asset", currency: "KES", status: "active", parentCode: "1100", description: "Business/SME loans outstanding", normalBalance: "debit" },
  { code: "1140", name: "Loans Receivable - Asset Finance", type: "asset", subType: "Current Asset", currency: "KES", status: "active", parentCode: "1100", description: "Asset finance loans outstanding", normalBalance: "debit" },
  { code: "1200", name: "Interest Receivable", type: "asset", subType: "Current Asset", currency: "KES", status: "active", parentCode: null, description: "Accrued interest on loans", normalBalance: "debit" },
  { code: "1300", name: "Provision for Bad Debts", type: "asset", subType: "Contra Asset", currency: "KES", status: "active", parentCode: null, description: "Allowance for expected credit losses", normalBalance: "credit" },
  // Liabilities
  { code: "2000", name: "Customer Wallet Liabilities", type: "liability", subType: "Current Liability", currency: "KES", status: "active", parentCode: null, description: "Total obligation to wallet holders", normalBalance: "credit" },
  { code: "2010", name: "Customer Balances - Main Wallets", type: "liability", subType: "Current Liability", currency: "KES", status: "active", parentCode: "2000", description: "Liability for main wallet balances", normalBalance: "credit" },
  { code: "2011", name: "Customer Balances - Education", type: "liability", subType: "Current Liability", currency: "KES", status: "active", parentCode: "2000", description: "Liability for education wallet balances", normalBalance: "credit" },
  { code: "2012", name: "Customer Balances - Medical", type: "liability", subType: "Current Liability", currency: "KES", status: "active", parentCode: "2000", description: "Liability for medical wallet balances", normalBalance: "credit" },
  { code: "2013", name: "Customer Balances - Holiday", type: "liability", subType: "Current Liability", currency: "KES", status: "active", parentCode: "2000", description: "Liability for holiday wallet balances", normalBalance: "credit" },
  { code: "2014", name: "Customer Balances - Retirement", type: "liability", subType: "Current Liability", currency: "KES", status: "active", parentCode: "2000", description: "Liability for retirement wallet balances", normalBalance: "credit" },
  { code: "2015", name: "Customer Balances - Pension (CPF)", type: "liability", subType: "Current Liability", currency: "KES", status: "active", parentCode: "2000", description: "Liability for CPF pension contributions", normalBalance: "credit" },
  { code: "2020", name: "Agent Float Liabilities", type: "liability", subType: "Current Liability", currency: "KES", status: "active", parentCode: null, description: "Liability to agents for float", normalBalance: "credit" },
  { code: "2030", name: "Pending Settlement - M-Pesa", type: "liability", subType: "Current Liability", currency: "KES", status: "active", parentCode: null, description: "M-Pesa transactions pending settlement", normalBalance: "credit" },
  { code: "2040", name: "Pending Settlement - Card Payments", type: "liability", subType: "Current Liability", currency: "KES", status: "active", parentCode: null, description: "Card transactions pending settlement", normalBalance: "credit" },
  { code: "2050", name: "Taxes Payable - Excise Duty", type: "liability", subType: "Current Liability", currency: "KES", status: "active", parentCode: null, description: "Excise duty on transaction fees (20%)", normalBalance: "credit" },
  { code: "2060", name: "Taxes Payable - VAT", type: "liability", subType: "Current Liability", currency: "KES", status: "active", parentCode: null, description: "VAT on services (16%)", normalBalance: "credit" },
  { code: "2070", name: "Loan Disbursement Payable", type: "liability", subType: "Current Liability", currency: "KES", status: "active", parentCode: null, description: "Approved loans pending disbursement", normalBalance: "credit" },
  // Revenue
  { code: "4000", name: "Transaction Fee Income", type: "revenue", subType: "Operating Revenue", currency: "KES", status: "active", parentCode: null, description: "Fees earned from wallet transactions", normalBalance: "credit" },
  { code: "4010", name: "P2P Transfer Fees", type: "revenue", subType: "Operating Revenue", currency: "KES", status: "active", parentCode: "4000", description: "Fees on person-to-person transfers", normalBalance: "credit" },
  { code: "4020", name: "Bill Payment Fees", type: "revenue", subType: "Operating Revenue", currency: "KES", status: "active", parentCode: "4000", description: "Fees on bill payments (KPLC, Water, etc.)", normalBalance: "credit" },
  { code: "4030", name: "School Fees Payment Fees", type: "revenue", subType: "Operating Revenue", currency: "KES", status: "active", parentCode: "4000", description: "Fees on school fees payments", normalBalance: "credit" },
  { code: "4040", name: "M-Pesa Interchange Income", type: "revenue", subType: "Operating Revenue", currency: "KES", status: "active", parentCode: "4000", description: "Margin on M-Pesa float operations", normalBalance: "credit" },
  { code: "4050", name: "Card Transaction Fees", type: "revenue", subType: "Operating Revenue", currency: "KES", status: "active", parentCode: "4000", description: "Virtual/debit card transaction fees", normalBalance: "credit" },
  { code: "4060", name: "Agent Transaction Fees", type: "revenue", subType: "Operating Revenue", currency: "KES", status: "active", parentCode: "4000", description: "Fees from agent cash-in/cash-out", normalBalance: "credit" },
  { code: "4100", name: "Loan Interest Income", type: "revenue", subType: "Operating Revenue", currency: "KES", status: "active", parentCode: null, description: "Interest earned on loan products", normalBalance: "credit" },
  { code: "4110", name: "Loan Origination Fees", type: "revenue", subType: "Operating Revenue", currency: "KES", status: "active", parentCode: null, description: "One-time fees on loan disbursement", normalBalance: "credit" },
  { code: "4120", name: "Late Payment Penalties", type: "revenue", subType: "Operating Revenue", currency: "KES", status: "active", parentCode: null, description: "Penalties on overdue loan payments", normalBalance: "credit" },
  { code: "4200", name: "Diaspora Service Fees", type: "revenue", subType: "Operating Revenue", currency: "KES", status: "active", parentCode: null, description: "Fees on diaspora remittance services", normalBalance: "credit" },
  { code: "4210", name: "FX Conversion Margin", type: "revenue", subType: "Operating Revenue", currency: "KES", status: "active", parentCode: null, description: "Spread on foreign exchange conversions", normalBalance: "credit" },
  { code: "4300", name: "CPF Management Fee", type: "revenue", subType: "Operating Revenue", currency: "KES", status: "active", parentCode: null, description: "Management fee on pension contributions", normalBalance: "credit" },
  // Expenses
  { code: "5000", name: "M-Pesa API Costs", type: "expense", subType: "Direct Cost", currency: "KES", status: "active", parentCode: null, description: "Safaricom API transaction charges", normalBalance: "debit" },
  { code: "5010", name: "Card Processor Fees", type: "expense", subType: "Direct Cost", currency: "KES", status: "active", parentCode: null, description: "VISA/MC processing costs", normalBalance: "debit" },
  { code: "5020", name: "Agent Commission Payable", type: "expense", subType: "Direct Cost", currency: "KES", status: "active", parentCode: null, description: "Commission paid to agents", normalBalance: "debit" },
  { code: "5030", name: "Bank Transfer Fees", type: "expense", subType: "Direct Cost", currency: "KES", status: "active", parentCode: null, description: "Interbank transfer (RTGS/EFT) costs", normalBalance: "debit" },
  { code: "5040", name: "Bad Debt Expense", type: "expense", subType: "Direct Cost", currency: "KES", status: "active", parentCode: null, description: "Loan write-offs and provisions", normalBalance: "debit" },
  { code: "5050", name: "Diaspora Corridor Costs", type: "expense", subType: "Direct Cost", currency: "KES", status: "active", parentCode: null, description: "Partner costs for remittance corridors", normalBalance: "debit" },
  // Equity
  { code: "3000", name: "Share Capital", type: "equity", subType: "Equity", currency: "KES", status: "active", parentCode: null, description: "Issued share capital", normalBalance: "credit" },
  { code: "3100", name: "Retained Earnings", type: "equity", subType: "Equity", currency: "KES", status: "active", parentCode: null, description: "Accumulated profits", normalBalance: "credit" },
];

const typeColors: Record<string, string> = {
  asset: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  liability: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  equity: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  revenue: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  expense: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function ChartOfAccounts() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = glAccounts.filter(a => {
    const matchSearch = a.code.includes(search) || a.name.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || a.type === filterType;
    return matchSearch && matchType;
  });

  const summary = {
    asset: glAccounts.filter(a => a.type === "asset").length,
    liability: glAccounts.filter(a => a.type === "liability").length,
    revenue: glAccounts.filter(a => a.type === "revenue").length,
    expense: glAccounts.filter(a => a.type === "expense").length,
    equity: glAccounts.filter(a => a.type === "equity").length,
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-5 gap-3">
        {Object.entries(summary).map(([type, count]) => (
          <Card key={type} className="glass-card">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{count}</div>
              <div className="text-xs text-muted-foreground capitalize">{type} Accounts</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by GL code or name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filter type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="asset">Assets</SelectItem>
            <SelectItem value="liability">Liabilities</SelectItem>
            <SelectItem value="equity">Equity</SelectItem>
            <SelectItem value="revenue">Revenue</SelectItem>
            <SelectItem value="expense">Expenses</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="button-3d"><Plus className="h-4 w-4 mr-2" />New GL Account</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create GL Account</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>GL Code</Label><Input placeholder="e.g. 1016" /></div>
                <div><Label>Account Name</Label><Input placeholder="Account name" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Account Type</Label>
                  <Select><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset">Asset</SelectItem>
                      <SelectItem value="liability">Liability</SelectItem>
                      <SelectItem value="equity">Equity</SelectItem>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Normal Balance</Label>
                  <Select><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Debit</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Parent Account (optional)</Label><Input placeholder="Parent GL code" /></div>
              <div><Label>Description</Label><Input placeholder="Account description" /></div>
              <Button className="w-full button-3d" onClick={() => setShowCreate(false)}>Create GL Account</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* COA Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FolderTree className="h-5 w-5 text-primary" />Chart of Accounts — Lipafo Wallet Banking</CardTitle>
          <CardDescription>Complete GL structure for wallet operations, lending, and settlement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">GL Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Sub-Type</TableHead>
                  <TableHead>Normal Bal</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(a => (
                  <TableRow key={a.code} className={a.parentCode ? "opacity-90" : "font-semibold"}>
                    <TableCell className="font-mono text-primary">
                      {a.parentCode && <ChevronRight className="inline h-3 w-3 mr-1 text-muted-foreground" />}
                      {a.code}
                    </TableCell>
                    <TableCell>{a.name}</TableCell>
                    <TableCell><Badge variant="outline" className={typeColors[a.type]}>{a.type}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.subType}</TableCell>
                    <TableCell><Badge variant="outline" className={a.normalBalance === "debit" ? "border-blue-500/30 text-blue-400" : "border-orange-500/30 text-orange-400"}>{a.normalBalance}</Badge></TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{a.parentCode || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="border-emerald-500/30 text-emerald-400">{a.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
