import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { PiggyBank, GraduationCap, Banknote, Heart, Shield, TrendingUp, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SaveAsYouSpendFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AllocationConfig {
  retirement: number;
  education: number;
  medical: number;
  pension: number;
}

export function SaveAsYouSpendFlow({ open, onOpenChange }: SaveAsYouSpendFlowProps) {
  const [step, setStep] = useState(1);
  const [enabled, setEnabled] = useState(true);
  const [savePercent, setSavePercent] = useState(5);
  const [roundUp, setRoundUp] = useState(true);
  const [autoBoost, setAutoBoost] = useState(false);
  const [allocation, setAllocation] = useState<AllocationConfig>({
    retirement: 50,
    education: 20,
    medical: 15,
    pension: 15,
  });
  const { toast } = useToast();

  const walletCategories = [
    { key: "retirement" as const, name: "Retirement", icon: Banknote, color: "text-[hsl(var(--retirement))]", bg: "bg-[hsl(var(--retirement)/0.2)]" },
    { key: "education" as const, name: "Education", icon: GraduationCap, color: "text-[hsl(var(--education))]", bg: "bg-[hsl(var(--education)/0.2)]" },
    { key: "medical" as const, name: "Medical", icon: Heart, color: "text-[hsl(var(--medical))]", bg: "bg-[hsl(var(--medical)/0.2)]" },
    { key: "pension" as const, name: "Taifa Pension", icon: Shield, color: "text-primary", bg: "bg-primary/20" },
  ];

  const totalAllocation = Object.values(allocation).reduce((a, b) => a + b, 0);

  const updateAllocation = (key: keyof AllocationConfig, value: number) => {
    setAllocation(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (totalAllocation !== 100) {
      toast({ title: "Allocation Error", description: "Wallet allocation must total 100%", variant: "destructive" });
      return;
    }
    setStep(2);
    toast({ title: "Settings Saved!", description: `Save-As-You-Spend is ${enabled ? "active" : "paused"} at ${savePercent}%` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-glass-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-success" />
            Save-As-You-Spend
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-5">
            {/* Master Toggle */}
            <Card className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">Auto-Save</p>
                  <p className="text-xs text-muted-foreground">Save a % of every transaction</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </Card>

            {enabled && (
              <>
                {/* Save Percentage */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Save Percentage</Label>
                    <span className="text-lg font-bold text-primary">{savePercent}%</span>
                  </div>
                  <Slider
                    value={[savePercent]}
                    onValueChange={(v) => setSavePercent(v[0])}
                    min={1}
                    max={20}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1%</span>
                    <span>Conservative</span>
                    <span>20%</span>
                  </div>
                  <Card className="glass-card p-3 border-primary/20 bg-primary/5">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        At {savePercent}%, a KES 1,000 spend saves <span className="text-primary font-semibold">KES {(1000 * savePercent / 100).toFixed(0)}</span> automatically
                      </p>
                    </div>
                  </Card>
                </div>

                {/* Allocation Sliders */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Wallet Allocation</Label>
                    <span className={`text-xs font-semibold ${totalAllocation === 100 ? "text-success" : "text-destructive"}`}>
                      {totalAllocation}% / 100%
                    </span>
                  </div>
                  {walletCategories.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <div key={cat.key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`p-1 rounded-full ${cat.bg}`}>
                              <Icon className={`h-3 w-3 ${cat.color}`} />
                            </div>
                            <span className="text-sm text-foreground">{cat.name}</span>
                          </div>
                          <span className="text-sm font-semibold text-foreground">{allocation[cat.key]}%</span>
                        </div>
                        <Slider
                          value={[allocation[cat.key]]}
                          onValueChange={(v) => updateAllocation(cat.key, v[0])}
                          min={0}
                          max={100}
                          step={5}
                          className="w-full"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Extra Options */}
                <div className="space-y-3">
                  <Card className="glass-card p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Round-Up Savings</p>
                        <p className="text-xs text-muted-foreground">Round transactions up to nearest 100</p>
                      </div>
                      <Switch checked={roundUp} onCheckedChange={setRoundUp} />
                    </div>
                  </Card>
                  <Card className="glass-card p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Salary Boost</p>
                        <p className="text-xs text-muted-foreground">Save 10% extra on salary deposits</p>
                      </div>
                      <Switch checked={autoBoost} onCheckedChange={setAutoBoost} />
                    </div>
                  </Card>
                </div>
              </>
            )}

            <Button onClick={handleSave} className="w-full button-3d" disabled={enabled && totalAllocation !== 100}>
              Save Configuration
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 text-center py-4">
            <CheckCircle className="h-16 w-16 text-success mx-auto" />
            <div>
              <h3 className="text-lg font-bold text-foreground">Configuration Saved!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {enabled
                  ? `${savePercent}% of every spend will be automatically saved`
                  : "Save-As-You-Spend has been paused"}
              </p>
            </div>
            {enabled && (
              <Card className="glass-card p-4 text-left space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Allocation Breakdown</p>
                {walletCategories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <div key={cat.key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${cat.color}`} />
                        <span className="text-sm text-foreground">{cat.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{allocation[cat.key]}%</span>
                    </div>
                  );
                })}
                {roundUp && <p className="text-xs text-success mt-2">✓ Round-up savings active</p>}
                {autoBoost && <p className="text-xs text-success">✓ Salary boost active</p>}
              </Card>
            )}
            <div className="flex gap-3">
              <Button onClick={() => setStep(1)} variant="outline" className="flex-1">Edit</Button>
              <Button onClick={() => { setStep(1); onOpenChange(false); }} className="flex-1 button-3d">Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
