import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { ArrowRightLeft, Wallet, GraduationCap, Heart, Plane, PiggyBank, CheckCircle, AlertCircle } from "lucide-react";

interface WalletTransferFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface WalletOption {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  description: string;
  color: string;
}

const walletOptions: WalletOption[] = [
  { id: 'main', name: 'Main Wallet', icon: Wallet, description: 'Your primary spending wallet', color: 'bg-gradient-to-br from-blue-500 to-blue-600' },
  { id: 'education', name: 'Education Wallet', icon: GraduationCap, description: 'For school fees and learning', color: 'bg-gradient-to-br from-purple-500 to-purple-600' },
  { id: 'medical', name: 'Medical Wallet', icon: Heart, description: 'For healthcare expenses', color: 'bg-gradient-to-br from-red-500 to-red-600' },
  { id: 'holiday', name: 'Holiday Wallet', icon: Plane, description: 'For travel and vacation', color: 'bg-gradient-to-br from-green-500 to-green-600' },
  { id: 'retirement', name: 'Retirement Wallet', icon: PiggyBank, description: 'For your future security', color: 'bg-gradient-to-br from-orange-500 to-orange-600' },
];

export function WalletTransferFlow({ open, onOpenChange }: WalletTransferFlowProps) {
  const [step, setStep] = useState(1);
  const [transferData, setTransferData] = useState({ fromWallet: '', toWallet: '', amount: '', description: '' });
  const { toast } = useToast();
  const { balances, updateBalance, addTransaction } = useWallet();

  const handleNext = () => { if (step < 3) setStep(step + 1); };
  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const handleComplete = () => {
    const amount = parseFloat(transferData.amount);
    const fromWallet = transferData.fromWallet as keyof typeof balances;
    const toWallet = transferData.toWallet as keyof typeof balances;
    if (balances[fromWallet] < amount) {
      toast({ title: "Insufficient Balance", description: `You don't have enough funds in your ${getWalletName(fromWallet)}`, variant: "destructive" });
      return;
    }
    updateBalance(fromWallet, -amount);
    updateBalance(toWallet, amount);
    addTransaction({ type: 'sent', amount: -amount, description: transferData.description || `Transfer to ${getWalletName(toWallet)}`, status: 'completed', walletType: fromWallet });
    addTransaction({ type: 'received', amount: amount, description: transferData.description || `Transfer from ${getWalletName(fromWallet)}`, status: 'completed', walletType: toWallet });
    toast({ title: "Transfer Successful", description: `KES ${amount.toLocaleString()} transferred from ${getWalletName(fromWallet)} to ${getWalletName(toWallet)}` });
    onOpenChange(false);
    setStep(1);
    setTransferData({ fromWallet: '', toWallet: '', amount: '', description: '' });
  };

  const getWalletName = (walletId: string) => walletOptions.find(w => w.id === walletId)?.name || walletId;
  const getWalletBalance = (walletId: string) => balances[walletId as keyof typeof balances] || 0;
  const canProceed = () => {
    if (step === 1) return transferData.fromWallet && transferData.toWallet && transferData.fromWallet !== transferData.toWallet;
    if (step === 2) return transferData.amount && parseFloat(transferData.amount) > 0;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-glass-border max-w-2xl max-h-[90vh] overflow-hidden p-0 flex flex-col">
        <DialogHeader className="p-6 pb-0 shrink-0">
          <DialogTitle className="text-foreground flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" />Transfer Between Wallets</DialogTitle>
          <div className="text-sm text-muted-foreground">Step {step} of 3: {step === 1 ? 'Select Wallets' : step === 2 ? 'Enter Amount' : 'Confirm Transfer'}</div>
        </DialogHeader>

        <div className="flex-1 overflow-auto px-6 touch-pan-y">
          <div className="pb-6 space-y-6">
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-base font-semibold">From Wallet</Label>
                  <div className="grid grid-cols-1 gap-3 mt-3">
                    {walletOptions.map((wallet) => {
                      const IconComponent = wallet.icon;
                      const isSelected = transferData.fromWallet === wallet.id;
                      return (
                        <Card key={`from-${wallet.id}`} className={`p-4 cursor-pointer transition-all ${isSelected ? 'border-primary bg-primary/5' : 'glass-card hover:border-primary/30'}`}
                          onClick={() => setTransferData({...transferData, fromWallet: wallet.id})}>
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${wallet.color}`}><IconComponent className="h-5 w-5 text-white" /></div>
                            <div className="flex-1">
                              <div className="font-medium text-foreground">{wallet.name}</div>
                              <div className="text-sm text-muted-foreground">KES {getWalletBalance(wallet.id).toLocaleString()}</div>
                            </div>
                            {isSelected && <CheckCircle className="h-5 w-5 text-primary" />}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label className="text-base font-semibold">To Wallet</Label>
                  <div className="grid grid-cols-1 gap-3 mt-3">
                    {walletOptions.filter(w => w.id !== transferData.fromWallet).map((wallet) => {
                      const IconComponent = wallet.icon;
                      const isSelected = transferData.toWallet === wallet.id;
                      return (
                        <Card key={`to-${wallet.id}`} className={`p-4 cursor-pointer transition-all ${isSelected ? 'border-primary bg-primary/5' : 'glass-card hover:border-primary/30'}`}
                          onClick={() => setTransferData({...transferData, toWallet: wallet.id})}>
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${wallet.color}`}><IconComponent className="h-5 w-5 text-white" /></div>
                            <div className="flex-1">
                              <div className="font-medium text-foreground">{wallet.name}</div>
                              <div className="text-sm text-muted-foreground">KES {getWalletBalance(wallet.id).toLocaleString()}</div>
                            </div>
                            {isSelected && <CheckCircle className="h-5 w-5 text-primary" />}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
                <Button onClick={handleNext} className="w-full button-3d" disabled={!canProceed()}>Continue</Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Available Balance</span>
                    <span className="font-bold text-foreground">KES {getWalletBalance(transferData.fromWallet).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">From:</span><span className="font-medium">{getWalletName(transferData.fromWallet)}</span>
                    <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">To:</span><span className="font-medium">{getWalletName(transferData.toWallet)}</span>
                  </div>
                </div>
                <div>
                  <Label>Transfer Amount (KES)</Label>
                  <Input type="number" placeholder="0.00" value={transferData.amount}
                    onChange={(e) => setTransferData({...transferData, amount: e.target.value})}
                    className="glass-card text-lg" max={getWalletBalance(transferData.fromWallet)} />
                  <div className="flex gap-2 mt-2">
                    {[25, 50, 75, 100].map((pct) => {
                      const amt = Math.floor(getWalletBalance(transferData.fromWallet) * pct / 100);
                      return <Button key={pct} variant="outline" size="sm" onClick={() => setTransferData({...transferData, amount: amt.toString()})} className="text-xs">{pct}%</Button>;
                    })}
                  </div>
                </div>
                <div>
                  <Label>Description (Optional)</Label>
                  <Input placeholder="What's this transfer for?" value={transferData.description}
                    onChange={(e) => setTransferData({...transferData, description: e.target.value})} className="glass-card" />
                </div>
                {transferData.amount && parseFloat(transferData.amount) > getWalletBalance(transferData.fromWallet) && (
                  <div className="glass-card p-3 border border-red-200 bg-red-50 dark:bg-red-950/20">
                    <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                      <AlertCircle className="h-4 w-4" />Insufficient balance in {getWalletName(transferData.fromWallet)}
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <Button onClick={handleBack} variant="outline" className="flex-1">Back</Button>
                  <Button onClick={handleNext} className="flex-1 button-3d" disabled={!canProceed()}>Review Transfer</Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="glass-card p-6 space-y-4">
                  <h3 className="font-semibold text-foreground">Transfer Summary</h3>
                  <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg">
                    <div className="text-center">
                      <div className="font-semibold text-foreground">{getWalletName(transferData.fromWallet)}</div>
                      <div className="text-sm text-muted-foreground">Balance: KES {getWalletBalance(transferData.fromWallet).toLocaleString()}</div>
                    </div>
                    <div className="flex flex-col items-center">
                      <ArrowRightLeft className="h-6 w-6 text-primary mb-1" />
                      <div className="font-bold text-lg text-primary">KES {parseFloat(transferData.amount).toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-foreground">{getWalletName(transferData.toWallet)}</div>
                      <div className="text-sm text-muted-foreground">Balance: KES {getWalletBalance(transferData.toWallet).toLocaleString()}</div>
                    </div>
                  </div>
                  {transferData.description && (
                    <div className="p-3 bg-muted/10 rounded-lg">
                      <div className="text-sm text-muted-foreground">Description</div>
                      <div className="font-medium text-foreground">{transferData.description}</div>
                    </div>
                  )}
                  <div className="text-center p-3 bg-success/10 rounded-lg border border-success/20">
                    <div className="text-sm text-success font-medium">✓ Transfer will be processed instantly</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleBack} variant="outline" className="flex-1">Back</Button>
                  <Button onClick={handleComplete} className="flex-1 button-3d">Confirm Transfer</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
