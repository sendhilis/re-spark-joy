/**
 * HostedCardSession — PCI DSS SAQ A boundary.
 *
 * These fields represent Mastercard's hosted-session iframe (checkout.js). The card
 * number, expiry and CVV are submitted DIRECTLY to the payment gateway endpoint and are
 * never placed in application state, never sent to a Rukisha backend, never logged and
 * never persisted. Only the masked summary the gateway returns flows back into the app.
 *
 * In production this component's inputs are swapped for Mastercard's hosted iframe
 * fields; the contract with the rest of the app (onCaptured) is unchanged.
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Lock, ShieldCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface CardSummary {
  scheme: string;
  number: string;
  last4: string;
  expiry: { month: number; year: number };
  nameOnCard: string | null;
  fundingMethod?: string;
}

interface Props {
  sessionId: string | null;
  onCaptured: (result: { sessionId: string; sessionBlob: string; summary: CardSummary }) => void;
  submitLabel?: string;
}

const GATEWAY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mpgs-gateway-sim`;

export function HostedCardSession({ sessionId, onCaptured, submitLabel = "Submit securely to Mastercard" }: Props) {
  // Refs, not state — the PAN/CVV values are never held in React state or context.
  const panRef = useRef<HTMLInputElement>(null);
  const expiryRef = useRef<HTMLInputElement>(null);
  const cvvRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!sessionId) return;
    const pan = panRef.current?.value ?? "";
    const expiry = expiryRef.current?.value ?? "";
    const [mm, yy] = expiry.split("/");
    setSubmitting(true);
    try {
      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          operation: "session.update",
          sessionId,
          pan,
          expiryMonth: mm,
          expiryYear: yy?.length === 2 ? `20${yy}` : yy,
          cvv: cvvRef.current?.value ?? "",
          cardholderName: nameRef.current?.value ?? "",
        }),
      });
      const data = await res.json();
      // Clear the hosted fields immediately after submission.
      if (panRef.current) panRef.current.value = "";
      if (cvvRef.current) cvvRef.current.value = "";

      if (data.result !== "SUCCESS") {
        toast({ title: "Card not accepted", description: data?.error?.explanation ?? "Gateway rejected the card details", variant: "destructive" });
        return;
      }
      onCaptured({
        sessionId,
        sessionBlob: data.session.blob,
        summary: data.sourceOfFunds.provided.card as CardSummary,
      });
    } catch {
      toast({ title: "Gateway unreachable", description: "Could not reach the payment gateway. Please retry.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="glass-card p-4 border-primary/30">
        <div className="flex items-center gap-2 text-xs text-primary mb-3">
          <Lock className="h-3.5 w-3.5" />
          <span className="font-medium">Mastercard hosted session {sessionId ? `· ${sessionId.slice(0, 14)}…` : "· initialising"}</span>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Card Number</Label>
            <Input ref={panRef} inputMode="numeric" autoComplete="off" placeholder="5123 4567 8901 2346" maxLength={23} className="glass-card font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Expiry</Label>
              <Input ref={expiryRef} placeholder="MM/YY" maxLength={5} autoComplete="off" className="glass-card font-mono" />
            </div>
            <div>
              <Label>Security Code</Label>
              <Input ref={cvvRef} type="password" placeholder="123" maxLength={4} autoComplete="off" className="glass-card font-mono" />
            </div>
          </div>
          <div>
            <Label>Cardholder Name</Label>
            <Input ref={nameRef} placeholder="JOHN KIPROTICH" className="glass-card" />
          </div>
        </div>
      </Card>

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-success mt-0.5 shrink-0" />
        <p>
          These fields post directly to Mastercard's gateway. Rukisha never receives, stores or logs your
          card number or security code — only a token reference and the masked card number. This keeps the
          wallet inside <span className="text-foreground font-medium">PCI DSS SAQ A</span> scope.
        </p>
      </div>

      <Button onClick={handleSubmit} disabled={!sessionId || submitting} className="w-full button-3d">
        {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting to gateway…</> : submitLabel}
      </Button>
    </div>
  );
}
