import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { PaymentMethodSelector } from "./PaymentMethodSelector";

interface PayBillsFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const kenyanBillers = [
  { id: "kplc", name: "Kenya Power (KPLC)", category: "Utilities" },
  { id: "nairobi-water", name: "Nairobi Water", category: "Utilities" },
  { id: "safaricom", name: "Safaricom", category: "Telecom" },
  { id: "airtel", name: "Airtel Kenya", category: "Telecom" },
  { id: "dstv", name: "DStv Kenya", category: "Entertainment" },
  { id: "gotv", name: "GOtv Kenya", category: "Entertainment" },
];

export function PayBillsFlow({ open, onOpenChange }: PayBillsFlowProps) {
  const [step, setStep] = useState(1);
  const [billData, setBillData] = useState({
    biller: "", accountNumber: "", amount: "", wallet: "main", paymentMethod: "wallet"
  });
  const { toast } = useToast();
  const { addTransaction } = useWallet();

  const selectedBiller = kenyanBillers.find(b => b.id === billData.biller);
  const handleNext = () => { if (step < 3) setStep(step + 1); };
  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const handleComplete = () => {
    const transactionType = billData.paymentMethod === 'virtual-card' ? 'virtual_card' : 'bill';
    const walletType = billData.paymentMethod === 'wallet' ? billData.wallet : 'main';
    addTransaction({
      type: transactionType,
      amount: -parseFloat(billData.amount),
      description: `${selectedBiller?.name} - ${billData.accountNumber}`,
      status: 'completed',
      walletType: walletType as any
    });
    toast({ title: "Bill Payment Successful", description: `KES ${billData.amount} paid to ${selectedBiller?.name}` });
    onOpenChange(false);
    setStep(1);
    setBillData({ biller: "", accountNumber: "", amount: "", wallet: "main", paymentMethod: "wallet" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-glass-border">
        <DialogHeader><DialogTitle className="text-foreground">Pay Bills</DialogTitle></DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Select Biller</Label>
              <Select value={billData.biller} onValueChange={(value) => setBillData({...billData, biller: value})}>
                <SelectTrigger className="glass-card"><SelectValue placeholder="Choose a biller" /></SelectTrigger>
                <SelectContent>
                  {kenyanBillers.map((biller) => (
                    <SelectItem key={biller.id} value={biller.id}>
                      <div><div className="font-medium">{biller.name}</div><div className="text-xs text-muted-foreground">{biller.category}</div></div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Account Number</Label>
              <Input placeholder="Enter your account number" value={billData.accountNumber}
                onChange={(e) => setBillData({...billData, accountNumber: e.target.value})} className="glass-card" />
            </div>
            <Button onClick={handleNext} className="w-full button-3d" disabled={!billData.biller || !billData.accountNumber}>Next</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <Label>Amount (KES)</Label>
              <Input type="number" placeholder="0.00" value={billData.amount}
                onChange={(e) => setBillData({...billData, amount: e.target.value})} className="glass-card" />
            </div>
            <PaymentMethodSelector selectedMethod={billData.paymentMethod}
              onMethodChange={(method) => setBillData({...billData, paymentMethod: method})}
              amount={parseFloat(billData.amount) || 0} availableMethods={['wallet', 'virtual-card', 'mpesa']} />
            {billData.paymentMethod === 'wallet' && (
              <div>
                <Label>Pay From Wallet</Label>
                <Select value={billData.wallet} onValueChange={(value) => setBillData({...billData, wallet: value})}>
                  <SelectTrigger className="glass-card"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">Main Wallet</SelectItem>
                    <SelectItem value="education">Education Wallet</SelectItem>
                    <SelectItem value="medical">Medical Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-3">
              <Button onClick={handleBack} variant="outline" className="flex-1">Back</Button>
              <Button onClick={handleNext} className="flex-1 button-3d" disabled={!billData.amount}>Review</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="glass-card p-4 space-y-2">
              <h3 className="font-semibold text-foreground">Payment Summary</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Biller:</span><span className="text-foreground">{selectedBiller?.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Account:</span><span className="text-foreground">{billData.accountNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount:</span><span className="text-foreground font-semibold">KES {billData.amount}</span></div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleBack} variant="outline" className="flex-1">Back</Button>
              <Button onClick={handleComplete} className="flex-1 button-3d">Pay Bill</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
