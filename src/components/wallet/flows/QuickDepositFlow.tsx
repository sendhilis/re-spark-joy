import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Smartphone, Building, CreditCard, QrCode, ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";

interface QuickDepositFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const depositMethods = [
  { id: "mpesa", name: "M-Pesa", icon: Smartphone, description: "Deposit via M-Pesa STK Push", color: "text-success" },
  { id: "bank", name: "Bank Transfer", icon: Building, description: "Direct bank deposit", color: "text-primary" },
  { id: "card", name: "Debit/Credit Card", icon: CreditCard, description: "Visa or Mastercard", color: "text-warning" },
  { id: "agent", name: "Rukisha Agent", icon: QrCode, description: "Visit nearest agent", color: "text-muted-foreground" },
];

const quickAmounts = [500, 1000, 2500, 5000, 10000, 25000];

export function QuickDepositFlow({ open, onOpenChange }: QuickDepositFlowProps) {
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState("");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("0712345678");
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();
  const { addTransaction } = useWallet();

  const reset = () => { setStep(1); setMethod(""); setAmount(""); setProcessing(false); };

  const handleDeposit = () => {
    const depositAmount = parseFloat(amount);
    if (!depositAmount || depositAmount < 50) {
      toast({ title: "Invalid Amount", description: "Minimum deposit is KES 50", variant: "destructive" });
      return;
    }
    setProcessing(true);
    setTimeout(() => {
      addTransaction({
        type: "received",
        amount: depositAmount,
        description: `Deposit via ${depositMethods.find(m => m.id === method)?.name}`,
        status: "completed",
        walletType: "main",
      });
      setProcessing(false);
      setStep(3);
      toast({ title: "Deposit Successful!", description: `KES ${depositAmount.toLocaleString()} added to your wallet` });
    }, 2000);
  };

  const selectedMethod = depositMethods.find(m => m.id === method);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="glass-card border-glass-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {step === 1 && "Quick Deposit"}
            {step === 2 && `Deposit via ${selectedMethod?.name}`}
            {step === 3 && "Deposit Complete"}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Choose how you'd like to add money to your wallet</p>
            <div className="grid grid-cols-2 gap-3">
              {depositMethods.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    onClick={() => { setMethod(m.id); setStep(2); }}
                    className="glass-card button-3d p-4 rounded-xl border border-glass-border/20 hover:border-primary/40 transition-all text-left"
                  >
                    <Icon className={`h-8 w-8 ${m.color} mb-2`} />
                    <p className="font-semibold text-sm text-foreground">{m.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <Label className="text-muted-foreground text-xs mb-2 block">Quick Amount</Label>
              <div className="grid grid-cols-3 gap-2">
                {quickAmounts.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAmount(a.toString())}
                    className={`glass-card p-2 rounded-lg text-sm font-medium transition-all ${
                      amount === a.toString()
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-glass-border/20 text-foreground hover:border-primary/30"
                    }`}
                  >
                    {a.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Amount (KES)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="glass-card text-lg font-semibold"
              />
              <p className="text-xs text-muted-foreground mt-1">Min: KES 50 · Max: KES 300,000</p>
            </div>

            {(method === "mpesa") && (
              <div>
                <Label>M-Pesa Phone Number</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="glass-card" placeholder="07XXXXXXXX" />
                <p className="text-xs text-muted-foreground mt-1">You'll receive an STK push on this number</p>
              </div>
            )}

            {method === "bank" && (
              <Card className="glass-card p-4 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Transfer to:</p>
                <div className="space-y-1">
                  <p className="text-sm text-foreground"><span className="text-muted-foreground">Bank:</span> Equity Bank</p>
                  <p className="text-sm text-foreground"><span className="text-muted-foreground">Account:</span> 0180297456321</p>
                  <p className="text-sm text-foreground"><span className="text-muted-foreground">Name:</span> RUKISHA WALLET LTD</p>
                  <p className="text-sm text-foreground"><span className="text-muted-foreground">Ref:</span> RUK-{Math.random().toString(36).substr(2, 8).toUpperCase()}</p>
                </div>
              </Card>
            )}

            {method === "agent" && (
              <Card className="glass-card p-4 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Find an agent near you</p>
                <p className="text-sm text-foreground">Visit any Rukisha agent with your ID and deposit cash. Quote code:</p>
                <p className="text-2xl font-bold text-primary text-center py-2">AGT-{Math.random().toString(36).substr(2, 6).toUpperCase()}</p>
              </Card>
            )}

            <div className="flex gap-3">
              <Button onClick={() => setStep(1)} variant="outline" className="flex-1">Back</Button>
              <Button onClick={handleDeposit} disabled={processing || !amount} className="flex-1 button-3d">
                {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</> : <>Deposit <ArrowRight className="h-4 w-4 ml-2" /></>}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 text-center py-4">
            <CheckCircle className="h-16 w-16 text-success mx-auto" />
            <div>
              <p className="text-2xl font-bold text-foreground">KES {parseFloat(amount).toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-1">deposited via {selectedMethod?.name}</p>
            </div>
            <Card className="glass-card p-4">
              <p className="text-xs text-muted-foreground">Transaction ID</p>
              <p className="text-sm font-mono text-foreground">TXN-{Date.now().toString(36).toUpperCase()}</p>
            </Card>
            <div className="flex gap-3">
              <Button onClick={() => { reset(); }} variant="outline" className="flex-1">Deposit More</Button>
              <Button onClick={() => { reset(); onOpenChange(false); }} className="flex-1 button-3d">Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
