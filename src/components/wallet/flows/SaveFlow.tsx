import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PiggyBank } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";

interface SaveFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaveFlow({ open, onOpenChange }: SaveFlowProps) {
  const [saveData, setSaveData] = useState({ amount: "", target: "", frequency: "" });
  const { toast } = useToast();
  const { addTransaction } = useWallet();

  const handleSave = () => {
    addTransaction({ type: 'sent', amount: -parseFloat(saveData.amount), description: `Transfer to ${saveData.target} wallet`, status: 'completed', walletType: 'main' });
    addTransaction({ type: 'save', amount: parseFloat(saveData.amount), description: `Saved to ${saveData.target} wallet`, status: 'completed', walletType: saveData.target as any });
    toast({ title: "Savings Added", description: `KES ${saveData.amount} added to ${saveData.target} wallet` });
    onOpenChange(false);
    setSaveData({ amount: "", target: "", frequency: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-glass-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2"><PiggyBank className="h-5 w-5" />Add to Savings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Save To</Label>
            <Select value={saveData.target} onValueChange={(value) => setSaveData({...saveData, target: value})}>
              <SelectTrigger className="glass-card"><SelectValue placeholder="Choose savings wallet" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="education">Education Wallet</SelectItem>
                <SelectItem value="medical">Medical Wallet</SelectItem>
                <SelectItem value="holiday">Holiday Wallet</SelectItem>
                <SelectItem value="retirement">Retirement Wallet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Amount (KES)</Label>
            <Input type="number" placeholder="0.00" value={saveData.amount}
              onChange={(e) => setSaveData({...saveData, amount: e.target.value})} className="glass-card" />
          </div>
          <div>
            <Label>Save Frequency</Label>
            <Select value={saveData.frequency} onValueChange={(value) => setSaveData({...saveData, frequency: value})}>
              <SelectTrigger className="glass-card"><SelectValue placeholder="How often?" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="once">One-time</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} className="w-full button-3d" disabled={!saveData.amount || !saveData.target || !saveData.frequency}>Save Money</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
