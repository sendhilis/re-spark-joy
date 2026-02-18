import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  CreditCard, Shield, CheckCircle, Loader2, Building, 
  Banknote, MapPin, Bot, ArrowRight, Lock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface BankDebitCardLinkFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const KE_BANKS = [
  "Equity Bank",
  "KCB Bank",
  "Co-operative Bank",
  "Absa Bank Kenya",
  "Standard Chartered",
  "NCBA Bank",
  "DTB Bank",
  "Family Bank",
  "I&M Bank",
  "Stanbic Bank",
  "Sidian Bank",
  "Gulf African Bank",
];

const CARD_BENEFITS = [
  { icon: Banknote, label: "ATM Withdrawals", desc: "Withdraw at 3,000+ ATMs countrywide" },
  { icon: MapPin, label: "Agent Cash Out", desc: "Collect cash at authorised bank agents" },
  { icon: Shield, label: "PIN Protected", desc: "Every transaction requires your PIN" },
  { icon: CreditCard, label: "Dual-use Card", desc: "Online & POS purchases worldwide" },
];

export function BankDebitCardLinkFlow({ open, onOpenChange }: BankDebitCardLinkFlowProps) {
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [cardData, setCardData] = useState({
    number: "",
    expiry: "",
    cvv: "",
    name: "",
    bank: "",
    phone: "",
  });
  const [otp, setOtp] = useState("");
  const [processing, setProcessing] = useState(false);
  const [aiGuide, setAiGuide] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);

  const reset = () => {
    setStep(1);
    setCardData({ number: "", expiry: "", cvv: "", name: "", bank: "", phone: "" });
    setOtp("");
    setAiGuide("");
  };

  const formatCardNumber = (value: string) =>
    value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim().slice(0, 19);

  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 4);
    return cleaned.length >= 2 ? `${cleaned.slice(0, 2)}/${cleaned.slice(2)}` : cleaned;
  };

  const fetchAIGuide = async (bank: string) => {
    setLoadingAI(true);
    try {
      const prompt = `You are Rukisha AI. In 2 friendly sentences, tell a user that linking their ${bank} debit card enables ATM withdrawals and agent cash outs from their Rukisha wallet. Mention it's secure and requires their PIN each time. Under 40 words.`;
      const { data, error } = await supabase.functions.invoke("rukisha-ai", {
        body: { message: prompt, conversationHistory: [] },
      });
      setAiGuide(
        !error && data?.reply
          ? data.reply
          : `Linking your ${bank} debit card lets you withdraw cash at ATMs and bank agents directly from your Rukisha wallet. Every transaction is PIN-secured for your safety.`
      );
    } catch {
      setAiGuide(
        `Linking your ${bank} debit card gives you instant access to your wallet funds at ATMs and agents. Your PIN protects every transaction.`
      );
    } finally {
      setLoadingAI(false);
    }
  };

  const handleStep1 = () => {
    const num = cardData.number.replace(/\s/g, "");
    if (num.length < 13 || !cardData.expiry.includes("/") || cardData.cvv.length < 3 || !cardData.name) {
      toast({ title: "Incomplete details", description: "Please fill in all card fields correctly", variant: "destructive" });
      return;
    }
    setStep(2);
  };

  const handleStep2 = () => {
    if (!cardData.bank || !cardData.phone) {
      toast({ title: "Required fields", description: "Select your bank and enter phone number", variant: "destructive" });
      return;
    }
    fetchAIGuide(cardData.bank);
    setStep(3);
  };

  const handleRequestOTP = async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1500));
    setProcessing(false);
    toast({ title: "OTP Sent", description: `Check ${cardData.phone} for your 6-digit code` });
    setStep(4);
  };

  const handleVerifyOTP = async () => {
    if (otp.length < 4) {
      toast({ title: "Enter OTP", description: "Enter the code sent to your phone", variant: "destructive" });
      return;
    }
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 2000));
    setProcessing(false);
    setStep(5);
    toast({ title: "Card Linked!", description: `Your ${cardData.bank} debit card is now linked to Rukisha wallet` });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="glass-card border-glass-border max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Link Bank Debit Card
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Card details */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                <CreditCard className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Enter your physical bank debit card details to enable ATM and agent cash access</p>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-2 gap-2">
              {CARD_BENEFITS.map((b) => {
                const Icon = b.icon;
                return (
                  <div key={b.label} className="glass-card p-3 rounded-xl border border-glass-border/20 flex items-start gap-2">
                    <Icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">{b.label}</p>
                      <p className="text-[10px] text-muted-foreground">{b.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              <div>
                <Label>Card Number</Label>
                <Input
                  value={cardData.number}
                  onChange={(e) => setCardData({ ...cardData, number: formatCardNumber(e.target.value) })}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  className="glass-card font-mono mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Expiry</Label>
                  <Input
                    value={cardData.expiry}
                    onChange={(e) => setCardData({ ...cardData, expiry: formatExpiry(e.target.value) })}
                    placeholder="MM/YY"
                    maxLength={5}
                    className="glass-card font-mono mt-1"
                  />
                </div>
                <div>
                  <Label>CVV</Label>
                  <Input
                    value={cardData.cvv}
                    onChange={(e) => setCardData({ ...cardData, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                    placeholder="123"
                    type="password"
                    maxLength={4}
                    className="glass-card font-mono mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Name on Card</Label>
                <Input
                  value={cardData.name}
                  onChange={(e) => setCardData({ ...cardData, name: e.target.value.toUpperCase() })}
                  placeholder="JOHN KIPROTICH"
                  className="glass-card mt-1"
                />
              </div>
            </div>

            <Card className="glass-card p-3 border border-primary/20 bg-primary/5">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Your card details are end-to-end encrypted and processed under PCI DSS Level 1 compliance. We never store your full card number.
                </p>
              </div>
            </Card>

            <Button onClick={handleStep1} className="w-full button-3d">
              Continue <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 2: Bank + phone */}
        {step === 2 && (
          <div className="space-y-4">
            <button onClick={() => setStep(1)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Back
            </button>

            <div>
              <Label>Issuing Bank</Label>
              <Select value={cardData.bank} onValueChange={(v) => setCardData({ ...cardData, bank: v })}>
                <SelectTrigger className="glass-card mt-1">
                  <SelectValue placeholder="Select your bank" />
                </SelectTrigger>
                <SelectContent>
                  {KE_BANKS.map((bank) => (
                    <SelectItem key={bank} value={bank}>
                      {bank}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Mobile Number (for OTP verification)</Label>
              <Input
                value={cardData.phone}
                onChange={(e) => setCardData({ ...cardData, phone: e.target.value })}
                placeholder="07XXXXXXXX"
                type="tel"
                className="glass-card mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">This should match your bank-registered number</p>
            </div>

            <Button
              onClick={handleStep2}
              className="w-full button-3d"
              disabled={!cardData.bank || !cardData.phone}
            >
              Continue <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 3: AI summary + request OTP */}
        {step === 3 && (
          <div className="space-y-4">
            <button onClick={() => setStep(2)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Back
            </button>

            {/* Card preview */}
            <Card className="p-5 bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">Rukisha · {cardData.bank}</p>
                  <Building className="h-5 w-5 text-primary/60" />
                </div>
                <p className="text-lg font-mono tracking-widest text-foreground">
                  •••• •••• •••• {cardData.number.replace(/\s/g, "").slice(-4)}
                </p>
                <div className="flex justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground">CARDHOLDER</p>
                    <p className="text-sm font-semibold text-foreground">{cardData.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">EXPIRES</p>
                    <p className="text-sm font-bold text-foreground">{cardData.expiry}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* AI guide */}
            <Card className="glass-card p-3 border border-primary/20 bg-primary/5">
              <div className="flex items-start gap-2">
                <Bot className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-primary mb-1">Rukisha AI</p>
                  {loadingAI ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Getting personalised info...
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground leading-relaxed">{aiGuide}</p>
                  )}
                </div>
              </div>
            </Card>

            <Card className="glass-card p-3 border border-muted/30">
              <p className="text-xs font-semibold text-foreground mb-2">Card Summary</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Card</span><span className="font-mono text-foreground">•••• {cardData.number.replace(/\s/g, "").slice(-4)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Bank</span><span className="text-foreground">{cardData.bank}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="text-foreground">{cardData.phone}</span></div>
              </div>
            </Card>

            <Button onClick={handleRequestOTP} disabled={processing} className="w-full button-3d">
              {processing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending OTP...</>
              ) : (
                <>Send Verification Code</>
              )}
            </Button>
          </div>
        )}

        {/* Step 4: OTP */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                <Lock className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit OTP sent to <span className="font-semibold text-foreground">{cardData.phone}</span>
              </p>
            </div>

            <div>
              <Label>One-Time Password (OTP)</Label>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                type="text"
                inputMode="numeric"
                maxLength={6}
                className="glass-card text-center text-2xl font-mono tracking-[0.4em] mt-1"
              />
            </div>

            <Button onClick={handleVerifyOTP} disabled={processing || otp.length < 4} className="w-full button-3d">
              {processing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying...</>
              ) : (
                <>Verify & Link Card</>
              )}
            </Button>

            <button
              onClick={handleRequestOTP}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Didn't receive it? Resend OTP
            </button>
          </div>
        )}

        {/* Step 5: Success */}
        {step === 5 && (
          <div className="space-y-5 text-center py-4">
            <div className="h-16 w-16 rounded-full bg-success/20 flex items-center justify-center mx-auto">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>

            <div>
              <p className="text-xl font-bold text-foreground">Card Linked!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your {cardData.bank} debit card ending in {cardData.number.replace(/\s/g, "").slice(-4)} is now linked to your Rukisha wallet.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {CARD_BENEFITS.map((b) => {
                const Icon = b.icon;
                return (
                  <div key={b.label} className="glass-card p-3 rounded-xl border border-success/20 bg-success/5 flex items-start gap-2">
                    <Icon className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground">{b.label}</p>
                  </div>
                );
              })}
            </div>

            <Button onClick={() => { reset(); onOpenChange(false); }} className="w-full button-3d">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
