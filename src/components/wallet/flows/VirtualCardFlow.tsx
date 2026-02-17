import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { CreditCard, Eye, EyeOff, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VirtualCardFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VirtualCardFlow({ open, onOpenChange }: VirtualCardFlowProps) {
  const [step, setStep] = useState(1);
  const [showDetails, setShowDetails] = useState(false);
  const [cardData] = useState({ number: "5234 5678 9012 3456", cvv: "123", expiry: "12/28", name: "JOHN KIPROTICH" });
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
  };

  const generateCard = () => {
    setStep(2);
    toast({ title: "Virtual Card Created", description: "Your virtual card is ready for online payments" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-glass-border">
        <DialogHeader><DialogTitle className="text-foreground">Virtual Card</DialogTitle></DialogHeader>

        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <CreditCard className="h-20 w-20 mx-auto text-primary mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Create Virtual Card</h3>
              <p className="text-muted-foreground mb-6">Generate a virtual card for secure online payments</p>
            </div>
            <div className="space-y-4">
              <div><Label>Cardholder Name</Label><Input defaultValue="John Kiprotich" className="glass-card" /></div>
              <div><Label>Load Amount (KES)</Label><Input type="number" placeholder="1000" className="glass-card" /></div>
              <div><Label>Purpose (Optional)</Label><Input placeholder="Online shopping, subscriptions, etc." className="glass-card" /></div>
            </div>
            <Button onClick={generateCard} className="w-full button-3d">Create Virtual Card</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="relative">
              <Card className="glass-card p-6 bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="text-xs text-primary font-semibold">RUKISHA VIRTUAL</div>
                    <div className="text-xs text-muted-foreground">MASTERCARD</div>
                  </div>
                  <div className="py-4">
                    <div className="text-lg font-mono tracking-wider text-foreground">
                      {showDetails ? cardData.number : "•••• •••• •••• 3456"}
                    </div>
                  </div>
                  <div className="flex justify-between items-end">
                    <div><div className="text-xs text-muted-foreground uppercase">Cardholder</div><div className="text-sm font-semibold text-foreground">{cardData.name}</div></div>
                    <div className="text-right"><div className="text-xs text-muted-foreground uppercase">Expires</div><div className="text-sm font-semibold text-foreground">{cardData.expiry}</div></div>
                  </div>
                </div>
              </Card>
              <Button onClick={() => setShowDetails(!showDetails)} variant="ghost" size="sm" className="absolute top-2 right-2">
                {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>

            {showDetails && (
              <div className="space-y-3">
                <div className="flex items-center justify-between glass-card p-3 rounded-lg">
                  <div><div className="text-xs text-muted-foreground">Card Number</div><div className="text-sm font-mono">{cardData.number}</div></div>
                  <Button onClick={() => copyToClipboard(cardData.number.replace(/\s/g, ''), 'Card number')} variant="ghost" size="sm"><Copy className="h-4 w-4" /></Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between glass-card p-3 rounded-lg">
                    <div><div className="text-xs text-muted-foreground">CVV</div><div className="text-sm font-mono">{cardData.cvv}</div></div>
                    <Button onClick={() => copyToClipboard(cardData.cvv, 'CVV')} variant="ghost" size="sm"><Copy className="h-3 w-3" /></Button>
                  </div>
                  <div className="flex items-center justify-between glass-card p-3 rounded-lg">
                    <div><div className="text-xs text-muted-foreground">Expiry</div><div className="text-sm font-mono">{cardData.expiry}</div></div>
                    <Button onClick={() => copyToClipboard(cardData.expiry, 'Expiry date')} variant="ghost" size="sm"><Copy className="h-3 w-3" /></Button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={() => setStep(1)} variant="outline" className="flex-1">Create Another</Button>
              <Button onClick={() => onOpenChange(false)} className="flex-1 button-3d">Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
