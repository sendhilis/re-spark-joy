import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Smartphone, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { PaymentMethodSelector } from "./PaymentMethodSelector";

interface MPESAFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const mpesaProviders = [
  { id: "safaricom", name: "Safaricom M-Pesa", code: "MPESA" },
  { id: "airtel", name: "Airtel Money", code: "AIRTEL" },
  { id: "tkash", name: "T-Kash", code: "TKASH" },
];

export function MPESAFlow({ open, onOpenChange }: MPESAFlowProps) {
  const [step, setStep] = useState(1);
  const [mpesaData, setMpesaData] = useState({ provider: "", phoneNumber: "", amount: "", paymentMethod: "wallet" });
  const { toast } = useToast();
  const { addTransaction } = useWallet();

  const selectedProvider = mpesaProviders.find(p => p.id === mpesaData.provider);
  const handleNext = () => { if (step < 3) setStep(step + 1); };
  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const handleComplete = () => {
    const transactionType = mpesaData.paymentMethod === 'virtual-card' ? 'virtual_card' : 'mpesa';
    addTransaction({
      type: transactionType,
      amount: -parseFloat(mpesaData.amount),
      description: `${selectedProvider?.name} Top-up - ${mpesaData.phoneNumber}`,
      recipient: mpesaData.phoneNumber,
      status: 'completed',
      walletType: 'main'
    });
    toast({ title: "M-Pesa Top-up Successful! 🎉", description: `KES ${mpesaData.amount} sent to ${mpesaData.phoneNumber}` });
    onOpenChange(false);
    setStep(1);
    setMpesaData({ provider: "", phoneNumber: "", amount: "", paymentMethod: "wallet" });
  };

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-glass-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2"><Smartphone className="h-5 w-5" />M-Pesa Top-up</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Mobile Money Provider</Label>
              <Select value={mpesaData.provider} onValueChange={(value) => setMpesaData({...mpesaData, provider: value})}>
                <SelectTrigger className="glass-card"><SelectValue placeholder="Choose provider" /></SelectTrigger>
                <SelectContent>
                  {mpesaProviders.map((p) => (
                    <SelectItem key={p.id} value={p.id}><div><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.code}</div></div></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input placeholder="0712 345 678" value={mpesaData.phoneNumber}
                onChange={(e) => setMpesaData({...mpesaData, phoneNumber: formatPhoneNumber(e.target.value)})} className="glass-card" maxLength={12} />
              <p className="text-xs text-muted-foreground mt-1">Enter the phone number to top-up</p>
            </div>
            <Button onClick={handleNext} className="w-full button-3d"
              disabled={!mpesaData.provider || !mpesaData.phoneNumber || mpesaData.phoneNumber.replace(/\s/g, '').length < 10}>Next</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <Label>Amount (KES)</Label>
              <Input type="number" placeholder="0.00" value={mpesaData.amount}
                onChange={(e) => setMpesaData({...mpesaData, amount: e.target.value})} className="glass-card" min="10" max="70000" />
              <p className="text-xs text-muted-foreground mt-1">Minimum: KES 10, Maximum: KES 70,000</p>
            </div>
            <PaymentMethodSelector selectedMethod={mpesaData.paymentMethod}
              onMethodChange={(method) => setMpesaData({...mpesaData, paymentMethod: method})}
              amount={parseFloat(mpesaData.amount) || 0} availableMethods={['wallet', 'virtual-card']} />
            <div className="flex gap-3">
              <Button onClick={handleBack} variant="outline" className="flex-1">Back</Button>
              <Button onClick={handleNext} className="flex-1 button-3d" disabled={!mpesaData.amount || parseFloat(mpesaData.amount) < 10}>Review</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="glass-card p-4 space-y-3">
              <h3 className="font-semibold text-foreground flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" />Top-up Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Provider:</span><span className="text-foreground font-medium">{selectedProvider?.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Phone Number:</span><span className="text-foreground">{mpesaData.phoneNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount:</span><span className="text-foreground font-semibold text-lg">KES {mpesaData.amount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Payment Method:</span><span className="text-foreground">{mpesaData.paymentMethod === 'virtual-card' ? 'Virtual Card' : 'Rukisha Wallet'}</span></div>
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">📱 You'll receive an SMS confirmation once the top-up is processed</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleBack} variant="outline" className="flex-1">Back</Button>
              <Button onClick={handleComplete} className="flex-1 button-3d">Complete Top-up</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
