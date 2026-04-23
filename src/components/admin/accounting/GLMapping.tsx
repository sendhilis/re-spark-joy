import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { ArrowRight, GitBranch } from "lucide-react";

interface TransactionGLMapping {
  transactionType: string;
  description: string;
  debitGL: string;
  debitName: string;
  creditGL: string;
  creditName: string;
  feeDebitGL?: string;
  feeDebitName?: string;
  feeCreditGL?: string;
  feeCreditName?: string;
  category: string;
}

const mappings: TransactionGLMapping[] = [
  // Deposits
  { transactionType: "M-Pesa Deposit", description: "Customer tops up wallet via M-Pesa STK Push", debitGL: "1040", debitName: "M-Pesa Trust Account", creditGL: "2010", creditName: "Customer Balances - Main", feeDebitGL: "2010", feeDebitName: "Customer Balances", feeCreditGL: "4040", feeCreditName: "M-Pesa Interchange", category: "Deposit" },
  { transactionType: "Bank Transfer Deposit", description: "Customer deposits via bank EFT/RTGS", debitGL: "1030", debitName: "Settlement Bank - KCB", creditGL: "2010", creditName: "Customer Balances - Main", category: "Deposit" },
  { transactionType: "Agent Cash-In", description: "Customer deposits cash at agent point", debitGL: "1020", debitName: "Agent Float Pool", creditGL: "2010", creditName: "Customer Balances - Main", feeDebitGL: "2010", feeDebitName: "Customer Balances", feeCreditGL: "4060", feeCreditName: "Agent Transaction Fees", category: "Deposit" },
  { transactionType: "Diaspora Inbound Remittance", description: "Diaspora user sends KES from abroad", debitGL: "1060", debitName: "Diaspora Remittance Inflow", creditGL: "2010", creditName: "Customer Balances - Main", feeDebitGL: "1060", feeDebitName: "Diaspora Inflow", feeCreditGL: "4200", feeCreditName: "Diaspora Service Fees", category: "Deposit" },
  // Transfers
  { transactionType: "P2P Transfer", description: "Customer sends money to another Lipafo user", debitGL: "2010", debitName: "Sender Wallet Liability", creditGL: "2010", creditName: "Receiver Wallet Liability", feeDebitGL: "2010", feeDebitName: "Sender Wallet", feeCreditGL: "4010", feeCreditName: "P2P Transfer Fees", category: "Transfer" },
  { transactionType: "Wallet-to-SubWallet", description: "Allocate from main to education/medical/etc", debitGL: "2010", debitName: "Customer Main Wallet", creditGL: "2011", creditName: "Customer Education Wallet", category: "Transfer" },
  { transactionType: "Save-As-You-Spend (SAYS)", description: "Auto-sweep % from transaction to sub-wallet", debitGL: "2010", debitName: "Customer Main Wallet", creditGL: "2014", creditName: "Customer Retirement Wallet", category: "Transfer" },
  { transactionType: "CPF Pension Contribution", description: "Fee delta auto-contributed to pension", debitGL: "1010", debitName: "Wallet Pool - Main", creditGL: "1015", creditName: "Wallet Pool - Pension", category: "Transfer" },
  // Payments
  { transactionType: "Bill Payment (KPLC/Water)", description: "Customer pays utility bill", debitGL: "2010", debitName: "Customer Main Wallet", creditGL: "2030", creditName: "Pending Settlement - M-Pesa", feeDebitGL: "2010", feeDebitName: "Customer Wallet", feeCreditGL: "4020", feeCreditName: "Bill Payment Fees", category: "Payment" },
  { transactionType: "School Fees Payment", description: "Customer pays school fees via paybill", debitGL: "2011", debitName: "Customer Education Wallet", creditGL: "2030", creditName: "Pending Settlement - M-Pesa", feeDebitGL: "2010", feeDebitName: "Customer Wallet", feeCreditGL: "4030", feeCreditName: "School Fees Payment Fees", category: "Payment" },
  { transactionType: "Virtual Card Payment", description: "Online purchase via virtual VISA card", debitGL: "2010", debitName: "Customer Main Wallet", creditGL: "2040", creditName: "Pending Settlement - Card", feeDebitGL: "2010", feeDebitName: "Customer Wallet", feeCreditGL: "4050", feeCreditName: "Card Transaction Fees", category: "Payment" },
  { transactionType: "QR Payment (Merchant)", description: "In-store QR code payment to merchant", debitGL: "2010", debitName: "Customer Main Wallet", creditGL: "2010", creditName: "Merchant Wallet", feeDebitGL: "2010", feeDebitName: "Customer/Merchant Wallet", feeCreditGL: "4010", feeCreditName: "Transaction Fees", category: "Payment" },
  // Withdrawals
  { transactionType: "M-Pesa Withdrawal", description: "Customer withdraws to M-Pesa", debitGL: "2010", debitName: "Customer Main Wallet", creditGL: "1040", creditName: "M-Pesa Trust Account", feeDebitGL: "2010", feeDebitName: "Customer Wallet", feeCreditGL: "4040", feeCreditName: "M-Pesa Interchange", category: "Withdrawal" },
  { transactionType: "Agent Cash-Out", description: "Customer withdraws cash at agent", debitGL: "2010", debitName: "Customer Main Wallet", creditGL: "1020", creditName: "Agent Float Pool", feeDebitGL: "2010", feeDebitName: "Customer Wallet", feeCreditGL: "4060", feeCreditName: "Agent Transaction Fees", category: "Withdrawal" },
  { transactionType: "Bank Withdrawal (EFT)", description: "Customer withdraws to bank account", debitGL: "2010", debitName: "Customer Main Wallet", creditGL: "1030", creditName: "Settlement Bank - KCB", feeDebitGL: "2010", feeDebitName: "Customer Wallet", feeCreditGL: "4010", feeCreditName: "Transfer Fees", category: "Withdrawal" },
  // Loans
  { transactionType: "Loan Disbursement", description: "Approved loan credited to customer wallet", debitGL: "1110", debitName: "Loans Receivable - Instant", creditGL: "2010", creditName: "Customer Main Wallet", feeDebitGL: "2010", feeDebitName: "Customer Wallet", feeCreditGL: "4110", feeCreditName: "Loan Origination Fees", category: "Loan" },
  { transactionType: "Loan Repayment", description: "Customer repays loan from wallet", debitGL: "2010", debitName: "Customer Main Wallet", creditGL: "1110", creditName: "Loans Receivable", category: "Loan" },
  { transactionType: "Interest Accrual", description: "Daily interest accrual on outstanding loans", debitGL: "1200", debitName: "Interest Receivable", creditGL: "4100", creditName: "Loan Interest Income", category: "Loan" },
  { transactionType: "Loan Write-Off", description: "Non-performing loan written off", debitGL: "5040", debitName: "Bad Debt Expense", creditGL: "1300", creditName: "Provision for Bad Debts", category: "Loan" },
  // Settlement
  { transactionType: "M-Pesa EOD Settlement", description: "Safaricom settles paybill to bank", debitGL: "1030", debitName: "Settlement Bank - KCB", creditGL: "1040", creditName: "M-Pesa Trust Account", category: "Settlement" },
  { transactionType: "Card Processor Settlement", description: "VISA/MC settles to bank account", debitGL: "1030", debitName: "Settlement Bank - KCB", creditGL: "1050", creditName: "Card Processor Settlement", category: "Settlement" },
  { transactionType: "Excise Duty Provision", description: "20% excise on transaction fees (CBK reg)", debitGL: "4000", debitName: "Transaction Fee Income", creditGL: "2050", creditName: "Taxes Payable - Excise Duty", category: "Settlement" },
];

const categoryColors: Record<string, string> = {
  Deposit: "bg-emerald-500/10 text-emerald-400",
  Transfer: "bg-blue-500/10 text-blue-400",
  Payment: "bg-purple-500/10 text-purple-400",
  Withdrawal: "bg-orange-500/10 text-orange-400",
  Loan: "bg-yellow-500/10 text-yellow-400",
  Settlement: "bg-pink-500/10 text-pink-400",
};

export function GLMapping() {
  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><GitBranch className="h-5 w-5 text-primary" />Transaction → GL Mapping Matrix</CardTitle>
          <CardDescription>Every transaction type maps to a double-entry journal with debit and credit GLs. Fee entries are booked simultaneously.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Debit GL</TableHead>
                  <TableHead className="text-center"></TableHead>
                  <TableHead className="text-center">Credit GL</TableHead>
                  <TableHead className="text-center">Fee Debit</TableHead>
                  <TableHead className="text-center">Fee Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="font-medium text-foreground">{m.transactionType}</div>
                      <div className="text-xs text-muted-foreground max-w-[200px]">{m.description}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className={categoryColors[m.category]}>{m.category}</Badge></TableCell>
                    <TableCell className="text-center">
                      <div className="font-mono text-sm text-blue-400">{m.debitGL}</div>
                      <div className="text-xs text-muted-foreground">{m.debitName}</div>
                    </TableCell>
                    <TableCell className="text-center"><ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" /></TableCell>
                    <TableCell className="text-center">
                      <div className="font-mono text-sm text-orange-400">{m.creditGL}</div>
                      <div className="text-xs text-muted-foreground">{m.creditName}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      {m.feeDebitGL ? (
                        <>
                          <div className="font-mono text-xs text-blue-300">{m.feeDebitGL}</div>
                          <div className="text-xs text-muted-foreground">{m.feeDebitName}</div>
                        </>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {m.feeCreditGL ? (
                        <>
                          <div className="font-mono text-xs text-emerald-400">{m.feeCreditGL}</div>
                          <div className="text-xs text-muted-foreground">{m.feeCreditName}</div>
                        </>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
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
