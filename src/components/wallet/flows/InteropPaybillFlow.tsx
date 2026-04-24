import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import {
  Search, Building2, Smartphone, Hash, Store, Zap, CheckCircle2,
  ArrowRight, Shield, Network, Loader2, Receipt
} from "lucide-react";

interface InteropPaybillFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Rail = "mpesa_paybill" | "mpesa_till" | "airtel" | "tkash" | "pesalink" | "bank_paybill";

interface Biller {
  id: string;
  name: string;
  paybill: string;
  rail: Rail;
  category: string;
  logo?: string;
  popular?: boolean;
}

// Comprehensive Kenyan biller directory — showcases interoperability
const BILLER_DIRECTORY: Biller[] = [
  // MPESA Paybills - Utilities
  { id: "kplc-prepaid", name: "KPLC Prepaid (Token)", paybill: "888880", rail: "mpesa_paybill", category: "Utilities", popular: true },
  { id: "kplc-postpaid", name: "KPLC Postpaid", paybill: "888888", rail: "mpesa_paybill", category: "Utilities", popular: true },
  { id: "nairobi-water", name: "Nairobi Water & Sewerage", paybill: "444400", rail: "mpesa_paybill", category: "Utilities" },
  { id: "mombasa-water", name: "Mombasa Water (MOWASCO)", paybill: "898998", rail: "mpesa_paybill", category: "Utilities" },
  { id: "kisumu-water", name: "Kisumu Water (KIWASCO)", paybill: "807550", rail: "mpesa_paybill", category: "Utilities" },

  // Telecom
  { id: "safaricom-postpaid", name: "Safaricom Postpaid", paybill: "200200", rail: "mpesa_paybill", category: "Telecom", popular: true },
  { id: "safaricom-home", name: "Safaricom Home Fibre", paybill: "150501", rail: "mpesa_paybill", category: "Telecom" },
  { id: "airtel-postpaid", name: "Airtel Kenya Postpaid", paybill: "220220", rail: "airtel", category: "Telecom" },
  { id: "telkom-postpaid", name: "Telkom Kenya", paybill: "202020", rail: "tkash", category: "Telecom" },
  { id: "zuku", name: "Zuku Fibre", paybill: "320320", rail: "mpesa_paybill", category: "Telecom" },
  { id: "faiba", name: "Faiba (JTL)", paybill: "100100", rail: "mpesa_paybill", category: "Telecom" },

  // Pay TV
  { id: "dstv", name: "DStv Kenya", paybill: "444900", rail: "mpesa_paybill", category: "Entertainment", popular: true },
  { id: "gotv", name: "GOtv Kenya", paybill: "423655", rail: "mpesa_paybill", category: "Entertainment" },
  { id: "startimes", name: "StarTimes", paybill: "828700", rail: "mpesa_paybill", category: "Entertainment" },
  { id: "showmax", name: "Showmax", paybill: "300300", rail: "mpesa_paybill", category: "Entertainment" },

  // Banks via PesaLink — true interop
  { id: "kcb-loan", name: "KCB Bank — Loan Repayment", paybill: "522522", rail: "bank_paybill", category: "Banks" },
  { id: "equity-loan", name: "Equity Bank — Loan/Account", paybill: "247247", rail: "pesalink", category: "Banks", popular: true },
  { id: "coop-bank", name: "Co-operative Bank", paybill: "400200", rail: "pesalink", category: "Banks" },
  { id: "absa-bank", name: "Absa Bank Kenya", paybill: "303030", rail: "pesalink", category: "Banks" },
  { id: "stanchart", name: "Standard Chartered KE", paybill: "329329", rail: "pesalink", category: "Banks" },
  { id: "ncba-bank", name: "NCBA Bank", paybill: "880100", rail: "pesalink", category: "Banks" },
  { id: "im-bank", name: "I&M Bank", paybill: "542542", rail: "pesalink", category: "Banks" },
  { id: "dtb-bank", name: "Diamond Trust Bank", paybill: "516600", rail: "pesalink", category: "Banks" },
  { id: "family-bank", name: "Family Bank", paybill: "222111", rail: "pesalink", category: "Banks" },
  { id: "stanbic-bank", name: "Stanbic Bank Kenya", paybill: "600100", rail: "pesalink", category: "Banks" },

  // SACCOs
  { id: "stima-sacco", name: "Stima Sacco", paybill: "823100", rail: "mpesa_paybill", category: "SACCO" },
  { id: "mwalimu-sacco", name: "Mwalimu National Sacco", paybill: "975100", rail: "mpesa_paybill", category: "SACCO" },
  { id: "kenpipe-sacco", name: "Kenya Pipeline Sacco", paybill: "535300", rail: "mpesa_paybill", category: "SACCO" },

  // Insurance
  { id: "nhif", name: "NHIF / SHIF", paybill: "200222", rail: "mpesa_paybill", category: "Insurance", popular: true },
  { id: "jubilee", name: "Jubilee Insurance", paybill: "503000", rail: "mpesa_paybill", category: "Insurance" },
  { id: "britam", name: "Britam Insurance", paybill: "503100", rail: "mpesa_paybill", category: "Insurance" },
  { id: "cic-insurance", name: "CIC Insurance", paybill: "709000", rail: "mpesa_paybill", category: "Insurance" },

  // Government
  { id: "kra", name: "KRA (Tax Payments)", paybill: "572572", rail: "mpesa_paybill", category: "Government", popular: true },
  { id: "ntsa", name: "NTSA (TIMS)", paybill: "350353", rail: "mpesa_paybill", category: "Government" },
  { id: "ecitizen", name: "eCitizen Services", paybill: "206206", rail: "mpesa_paybill", category: "Government" },
];

const railMeta: Record<Rail, { label: string; icon: any; color: string }> = {
  mpesa_paybill: { label: "M-PESA Paybill", icon: Smartphone, color: "text-success" },
  mpesa_till:    { label: "M-PESA Till (Buy Goods)", icon: Store, color: "text-success" },
  airtel:        { label: "Airtel Money", icon: Smartphone, color: "text-destructive" },
  tkash:         { label: "T-Kash (Telkom)", icon: Smartphone, color: "text-primary" },
  pesalink:      { label: "PesaLink (Inter-bank)", icon: Network, color: "text-primary" },
  bank_paybill:  { label: "Bank Paybill", icon: Building2, color: "text-primary" },
};

export function InteropPaybillFlow({ open, onOpenChange }: InteropPaybillFlowProps) {
  const { toast } = useToast();
  const { addTransaction, balances } = useWallet();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [tab, setTab] = useState<"directory" | "manual">("directory");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [selectedBiller, setSelectedBiller] = useState<Biller | null>(null);

  // Manual entry state
  const [manualRail, setManualRail] = useState<Rail>("mpesa_paybill");
  const [manualPaybill, setManualPaybill] = useState("");
  const [manualName, setManualName] = useState("");

  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [processing, setProcessing] = useState(false);

  const categories = useMemo(() => {
    return ["All", ...Array.from(new Set(BILLER_DIRECTORY.map(b => b.category)))];
  }, []);

  const filtered = useMemo(() => {
    return BILLER_DIRECTORY.filter(b => {
      const matchCat = category === "All" || b.category === category;
      const q = search.trim().toLowerCase();
      const matchSearch = !q || b.name.toLowerCase().includes(q) || b.paybill.includes(q);
      return matchCat && matchSearch;
    });
  }, [search, category]);

  const activeBiller: Biller | null = useMemo(() => {
    if (tab === "directory") return selectedBiller;
    if (!manualPaybill) return null;
    return {
      id: "manual",
      name: manualName || `Paybill ${manualPaybill}`,
      paybill: manualPaybill,
      rail: manualRail,
      category: "Custom",
    };
  }, [tab, selectedBiller, manualPaybill, manualName, manualRail]);

  const amt = parseFloat(amount) || 0;
  const interopFee = activeBiller
    ? activeBiller.rail === "pesalink" || activeBiller.rail === "bank_paybill" ? 25
    : activeBiller.rail === "airtel" || activeBiller.rail === "tkash" ? 15
    : 0  // M-PESA paybills via Lipafo zero-rated
    : 0;
  const total = amt + interopFee;
  const insufficient = amt > 0 && total > balances.main;

  const reset = () => {
    setStep(1);
    setSearch("");
    setCategory("All");
    setSelectedBiller(null);
    setManualPaybill("");
    setManualName("");
    setManualRail("mpesa_paybill");
    setAccountNumber("");
    setAmount("");
    setProcessing(false);
    setTab("directory");
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const proceedToAmount = () => {
    if (!activeBiller) return;
    if (!accountNumber.trim()) {
      toast({ title: "Account required", description: "Enter the account / reference number.", variant: "destructive" });
      return;
    }
    setStep(3);
  };

  const handleConfirm = async () => {
    if (!activeBiller || insufficient || amt <= 0) return;
    setProcessing(true);
    // Simulate rail handshake
    await new Promise(r => setTimeout(r, 1400));
    await addTransaction({
      type: "bill",
      amount: -total,
      description: `${activeBiller.name} • ${railMeta[activeBiller.rail].label} • Acc ${accountNumber}`,
      recipient: activeBiller.paybill,
      status: "completed",
      walletType: "main",
    });
    setProcessing(false);
    setStep(4);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-card border-glass-border max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            Lipafo Interop Paybill
          </DialogTitle>
          <DialogDescription>
            Pay any biller in Kenya — M-PESA, Airtel Money, T-Kash, PesaLink & all bank paybills.
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1 — Choose biller */}
        {step === 1 && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            <div className="glass-card p-3 rounded-xl border border-primary/30 bg-primary/5 flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary shrink-0" />
              <div className="text-xs text-muted-foreground">
                <span className="text-foreground font-semibold">True interoperability:</span> Lipafo routes payments across
                M-PESA, Airtel, T-Kash, PesaLink and direct bank rails — all from one wallet.
              </div>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="directory">Biller Directory</TabsTrigger>
                <TabsTrigger value="manual">Enter Paybill / Till</TabsTrigger>
              </TabsList>

              <TabsContent value="directory" className="flex-1 overflow-hidden flex flex-col space-y-3 mt-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or paybill…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="glass-card pl-9"
                    />
                  </div>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="glass-card w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <ScrollArea className="flex-1 pr-3">
                  <div className="space-y-2">
                    {filtered.map(biller => {
                      const meta = railMeta[biller.rail];
                      const RailIcon = meta.icon;
                      const isSelected = selectedBiller?.id === biller.id;
                      return (
                        <button
                          key={biller.id}
                          onClick={() => setSelectedBiller(biller)}
                          className={`w-full glass-card p-3 rounded-xl border text-left transition-all ${
                            isSelected ? "border-primary bg-primary/10" : "border-glass-border/30 hover:border-primary/40"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-foreground text-sm truncate">{biller.name}</span>
                                {biller.popular && <Badge variant="secondary" className="text-[10px]">Popular</Badge>}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <Hash className="h-3 w-3" />
                                <span className="font-mono">{biller.paybill}</span>
                                <span>•</span>
                                <span>{biller.category}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <RailIcon className={`h-4 w-4 ${meta.color}`} />
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{meta.label.split(" ")[0]}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {filtered.length === 0 && (
                      <div className="text-center text-sm text-muted-foreground py-8">
                        No biller found. Try the "Enter Paybill / Till" tab.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="manual" className="space-y-3 mt-3">
                <div>
                  <Label>Payment Rail</Label>
                  <Select value={manualRail} onValueChange={(v) => setManualRail(v as Rail)}>
                    <SelectTrigger className="glass-card"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(railMeta).map(([k, m]) => (
                        <SelectItem key={k} value={k}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Paybill / Till / Bank Code</Label>
                  <Input
                    placeholder="e.g. 247247"
                    value={manualPaybill}
                    onChange={(e) => setManualPaybill(e.target.value.replace(/\D/g, ""))}
                    className="glass-card font-mono"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <Label>Biller Name (optional)</Label>
                  <Input
                    placeholder="e.g. My Landlord"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="glass-card"
                  />
                </div>
                <div className="glass-card p-3 rounded-lg bg-muted/20 text-xs text-muted-foreground">
                  <Zap className="h-3 w-3 inline mr-1 text-primary" />
                  Lipafo automatically detects and routes via the correct rail with real-time validation.
                </div>
              </TabsContent>
            </Tabs>

            <Button
              className="w-full button-3d"
              disabled={!activeBiller}
              onClick={() => setStep(2)}
            >
              Continue <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* STEP 2 — Account number */}
        {step === 2 && activeBiller && (
          <div className="space-y-4">
            <div className="glass-card p-4 rounded-xl border border-primary/30 bg-primary/5">
              <div className="text-xs text-muted-foreground mb-1">Paying to</div>
              <div className="font-semibold text-foreground">{activeBiller.name}</div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <Hash className="h-3 w-3" />
                <span className="font-mono">{activeBiller.paybill}</span>
                <span>•</span>
                <span>{railMeta[activeBiller.rail].label}</span>
              </div>
            </div>
            <div>
              <Label>Account / Reference Number</Label>
              <Input
                placeholder="Meter no., account no., phone, policy no…"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="glass-card"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                Same reference you'd use on the biller's USSD or app.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1 button-3d" onClick={proceedToAmount}>Continue</Button>
            </div>
          </div>
        )}

        {/* STEP 3 — Amount + review */}
        {step === 3 && activeBiller && (
          <div className="space-y-4">
            <div>
              <Label>Amount (KES)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="glass-card text-lg"
                autoFocus
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Wallet balance</span>
                <span className="font-mono">KES {balances.main.toLocaleString()}</span>
              </div>
            </div>

            <div className="glass-card p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Receipt className="h-4 w-4" /> Payment Summary
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Biller</span><span className="text-foreground">{activeBiller.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paybill</span><span className="text-foreground font-mono">{activeBiller.paybill}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Account</span><span className="text-foreground">{accountNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Rail</span><span className="text-foreground">{railMeta[activeBiller.rail].label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="text-foreground">KES {amt.toLocaleString()}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Interop fee</span>
                  <span className={interopFee === 0 ? "text-success font-semibold" : "text-foreground"}>
                    {interopFee === 0 ? "FREE" : `KES ${interopFee}`}
                  </span>
                </div>
                <div className="border-t border-glass-border/30 pt-2 flex justify-between font-semibold">
                  <span className="text-foreground">Total</span>
                  <span className="text-foreground">KES {total.toLocaleString()}</span>
                </div>
              </div>
              {insufficient && (
                <div className="text-xs text-destructive">Insufficient balance in main wallet.</div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)} disabled={processing}>Back</Button>
              <Button
                className="flex-1 button-3d"
                onClick={handleConfirm}
                disabled={processing || insufficient || amt <= 0}
              >
                {processing ? (<><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Routing…</>) : "Pay Now"}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4 — Success */}
        {step === 4 && activeBiller && (
          <div className="space-y-4 text-center py-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-success" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">Payment Successful</h3>
              <p className="text-sm text-muted-foreground">
                KES {amt.toLocaleString()} sent to {activeBiller.name} via {railMeta[activeBiller.rail].label}.
              </p>
            </div>
            <div className="glass-card p-3 rounded-lg text-xs text-muted-foreground">
              Ref: LIPAFO-{Date.now().toString().slice(-8)}
            </div>
            <Button className="w-full button-3d" onClick={() => handleClose(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
