import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Globe2, Search, ArrowRight, CheckCircle2, Loader2, Landmark, Network,
  Banknote, CreditCard, Wallet, Coins, FileText, ArrowDownToLine, TrendingUp, Building2, Zap, Hash
} from "lucide-react";

interface MpesaTariffRow {
  corridor_code: string;
  band_min_kes: number;
  band_max_kes: number;
  fee_kes: number;
  fx_margin_bps: number | null;
  snapshot_at: string;
  source_url: string;
}

interface CrossBorderMerchantFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* ============================================================
 * Source banks — Lipafo is the SWITCH. Customer can be on ANY
 * participating Kenyan bank. KCB orchestrates routing.
 * ============================================================ */
const SOURCE_BANKS = [
  { id: "kcb",     name: "KCB Bank",            channel: "Mobile App / USSD" },
  { id: "equity",  name: "Equity Bank",         channel: "Equitel / Mobile App" },
  { id: "coop",    name: "Co-operative Bank",   channel: "MCo-op Cash" },
  { id: "family",  name: "Family Bank",         channel: "PesaPap" },
  { id: "ncba",    name: "NCBA Bank",           channel: "NOW App" },
  { id: "stanbic", name: "Stanbic Bank Kenya",  channel: "Mobile Banking" },
  { id: "absa",    name: "Absa Bank Kenya",     channel: "Absa Mobile" },
  { id: "im",      name: "I&M Bank",            channel: "I&M On The Go" },
];

/* Source funding channel — per spec page 2 */
const SOURCE_CHANNELS = [
  { id: "wire",   label: "International Wire Transfer", icon: Banknote,        kcbBps: 35 },
  { id: "eft",    label: "Electronic Fund Transfer",    icon: ArrowDownToLine, kcbBps: 20 },
  { id: "wallet", label: "Lipafo Wallet Balance",       icon: Wallet,          kcbBps: 15 },
  { id: "card",   label: "Debit / Credit Card",         icon: CreditCard,      kcbBps: 30 },
  { id: "crypto", label: "Digital Currency (USDC/cNGN)", icon: Coins,          kcbBps: 25 },
  { id: "moneyorder", label: "Money Order / Cheque",    icon: FileText,        kcbBps: 40 },
];

/* Destination corridors via KCB Group subsidiaries.
 * Per spec page 4: KCB Bank Kenya → KCB Subsidiary → Country.
 * Indicative FX rates (KES → local currency). Mock for demo only.   */
interface Corridor {
  code: string;
  country: string;
  flag: string;
  currency: string;
  rate: number;       // 1 KES = rate * local
  subsidiary: string; // KCB subsidiary handling settlement
  regulator: string;
}
const CORRIDORS: Corridor[] = [
  { code: "UG",  country: "Uganda",       flag: "🇺🇬", currency: "UGX", rate: 28.5,  subsidiary: "KCB Bank Uganda",      regulator: "Bank of Uganda (BoU)" },
  { code: "TZ",  country: "Tanzania",     flag: "🇹🇿", currency: "TZS", rate: 19.6,  subsidiary: "KCB Bank Tanzania",    regulator: "Bank of Tanzania (BoT)" },
  { code: "RW",  country: "Rwanda",       flag: "🇷🇼", currency: "RWF", rate: 10.2,  subsidiary: "KCB Bank Rwanda",      regulator: "National Bank of Rwanda (BNR)" },
  { code: "BI",  country: "Burundi",      flag: "🇧🇮", currency: "BIF", rate: 22.4,  subsidiary: "KCB Bank Burundi",     regulator: "Banque de la République du Burundi" },
  { code: "SS",  country: "South Sudan",  flag: "🇸🇸", currency: "SSP", rate: 9.8,   subsidiary: "KCB Bank South Sudan", regulator: "Bank of South Sudan" },
  { code: "CD",  country: "DRC",          flag: "🇨🇩", currency: "CDF", rate: 21.3,  subsidiary: "KCB Bank DRC",         regulator: "Banque Centrale du Congo" },
  { code: "ET",  country: "Ethiopia",     flag: "🇪🇹", currency: "ETB", rate: 0.43,  subsidiary: "KCB Rep Office Addis", regulator: "National Bank of Ethiopia" },
  { code: "ZA",  country: "South Africa", flag: "🇿🇦", currency: "ZAR", rate: 0.14,  subsidiary: "KCB Correspondent (Standard Bank)", regulator: "SARB" },
  { code: "NG",  country: "Nigeria",      flag: "🇳🇬", currency: "NGN", rate: 12.4,  subsidiary: "KCB Correspondent (GTBank)", regulator: "Central Bank of Nigeria" },
  { code: "GH",  country: "Ghana",        flag: "🇬🇭", currency: "GHS", rate: 0.11,  subsidiary: "KCB Correspondent (Ecobank)", regulator: "Bank of Ghana" },
];

/* Sample merchants per corridor — all paid via Lipafo Cross-Border code (LPX-...) */
interface XMerchant {
  id: string;
  name: string;
  category: string;
  lipafoXCode: string;
  country: string;
}
const X_MERCHANTS: XMerchant[] = [
  { id: "ug-jumia",     name: "Jumia Uganda",            category: "E-commerce",      lipafoXCode: "LPX-UG-1001", country: "UG" },
  { id: "ug-cipla",     name: "Cipla Quality Chemicals", category: "Pharma / Wholesale", lipafoXCode: "LPX-UG-2014", country: "UG" },
  { id: "ug-uap",       name: "UAP Old Mutual Uganda",   category: "Insurance",       lipafoXCode: "LPX-UG-3041", country: "UG" },
  { id: "tz-vodacom",   name: "Vodacom Tanzania (B2B)",  category: "Telecom",         lipafoXCode: "LPX-TZ-1101", country: "TZ" },
  { id: "tz-bakhresa",  name: "Bakhresa Group",          category: "FMCG / Imports",  lipafoXCode: "LPX-TZ-2202", country: "TZ" },
  { id: "rw-bralirwa",  name: "Bralirwa Ltd",            category: "FMCG",            lipafoXCode: "LPX-RW-1003", country: "RW" },
  { id: "rw-ucb",       name: "University of Rwanda",    category: "Education",       lipafoXCode: "LPX-RW-4404", country: "RW" },
  { id: "ss-nilepet",   name: "NilePet (S. Sudan)",      category: "Energy / B2B",    lipafoXCode: "LPX-SS-1011", country: "SS" },
  { id: "cd-bralima",   name: "Bralima DRC",             category: "FMCG",            lipafoXCode: "LPX-CD-1077", country: "CD" },
  { id: "bi-brarudi",   name: "Brarudi SA",              category: "FMCG",            lipafoXCode: "LPX-BI-1088", country: "BI" },
  { id: "et-ethio",     name: "Ethio Telecom (Postpaid)", category: "Telecom",        lipafoXCode: "LPX-ET-1019", country: "ET" },
  { id: "za-takealot",  name: "Takealot.com",            category: "E-commerce",      lipafoXCode: "LPX-ZA-9001", country: "ZA" },
  { id: "ng-jumia",     name: "Jumia Nigeria",           category: "E-commerce",      lipafoXCode: "LPX-NG-9011", country: "NG" },
  { id: "ng-konga",     name: "Konga.com",               category: "E-commerce",      lipafoXCode: "LPX-NG-9012", country: "NG" },
  { id: "gh-melcom",    name: "Melcom Ghana",            category: "Retail",          lipafoXCode: "LPX-GH-9101", country: "GH" },
];

/* Flat KCB cross-border fee tier (KES) */
const computeCrossBorderFee = (kesAmount: number): number => {
  if (kesAmount <= 0) return 0;
  if (kesAmount <= 5_000)   return 50;
  if (kesAmount <= 50_000)  return 120;
  if (kesAmount <= 250_000) return 250;
  return 450;
};

/* M-PESA + bank correspondent equivalent cost — fallback estimate when no scraped data */
const computeLegacyCostEstimate = (kesAmount: number): number => {
  const flat = 220 + 350; // m-pesa + bank charge
  const fxMargin = kesAmount * 0.035;
  return Math.round(flat + fxMargin);
};

/* Compute legacy cost from real Safaricom tariff rows when available */
const computeLegacyCostFromTariffs = (
  kesAmount: number,
  corridorCode: string,
  rows: MpesaTariffRow[],
): { cost: number; bandFee: number; fxBps: number | null } | null => {
  if (kesAmount <= 0) return null;
  const matches = rows.filter(r => r.corridor_code === corridorCode);
  if (matches.length === 0) return null;
  const band = matches.find(r => kesAmount >= Number(r.band_min_kes) && kesAmount <= Number(r.band_max_kes));
  if (!band) return null;
  const fxBps = band.fx_margin_bps != null ? Number(band.fx_margin_bps) : null;
  const fxMargin = fxBps != null ? Math.round(kesAmount * (fxBps / 10_000)) : Math.round(kesAmount * 0.035);
  return { cost: Number(band.fee_kes) + fxMargin, bandFee: Number(band.fee_kes), fxBps };
};

export function CrossBorderMerchantFlow({ open, onOpenChange }: CrossBorderMerchantFlowProps) {
  const { toast } = useToast();
  const { addTransaction, balances } = useWallet();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [sourceBankId, setSourceBankId] = useState<string>("kcb");
  const [channelId, setChannelId] = useState<string>("wallet");
  const [corridorCode, setCorridorCode] = useState<string>("UG");
  const [merchantSearch, setMerchantSearch] = useState("");
  const [merchant, setMerchant] = useState<XMerchant | null>(null);
  const [reference, setReference] = useState("");
  const [kesAmount, setKesAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [tariffRows, setTariffRows] = useState<MpesaTariffRow[]>([]);

  // Load latest scraped Safaricom tariff snapshot once dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("mpesa_global_tariffs")
        .select("corridor_code, band_min_kes, band_max_kes, fee_kes, fx_margin_bps, snapshot_at, source_url")
        .order("snapshot_at", { ascending: false })
        .limit(500);
      if (cancelled || !data) return;
      // Keep only the latest snapshot (rows already sorted desc)
      const latest = data[0]?.snapshot_at;
      setTariffRows(latest ? (data as MpesaTariffRow[]).filter(r => r.snapshot_at === latest) : []);
    })();
    return () => { cancelled = true; };
  }, [open]);

  const corridor = useMemo(() => CORRIDORS.find(c => c.code === corridorCode)!, [corridorCode]);
  const channel  = useMemo(() => SOURCE_CHANNELS.find(c => c.id === channelId)!, [channelId]);
  const sourceBank = useMemo(() => SOURCE_BANKS.find(b => b.id === sourceBankId)!, [sourceBankId]);

  const merchantsForCorridor = useMemo(
    () => X_MERCHANTS.filter(m => m.country === corridorCode &&
      (!merchantSearch || m.name.toLowerCase().includes(merchantSearch.toLowerCase()))),
    [corridorCode, merchantSearch]
  );

  const amt = parseFloat(kesAmount) || 0;
  const kcbFee = computeCrossBorderFee(amt);
  const legacyFromTariffs = computeLegacyCostFromTariffs(amt, corridorCode, tariffRows);
  const legacyCost = legacyFromTariffs?.cost ?? computeLegacyCostEstimate(amt);
  const legacyIsGenuine = !!legacyFromTariffs;
  const tariffSnapshotAt = tariffRows[0]?.snapshot_at ?? null;
  const fxMarginRevenueKES = Math.round(amt * (channel.kcbBps / 10_000));
  const totalDebit = amt + kcbFee;
  const localAmount = amt * corridor.rate;
  const insufficient = channelId === "wallet" && totalDebit > balances.main;
  const userSavings = legacyCost - kcbFee;

  const reset = () => {
    setStep(1); setSourceBankId("kcb"); setChannelId("wallet");
    setCorridorCode("UG"); setMerchant(null); setReference(""); setKesAmount("");
    setMerchantSearch(""); setProcessing(false);
  };

  const handleClose = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const handleConfirm = async () => {
    if (!merchant || amt <= 0 || insufficient) return;
    setProcessing(true);
    await new Promise(r => setTimeout(r, 1600));
    await addTransaction({
      type: "bill",
      amount: -totalDebit,
      description: `X-Border • ${merchant.name} (${corridor.country}) • via ${sourceBank.name} → Lipafo → ${corridor.subsidiary}`,
      recipient: merchant.lipafoXCode,
      status: "completed",
      walletType: "main",
    });
    setProcessing(false);
    setStep(5);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-card border-glass-border max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Globe2 className="h-5 w-5 text-primary" />
            Cross-Border Merchant Pay — Lipafo Switch
          </DialogTitle>
          <DialogDescription>
            Pay any merchant across Africa. Lipafo routes through KCB Group subsidiaries.
            Single integration. Flat fee. KCB earns FX margin & overnight float.
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1 — Source bank simulator + channel */}
        {step === 1 && (
          <div className="flex-1 overflow-auto space-y-4">
            <div className="glass-card p-3 rounded-xl border border-primary/30 bg-primary/5">
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Network className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="text-foreground font-semibold">Lipafo is the switch.</span>{" "}
                  Customers from any Kenyan bank can route through Lipafo. Single integration replaces
                  fragmented bilateral M-PESA / bank-to-bank corridors.
                </div>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">I'm a customer of</Label>
              <Select value={sourceBankId} onValueChange={setSourceBankId}>
                <SelectTrigger className="glass-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_BANKS.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="font-medium">{b.name}</span>{" "}
                      <span className="text-xs text-muted-foreground">— {b.channel}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                Initiating from <span className="text-foreground">{sourceBank.name}</span> via <span className="text-foreground">{sourceBank.channel}</span>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Source funding channel</Label>
              <div className="grid grid-cols-2 gap-2">
                {SOURCE_CHANNELS.map(c => {
                  const Icon = c.icon;
                  const active = channelId === c.id;
                  return (
                    <button key={c.id} onClick={() => setChannelId(c.id)}
                      className={`glass-card p-3 rounded-xl border text-left transition-all ${
                        active ? "border-primary bg-primary/10" : "border-glass-border/30 hover:border-primary/40"
                      }`}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{c.label}</div>
                          <div className="text-[10px] text-muted-foreground">KCB FX margin {c.kcbBps} bps</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button className="w-full button-3d" onClick={() => setStep(2)}>
              Continue <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* STEP 2 — Destination corridor */}
        {step === 2 && (
          <div className="flex-1 overflow-auto space-y-4">
            <Label>Destination country</Label>
            <ScrollArea className="h-[320px] pr-3">
              <div className="grid grid-cols-2 gap-2">
                {CORRIDORS.map(c => {
                  const active = corridorCode === c.code;
                  return (
                    <button key={c.code} onClick={() => { setCorridorCode(c.code); setMerchant(null); }}
                      className={`glass-card p-3 rounded-xl border text-left transition-all ${
                        active ? "border-primary bg-primary/10" : "border-glass-border/30 hover:border-primary/40"
                      }`}>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{c.flag}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-foreground truncate">{c.country}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{c.subsidiary}</div>
                          <div className="text-[10px] text-primary font-mono">1 KES = {c.rate} {c.currency}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="glass-card p-3 rounded-lg border border-primary/20 bg-primary/5 text-xs space-y-1">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <Landmark className="h-3 w-3 text-primary" /> Routing path
              </div>
              <div className="text-muted-foreground">
                {sourceBank.name} → <span className="text-primary font-semibold">Lipafo Switch</span> → KCB Bank Kenya → {corridor.subsidiary}
              </div>
              <div className="text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3 text-success" /> Regulator: {corridor.regulator}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 glass-card" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1 button-3d" onClick={() => setStep(3)}>
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3 — Merchant + reference */}
        {step === 3 && (
          <div className="flex-1 overflow-auto space-y-4">
            <div className="glass-card p-3 rounded-xl border border-primary/20 bg-primary/5 text-xs flex items-center gap-2">
              <span className="text-xl">{corridor.flag}</span>
              <div className="flex-1">
                <div className="text-foreground font-semibold">{corridor.country}</div>
                <div className="text-muted-foreground">via {corridor.subsidiary}</div>
              </div>
              <Badge variant="secondary" className="text-[10px]">{corridor.currency}</Badge>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search merchants…" value={merchantSearch}
                onChange={(e) => setMerchantSearch(e.target.value)}
                className="glass-card pl-9" />
            </div>

            <ScrollArea className="h-[260px] pr-3">
              <div className="space-y-2">
                {merchantsForCorridor.map(m => {
                  const active = merchant?.id === m.id;
                  return (
                    <button key={m.id} onClick={() => setMerchant(m)}
                      className={`w-full glass-card p-3 rounded-xl border text-left transition-all ${
                        active ? "border-primary bg-primary/10" : "border-glass-border/30 hover:border-primary/40"
                      }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground truncate">{m.name}</div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Hash className="h-3 w-3" />
                            <span className="font-mono text-primary">{m.lipafoXCode}</span>
                            <span>•</span>
                            <span>{m.category}</span>
                          </div>
                        </div>
                        <Globe2 className="h-4 w-4 text-primary shrink-0" />
                      </div>
                    </button>
                  );
                })}
                {merchantsForCorridor.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    No merchants in this corridor yet.
                  </div>
                )}
              </div>
            </ScrollArea>

            <div>
              <Label>Invoice / Reference Number</Label>
              <Input placeholder="e.g. INV-2026-0042" value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="glass-card" />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 glass-card" onClick={() => setStep(2)}>Back</Button>
              <Button className="flex-1 button-3d" disabled={!merchant || !reference.trim()}
                onClick={() => setStep(4)}>
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4 — Amount + cost comparison + confirm */}
        {step === 4 && merchant && (
          <div className="flex-1 overflow-auto space-y-4">
            <div className="glass-card p-3 rounded-xl border border-primary/20 bg-primary/5">
              <div className="text-xs text-muted-foreground">Paying</div>
              <div className="font-semibold text-foreground text-sm">{merchant.name}</div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 flex-wrap">
                <span>{corridor.flag} {corridor.country}</span> •
                <span className="font-mono text-primary">{merchant.lipafoXCode}</span> •
                <span>Ref {reference}</span>
              </div>
            </div>

            <div>
              <Label>Amount (KES)</Label>
              <Input type="number" inputMode="decimal" placeholder="0"
                value={kesAmount} onChange={(e) => setKesAmount(e.target.value)}
                className="glass-card text-2xl font-bold h-14" />
              {amt > 0 && (
                <div className="text-xs text-primary mt-1 font-mono">
                  ≈ {new Intl.NumberFormat("en-KE").format(Math.round(localAmount))} {corridor.currency}
                </div>
              )}
            </div>

            {amt > 0 && (
              <>
                {/* Lipafo vs Legacy cost comparison */}
                <div className="glass-card p-3 rounded-xl border border-success/30 bg-success/5 space-y-2">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-success" /> Cost vs. legacy M-PESA + correspondent route
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2">
                      <div className="text-muted-foreground">Old way</div>
                      <div className="text-destructive font-bold text-base">KES {legacyCost.toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground">M-PESA + bank wire + 3.5% FX</div>
                    </div>
                    <div className="rounded-lg bg-success/10 border border-success/20 p-2">
                      <div className="text-muted-foreground">Lipafo</div>
                      <div className="text-success font-bold text-base">KES {kcbFee.toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground">flat KCB fee · no M-PESA</div>
                    </div>
                  </div>
                  <div className="text-xs text-success font-semibold text-center">
                    You save KES {userSavings.toLocaleString()} ({Math.round((userSavings / Math.max(legacyCost, 1)) * 100)}%)
                  </div>
                </div>

                {/* KCB revenue snapshot */}
                <div className="glass-card p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-1 text-xs">
                  <div className="font-semibold text-foreground flex items-center gap-1">
                    <Landmark className="h-3 w-3 text-primary" /> KCB earns on this transaction
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Switch fee (NFI)</span><span className="text-foreground">KES {kcbFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>FX margin ({channel.kcbBps} bps)</span><span className="text-foreground">KES {fxMarginRevenueKES.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Float held until T+1 settlement</span>
                    <span className="text-foreground">KES {amt.toLocaleString()}</span>
                  </div>
                </div>

                <div className="glass-card p-3 rounded-xl border border-glass-border/30 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="text-foreground">KES {amt.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">KCB switch fee</span><span className="text-foreground">KES {kcbFee.toLocaleString()}</span></div>
                  <div className="flex justify-between border-t border-glass-border/30 pt-1 mt-1">
                    <span className="font-semibold text-foreground">Total debit</span>
                    <span className="font-bold text-primary">KES {totalDebit.toLocaleString()}</span>
                  </div>
                  {insufficient && (
                    <div className="text-destructive text-[11px] mt-1">Insufficient main wallet balance.</div>
                  )}
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 glass-card" onClick={() => setStep(3)}>Back</Button>
              <Button className="flex-1 button-3d" disabled={amt <= 0 || insufficient || processing}
                onClick={handleConfirm}>
                {processing
                  ? (<><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Routing via Lipafo…</>)
                  : (<>Pay KES {totalDebit.toLocaleString()}</>)}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5 — Success */}
        {step === 5 && merchant && (
          <div className="flex-1 overflow-auto space-y-4 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-success" />
            </div>
            <div>
              <div className="text-lg font-bold text-foreground">Payment routed</div>
              <div className="text-sm text-muted-foreground">
                KES {totalDebit.toLocaleString()} sent to {merchant.name}
              </div>
              <div className="text-xs text-primary mt-1 font-mono">
                ≈ {new Intl.NumberFormat("en-KE").format(Math.round(localAmount))} {corridor.currency}
              </div>
            </div>

            <div className="glass-card p-3 rounded-xl border border-glass-border/30 text-left text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Source</span><span className="text-foreground">{sourceBank.name} · {channel.label}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Switch</span><span className="text-primary font-semibold">Lipafo (KCB-orchestrated)</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Subsidiary</span><span className="text-foreground">{corridor.subsidiary}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="text-foreground font-mono">{reference}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Settlement</span><span className="text-foreground">T+1 by 1pm (per Lipafo cycle)</span></div>
            </div>

            <Button className="w-full button-3d" onClick={() => handleClose(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}