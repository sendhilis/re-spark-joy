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
  Search, Hash, Zap, CheckCircle2, ArrowRight, Shield, Network,
  Loader2, Receipt, Landmark, Wallet, Clock, TrendingUp
} from "lucide-react";

interface InteropPaybillFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Biller {
  id: string;
  name: string;
  lipafoPaybill: string; // NEW Lipafo (KCB-issued) paybill
  category: string;
  popular?: boolean;
  settlementWindow: string; // e.g. "T+1"
}

// All paybills are NEW Lipafo numbers — issued by KCB, NO M-PESA connection.
// Format: LPF-XXXXXX (6-digit Lipafo short code, KCB-orchestrated)
const BILLER_DIRECTORY: Biller[] = [
  // Utilities
  { id: "kplc-prepaid",   name: "KPLC Prepaid (Token)",        lipafoPaybill: "LPF-100101", category: "Utilities", popular: true,  settlementWindow: "T+0" },
  { id: "kplc-postpaid",  name: "KPLC Postpaid",                lipafoPaybill: "LPF-100102", category: "Utilities", popular: true,  settlementWindow: "T+1" },
  { id: "nairobi-water",  name: "Nairobi Water & Sewerage",    lipafoPaybill: "LPF-100201", category: "Utilities",                  settlementWindow: "T+1" },
  { id: "mombasa-water",  name: "Mombasa Water (MOWASCO)",     lipafoPaybill: "LPF-100202", category: "Utilities",                  settlementWindow: "T+1" },
  { id: "kisumu-water",   name: "Kisumu Water (KIWASCO)",      lipafoPaybill: "LPF-100203", category: "Utilities",                  settlementWindow: "T+1" },

  // Telecom (data/postpaid only — no airtime via mobile money rails)
  { id: "safaricom-home", name: "Safaricom Home Fibre",         lipafoPaybill: "LPF-200101", category: "Telecom",                    settlementWindow: "T+1" },
  { id: "zuku",           name: "Zuku Fibre",                   lipafoPaybill: "LPF-200102", category: "Telecom",                    settlementWindow: "T+1" },
  { id: "faiba",          name: "Faiba (JTL)",                  lipafoPaybill: "LPF-200103", category: "Telecom",                    settlementWindow: "T+1" },
  { id: "poa-internet",   name: "Poa! Internet",                lipafoPaybill: "LPF-200104", category: "Telecom",                    settlementWindow: "T+1" },

  // Pay TV
  { id: "dstv",           name: "DStv Kenya",                   lipafoPaybill: "LPF-300101", category: "Entertainment", popular: true, settlementWindow: "T+0" },
  { id: "gotv",           name: "GOtv Kenya",                   lipafoPaybill: "LPF-300102", category: "Entertainment",                settlementWindow: "T+0" },
  { id: "startimes",      name: "StarTimes",                    lipafoPaybill: "LPF-300103", category: "Entertainment",                settlementWindow: "T+0" },
  { id: "showmax",        name: "Showmax",                      lipafoPaybill: "LPF-300104", category: "Entertainment",                settlementWindow: "T+0" },

  // Banks — Lipafo settles directly to bank GL via KCB core
  { id: "kcb-loan",       name: "KCB Bank — Loan Repayment",   lipafoPaybill: "LPF-400101", category: "Banks",                        settlementWindow: "Instant" },
  { id: "equity-loan",    name: "Equity Bank — Loan/Account",  lipafoPaybill: "LPF-400102", category: "Banks", popular: true,         settlementWindow: "T+0" },
  { id: "coop-bank",      name: "Co-operative Bank",            lipafoPaybill: "LPF-400103", category: "Banks",                        settlementWindow: "T+0" },
  { id: "absa-bank",      name: "Absa Bank Kenya",              lipafoPaybill: "LPF-400104", category: "Banks",                        settlementWindow: "T+0" },
  { id: "stanchart",      name: "Standard Chartered KE",        lipafoPaybill: "LPF-400105", category: "Banks",                        settlementWindow: "T+0" },
  { id: "ncba-bank",      name: "NCBA Bank",                    lipafoPaybill: "LPF-400106", category: "Banks",                        settlementWindow: "T+0" },
  { id: "im-bank",        name: "I&M Bank",                     lipafoPaybill: "LPF-400107", category: "Banks",                        settlementWindow: "T+0" },
  { id: "dtb-bank",       name: "Diamond Trust Bank",           lipafoPaybill: "LPF-400108", category: "Banks",                        settlementWindow: "T+0" },
  { id: "family-bank",    name: "Family Bank",                  lipafoPaybill: "LPF-400109", category: "Banks",                        settlementWindow: "T+0" },
  { id: "stanbic-bank",   name: "Stanbic Bank Kenya",           lipafoPaybill: "LPF-400110", category: "Banks",                        settlementWindow: "T+0" },

  // SACCOs
  { id: "stima-sacco",    name: "Stima Sacco",                  lipafoPaybill: "LPF-500101", category: "SACCO",                        settlementWindow: "T+1" },
  { id: "mwalimu-sacco",  name: "Mwalimu National Sacco",       lipafoPaybill: "LPF-500102", category: "SACCO",                        settlementWindow: "T+1" },
  { id: "kenpipe-sacco",  name: "Kenya Pipeline Sacco",         lipafoPaybill: "LPF-500103", category: "SACCO",                        settlementWindow: "T+1" },

  // Insurance
  { id: "nhif",           name: "SHIF (Social Health)",         lipafoPaybill: "LPF-600101", category: "Insurance", popular: true,    settlementWindow: "T+1" },
  { id: "jubilee",        name: "Jubilee Insurance",            lipafoPaybill: "LPF-600102", category: "Insurance",                    settlementWindow: "T+1" },
  { id: "britam",         name: "Britam Insurance",             lipafoPaybill: "LPF-600103", category: "Insurance",                    settlementWindow: "T+1" },
  { id: "cic-insurance",  name: "CIC Insurance",                lipafoPaybill: "LPF-600104", category: "Insurance",                    settlementWindow: "T+1" },

  // Government
  { id: "kra",            name: "KRA (Tax Payments)",           lipafoPaybill: "LPF-700101", category: "Government", popular: true,   settlementWindow: "Instant" },
  { id: "ntsa",           name: "NTSA (TIMS)",                  lipafoPaybill: "LPF-700102", category: "Government",                   settlementWindow: "T+0" },
  { id: "ecitizen",       name: "eCitizen Services",            lipafoPaybill: "LPF-700103", category: "Government",                   settlementWindow: "Instant" },
];

// Flat KCB-orchestrated Lipafo fee tiers (in KES) — NO M-PESA charges ever
const computeLipafoFee = (amount: number): number => {
  if (amount <= 0) return 0;
  if (amount <= 1000) return 10;
  if (amount <= 10000) return 20;
  if (amount <= 50000) return 30;
  return 45; // flat cap above 50k
};

export function InteropPaybillFlow({ open, onOpenChange }: InteropPaybillFlowProps) {
  const { toast } = useToast();
  const { addTransaction, balances } = useWallet();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [tab, setTab] = useState<"directory" | "manual">("directory");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [selectedBiller, setSelectedBiller] = useState<Biller | null>(null);

  // Manual entry — Lipafo paybill only
  const [manualPaybill, setManualPaybill] = useState("");
  const [manualName, setManualName] = useState("");

  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [processing, setProcessing] = useState(false);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(BILLER_DIRECTORY.map(b => b.category)))],
    []
  );

  const filtered = useMemo(() => {
    return BILLER_DIRECTORY.filter(b => {
      const matchCat = category === "All" || b.category === category;
      const q = search.trim().toLowerCase();
      const matchSearch = !q || b.name.toLowerCase().includes(q) || b.lipafoPaybill.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [search, category]);

  const activeBiller: Biller | null = useMemo(() => {
    if (tab === "directory") return selectedBiller;
    if (!manualPaybill) return null;
    const formatted = manualPaybill.toUpperCase().startsWith("LPF-")
      ? manualPaybill.toUpperCase()
      : `LPF-${manualPaybill.replace(/\D/g, "")}`;
    return {
      id: "manual",
      name: manualName || `Lipafo Biller ${formatted}`,
      lipafoPaybill: formatted,
      category: "Custom",
      settlementWindow: "T+1",
    };
  }, [tab, selectedBiller, manualPaybill, manualName]);

  const amt = parseFloat(amount) || 0;
  const lipafoFee = computeLipafoFee(amt);
  const total = amt + lipafoFee;
  const insufficient = amt > 0 && total > balances.main;

  const reset = () => {
    setStep(1); setSearch(""); setCategory("All"); setSelectedBiller(null);
    setManualPaybill(""); setManualName(""); setAccountNumber(""); setAmount("");
    setProcessing(false); setTab("directory");
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
    await new Promise(r => setTimeout(r, 1400));
    await addTransaction({
      type: "bill",
      amount: -total,
      description: `${activeBiller.name} • Lipafo (KCB) • Acc ${accountNumber}`,
      recipient: activeBiller.lipafoPaybill,
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
            Lipafo Paybill — Powered by KCB
          </DialogTitle>
          <DialogDescription>
            Direct bank-orchestrated bill payments. Flat fee, KCB-held float, zero mobile-money charges.
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1 — Choose biller */}
        {step === 1 && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            <div className="glass-card p-3 rounded-xl border border-primary/30 bg-primary/5 flex items-start gap-3">
              <Landmark className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <div><span className="text-foreground font-semibold">Lipafo is the primary rail.</span> Every paybill below is a KCB-issued Lipafo short code (LPF-XXXXXX).</div>
                <div className="flex items-center gap-1 text-success"><Zap className="h-3 w-3" /> No M-PESA fees. No mobile-money intermediary. Flat KCB charge only.</div>
              </div>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="directory">Lipafo Directory</TabsTrigger>
                <TabsTrigger value="manual">Enter Lipafo Code</TabsTrigger>
              </TabsList>

              <TabsContent value="directory" className="flex-1 overflow-hidden flex flex-col space-y-3 mt-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or LPF code…"
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
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                                <Hash className="h-3 w-3" />
                                <span className="font-mono text-primary">{biller.lipafoPaybill}</span>
                                <span>•</span>
                                <span>{biller.category}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{biller.settlementWindow}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Landmark className="h-4 w-4 text-primary" />
                              <span className="text-[10px] text-muted-foreground">KCB rail</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {filtered.length === 0 && (
                      <div className="text-center text-sm text-muted-foreground py-8">
                        No biller found. Try the "Enter Lipafo Code" tab.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="manual" className="space-y-3 mt-3">
                <div className="glass-card p-3 rounded-lg border border-primary/20 bg-primary/5 text-xs text-muted-foreground">
                  <Landmark className="h-3 w-3 inline mr-1 text-primary" />
                  Enter any KCB-issued Lipafo paybill code (format: <span className="font-mono text-foreground">LPF-XXXXXX</span>).
                </div>
                <div>
                  <Label>Lipafo Paybill Code</Label>
                  <Input
                    placeholder="e.g. LPF-400102"
                    value={manualPaybill}
                    onChange={(e) => setManualPaybill(e.target.value)}
                    className="glass-card font-mono"
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
                  Lipafo validates the code in real-time against the KCB biller registry.
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
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                <Hash className="h-3 w-3" />
                <span className="font-mono text-primary">{activeBiller.lipafoPaybill}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Landmark className="h-3 w-3" /> KCB-orchestrated</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {activeBiller.settlementWindow}</span>
              </div>
            </div>
            <div>
              <Label>Account / Reference Number</Label>
              <Input
                placeholder="Meter no., account no., policy no…"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="glass-card"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                Same reference issued by your biller.
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
          <div className="space-y-4 overflow-y-auto">
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
                <div className="flex justify-between"><span className="text-muted-foreground">Lipafo Code</span><span className="text-foreground font-mono">{activeBiller.lipafoPaybill}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Account</span><span className="text-foreground">{accountNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Rail</span><span className="text-foreground">Lipafo (KCB direct)</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="text-foreground">KES {amt.toLocaleString()}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">KCB Lipafo fee (flat)</span>
                  <span className="text-foreground">KES {lipafoFee}</span>
                </div>
                <div className="flex justify-between text-success">
                  <span>M-PESA fee</span>
                  <span className="font-semibold">KES 0 — bypassed</span>
                </div>
                <div className="border-t border-glass-border/30 pt-2 flex justify-between font-semibold">
                  <span className="text-foreground">Total debit</span>
                  <span className="text-foreground">KES {total.toLocaleString()}</span>
                </div>
              </div>

              {/* Float economics — KCB holds float till settlement */}
              <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <TrendingUp className="h-3 w-3" /> Float & Settlement
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" /> Float held by</span>
                  <span className="text-foreground font-medium">KCB Lipafo Pool</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Biller settlement</span>
                  <span className="text-foreground font-medium">{activeBiller.settlementWindow}</span>
                </div>
                <p className="text-[11px] text-muted-foreground italic pt-1">
                  KCB earns float yield until backend settlement to the biller.
                </p>
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
                {processing ? (<><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Routing via KCB…</>) : "Pay Now"}
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
                KES {amt.toLocaleString()} routed to {activeBiller.name} via Lipafo (KCB).
              </p>
            </div>
            <div className="glass-card p-3 rounded-lg space-y-1 text-xs text-left">
              <div className="flex justify-between"><span className="text-muted-foreground">Lipafo Ref</span><span className="font-mono text-foreground">LPF-TXN-{Date.now().toString().slice(-8)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Float status</span><span className="text-primary font-medium">Held by KCB</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Biller settlement</span><span className="text-foreground">{activeBiller.settlementWindow}</span></div>
              <div className="flex justify-between text-success"><span>M-PESA fee paid</span><span className="font-semibold">KES 0</span></div>
            </div>
            <Button className="w-full button-3d" onClick={() => handleClose(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
