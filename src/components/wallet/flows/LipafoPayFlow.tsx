import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { Store, ArrowRight, CheckCircle2, Loader2, Network, Building2, Smartphone, Wallet, Search, Hash, Globe2, AlertCircle } from "lucide-react";

type Corridor = "on_us" | "papss" | "correspondent";

type Merchant = {
  id: string;
  merchant_name: string;
  till_code: string | null;
  lipafo_code: string;
  lmid: string | null;
  merchant_segment: "bank_linked" | "mobile_only";
  settlement_bank: string;
  contact_phone: string | null;
  category: string;
  country_code: string;
  corridor_type: Corridor;
};

const CORRIDOR_LABEL: Record<Corridor, string> = {
  on_us: "On-Us (Domestic)",
  papss: "PAPSS (Pan-African)",
  correspondent: "Correspondent Banking",
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
  const [segmentTab, setSegmentTab] = useState<"bank_linked" | "mobile_only" | "lipafo_code">("bank_linked");
  const [search, setSearch] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [selected, setSelected] = useState<Merchant | null>(null);
  const [amount, setAmount] = useState("");
  const [trace, setTrace] = useState<{
    ref: string;
    rail: "bank_rail" | "lipafo_internal" | "papss" | "correspondent";
    identifier: string;
    identifierKind: "MSISDN" | "LMID" | "LIPAFO_CODE";
    positionId?: string;
    dispatchId?: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("select"); setSelected(null); setAmount(""); setTrace(null);
    setSearch(""); setCodeInput(""); setCodeError(null);
    supabase.from("merchants")
      .select("id,merchant_name,till_code,lipafo_code,lmid,merchant_segment,settlement_bank,contact_phone,category,country_code,corridor_type")
      .eq("status", "active").order("merchant_name").limit(100)
      .then(({ data }) => { if (data) setMerchants(data as Merchant[]); });
  }, [open]);

  const filtered = merchants
    .filter((m) => segmentTab === "lipafo_code" ? false : m.merchant_segment === segmentTab)
    .filter((m) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        m.merchant_name.toLowerCase().includes(q) ||
        (m.contact_phone || "").includes(q) ||
        (m.lmid || "").toLowerCase().includes(q) ||
        m.lipafo_code.toLowerCase().includes(q)
      );
    });

  const resolveByCode = async () => {
    const code = codeInput.trim().toUpperCase();
    setCodeError(null);
    if (!code) { setCodeError("Enter a Lipafo Code (e.g. LPF-MR-4521)"); return; }
    setResolving(true);
    try {
      const { data, error } = await supabase
        .from("merchants")
        .select("id,merchant_name,till_code,lipafo_code,lmid,merchant_segment,settlement_bank,contact_phone,category,country_code,corridor_type")
        .eq("lipafo_code", code)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      if (!data) { setCodeError("No active merchant found for this Lipafo Code."); return; }
      setSelected(data as Merchant);
      setStep("amount");
    } catch (e) {
      setCodeError((e as Error).message);
    } finally {
      setResolving(false);
    }
  };

  const submit = async () => {
    if (!selected || !amount) return;
    const amt = Number(amount);
    if (amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (amt > balances.main) { toast.error("Insufficient main wallet balance"); return; }

    setStep("processing");
    try {
      const isBank = selected.merchant_segment === "bank_linked";
      const corridor = selected.corridor_type;
      const paidByCode = segmentTab === "lipafo_code";

      // Identifier shown in receipt: prefer Lipafo Code if that was the entry point.
      const identifier = paidByCode
        ? selected.lipafo_code
        : (isBank ? (selected.contact_phone || "") : (selected.lmid || ""));
      const identifierKind: "MSISDN" | "LMID" | "LIPAFO_CODE" = paidByCode
        ? "LIPAFO_CODE"
        : (isBank ? "MSISDN" : "LMID");

      // Rail selection driven by merchant corridor + segment.
      let rail: "bank_rail" | "lipafo_internal" | "papss" | "correspondent";
      if (!isBank) rail = "lipafo_internal";
      else if (corridor === "papss") rail = "papss";
      else if (corridor === "correspondent") rail = "correspondent";
      else rail = "bank_rail";

      const refPrefix =
        rail === "lipafo_internal" ? "P2L" :
        rail === "papss" ? "PAPSS" :
        rail === "correspondent" ? "CORR" : "P2B";
      const ref = `LPF-${refPrefix}-${Date.now()}`;
      const today = new Date().toISOString().slice(0, 10);
      const cutoff = new Date(); cutoff.setHours(13, 0, 0, 0);
      const dispatchAt = new Date(cutoff);
      // Cross-border = T+2; domestic bank = T+1; on-us = instant
      dispatchAt.setDate(dispatchAt.getDate() + (rail === "papss" || rail === "correspondent" ? 2 : 1));

      const beneficiaryKey =
        rail === "lipafo_internal" ? "LIPAFO_WALLET" :
        rail === "papss" ? `PAPSS:${selected.settlement_bank}` :
        rail === "correspondent" ? `CORR:${selected.settlement_bank}` :
        selected.settlement_bank;

      // 1) Debit Jane's main Lipafo wallet
      const descTail = paidByCode ? ` · Code ${selected.lipafo_code}` : "";
      await addTransaction({
        type: "qr_payment",
        amount: -amt,
        description: isBank
          ? `LipafoPay → ${selected.merchant_name} (${identifierKind} ${identifier} · ${selected.settlement_bank})${paidByCode ? "" : descTail}`
          : `LipafoPay → ${selected.merchant_name} (LMID ${selected.lmid})${descTail}`,
        recipient: selected.merchant_name,
        status: "completed",
        walletType: "main",
      });

      let positionId: string | undefined;
      let dispatchId: string | undefined;

      if (rail === "lipafo_internal") {
        // On-us: instant credit, recorded against LIPAFO_WALLET pool
        const { data: existing } = await supabase
          .from("settlement_positions")
          .select("*")
          .eq("position_date", today)
          .eq("participating_bank", "LIPAFO_WALLET")
          .maybeSingle();

        if (existing) {
          const newInbound = Number(existing.inbound_volume) + amt;
          await supabase.from("settlement_positions").update({
            inbound_volume: newInbound,
            transaction_count: (existing.transaction_count || 0) + 1,
            net_position: newInbound - Number(existing.outbound_volume),
          }).eq("id", existing.id);
          positionId = existing.id;
        } else {
          const { data: ins } = await supabase.from("settlement_positions").insert({
            position_date: today, participating_bank: "LIPAFO_WALLET",
            inbound_volume: amt, outbound_volume: 0, net_position: amt,
            transaction_count: 1, cutoff_at: cutoff.toISOString(), status: "settled",
          }).select().single();
          positionId = ins?.id;
        }

        const { data: disp } = await supabase.from("settlement_dispatches").insert({
          position_id: positionId, beneficiary_bank: "LIPAFO_WALLET", amount: amt,
          scheduled_at: new Date().toISOString(), dispatched_at: new Date().toISOString(),
          reference: ref, status: "dispatched", float_revenue: 0,
        }).select().single();
        dispatchId = disp?.id;
      } else {
        // Bank rail / PAPSS / Correspondent — net position + scheduled dispatch
        const { data: existing } = await supabase
          .from("settlement_positions")
          .select("*")
          .eq("position_date", today)
          .eq("participating_bank", beneficiaryKey)
          .maybeSingle();

        if (existing) {
          const newInbound = Number(existing.inbound_volume) + amt;
          await supabase.from("settlement_positions").update({
            inbound_volume: newInbound,
            transaction_count: (existing.transaction_count || 0) + 1,
            net_position: newInbound - Number(existing.outbound_volume),
          }).eq("id", existing.id);
          positionId = existing.id;
        } else {
          const { data: ins } = await supabase.from("settlement_positions").insert({
            position_date: today, participating_bank: beneficiaryKey,
            inbound_volume: amt, outbound_volume: 0, net_position: amt,
            transaction_count: 1, cutoff_at: cutoff.toISOString(), status: "pending",
          }).select().single();
          positionId = ins?.id;
        }

        // Float = 2 bps domestic, 5 bps cross-border (held longer)
        const floatBps = rail === "bank_rail" ? 0.0002 : 0.0005;
        const { data: disp } = await supabase.from("settlement_dispatches").insert({
          position_id: positionId, beneficiary_bank: beneficiaryKey, amount: amt,
          scheduled_at: dispatchAt.toISOString(), reference: ref, status: "scheduled",
          float_revenue: Math.round(amt * floatBps),
        }).select().single();
        dispatchId = disp?.id;
      }

      setTrace({ ref, rail, identifier, identifierKind, positionId, dispatchId });
      setStep("done");
      toast.success(
        rail === "lipafo_internal" ? "Paid instantly to LMID merchant" :
        rail === "papss" ? "Routed via PAPSS · settles T+2" :
        rail === "correspondent" ? "Routed via correspondent bank · settles T+2" :
        "Paid to bank merchant · settles T+1"
      );
    } catch (e) {
      toast.error(`Payment failed: ${(e as Error).message}`);
      setStep("confirm");
    }
  };

  const isBank = selected?.merchant_segment === "bank_linked";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" /> LipafoPay
          </DialogTitle>
          <DialogDescription>
            Pay by mobile (bank-linked), LMID (mobile-only), or universal Lipafo Code — works across corridors. No M-PESA in the loop.
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-3">
            <Tabs value={segmentTab} onValueChange={(v) => { setSegmentTab(v as any); setCodeError(null); }}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="bank_linked" className="gap-1.5 text-xs">
                  <Building2 className="h-3.5 w-3.5" /> Bank
                </TabsTrigger>
                <TabsTrigger value="mobile_only" className="gap-1.5 text-xs">
                  <Smartphone className="h-3.5 w-3.5" /> LMID
                </TabsTrigger>
                <TabsTrigger value="lipafo_code" className="gap-1.5 text-xs">
                  <Hash className="h-3.5 w-3.5" /> Lipafo Code
                </TabsTrigger>
              </TabsList>

              {segmentTab !== "lipafo_code" && (
                <div className="mt-3 relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder={segmentTab === "bank_linked" ? "Search by name or mobile…" : "Search by name or LMID…"}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              )}

              <TabsContent value="bank_linked" className="mt-3">
                <p className="text-xs text-muted-foreground mb-2">
                  Identifier = <strong>mobile number</strong>. Funds settle to the merchant's bank via the Lipafo switch (T+1 net). No M-PESA.
                </p>
              </TabsContent>
              <TabsContent value="mobile_only" className="mt-3">
                <p className="text-xs text-muted-foreground mb-2">
                  No bank account → Lipafo issues a <strong>LMID</strong>. Funds credit the merchant's Lipafo wallet instantly (on-us).
                </p>
              </TabsContent>
              <TabsContent value="lipafo_code" className="mt-3 space-y-3">
                <div className="p-3 rounded-md border border-primary/30 bg-primary/5">
                  <p className="text-xs text-foreground font-semibold flex items-center gap-1.5 mb-1">
                    <Globe2 className="h-3.5 w-3.5 text-primary" /> Universal merchant address
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    The Lipafo Code works the same way across <strong>domestic</strong>, <strong>PAPSS</strong>, and <strong>correspondent</strong> corridors.
                    Lipafo automatically routes to the right rail (MSISDN→bank, LMID→on-us, or cross-border partner bank).
                  </p>
                </div>
                <div>
                  <Label className="text-xs">Enter Lipafo Code</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={codeInput}
                      onChange={(e) => { setCodeInput(e.target.value); setCodeError(null); }}
                      placeholder="LPF-MR-4521 · LPF-PA-NG-031 · LPF-CB-GB-007"
                      className="font-mono"
                      onKeyDown={(e) => { if (e.key === "Enter") resolveByCode(); }}
                    />
                    <Button onClick={resolveByCode} disabled={resolving || !codeInput.trim()} className="button-3d shrink-0">
                      {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Resolve <ArrowRight className="h-4 w-4 ml-1" /></>}
                    </Button>
                  </div>
                  {codeError && (
                    <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {codeError}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1.5">Recently active codes you can try:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {merchants.slice(0, 6).map((m) => (
                      <Badge
                        key={m.id}
                        variant="outline"
                        className="text-[10px] cursor-pointer hover:bg-primary/10 font-mono"
                        onClick={() => setCodeInput(m.lipafo_code)}
                      >
                        {m.lipafo_code}
                      </Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {segmentTab !== "lipafo_code" && (
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {filtered.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">No merchants match.</p>
                )}
                {filtered.map((m) => (
                  <Card key={m.id}
                    onClick={() => { setSelected(m); setStep("amount"); }}
                    className="glass-card p-3 cursor-pointer hover:border-primary/50 transition-all">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-full bg-primary/15 shrink-0">
                          {m.merchant_segment === "bank_linked"
                            ? <Store className="h-4 w-4 text-primary" />
                            : <Wallet className="h-4 w-4 text-primary" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">{m.merchant_name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {m.merchant_segment === "bank_linked"
                              ? <>📱 {m.contact_phone || "—"} · {m.category}</>
                              : <>🆔 {m.lmid} · {m.category}</>}
                            <span className="ml-1 font-mono text-[10px] opacity-70">· {m.lipafo_code}</span>
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {m.merchant_segment === "bank_linked"
                          ? <><Building2 className="h-3 w-3 mr-1" />{m.settlement_bank}</>
                          : <><Smartphone className="h-3 w-3 mr-1" />Lipafo wallet</>}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {step === "amount" && selected && (
          <div className="space-y-4">
            <Card className="glass-card p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground truncate">{selected.merchant_name}</p>
                <Badge variant="outline" className="text-[10px] font-mono shrink-0">{selected.lipafo_code}</Badge>
              </div>
              {isBank ? (
                <p className="text-xs text-muted-foreground">
                  📱 {selected.contact_phone} · settles to {selected.settlement_bank}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  🆔 LMID {selected.lmid} · credits Lipafo wallet instantly
                </p>
              )}
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Globe2 className="h-3 w-3" /> {selected.country_code} · {CORRIDOR_LABEL[selected.corridor_type]}
              </p>
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

        {step === "confirm" && selected && (() => {
          const corridor = selected.corridor_type;
          const rail =
            !isBank ? "lipafo_internal" :
            corridor === "papss" ? "papss" :
            corridor === "correspondent" ? "correspondent" : "bank_rail";
          const railLabel =
            rail === "lipafo_internal" ? "On-us · instant" :
            rail === "papss" ? "PAPSS · T+2 net" :
            rail === "correspondent" ? "Correspondent · T+2 net" : "Bank rail · T+1 net";
          const traceText =
            rail === "lipafo_internal" ? <>Trace: Lipafo wallet → Switch (LMID lookup) → instant credit to merchant's Lipafo wallet.</> :
            rail === "papss" ? <>Trace: Lipafo wallet → Switch (Lipafo Code → PAPSS routing) → Lipafo {selected.country_code} pool → T+2 net dispatch to {selected.settlement_bank}.</> :
            rail === "correspondent" ? <>Trace: Lipafo wallet → Switch (Lipafo Code → correspondent banking) → nostro account → T+2 net dispatch to {selected.settlement_bank}.</> :
            <>Trace: Lipafo wallet → Switch (MSISDN/Lipafo Code lookup) → KCB pool → T+1 net dispatch to {selected.settlement_bank}.</>;
          return (
            <div className="space-y-4">
              <Card className="glass-card p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Merchant</span><span className="font-medium">{selected.merchant_name}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Lipafo Code</span><span className="font-mono text-primary">{selected.lipafo_code}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Corridor</span><span className="text-xs">{CORRIDOR_LABEL[corridor]} · {selected.country_code}</span></div>
                {isBank ? (
                  <>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Resolved identifier</span><span className="font-mono">{selected.contact_phone || "—"}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Beneficiary bank</span><span>{selected.settlement_bank}</span></div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Resolved identifier</span><span className="font-mono">{selected.lmid}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Beneficiary</span><span>Lipafo Wallet</span></div>
                  </>
                )}
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Rail</span><Badge variant="outline" className="text-[10px]">{railLabel}</Badge></div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-bold text-lg text-primary">{fmtKES(Number(amount))}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Switch fee</span><span className="text-success">Free</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">M-PESA involvement</span><span className="text-success">None</span></div>
              </Card>
              <Card className="glass-card p-3 bg-primary/5">
                <p className="text-xs text-muted-foreground">{traceText}</p>
              </Card>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep("amount")}>Back</Button>
                <Button className="flex-1 button-3d" onClick={submit}>Confirm & Pay</Button>
              </div>
            </div>
          );
        })()}

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
              <div className="flex justify-between"><span className="text-muted-foreground">Lipafo Code</span><span className="font-mono text-primary">{selected.lipafo_code}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Identifier ({trace.identifierKind})</span><span className="font-mono">{trace.identifier}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Corridor</span><span>{CORRIDOR_LABEL[selected.corridor_type]} · {selected.country_code}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Rail</span>
                <Badge variant="outline" className="text-[10px]">
                  {trace.rail === "bank_rail" ? "Bank rail · T+1" :
                   trace.rail === "lipafo_internal" ? "On-us · instant" :
                   trace.rail === "papss" ? "PAPSS · T+2" : "Correspondent · T+2"}
                </Badge>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">{trace.rail === "lipafo_internal" ? "Beneficiary" : "Beneficiary bank"}</span>
                <span>{trace.rail === "lipafo_internal" ? "Lipafo Wallet" : selected.settlement_bank}</span>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Inbound recorded</span><span className="text-success">+{fmtKES(Number(amount))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Dispatch</span>
                <Badge variant="outline" className="text-[10px]">
                  {trace.rail === "lipafo_internal" ? "dispatched" :
                   trace.rail === "bank_rail" ? "scheduled (T+1)" : "scheduled (T+2)"}
                </Badge>
              </div>
              <Separator className="my-1" />
              <p className="text-muted-foreground">View in <strong>Admin → Settlement</strong>.</p>
            </Card>
            <Button className="w-full button-3d" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
