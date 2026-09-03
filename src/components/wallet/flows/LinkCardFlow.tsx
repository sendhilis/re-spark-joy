/**
 * LinkCardFlow — international card linking.
 *
 * The card-capture step is now Mastercard's hosted session (see HostedCardSession):
 * PAN, expiry and CVV are submitted straight to the gateway and never enter React state.
 * The wallet only receives a masked summary, and only a token reference + masked PAN is
 * persisted by the mc-card-link edge function. PCI DSS scope: SAQ A.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { CreditCard, Shield, Globe, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { HostedCardSession, type CardSummary } from "../HostedCardSession";

interface LinkCardFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinkCardFlow({ open, onOpenChange }: LinkCardFlowProps) {
  const [step, setStep] = useState(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [captured, setCaptured] = useState<{ sessionId: string; sessionBlob: string; summary: CardSummary } | null>(null);
  const [country, setCountry] = useState("");
  const [linking, setLinking] = useState(false);
  const [linked, setLinked] = useState<any>(null);
  const { toast } = useToast();

  const startSession = async () => {
    const { data, error } = await supabase.functions.invoke("mc-card-link", { body: { action: "create_session" } });
    if (error || data?.error) {
      toast({ title: "Secure session unavailable", description: data?.error ?? error?.message, variant: "destructive" });
      return;
    }
    setSessionId(data.session_id);
  };

  useEffect(() => {
    if (open) { setStep(1); setCaptured(null); setLinked(null); setCountry(""); startSession(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleVerify = async () => {
    if (!captured) return;
    setLinking(true);
    const { data, error } = await supabase.functions.invoke("mc-card-link", {
      body: {
        action: "confirm_link",
        session_id: captured.sessionId,
        session_blob: captured.sessionBlob,
        issuer_country: country.toUpperCase(),
        policy: "EMI_ONLY",
        cap_amount: 50000,
      },
    });
    setLinking(false);
    if (error || data?.error) {
      toast({
        title: data?.error === "verification_declined" ? "Issuer declined the card" : "Linking failed",
        description: data?.gateway_code ?? data?.error ?? error?.message,
        variant: "destructive",
      });
      await startSession();
      setCaptured(null);
      setStep(1);
      return;
    }
    setLinked(data);
    setStep(3);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-glass-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2"><Globe className="h-5 w-5" />Link International Card</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-5">
            <div className="text-center">
              <CreditCard className="h-14 w-14 mx-auto text-primary mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-1">Diaspora Card Linking</h3>
              <p className="text-sm text-muted-foreground">Card details are captured by Mastercard's hosted session, not by Rukisha</p>
            </div>
            {captured ? (
              <div className="space-y-4">
                <Card className="glass-card p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Scheme</span><span className="text-foreground">{captured.summary.scheme}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Masked PAN</span><span className="font-mono text-foreground">{captured.summary.number}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Expiry</span><span className="font-mono text-foreground">{String(captured.summary.expiry.month).padStart(2, "0")}/{String(captured.summary.expiry.year).slice(-2)}</span></div>
                </Card>
                <Button onClick={() => setStep(2)} className="w-full button-3d">Continue</Button>
              </div>
            ) : (
              <HostedCardSession sessionId={sessionId} onCaptured={setCaptured} />
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>Issuing Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="glass-card"><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ae">United Arab Emirates</SelectItem>
                  <SelectItem value="sa">Saudi Arabia</SelectItem>
                  <SelectItem value="qa">Qatar</SelectItem>
                  <SelectItem value="gb">United Kingdom</SelectItem>
                  <SelectItem value="us">United States</SelectItem>
                  <SelectItem value="ca">Canada</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Card className="glass-card p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground mb-1">How this is secured</p>
                  <p className="text-muted-foreground">
                    Verification runs as a zero-value check with EMV 3-D Secure at your issuer. Rukisha stores only a
                    Mastercard token reference and the masked card number — never the card number or security code.
                  </p>
                </div>
              </div>
            </Card>
            <div className="flex gap-3">
              <Button onClick={() => setStep(1)} variant="outline" className="flex-1">Back</Button>
              <Button onClick={handleVerify} className="flex-1 button-3d" disabled={!country || linking}>
                {linking ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying…</> : "Verify Card"}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && linked && (
          <div className="space-y-4">
            <div className="glass-card p-4 space-y-3">
              <h3 className="font-semibold text-foreground">Card Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Card Number:</span><span className="text-foreground font-mono">{linked.card.masked_pan}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Scheme:</span><span className="text-foreground">{linked.card.scheme}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Expiry:</span><span className="text-foreground font-mono">{linked.card.expiry}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Network token:</span><span className="text-foreground font-mono text-xs break-all">{linked.token.mdes_token_id}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Standing instruction:</span><span className="text-foreground font-mono text-xs break-all">{linked.token.agreement_id}</span></div>
              </div>
            </div>
            <div className="glass-card p-4 bg-success/10 border-success/20">
              <div className="flex items-center gap-2 text-success text-sm">
                <Shield className="h-4 w-4" /><span className="font-medium">Card verified with 3-D Secure</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Your salary-day sweep mandate is active. Open “Salary-Day Repayment” to adjust, pause or cancel it.
              </p>
            </div>
            <Button onClick={() => { onOpenChange(false); toast({ title: "Card linked", description: "Your card is linked to your Rukisha wallet" }); }} className="w-full button-3d">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
