import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";

interface TransferFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferFlow({ open, onOpenChange }: TransferFlowProps) {
  const [step, setStep] = useState(1);
  const [transferData, setTransferData] = useState({
    recipient: "",
    amount: "",
    method: "",
    description: ""
  });
  const { toast } = useToast();
  const { addTransaction } = useWallet();

  const handleNext = () => { if (step < 3) setStep(step + 1); };
  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const handleComplete = () => {
    addTransaction({
      type: 'sent',
      amount: -parseFloat(transferData.amount),
      description: transferData.description || `Transfer to ${transferData.recipient}`,
      recipient: transferData.recipient,
      status: 'completed',
      walletType: 'main'
    });
    toast({ title: "Transfer Successful", description: `KES ${transferData.amount} sent to ${transferData.recipient}` });
    onOpenChange(false);
    setStep(1);
    setTransferData({ recipient: "", amount: "", method: "", description: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-glass-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Send Money</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="recipient">Recipient</Label>
              <Input id="recipient" placeholder="Phone number or email" value={transferData.recipient}
                onChange={(e) => setTransferData({...transferData, recipient: e.target.value})} className="glass-card" />
            </div>
            <div>
              <Label htmlFor="method">Transfer Method</Label>
              <Select value={transferData.method} onValueChange={(value) => setTransferData({...transferData, method: value})}>
                <SelectTrigger className="glass-card"><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="wallet">Rukisha Wallet</SelectItem>
                  <SelectItem value="virtual-card">Virtual Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleNext} className="w-full button-3d" disabled={!transferData.recipient || !transferData.method}>Next</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount (KES)</Label>
              <Input id="amount" type="number" placeholder="0.00" value={transferData.amount}
                onChange={(e) => setTransferData({...transferData, amount: e.target.value})} className="glass-card" />
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Input id="description" placeholder="What's this for?" value={transferData.description}
                onChange={(e) => setTransferData({...transferData, description: e.target.value})} className="glass-card" />
            </div>
            <div className="flex gap-3">
              <Button onClick={handleBack} variant="outline" className="flex-1">Back</Button>
              <Button onClick={handleNext} className="flex-1 button-3d" disabled={!transferData.amount}>Review</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="glass-card p-4 space-y-2">
              <h3 className="font-semibold text-foreground">Transfer Summary</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">To:</span><span className="text-foreground">{transferData.recipient}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount:</span><span className="text-foreground font-semibold">KES {transferData.amount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Method:</span><span className="text-foreground">{transferData.method}</span></div>
                {transferData.description && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Note:</span><span className="text-foreground">{transferData.description}</span></div>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleBack} variant="outline" className="flex-1">Back</Button>
              <Button onClick={handleComplete} className="flex-1 button-3d">Send Money</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
