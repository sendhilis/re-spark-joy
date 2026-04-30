import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { Store, ArrowRight, CheckCircle2, Loader2, Network, Building2 } from "lucide-react";

type Merchant = {
  id: string;
  merchant_name: string;
  till_code: string;
  lipafo_code: string;
  settlement_bank: string;
  category: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fmtKES = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);

export function LipafoPayFlow({ open, onOpenChange }: Props) {
  const { balances, addTransaction } = useWallet();
  const [step, setStep] = useState<"select" | "amount" | "confirm" | "processing" | "done">("select");
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selected, setSelected] = useState<Merchant | null>(null);
  const [amount, setAmount] = useState("");
  const [trace, setTrace] = useState<{ ref: string; positionId?: string; dispatchId?: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("select"); setSelected(null); setAmount(""); setTrace(null);
    supabase.from("merchants").select("id,merchant_name,till_code,lipafo_code,settlement_bank,category")
      .eq("status", "active").order("merchant_name").limit(20)
      .then(({ data }) => { if (data) setMerchants(data as Merchant[]); });
  }, [open]);

  const submit = async () => {
    if (!selected || !amount) return;
    const amt = Number(amount);
    if (amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (amt > balances.main) { toast.error("Insufficient main wallet balance"); return; }

    setStep("processing");
    try {
      const ref = `LPF-P2M-${Date.now()}`;
      const today = new Date().toISOString().slice(0, 10);
      const cutoff = new Date(); cutoff.setHours(13, 0, 0, 0);
      const dispatchAt = new Date(cutoff); dispatchAt.setDate(dispatchAt.getDate() + 1);

      // 1) Debit Jane's main wallet
      await addTransaction({
        type: "qr_payment",
        amount: -amt,
        description: `LipafoPay → ${selected.merchant_name} (Till ${selected.till_code})`,
        recipient: selected.merchant_name,
        status: "completed",
        walletType: "main",
      });

      // 2) Reflect the exact transaction in the Settlement Engine.
      // Lipafo OWES the merchant's bank → outbound from KCB pool, inbound for Co-op.
      // Find or create today's position row for this beneficiary bank.
      const { data: existing } = await supabase
        .from("settlement_positions")
        .select("*")
        .eq("position_date", today)
        .eq("participating_bank", selected.settlement_bank)
        .maybeSingle();

      let positionId = existing?.id as string | undefined;

      if (existing) {
        const newInbound = Number(existing.inbound_volume) + amt; // bank receives
        const newCount = (existing.transaction_count || 0) + 1;
        const newNet = newInbound - Number(existing.outbound_volume);
        await supabase.from("settlement_positions").update({
          inbound_volume: newInbound,
          transaction_count: newCount,
          net_position: newNet,
        }).eq("id", existing.id);
      } else {
        const { data: ins } = await supabase.from("settlement_positions").insert({
          position_date: today,
          participating_bank: selected.settlement_bank,
          inbound_volume: amt,
          outbound_volume: 0,
          net_position: amt,
          transaction_count: 1,
          cutoff_at: cutoff.toISOString(),
          status: "pending",
        }).select().single();
        positionId = ins?.id;
      }

      // 3) T+1 dispatch entry — KCB pool will pay Co-op the net (we record this leg)
      const floatRev = Math.round(amt * 0.0002);
      const { data: disp } = await supabase.from("settlement_dispatches").insert({
        position_id: positionId,
        beneficiary_bank: selected.settlement_bank,
        amount: amt,
        scheduled_at: dispatchAt.toISOString(),
        reference: ref,
        status: "scheduled",
        float_revenue: floatRev,
      }).select().single();

      setTrace({ ref, positionId, dispatchId: disp?.id });
      setStep("done");
      toast.success("Paid via Lipafo switch");
    } catch (e) {
      toast.error(`Payment failed: ${(e as Error).message}`);
      setStep("confirm");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" /> LipafoPay — Pay any merchant
          </DialogTitle>
          <DialogDescription>
            Wallet → Lipafo Switch → Merchant Bank. Recorded in EOD net positions.
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Choose a merchant (sample includes Co-operative Bank tills):</p>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {merchants.map((m) => (
                <Card key={m.id}
                  onClick={() => { setSelected(m); setStep("amount"); }}
                  className="glass-card p-3 cursor-pointer hover:border-primary/50 transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/15"><Store className="h-4 w-4 text-primary" /></div>
                      <div>
                        <p className="font-medium text-sm text-foreground">{m.merchant_name}</p>
                        <p className="text-xs text-muted-foreground">Till {m.till_code} · {m.category}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      <Building2 className="h-3 w-3 mr-1" />{m.settlement_bank}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {step === "amount" && selected && (
          <div className="space-y-4">
            <Card className="glass-card p-3">
              <p className="text-sm font-medium text-foreground">{selected.merchant_name}</p>
              <p className="text-xs text-muted-foreground">Till {selected.till_code} · Settles to {selected.settlement_bank}</p>
            </Card>
            <div>
              <Label>Amount (KES)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2,500" />
              <p className="text-xs text-muted-foreground mt-1">Available: {fmtKES(balances.main)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("select")}>Back</Button>
              <Button className="flex-1 button-3d" onClick={() => setStep("confirm")} disabled={!amount}>
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === "confirm" && selected && (
          <div className="space-y-4">
            <Card className="glass-card p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Merchant</span><span className="font-medium">{selected.merchant_name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Till</span><span className="font-mono">{selected.till_code}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Merchant bank</span><span>{selected.settlement_bank}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-bold text-lg text-primary">{fmtKES(Number(amount))}</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Switch fee</span><span className="text-success">Free (Lipafo on-us)</span></div>
            </Card>
            <Card className="glass-card p-3 bg-primary/5">
              <p className="text-xs text-muted-foreground">Trace: Lipafo wallet → Lipafo Switch (till alias lookup) → KCB pool → T+1 net dispatch to {selected.settlement_bank}.</p>
            </Card>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("amount")}>Back</Button>
              <Button className="flex-1 button-3d" onClick={submit}>Confirm & Pay</Button>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="py-10 flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Routing through Lipafo switch…</p>
          </div>
        )}

        {step === "done" && selected && trace && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-2">
              <CheckCircle2 className="h-12 w-12 text-success" />
              <p className="font-semibold text-foreground">Payment successful</p>
              <p className="text-2xl font-bold text-primary">{fmtKES(Number(amount))}</p>
              <p className="text-xs text-muted-foreground">to {selected.merchant_name}</p>
            </div>
            <Card className="glass-card p-3 space-y-1.5 text-xs">
              <p className="font-semibold text-foreground mb-1">Settlement Engine trace</p>
              <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-mono">{trace.ref}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Position bank</span><span>{selected.settlement_bank}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Inbound (to bank)</span><span className="text-success">+{fmtKES(Number(amount))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Dispatch (T+1)</span><Badge variant="outline" className="text-[10px]">scheduled</Badge></div>
              <Separator className="my-1" />
              <p className="text-muted-foreground">Admins can view this in <strong>Admin → Settlement</strong>.</p>
            </Card>
            <Button className="w-full button-3d" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
