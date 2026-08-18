import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { CreditCard, Shield, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LinkCardFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinkCardFlow({ open, onOpenChange }: LinkCardFlowProps) {
  const [step, setStep] = useState(1);
  const [cardData, setCardData] = useState({ number: "", expiry: "", cvv: "", name: "", type: "", country: "" });
  const { toast } = useToast();

  const handleNext = () => { if (step < 3) setStep(step + 1); };
  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const handleComplete = () => {
    toast({ title: "Card Linked Successfully", description: "Your international card is now linked to your Rukisha wallet" });
    onOpenChange(false);
    setStep(1);
    setCardData({ number: "", expiry: "", cvv: "", name: "", type: "", country: "" });
  };

  const formatCardNumber = (value: string) => value.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-glass-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2"><Globe className="h-5 w-5" />Link International Card</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <CreditCard className="h-16 w-16 mx-auto text-primary mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Diaspora Card Linking</h3>
              <p className="text-muted-foreground mb-6">Link your international Visa/Mastercard for global transactions</p>
            </div>
            <div className="space-y-4">
              <div><Label>Card Number</Label><Input placeholder="1234 5678 9012 3456" value={cardData.number}
                onChange={(e) => setCardData({...cardData, number: formatCardNumber(e.target.value)})} maxLength={19} className="glass-card font-mono" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Expiry Date</Label><Input placeholder="MM/YY" value={cardData.expiry}
                  onChange={(e) => setCardData({...cardData, expiry: e.target.value})} maxLength={5} className="glass-card font-mono" /></div>
                <div><Label>CVV</Label><Input placeholder="123" value={cardData.cvv}
                  onChange={(e) => setCardData({...cardData, cvv: e.target.value})} maxLength={4} type="password" className="glass-card font-mono" /></div>
              </div>
              <div><Label>Cardholder Name</Label><Input placeholder="JOHN KIPROTICH" value={cardData.name}
                onChange={(e) => setCardData({...cardData, name: e.target.value.toUpperCase()})} className="glass-card" /></div>
            </div>
            <Button onClick={handleNext} className="w-full button-3d" disabled={!cardData.number || !cardData.expiry || !cardData.cvv || !cardData.name}>Continue</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>Card Type</Label>
              <Select value={cardData.type} onValueChange={(value) => setCardData({...cardData, type: value})}>
                <SelectTrigger className="glass-card"><SelectValue placeholder="Select card type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="visa">Visa</SelectItem>
                  <SelectItem value="mastercard">Mastercard</SelectItem>
                  <SelectItem value="amex">American Express</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Issuing Country</Label>
              <Select value={cardData.country} onValueChange={(value) => setCardData({...cardData, country: value})}>
                <SelectTrigger className="glass-card"><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="us">United States</SelectItem>
                  <SelectItem value="uk">United Kingdom</SelectItem>
                  <SelectItem value="ca">Canada</SelectItem>
                  <SelectItem value="au">Australia</SelectItem>
                  <SelectItem value="de">Germany</SelectItem>
                  <SelectItem value="ae">UAE</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Card className="glass-card p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground mb-1">Security Notice</p>
                  <p className="text-muted-foreground">Your card details are encrypted and securely stored. We comply with international PCI DSS standards.</p>
                </div>
              </div>
            </Card>
            <div className="flex gap-3">
              <Button onClick={handleBack} variant="outline" className="flex-1">Back</Button>
              <Button onClick={handleNext} className="flex-1 button-3d" disabled={!cardData.type || !cardData.country}>Verify Card</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="glass-card p-4 space-y-3">
              <h3 className="font-semibold text-foreground">Card Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Card Number:</span><span className="text-foreground font-mono">•••• •••• •••• {cardData.number.slice(-4)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Cardholder:</span><span className="text-foreground">{cardData.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Type:</span><span className="text-foreground capitalize">{cardData.type}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Country:</span><span className="text-foreground">{cardData.country.toUpperCase()}</span></div>
              </div>
            </div>
            <div className="glass-card p-4 bg-success/10 border-success/20">
              <div className="flex items-center gap-2 text-success text-sm">
                <Shield className="h-4 w-4" /><span className="font-medium">Card Verified Successfully</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Your card can now be used for international transactions and remittances</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleBack} variant="outline" className="flex-1">Back</Button>
              <Button onClick={handleComplete} className="flex-1 button-3d">Link Card</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
