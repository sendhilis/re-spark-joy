import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building, CheckCircle, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { PaymentMethodSelector } from "./PaymentMethodSelector";

interface BankTransferFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const kenyanBanks = [
  { id: "kcb", name: "KCB Bank", code: "01" },
  { id: "equity", name: "Equity Bank", code: "68" },
  { id: "cooperative", name: "Co-operative Bank", code: "11" },
  { id: "absa", name: "Absa Bank Kenya", code: "03" },
  { id: "standard", name: "Standard Chartered", code: "02" },
  { id: "dtb", name: "Diamond Trust Bank", code: "63" },
  { id: "family", name: "Family Bank", code: "70" },
  { id: "ib", name: "I&M Bank", code: "57" },
  { id: "ncba", name: "NCBA Bank", code: "07" },
  { id: "stanbic", name: "Stanbic Bank", code: "31" },
];

export function BankTransferFlow({ open, onOpenChange }: BankTransferFlowProps) {
  const [step, setStep] = useState(1);
  const [transferData, setTransferData] = useState({
    bank: "", accountNumber: "", accountName: "", amount: "", description: "", paymentMethod: "wallet"
  });
  const { toast } = useToast();
  const { addTransaction } = useWallet();

  const selectedBank = kenyanBanks.find(b => b.id === transferData.bank);
  const handleNext = () => { if (step < 3) setStep(step + 1); };
  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const handleComplete = () => {
    const transactionType = transferData.paymentMethod === 'virtual-card' ? 'virtual_card' : 'sent';
    addTransaction({
      type: transactionType,
      amount: -parseFloat(transferData.amount),
      description: `Bank Transfer to ${transferData.accountName} (${selectedBank?.name})`,
      recipient: `${transferData.accountName} - ${transferData.accountNumber}`,
      status: 'completed',
      walletType: 'main'
    });
    toast({ title: "Bank Transfer Initiated! 🏦", description: `KES ${transferData.amount} transfer to ${transferData.accountName} is being processed` });
    onOpenChange(false);
    setStep(1);
    setTransferData({ bank: "", accountNumber: "", accountName: "", amount: "", description: "", paymentMethod: "wallet" });
  };

  const formatAccountNumber = (value: string) => value.replace(/\D/g, '').slice(0, 16);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-glass-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2"><Building className="h-5 w-5" />Bank Transfer</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Select Bank</Label>
              <Select value={transferData.bank} onValueChange={(value) => setTransferData({...transferData, bank: value})}>
                <SelectTrigger className="glass-card"><SelectValue placeholder="Choose bank" /></SelectTrigger>
                <SelectContent>
                  {kenyanBanks.map((bank) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      <div className="flex items-center gap-2"><Building className="h-4 w-4" /><div><div className="font-medium">{bank.name}</div><div className="text-xs text-muted-foreground">Code: {bank.code}</div></div></div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Account Number</Label><Input placeholder="Enter account number" value={transferData.accountNumber}
              onChange={(e) => setTransferData({...transferData, accountNumber: formatAccountNumber(e.target.value)})} className="glass-card" maxLength={16} /></div>
            <div>
              <Label>Account Holder Name</Label>
              <Input
                placeholder="e.g. John Mwangi Kamau"
                value={transferData.accountName}
                onChange={(e) => setTransferData({...transferData, accountName: e.target.value.replace(/[^a-zA-Z\s.'-]/g, '').slice(0, 60)})}
                className="glass-card"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Type the recipient's full name as registered with the bank (letters only, min 3 characters).
              </p>
            </div>
            {(() => {
              const reasons: string[] = [];
              if (!transferData.bank) reasons.push("Select a bank");
              if (!transferData.accountNumber) reasons.push("Enter account number");
              else if (transferData.accountNumber.length < 6) reasons.push("Account number must be at least 6 digits");
              if (!transferData.accountName.trim()) reasons.push("Enter account holder name");
              else if (transferData.accountName.trim().length < 3) reasons.push("Name must be at least 3 characters");
              const disabled = reasons.length > 0;
              return (
                <>
                  {disabled && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">{reasons.join(" · ")}</p>
                  )}
                  <Button onClick={handleNext} className="w-full button-3d" disabled={disabled}>Next</Button>
                </>
              );
            })()}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <Label>Amount (KES)</Label><Input type="number" placeholder="0.00" value={transferData.amount}
                onChange={(e) => setTransferData({...transferData, amount: e.target.value})} className="glass-card" min="100" max="999999" />
              <p className="text-xs text-muted-foreground mt-1">Minimum: KES 100, Maximum: KES 999,999</p>
            </div>
            <div>
              <Label>Transfer Description (Optional)</Label><Input placeholder="e.g., Salary, Payment, etc." value={transferData.description}
                onChange={(e) => setTransferData({...transferData, description: e.target.value})} className="glass-card" maxLength={50} />
            </div>
            <PaymentMethodSelector selectedMethod={transferData.paymentMethod}
              onMethodChange={(method) => setTransferData({...transferData, paymentMethod: method})}
              amount={parseFloat(transferData.amount) || 0} availableMethods={['wallet', 'virtual-card']} />
            <div className="flex gap-3">
              <Button onClick={handleBack} variant="outline" className="flex-1">Back</Button>
              <Button onClick={handleNext} className="flex-1 button-3d" disabled={!transferData.amount || parseFloat(transferData.amount) < 100}>Review</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="glass-card p-4 space-y-3">
              <h3 className="font-semibold text-foreground flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" />Transfer Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Bank:</span><span className="text-foreground font-medium">{selectedBank?.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Account:</span><span className="text-foreground font-mono">{transferData.accountNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Recipient:</span><span className="text-foreground">{transferData.accountName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount:</span><span className="text-foreground font-semibold text-lg">KES {transferData.amount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Payment Method:</span>
                  <span className="text-foreground flex items-center gap-1">
                    {transferData.paymentMethod === 'virtual-card' ? <><CreditCard className="h-3 w-3" />Virtual Card</> : 'Lipafo Wallet'}
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg">
              <p className="text-sm text-amber-700 dark:text-amber-300">⏰ Bank transfers typically take 1-2 hours during banking hours.</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleBack} variant="outline" className="flex-1">Back</Button>
              <Button onClick={handleComplete} className="flex-1 button-3d">Send Transfer</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
