import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Percent, DollarSign, Settings2 } from "lucide-react";

interface FeeSchedule {
  id: string;
  transactionType: string;
  feeName: string;
  feeModel: "flat" | "percentage" | "tiered" | "hybrid";
  amount: number | null;
  percentage: number | null;
  minFee: number;
  maxFee: number;
  tiers: { from: number; to: number; fee: number }[];
  revenueGL: string;
  revenueGLName: string;
  exciseDutyApplicable: boolean;
  vatApplicable: boolean;
  cpfEligible: boolean;
  cpfRate: number;
  status: "active" | "draft" | "suspended";
  effectiveDate: string;
}

const feeSchedules: FeeSchedule[] = [
  {
    id: "FEE-001", transactionType: "P2P Transfer", feeName: "Person-to-Person Transfer Fee", feeModel: "tiered", amount: null, percentage: null, minFee: 0, maxFee: 300,
    tiers: [
      { from: 0, to: 100, fee: 0 },
      { from: 101, to: 500, fee: 7 },
      { from: 501, to: 1000, fee: 15 },
      { from: 1001, to: 5000, fee: 25 },
      { from: 5001, to: 10000, fee: 40 },
      { from: 10001, to: 35000, fee: 60 },
      { from: 35001, to: 70000, fee: 100 },
      { from: 70001, to: 150000, fee: 200 },
    ],
    revenueGL: "4010", revenueGLName: "P2P Transfer Fees", exciseDutyApplicable: true, vatApplicable: false, cpfEligible: true, cpfRate: 0.5, status: "active", effectiveDate: "2026-01-01"
  },
  {
    id: "FEE-002", transactionType: "Bill Payment", feeName: "Utility Bill Payment Fee", feeModel: "flat", amount: 30, percentage: null, minFee: 30, maxFee: 30,
    tiers: [], revenueGL: "4020", revenueGLName: "Bill Payment Fees", exciseDutyApplicable: true, vatApplicable: false, cpfEligible: true, cpfRate: 0.3, status: "active", effectiveDate: "2026-01-01"
  },
  {
    id: "FEE-003", transactionType: "School Fees Payment", feeName: "School Fees Processing Fee", feeModel: "percentage", amount: null, percentage: 0.5, minFee: 20, maxFee: 500,
    tiers: [], revenueGL: "4030", revenueGLName: "School Fees Payment Fees", exciseDutyApplicable: true, vatApplicable: false, cpfEligible: true, cpfRate: 0.2, status: "active", effectiveDate: "2026-01-01"
  },
  {
    id: "FEE-004", transactionType: "M-Pesa Deposit", feeName: "M-Pesa Top-Up Fee", feeModel: "flat", amount: 0, percentage: null, minFee: 0, maxFee: 0,
    tiers: [], revenueGL: "4040", revenueGLName: "M-Pesa Interchange", exciseDutyApplicable: false, vatApplicable: false, cpfEligible: false, cpfRate: 0, status: "active", effectiveDate: "2026-01-01"
  },
  {
    id: "FEE-005", transactionType: "M-Pesa Withdrawal", feeName: "M-Pesa Cash-Out Fee", feeModel: "tiered", amount: null, percentage: null, minFee: 10, maxFee: 300,
    tiers: [
      { from: 0, to: 500, fee: 10 },
      { from: 501, to: 2500, fee: 25 },
      { from: 2501, to: 10000, fee: 40 },
      { from: 10001, to: 35000, fee: 60 },
      { from: 35001, to: 70000, fee: 100 },
      { from: 70001, to: 150000, fee: 200 },
    ],
    revenueGL: "4040", revenueGLName: "M-Pesa Interchange", exciseDutyApplicable: true, vatApplicable: false, cpfEligible: true, cpfRate: 0.5, status: "active", effectiveDate: "2026-01-01"
  },
  {
    id: "FEE-006", transactionType: "Agent Cash-In", feeName: "Agent Deposit Fee", feeModel: "flat", amount: 0, percentage: null, minFee: 0, maxFee: 0,
    tiers: [], revenueGL: "4060", revenueGLName: "Agent Transaction Fees", exciseDutyApplicable: false, vatApplicable: false, cpfEligible: false, cpfRate: 0, status: "active", effectiveDate: "2026-01-01"
  },
  {
    id: "FEE-007", transactionType: "Agent Cash-Out", feeName: "Agent Withdrawal Fee", feeModel: "tiered", amount: null, percentage: null, minFee: 10, maxFee: 200,
    tiers: [
      { from: 0, to: 1000, fee: 10 },
      { from: 1001, to: 5000, fee: 30 },
      { from: 5001, to: 20000, fee: 50 },
      { from: 20001, to: 50000, fee: 100 },
    ],
    revenueGL: "4060", revenueGLName: "Agent Transaction Fees", exciseDutyApplicable: true, vatApplicable: false, cpfEligible: true, cpfRate: 0.3, status: "active", effectiveDate: "2026-01-01"
  },
  {
    id: "FEE-008", transactionType: "Virtual Card Transaction", feeName: "Card Payment Fee", feeModel: "percentage", amount: null, percentage: 1.5, minFee: 10, maxFee: 1000,
    tiers: [], revenueGL: "4050", revenueGLName: "Card Transaction Fees", exciseDutyApplicable: true, vatApplicable: false, cpfEligible: true, cpfRate: 0.3, status: "active", effectiveDate: "2026-01-01"
  },
  {
    id: "FEE-009", transactionType: "Loan Origination", feeName: "Loan Processing Fee", feeModel: "percentage", amount: null, percentage: 2.5, minFee: 100, maxFee: 5000,
    tiers: [], revenueGL: "4110", revenueGLName: "Loan Origination Fees", exciseDutyApplicable: true, vatApplicable: true, cpfEligible: false, cpfRate: 0, status: "active", effectiveDate: "2026-01-01"
  },
  {
    id: "FEE-010", transactionType: "Late Loan Payment", feeName: "Late Payment Penalty", feeModel: "percentage", amount: null, percentage: 3, minFee: 50, maxFee: 2000,
    tiers: [], revenueGL: "4120", revenueGLName: "Late Payment Penalties", exciseDutyApplicable: true, vatApplicable: false, cpfEligible: false, cpfRate: 0, status: "active", effectiveDate: "2026-01-01"
  },
  {
    id: "FEE-011", transactionType: "Diaspora Remittance", feeName: "Diaspora Transfer Fee", feeModel: "hybrid", amount: 50, percentage: 0.5, minFee: 50, maxFee: 2000,
    tiers: [], revenueGL: "4200", revenueGLName: "Diaspora Service Fees", exciseDutyApplicable: true, vatApplicable: false, cpfEligible: true, cpfRate: 0.2, status: "active", effectiveDate: "2026-01-01"
  },
  {
    id: "FEE-012", transactionType: "FX Conversion", feeName: "Foreign Exchange Spread", feeModel: "percentage", amount: null, percentage: 1.0, minFee: 0, maxFee: 0,
    tiers: [], revenueGL: "4210", revenueGLName: "FX Conversion Margin", exciseDutyApplicable: false, vatApplicable: false, cpfEligible: false, cpfRate: 0, status: "active", effectiveDate: "2026-01-01"
  },
  {
    id: "FEE-013", transactionType: "CPF Management", feeName: "Pension Management Fee", feeModel: "percentage", amount: null, percentage: 0.25, minFee: 0, maxFee: 500,
    tiers: [], revenueGL: "4300", revenueGLName: "CPF Management Fee", exciseDutyApplicable: true, vatApplicable: true, cpfEligible: false, cpfRate: 0, status: "active", effectiveDate: "2026-01-01"
  },
  {
    id: "FEE-014", transactionType: "Bank Transfer (EFT)", feeName: "Bank Transfer Fee", feeModel: "flat", amount: 50, percentage: null, minFee: 50, maxFee: 50,
    tiers: [], revenueGL: "4010", revenueGLName: "Transfer Fees", exciseDutyApplicable: true, vatApplicable: false, cpfEligible: true, cpfRate: 0.3, status: "active", effectiveDate: "2026-01-01"
  },
];

const feeModelColors: Record<string, string> = {
  flat: "bg-blue-500/10 text-blue-400",
  percentage: "bg-purple-500/10 text-purple-400",
  tiered: "bg-emerald-500/10 text-emerald-400",
  hybrid: "bg-orange-500/10 text-orange-400",
};

export function FeeDefinition() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedFee, setSelectedFee] = useState<FeeSchedule | null>(null);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{feeSchedules.length}</div>
          <div className="text-xs text-muted-foreground">Fee Schedules</div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{feeSchedules.filter(f => f.cpfEligible).length}</div>
          <div className="text-xs text-muted-foreground">CPF-Eligible Fees</div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-orange-400">{feeSchedules.filter(f => f.exciseDutyApplicable).length}</div>
          <div className="text-xs text-muted-foreground">Excise Duty Applicable</div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{feeSchedules.filter(f => f.feeModel === "tiered").length}</div>
          <div className="text-xs text-muted-foreground">Tiered Fee Models</div>
        </CardContent></Card>
      </div>

      <div className="flex justify-end">
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="button-3d"><Plus className="h-4 w-4 mr-2" />New Fee Schedule</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Fee Schedule</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Transaction Type</Label><Input placeholder="e.g. QR Payment" /></div>
              <div><Label>Fee Name</Label><Input placeholder="Descriptive name" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Fee Model</Label>
                  <Select><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="tiered">Tiered</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Revenue GL</Label><Input placeholder="e.g. 4010" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Amount / %</Label><Input type="number" placeholder="0" /></div>
                <div><Label>CPF Rate (%)</Label><Input type="number" placeholder="0" /></div>
              </div>
              <Button className="w-full button-3d" onClick={() => setShowCreate(false)}>Create Fee Schedule</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Fee Schedule Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" />Fee Schedule Matrix</CardTitle>
          <CardDescription>Complete fee definitions with GL mapping, tax applicability, and CPF (Cost Per Float) pension contribution rates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction Type</TableHead>
                  <TableHead>Fee Model</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead className="text-right">Min/Max</TableHead>
                  <TableHead>Revenue GL</TableHead>
                  <TableHead className="text-center">Excise</TableHead>
                  <TableHead className="text-center">VAT</TableHead>
                  <TableHead className="text-center">CPF</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feeSchedules.map(fee => (
                  <TableRow key={fee.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedFee(fee)}>
                    <TableCell>
                      <div className="font-medium text-foreground">{fee.transactionType}</div>
                      <div className="text-xs text-muted-foreground">{fee.feeName}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className={feeModelColors[fee.feeModel]}>{fee.feeModel}</Badge></TableCell>
                    <TableCell className="text-right font-mono">
                      {fee.feeModel === "flat" && `KES ${fee.amount}`}
                      {fee.feeModel === "percentage" && `${fee.percentage}%`}
                      {fee.feeModel === "tiered" && `${fee.tiers.length} tiers`}
                      {fee.feeModel === "hybrid" && `KES ${fee.amount} + ${fee.percentage}%`}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{fee.minFee}/{fee.maxFee}</TableCell>
                    <TableCell className="font-mono text-xs text-primary">{fee.revenueGL}</TableCell>
                    <TableCell className="text-center">{fee.exciseDutyApplicable ? "✓" : "—"}</TableCell>
                    <TableCell className="text-center">{fee.vatApplicable ? "✓" : "—"}</TableCell>
                    <TableCell className="text-center">
                      {fee.cpfEligible ? <span className="text-emerald-400">{fee.cpfRate}%</span> : "—"}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="border-emerald-500/30 text-emerald-400">{fee.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Tiered Fee Detail Dialog */}
      <Dialog open={!!selectedFee} onOpenChange={() => setSelectedFee(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selectedFee?.feeName}</DialogTitle></DialogHeader>
          {selectedFee && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Type:</span> {selectedFee.transactionType}</div>
                <div><span className="text-muted-foreground">Model:</span> <Badge variant="outline" className={feeModelColors[selectedFee.feeModel]}>{selectedFee.feeModel}</Badge></div>
                <div><span className="text-muted-foreground">Revenue GL:</span> <span className="font-mono text-primary">{selectedFee.revenueGL}</span> {selectedFee.revenueGLName}</div>
                <div><span className="text-muted-foreground">Effective:</span> {selectedFee.effectiveDate}</div>
              </div>

              {selectedFee.tiers.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Tier Structure</Label>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>From (KES)</TableHead><TableHead>To (KES)</TableHead><TableHead className="text-right">Fee (KES)</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {selectedFee.tiers.map((t, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono">{t.from.toLocaleString()}</TableCell>
                          <TableCell className="font-mono">{t.to.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono font-bold">{t.fee}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/10">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Excise Duty (20%)</div>
                  <div className={`font-bold ${selectedFee.exciseDutyApplicable ? 'text-orange-400' : 'text-muted-foreground'}`}>{selectedFee.exciseDutyApplicable ? "Applicable" : "N/A"}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">VAT (16%)</div>
                  <div className={`font-bold ${selectedFee.vatApplicable ? 'text-orange-400' : 'text-muted-foreground'}`}>{selectedFee.vatApplicable ? "Applicable" : "N/A"}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">CPF Pension</div>
                  <div className={`font-bold ${selectedFee.cpfEligible ? 'text-emerald-400' : 'text-muted-foreground'}`}>{selectedFee.cpfEligible ? `${selectedFee.cpfRate}% of fee delta` : "N/A"}</div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
