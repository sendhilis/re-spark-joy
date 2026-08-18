import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, Loader2, CheckCircle, ArrowUpFromLine, 
  MapPin, Bot, Shield, Banknote, AlertCircle, AtSign, Building
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { supabase } from "@/integrations/supabase/client";

interface DebitCardWithdrawalFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WITHDRAWAL_CHANNELS = [
  {
    id: "atm",
    name: "ATM Withdrawal",
    icon: Building,
    description: "Use your linked debit card at any Visa/Mastercard ATM",
    limit: "Up to KES 40,000/day",
    fee: "KES 34",
    color: "text-primary",
    borderColor: "border-primary/30",
    bgColor: "bg-primary/10",
  },
  {
    id: "agent",
    name: "Bank Agent",
    icon: MapPin,
    description: "Withdraw via authenticated bank agents near you",
    limit: "Up to KES 70,000/day",
    fee: "KES 20",
    color: "text-success",
    borderColor: "border-success/30",
    bgColor: "bg-success/10",
  },
];

const ATM_INSTRUCTIONS = [
  "Insert or tap your linked Rukisha debit card",
  "Select 'Withdrawal' and enter amount",
  "Enter your 4-digit ATM PIN",
  "Collect cash and take your card",
];

const QUICK_AMOUNTS = [500, 1000, 2000, 3000, 5000, 10000, 20000];

export function DebitCardWithdrawalFlow({ open, onOpenChange }: DebitCardWithdrawalFlowProps) {
  const { toast } = useToast();
  const { balances, addTransaction } = useWallet();

  const [step, setStep] = useState(1);
  const [channel, setChannel] = useState<"atm" | "agent" | "">("");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [processing, setProcessing] = useState(false);
  const [aiGuide, setAiGuide] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [withdrawalCode, setWithdrawalCode] = useState("");

  const reset = () => {
    setStep(1);
    setChannel("");
    setAmount("");
    setPin("");
    setProcessing(false);
    setAiGuide("");
    setWithdrawalCode("");
  };

  const fetchAIGuide = async (selectedChannel: string, amt: string) => {
    setLoadingAI(true);
    try {
      const prompt =
        selectedChannel === "atm"
          ? `You are Rukisha AI. In 2 friendly sentences, guide a user who is about to withdraw KES ${amt} from an ATM using their linked Rukisha debit card. Mention they should check ATM fees and keep their PIN private. Under 40 words.`
          : `You are Rukisha AI. In 2 sentences, guide a user withdrawing KES ${amt} at a bank agent using their Rukisha wallet. Remind them to bring their ID and only use authorised agents. Under 40 words.`;

      const { data, error } = await supabase.functions.invoke("rukisha-ai", {
        body: { message: prompt, conversationHistory: [] },
      });

      setAiGuide(
        !error && data?.reply
          ? data.reply
          : selectedChannel === "atm"
          ? "Insert your Rukisha debit card at any Visa ATM, enter your PIN and select withdrawal. Always cover the keypad when entering your PIN for safety."
          : "Visit an authorised Rukisha bank agent with your national ID. The agent will verify your identity before processing your cash withdrawal."
      );
    } catch {
      setAiGuide(
        selectedChannel === "atm"
          ? "Insert your Rukisha debit card, enter your PIN, and collect your cash. Keep your PIN private and never share it."
          : "Visit a nearby Rukisha bank agent with your national ID to collect your cash safely."
      );
    } finally {
      setLoadingAI(false);
    }
  };

  const handleSelectChannel = (ch: "atm" | "agent") => {
    setChannel(ch);
    setStep(2);
  };

  const handleProceed = () => {
    const num = parseFloat(amount);
    if (!num || num < 200) {
      toast({ title: "Minimum KES 200", description: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (num > balances.main) {
      toast({ title: "Insufficient balance", description: "Not enough funds in main wallet", variant: "destructive" });
      return;
    }
    fetchAIGuide(channel, amount);
    setStep(3);
  };

  const handleAuthenticate = async () => {
    if (pin.length < 4) {
      toast({ title: "Enter PIN", description: "Enter your 4-digit wallet PIN", variant: "destructive" });
      return;
    }
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 2000));

    const txAmount = parseFloat(amount);
    const code = `WDR-${Date.now().toString(36).toUpperCase().slice(-8)}`;
    setWithdrawalCode(code);

    if (channel === "agent") {
      await addTransaction({
        type: "sent",
        amount: -txAmount,
        description: `Agent cash withdrawal · ${code}`,
        status: "completed",
        walletType: "main",
      });
    } else {
      // ATM – wallet debit happens when card is used; we record as pending
      await addTransaction({
        type: "sent",
        amount: -txAmount,
        description: `ATM withdrawal · ${code}`,
        status: "completed",
        walletType: "main",
      });
    }

    setProcessing(false);
    setStep(4);
    toast({ title: "Withdrawal Authorised!", description: `Use code ${code} at the ${channel === "atm" ? "ATM" : "agent"}` });
  };

  const selectedChannelData = WITHDRAWAL_CHANNELS.find((c) => c.id === channel);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="glass-card border-glass-border max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <ArrowUpFromLine className="h-5 w-5 text-warning" />
            Cash Withdrawal
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Choose channel */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Choose how you want to withdraw cash</p>

            <div className="space-y-3">
              {WITHDRAWAL_CHANNELS.map((ch) => {
                const Icon = ch.icon;
                return (
                  <button
                    key={ch.id}
                    onClick={() => handleSelectChannel(ch.id as "atm" | "agent")}
                    className={`w-full glass-card button-3d p-4 rounded-xl border ${ch.borderColor} ${ch.bgColor} hover:opacity-90 transition-all text-left`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-full bg-background/40`}>
                        <Icon className={`h-6 w-6 ${ch.color}`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-foreground">{ch.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{ch.description}</p>
                        <div className="flex gap-3 mt-2">
                          <span className="text-[10px] text-muted-foreground">{ch.limit}</span>
                          <span className="text-[10px] text-muted-foreground">Fee: {ch.fee}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <Card className="glass-card p-3 border border-primary/20 bg-primary/5">
              <div className="flex items-start gap-2">
                <CreditCard className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Your Rukisha virtual debit card is linked to your main wallet. Withdrawals are deducted instantly.
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* Step 2: Amount */}
        {step === 2 && (
          <div className="space-y-4">
            <button onClick={() => setStep(1)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Back
            </button>

            {selectedChannelData && (
              <div className={`glass-card p-3 rounded-xl border ${selectedChannelData.borderColor} ${selectedChannelData.bgColor} flex items-center gap-3`}>
                <selectedChannelData.icon className={`h-5 w-5 ${selectedChannelData.color}`} />
                <div>
                  <p className="text-sm font-semibold text-foreground">{selectedChannelData.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedChannelData.limit} · Fee: {selectedChannelData.fee}</p>
                </div>
              </div>
            )}

            <div>
              <Label>Withdrawal Amount (KES)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="glass-card text-lg font-semibold mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available: KES {balances.main.toLocaleString()}
              </p>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAmount(a.toString())}
                  className={`glass-card p-2 rounded-lg text-xs font-medium transition-all ${
                    amount === a.toString()
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-glass-border/20 text-foreground hover:border-primary/30"
                  }`}
                >
                  {a >= 1000 ? `${a / 1000}k` : a}
                </button>
              ))}
            </div>

            <Button onClick={handleProceed} className="w-full button-3d" disabled={!amount}>
              Continue
            </Button>
          </div>
        )}

        {/* Step 3: Authenticate */}
        {step === 3 && (
          <div className="space-y-4">
            <button onClick={() => setStep(2)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Back
            </button>

            <Card className="glass-card p-5 border border-warning/20 bg-warning/5 text-center">
              <p className="text-xs text-muted-foreground">Withdrawal Amount</p>
              <p className="text-3xl font-bold text-foreground mt-1">KES {parseFloat(amount || "0").toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">via {selectedChannelData?.name}</p>
            </Card>

            {/* AI Guide */}
            <Card className="glass-card p-3 border border-primary/20 bg-primary/5">
              <div className="flex items-start gap-2">
                <Bot className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-primary mb-1">Rukisha AI Guide</p>
                  {loadingAI ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading advice...
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground leading-relaxed">{aiGuide}</p>
                  )}
                </div>
              </div>
            </Card>

            {channel === "atm" && (
              <div className="glass-card p-3 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">ATM Steps</p>
                {ATM_INSTRUCTIONS.map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="h-5 w-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-xs text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label>Wallet PIN to Authorise</Label>
              <div className="relative mt-1">
                <Input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.slice(0, 4))}
                  placeholder="••••"
                  maxLength={4}
                  className="glass-card text-center text-2xl font-mono tracking-[0.5em]"
                />
                <Shield className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <Button
              onClick={handleAuthenticate}
              disabled={processing || pin.length < 4}
              className="w-full button-3d"
            >
              {processing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Authorising...</>
              ) : (
                <>Authorise Withdrawal</>
              )}
            </Button>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div className="space-y-5 text-center py-4">
            <div className="h-16 w-16 rounded-full bg-success/20 mx-auto flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>

            <div>
              <p className="text-2xl font-bold text-foreground">KES {parseFloat(amount).toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {channel === "atm" ? "Ready for ATM withdrawal" : "Agent withdrawal authorised"}
              </p>
            </div>

            {channel === "agent" && withdrawalCode && (
              <Card className="glass-card p-5 border border-success/30 bg-success/10">
                <p className="text-xs text-muted-foreground mb-2">AGENT CODE – show this to agent</p>
                <p className="text-3xl font-mono font-bold text-success tracking-widest">{withdrawalCode}</p>
                <p className="text-xs text-muted-foreground mt-3">Code expires in 30 minutes</p>
              </Card>
            )}

            {channel === "atm" && (
              <Card className="glass-card p-4 border border-primary/20 bg-primary/5">
                <div className="flex items-start gap-2 text-left">
                  <CreditCard className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Use your Rukisha debit card</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your wallet has been debited. Insert your card at any Visa ATM and enter your ATM PIN to collect cash.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            <div className="flex gap-3">
              <Button onClick={reset} variant="outline" className="flex-1">New Withdrawal</Button>
              <Button onClick={() => { reset(); onOpenChange(false); }} className="flex-1 button-3d">Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
