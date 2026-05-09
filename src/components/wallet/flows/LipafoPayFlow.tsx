import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { Store, ArrowRight, CheckCircle2, Loader2, Network, Building2, Search, Hash, UtensilsCrossed, Truck, Smartphone, Pill, Shirt, Film, Sparkles, Wrench, Fuel, ShoppingCart, Heart, GraduationCap, Plane, Zap, Phone, Tag } from "lucide-react";

const CATEGORY_META: Record<string, { label: string; icon: any }> = {
  food_delivery: { label: "Food Delivery", icon: UtensilsCrossed },
  food: { label: "Food & Dining", icon: UtensilsCrossed },
  courier: { label: "Courier", icon: Truck },
  electronics: { label: "Electronics", icon: Smartphone },
  pharmacy: { label: "Pharmacy", icon: Pill },
  fashion: { label: "Fashion", icon: Shirt },
  entertainment: { label: "Entertainment", icon: Film },
  beauty: { label: "Beauty", icon: Sparkles },
  hardware: { label: "Hardware", icon: Wrench },
  fuel: { label: "Fuel", icon: Fuel },
  supermarket: { label: "Supermarket", icon: ShoppingCart },
  retail: { label: "Retail", icon: Tag },
  health: { label: "Health", icon: Heart },
  education: { label: "Education", icon: GraduationCap },
  travel: { label: "Travel", icon: Plane },
  utility: { label: "Utility", icon: Zap },
  telecoms: { label: "Telecoms", icon: Phone },
};

type BankMerchant = {
  id: string;
  bank_id: string;
  merchant_name: string;
  category: string;
  paybill_number: string;
  till_number: string | null;
  status: string;
};

type Bank = { id: string; bank_name: string; bank_code: string };

interface Props { open: boolean; onOpenChange: (open: boolean) => void; }

const fmtKES = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);

/**
 * Lipafo switch fee schedule (KES). Designed to undercut the legacy
 * "Bank → M-PESA → Paybill" double-fee path by 60-80%.
 * Legacy = Safaricom Bank-to-MPESA + MPESA Pay Bill (customer-to-business), 2024 published tariffs.
 */
const LIPAFO_FEE_BANDS: { min: number; max: number; fee: number }[] = [
  { min: 0,       max: 100,     fee: 0  },
  { min: 101,     max: 1500,    fee: 8  },
  { min: 1501,    max: 5000,    fee: 15 },
  { min: 5001,    max: 20000,   fee: 25 },
  { min: 20001,   max: 70000,   fee: 40 },
  { min: 70001,   max: 250000,  fee: 55 },
  { min: 250001,  max: Infinity, fee: 75 },
];
const computeLipafoFee = (amt: number) =>
  LIPAFO_FEE_BANDS.find(b => amt >= b.min && amt <= b.max)?.fee ?? 75;

const computeLegacyDoubleFee = (amt: number) => {
  const bankToMpesa =
    amt <= 100 ? 0 : amt <= 1500 ? 30 : amt <= 5000 ? 55 :
    amt <= 20000 ? 100 : 110;
  const payBill =
    amt <= 100 ? 0 : amt <= 1500 ? 12 : amt <= 5000 ? 41 :
    amt <= 20000 ? 86 : 108;
  return bankToMpesa + payBill;
};

const CATEGORIES = ["all", "food_delivery", "food", "courier", "electronics", "pharmacy", "fashion", "entertainment", "beauty", "hardware", "fuel", "supermarket", "retail", "health", "education", "travel", "utility", "telecoms"];

export function LipafoPayFlow({ open, onOpenChange }: Props) {
  const { balances, addTransaction } = useWallet();
  const [step, setStep] = useState<"select" | "amount" | "confirm" | "processing" | "done">("select");
  const [merchants, setMerchants] = useState<BankMerchant[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [bankFilter, setBankFilter] = useState<string>("all");
  const [paybillInput, setPaybillInput] = useState("");
  const [tillInput, setTillInput] = useState("");
  const [paybillError, setPaybillError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [selected, setSelected] = useState<BankMerchant | null>(null);
  const [amount, setAmount] = useState("");
  const [trace, setTrace] = useState<{ ref: string; positionId?: string; dispatchId?: string; intentId?: string; traceId?: string; resultCode?: number; resultDesc?: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("select"); setSelected(null); setAmount(""); setTrace(null);
    setSearch(""); setPaybillInput(""); setTillInput(""); setPaybillError(null);
    Promise.all([
      supabase.from("bank_merchants").select("*").eq("status", "active").order("merchant_name").limit(200),
      supabase.from("participating_banks").select("id,bank_name,bank_code").order("bank_name"),
    ]).then(([m, b]) => {
      if (m.data) setMerchants(m.data as BankMerchant[]);
      if (b.data) setBanks(b.data as Bank[]);
    });
  }, [open]);

  const bankMap = useMemo(() => Object.fromEntries(banks.map(b => [b.id, b])), [banks]);

  const filtered = merchants.filter(m =>
    (category === "all" || m.category === category) &&
    (bankFilter === "all" || m.bank_id === bankFilter) &&
    (!search.trim() || m.merchant_name.toLowerCase().includes(search.toLowerCase()) ||
      m.paybill_number.includes(search) || (m.till_number || "").includes(search))
  );

  const resolveByPaybill = async () => {
    setPaybillError(null);
    if (!paybillInput.trim()) { setPaybillError("Enter a paybill number"); return; }
    setResolving(true);
    try {
      let q = supabase.from("bank_merchants").select("*").eq("paybill_number", paybillInput.trim()).eq("status", "active");
      if (tillInput.trim()) q = q.eq("till_number", tillInput.trim());
      const { data, error } = await q.limit(1).maybeSingle();
      if (error) throw error;
      if (!data) { setPaybillError("No merchant found for that paybill" + (tillInput ? "/till combination." : ".")); return; }
      setSelected(data as BankMerchant);
      setStep("amount");
    } catch (e) {
      setPaybillError((e as Error).message);
    } finally {
      setResolving(false);
    }
  };

  const submit = async () => {
    if (!selected || !amount) return;
    const amt = Number(amount);
    if (amt <= 0) { toast.error("Enter a valid amount"); return; }
    const fee = computeLipafoFee(amt);
    const totalDebit = amt + fee;
    if (totalDebit > balances.main) { toast.error("Insufficient main wallet balance (incl. switch fee)"); return; }
    setStep("processing");
    try {
      const sourceBank = bankMap[selected.bank_id]?.bank_name || "Participating Bank";
      const ref = `LPF-P2B-${Date.now()}`;
      const today = new Date().toISOString().slice(0, 10);
      const cutoff = new Date(); cutoff.setHours(13, 0, 0, 0);
      const legacy = computeLegacyDoubleFee(amt);
      const savings = Math.max(0, legacy - fee);

      await addTransaction({
        type: "qr_payment",
        amount: -totalDebit,
        description: `LipafoPay → ${selected.merchant_name} (Paybill ${selected.paybill_number}${selected.till_number ? ` · Till ${selected.till_number}` : ""}) · ${sourceBank} · fee ${fmtKES(fee)} · saved ${fmtKES(savings)} vs M-PESA · No M-PESA`,
        recipient: selected.merchant_name,
        status: "completed",
        walletType: "main",
      });

      let positionId: string | undefined;
      const { data: existing } = await supabase
        .from("settlement_positions").select("*")
        .eq("position_date", today).eq("participating_bank", sourceBank).maybeSingle();
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
          position_date: today, participating_bank: sourceBank,
          inbound_volume: amt, outbound_volume: 0, net_position: amt,
          transaction_count: 1, cutoff_at: cutoff.toISOString(), status: "pending",
        }).select().single();
        positionId = ins?.id;
      }

      const { data: disp } = await supabase.from("settlement_dispatches").insert({
        position_id: positionId, beneficiary_bank: sourceBank, amount: amt,
        scheduled_at: cutoff.toISOString(), reference: ref, status: "scheduled",
        float_revenue: fee + Math.round(amt * 0.0002),
      }).select().single();

      // Drive the Daraja FTS v3.0 switch FSM so the Admin → Daraja Flow tab
      // shows intent.received → authorized → debited → credited for this payment.
      const idempotencyKey = (crypto as any).randomUUID?.() ?? `lpf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const traceId = `trace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      let intentId: string | undefined;
      let resultCode: number | undefined;
      let resultDesc: string | undefined;
      try {
        const { data: switchResp, error: switchErr } = await supabase.functions.invoke("switch-process-intent", {
          body: {
            idempotency_key: idempotencyKey,
            trace_id: traceId,
            payer_identifier: "lipafopay-wallet",
            payee_identifier: selected.paybill_number,
            payee_bank: bankMap[selected.bank_id]?.bank_code ?? sourceBank,
            amount: amt,
            currency: "KES",
            rail: "bank_rail",
          },
        });
        if (switchErr) throw switchErr;
        intentId = switchResp?.intent_id ?? switchResp?.id;
        resultCode = switchResp?.ResultCode ?? switchResp?.result_code;
        resultDesc = switchResp?.ResultDesc ?? switchResp?.result_desc;
      } catch (switchErr) {
        // Switch trace is best-effort visualisation; settlement already recorded.
        console.warn("switch-process-intent invoke failed", switchErr);
      }

      setTrace({ ref, positionId, dispatchId: disp?.id, intentId, traceId, resultCode, resultDesc });
      setStep("done");
      toast.success(`Paid via Lipafo switch → ${sourceBank} · settles T+1 · No M-PESA`);
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
            <Network className="h-5 w-5 text-primary" /> LipafoPay
          </DialogTitle>
          <DialogDescription>
            Pay any participating-bank merchant using their existing <strong>Paybill / Till</strong>. Routed via the Lipafo switch — <strong>zero M-PESA involvement</strong>.
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-3">
            {/* Direct paybill entry */}
            <Card className="glass-card p-3 space-y-2 bg-primary/5 border-primary/30">
              <p className="text-xs font-semibold flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 text-primary" />Pay by Paybill / Till</p>
              <div className="grid grid-cols-2 gap-2">
                <Input value={paybillInput} onChange={e => { setPaybillInput(e.target.value); setPaybillError(null); }} placeholder="Paybill (e.g. 247247)" className="font-mono" />
                <Input value={tillInput} onChange={e => { setTillInput(e.target.value); setPaybillError(null); }} placeholder="Till (optional)" className="font-mono" />
              </div>
              <Button size="sm" className="w-full button-3d" onClick={resolveByPaybill} disabled={resolving || !paybillInput.trim()}>
                {resolving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Resolve merchant <ArrowRight className="h-3.5 w-3.5 ml-1" /></>}
              </Button>
              {paybillError && <p className="text-[11px] text-destructive">{paybillError}</p>}
            </Card>

            <Separator />
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Browse by category</p>
              <div className="grid grid-cols-4 gap-2">
                {["food_delivery","courier","electronics","pharmacy","fashion","entertainment","beauty","hardware","fuel","supermarket","health","food"].map((c) => {
                  const meta = CATEGORY_META[c];
                  const Icon = meta?.icon || Tag;
                  const count = merchants.filter(m => m.category === c).length;
                  const active = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(active ? "all" : c)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all text-[10px] ${active ? "bg-primary/15 border-primary text-primary" : "bg-card/40 border-border/50 hover:border-primary/40 text-muted-foreground"}`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-center leading-tight">{meta?.label || c}</span>
                      <span className="text-[9px] opacity-70">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">…or refine with filters:</p>

            <div className="grid grid-cols-2 gap-2">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c === "all" ? "All categories" : (CATEGORY_META[c]?.label || c)}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={bankFilter} onValueChange={setBankFilter}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All banks</SelectItem>
                  {banks.map(b => <SelectItem key={b.id} value={b.id}>{b.bank_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search by name, paybill or till…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No merchants match.</p>}
              {filtered.map((m) => (
                <Card key={m.id} onClick={() => { setSelected(m); setStep("amount"); }}
                  className="glass-card p-3 cursor-pointer hover:border-primary/50 transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-full bg-primary/15 shrink-0"><Store className="h-4 w-4 text-primary" /></div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{m.merchant_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          Paybill <span className="font-mono">{m.paybill_number}</span>
                          {m.till_number && <> · Till <span className="font-mono">{m.till_number}</span></>}
                          <span className="ml-1 opacity-70">· {m.category}</span>
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0"><Building2 className="h-3 w-3 mr-1" />{bankMap[m.bank_id]?.bank_name || "Bank"}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {step === "amount" && selected && (
          <div className="space-y-4">
            <Card className="glass-card p-3 space-y-1">
              <p className="text-sm font-medium text-foreground">{selected.merchant_name}</p>
              <p className="text-xs text-muted-foreground">
                Paybill <span className="font-mono">{selected.paybill_number}</span>
                {selected.till_number && <> · Till <span className="font-mono">{selected.till_number}</span></>}
              </p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" />{bankMap[selected.bank_id]?.bank_name || "Participating bank"}</p>
            </Card>
            <div>
              <Label>Amount (KES)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2,500" />
              <p className="text-xs text-muted-foreground mt-1">Available: {fmtKES(balances.main)}</p>
            </div>

            {/* Live fee preview */}
            {(() => {
              const amt = Number(amount) || 0;
              const fee = computeLipafoFee(amt);
              const legacy = computeLegacyDoubleFee(amt);
              const savings = Math.max(0, legacy - fee);
              const pct = legacy > 0 ? Math.round((savings / legacy) * 100) : 0;
              return (
                <Card className="glass-card p-3 space-y-1.5 bg-primary/5 border-primary/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Lipafo switch fee</span>
                    <span className="font-semibold text-foreground">{amt === 0 ? "—" : fee === 0 ? "Free" : fmtKES(fee)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground line-through opacity-70">M-PESA route (Bank→MPESA + Paybill)</span>
                    <span className="line-through opacity-70">{amt === 0 ? "—" : fmtKES(legacy)}</span>
                  </div>
                  {amt > 0 && savings > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-success">You save</span>
                      <span className="text-success font-semibold">{fmtKES(savings)} ({pct}%)</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-border/40">
                    <span className="text-muted-foreground">Total debit</span>
                    <span className="font-bold text-foreground">{amt === 0 ? "—" : fmtKES(amt + fee)}</span>
                  </div>
                </Card>
              );
            })()}

            {/* Fee schedule (collapsible) */}
            <details className="glass-card rounded-lg p-3 text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                View full Lipafo fee schedule (vs M-PESA double-fee)
              </summary>
              <div className="mt-2 space-y-1">
                {LIPAFO_FEE_BANDS.map((b, i) => {
                  const label = b.max === Infinity
                    ? `Above ${fmtKES(b.min - 1)}`
                    : `${fmtKES(b.min)} – ${fmtKES(b.max)}`;
                  const active = Number(amount) >= b.min && Number(amount) <= b.max;
                  return (
                    <div key={i} className={`flex justify-between px-2 py-1 rounded ${active ? "bg-primary/10 text-foreground" : "text-muted-foreground"}`}>
                      <span>{label}</span>
                      <span className="font-mono font-semibold">{b.fee === 0 ? "Free" : fmtKES(b.fee)}</span>
                    </div>
                  );
                })}
                <p className="text-[10px] text-muted-foreground pt-1">
                  Benchmarked to undercut Safaricom's Bank→M-PESA + Pay Bill stacked tariff by ~80%.
                </p>
              </div>
            </details>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("select")}>Back</Button>
              <Button className="flex-1 button-3d" onClick={() => setStep("confirm")} disabled={!amount}>Continue <ArrowRight className="h-4 w-4 ml-1" /></Button>
            </div>
          </div>
        )}

        {step === "confirm" && selected && (
          <div className="space-y-4">
            <Card className="glass-card p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Merchant</span><span className="font-medium">{selected.merchant_name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Source bank</span><span>{bankMap[selected.bank_id]?.bank_name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Paybill</span><span className="font-mono text-primary">{selected.paybill_number}</span></div>
              {selected.till_number && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Till</span><span className="font-mono">{selected.till_number}</span></div>}
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Rail</span><Badge variant="outline" className="text-[10px]">Lipafo switch · T+1 net</Badge></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-bold text-lg text-primary">{fmtKES(Number(amount))}</span></div>
              {(() => {
                const amt = Number(amount) || 0;
                const fee = computeLipafoFee(amt);
                const legacy = computeLegacyDoubleFee(amt);
                const savings = Math.max(0, legacy - fee);
                const pct = legacy > 0 ? Math.round((savings / legacy) * 100) : 0;
                return (
                  <>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Lipafo switch fee</span><span className="font-semibold text-foreground">{fee === 0 ? "Free" : fmtKES(fee)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground line-through opacity-70">M-PESA route (Bank→MPESA + Paybill)</span><span className="line-through opacity-70">{fmtKES(legacy)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-success">You save</span><span className="text-success font-semibold">{fmtKES(savings)} ({pct}%)</span></div>
                    <div className="flex justify-between text-sm pt-1 border-t border-border/40"><span className="text-muted-foreground">Total debit</span><span className="font-bold text-foreground">{fmtKES(amt + fee)}</span></div>
                  </>
                );
              })()}
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">M-PESA involvement</span><span className="text-success font-semibold">ZERO</span></div>
            </Card>
            <Card className="glass-card p-3 bg-primary/5">
              <p className="text-xs text-muted-foreground">
                Trace: Lipafo wallet → Switch (paybill {selected.paybill_number} lookup) → {bankMap[selected.bank_id]?.bank_name} pool → T+1 net dispatch directly to merchant. No Safaricom/M-PESA in the loop.
              </p>
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
              <div className="flex justify-between"><span className="text-muted-foreground">Paybill</span><span className="font-mono text-primary">{selected.paybill_number}</span></div>
              {selected.till_number && <div className="flex justify-between"><span className="text-muted-foreground">Till</span><span className="font-mono">{selected.till_number}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Source bank</span><span>{bankMap[selected.bank_id]?.bank_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Rail</span><Badge variant="outline" className="text-[10px]">Lipafo switch · T+1</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">M-PESA</span><span className="text-success font-semibold">Bypassed</span></div>
              {trace.traceId && <div className="flex justify-between"><span className="text-muted-foreground">Trace ID</span><span className="font-mono text-[10px]">{trace.traceId}</span></div>}
              {trace.intentId && <div className="flex justify-between"><span className="text-muted-foreground">Intent ID</span><span className="font-mono text-[10px]">{trace.intentId.slice(0, 12)}…</span></div>}
              {typeof trace.resultCode === "number" && (
                <div className="flex justify-between"><span className="text-muted-foreground">Daraja ResultCode</span>
                  <Badge variant={trace.resultCode === 0 ? "default" : "destructive"} className="text-[10px]">
                    {trace.resultCode} {trace.resultDesc ? `· ${trace.resultDesc}` : ""}
                  </Badge>
                </div>
              )}
              <Separator className="my-1" />
              <p className="text-muted-foreground">View in <strong>Admin → Settlement → Daraja Flow</strong>.</p>
            </Card>
            <Button className="w-full button-3d" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
