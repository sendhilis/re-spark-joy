import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  ShoppingBag, CheckCircle2, ShieldCheck, TrendingUp, Store, Wallet,
  ArrowRight, Sparkles, AlertCircle, Receipt, Clock,
} from "lucide-react";

interface LipafoBNPLFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MerchantOption {
  id: string;
  name: string;
  category: string;
  sample: number;
}

const MERCHANTS: MerchantOption[] = [
  { id: "naivas", name: "Naivas Supermarket", category: "Groceries", sample: 4500 },
  { id: "carrefour", name: "Carrefour", category: "Retail", sample: 7200 },
  { id: "jumia", name: "Jumia Kenya", category: "Online Shopping", sample: 12000 },
  { id: "kfc", name: "KFC Kenya", category: "Restaurants", sample: 1800 },
  { id: "phonebox", name: "Phone Box Ltd", category: "Electronics", sample: 25000 },
  { id: "bata", name: "Bata Stores", category: "Apparel", sample: 3500 },
];

const STORAGE_KEY = "lipafo.bnpl.outstanding";
const HISTORY_KEY = "lipafo.bnpl.history";

interface BNPLRecord {
  id: string;
  merchant: string;
  amount: number;
  fee: number;
  total: number;
  createdAt: string;
  status: "active" | "repaid";
  repaidAt?: string;
}

export function LipafoBNPLFlow({ open, onOpenChange }: LipafoBNPLFlowProps) {
  const [step, setStep] = useState(1);
  const [merchantId, setMerchantId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [agreed, setAgreed] = useState(false);
  const { toast } = useToast();
  const { balances, transactions, addTransaction } = useWallet();
  const { user } = useAuth();

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  // ------- Eligibility scoring (mock based on real tx history) -------
  const eligibility = useMemo(() => {
    const inflows = transactions.filter((t) => t.amount > 0);
    const outflows = transactions.filter((t) => t.amount < 0);
    const totalInflow = inflows.reduce((s, t) => s + t.amount, 0);
    const txCount = transactions.length;

    // Score: base + flow + activity
    let score = 550;
    if (totalInflow > 5000) score += 60;
    if (totalInflow > 20000) score += 80;
    if (txCount >= 5) score += 40;
    if (txCount >= 15) score += 60;
    if (balances.main >= 500) score += 30;
    if (outflows.length >= 3) score += 30;
    score = Math.min(score, 850);

    const tier =
      score >= 780 ? "Platinum" : score >= 700 ? "Gold" : score >= 620 ? "Silver" : "Starter";
    const limit =
      score >= 780 ? 50000 : score >= 700 ? 25000 : score >= 620 ? 10000 : 3000;

    const eligible = score >= 600;
    return { score, tier, limit, eligible, totalInflow, txCount };
  }, [transactions, balances.main]);

  const merchant = MERCHANTS.find((m) => m.id === merchantId);
  const numericAmount = Number(amount) || 0;
  const fee = Math.round(numericAmount * 0.025); // 2.5% service fee
  const totalRepay = numericAmount + fee;

  // ------- Outstanding balance & auto-repay watcher -------
  const userKey = user?.id ?? "guest";
  const storageKey = `${STORAGE_KEY}.${userKey}`;
  const historyKey = `${HISTORY_KEY}.${userKey}`;

  const [outstanding, setOutstanding] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem(storageKey) || 0);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOutstanding(Number(localStorage.getItem(storageKey) || 0));
  }, [storageKey, open]);

  // Auto-deduct on next inflow (mock: when a positive non-BNPL tx arrives, settle it)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const current = Number(localStorage.getItem(storageKey) || 0);
    if (current <= 0) return;

    const lastSeenId = localStorage.getItem(`${storageKey}.lastSeen`) || "";
    const newInflow = transactions.find(
      (t) =>
        t.amount > 0 &&
        t.id !== lastSeenId &&
        !t.description.toLowerCase().includes("bnpl") &&
        t.type !== "pension_contribution",
    );
    if (!newInflow) return;
    localStorage.setItem(`${storageKey}.lastSeen`, newInflow.id);

    const settle = Math.min(current, newInflow.amount);
    if (settle <= 0) return;

    addTransaction({
      type: "sent",
      amount: -settle,
      description: `Lipafo BNPL auto-repayment from inflow`,
      status: "completed",
      walletType: "main",
    });

    const remaining = current - settle;
    localStorage.setItem(storageKey, String(remaining));
    setOutstanding(remaining);

    // Update history
    const history: BNPLRecord[] = JSON.parse(localStorage.getItem(historyKey) || "[]");
    if (remaining === 0) {
      const updated = history.map((h) =>
        h.status === "active" ? { ...h, status: "repaid" as const, repaidAt: new Date().toISOString() } : h,
      );
      localStorage.setItem(historyKey, JSON.stringify(updated));
    }

    toast({
      title: "BNPL Repayment Processed",
      description: `KSh ${settle.toLocaleString()} auto-deducted from inflow. Remaining: KSh ${remaining.toLocaleString()}`,
    });
  }, [transactions, storageKey, historyKey, addTransaction, toast]);

  const reset = () => {
    setStep(1);
    setMerchantId("");
    setAmount("");
    setAgreed(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) setTimeout(reset, 300);
    onOpenChange(o);
  };

  const canProceedStep2 = !!merchantId;
  const canProceedStep3 =
    numericAmount > 0 &&
    numericAmount <= eligibility.limit &&
    numericAmount + outstanding <= eligibility.limit;

  const handleConfirmPurchase = async () => {
    if (!merchant) return;

    // Credit wallet (simulating merchant being paid by Lipafo on customer's behalf)
    await addTransaction({
      type: "received",
      amount: numericAmount,
      description: `Lipafo BNPL credit — ${merchant.name}`,
      recipient: merchant.name,
      status: "completed",
      walletType: "main",
    });

    // Immediately debit as merchant payment
    await addTransaction({
      type: "sent",
      amount: -numericAmount,
      description: `Purchase at ${merchant.name} (BNPL)`,
      recipient: merchant.name,
      status: "completed",
      walletType: "main",
    });

    // Track outstanding
    const newTotal = outstanding + totalRepay;
    localStorage.setItem(storageKey, String(newTotal));
    setOutstanding(newTotal);

    // Save to history
    const history: BNPLRecord[] = JSON.parse(localStorage.getItem(historyKey) || "[]");
    const record: BNPLRecord = {
      id: crypto.randomUUID(),
      merchant: merchant.name,
      amount: numericAmount,
      fee,
      total: totalRepay,
      createdAt: new Date().toISOString(),
      status: "active",
    };
    localStorage.setItem(historyKey, JSON.stringify([record, ...history]));

    toast({
      title: "BNPL Purchase Approved!",
      description: `Pay ${merchant.name} now. KSh ${totalRepay.toLocaleString()} will be auto-repaid from your next inflow.`,
    });

    setStep(5);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Lipafo BNPL — Buy Now, Pay on Next Inflow
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            Step {step} of {totalSteps}
          </p>
        </div>

        {/* STEP 1: Eligibility */}
        {step === 1 && (
          <div className="space-y-4">
            <Card className="p-5 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Your Lipafo Trust Score</p>
                  <p className="text-4xl font-bold text-primary">{eligibility.score}</p>
                </div>
                <Badge variant="secondary" className="text-base px-3 py-1">
                  {eligibility.tier}
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Approved BNPL limit</span>
                  <span className="font-semibold">KSh {eligibility.limit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total inflows seen</span>
                  <span className="font-medium">KSh {eligibility.totalInflow.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Wallet activity</span>
                  <span className="font-medium">{eligibility.txCount} transactions</span>
                </div>
                {outstanding > 0 && (
                  <div className="flex justify-between pt-2 border-t border-primary/20">
                    <span className="text-warning font-medium">Outstanding BNPL</span>
                    <span className="font-semibold text-warning">
                      KSh {outstanding.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {!eligibility.eligible ? (
              <Card className="p-4 border-destructive/30 bg-destructive/5">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Not yet eligible</p>
                    <p className="text-sm text-muted-foreground">
                      Build transaction history with Lipafo to unlock BNPL. Make a few deposits or
                      payments and try again.
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-4 bg-success/5 border-success/30">
                <div className="flex gap-3">
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">You're approved!</p>
                    <p className="text-sm text-muted-foreground">
                      Shop at any partner merchant now and Lipafo settles your bill — auto-repaid
                      from your next wallet inflow.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => handleClose(false)}>Close</Button>
              <Button onClick={() => setStep(2)} disabled={!eligibility.eligible}>
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Merchant */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-foreground mb-1">Choose your merchant</h3>
              <p className="text-sm text-muted-foreground">
                Where are you shopping today?
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MERCHANTS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMerchantId(m.id)}
                  className={`text-left p-4 rounded-lg border transition-all ${
                    merchantId === m.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      <Store className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.category}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)} disabled={!canProceedStep2}>
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Amount */}
        {step === 3 && merchant && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-foreground mb-1">Purchase amount</h3>
              <p className="text-sm text-muted-foreground">
                Shopping at <span className="font-medium text-foreground">{merchant.name}</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bnpl-amount">Amount (KSh)</Label>
              <Input
                id="bnpl-amount"
                type="number"
                placeholder={`e.g. ${merchant.sample}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {[500, 1000, 2500, 5000, merchant.sample].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(String(v))}
                    className="text-xs px-3 py-1 rounded-full bg-muted hover:bg-muted/70 transition-colors"
                  >
                    KSh {v.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <Card className="p-4 space-y-2 bg-muted/30">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Purchase</span>
                <span className="font-medium">KSh {numericAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">BNPL service fee (2.5%)</span>
                <span className="font-medium">KSh {fee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="font-semibold">Total to repay</span>
                <span className="font-bold text-primary">KSh {totalRepay.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Remaining limit after this</span>
                <span>
                  KSh {(eligibility.limit - outstanding - totalRepay).toLocaleString()}
                </span>
              </div>
            </Card>

            {numericAmount > 0 && !canProceedStep3 && (
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Exceeds your available BNPL limit.
              </p>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={() => setStep(4)} disabled={!canProceedStep3}>
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Terms & confirm */}
        {step === 4 && merchant && (
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Review & confirm</h3>

            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <ShoppingBag className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">{merchant.name}</p>
                  <p className="text-xs text-muted-foreground">{merchant.category}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credit issued</span>
                  <span className="font-medium">KSh {numericAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service fee</span>
                  <span className="font-medium">KSh {fee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-base pt-2 border-t border-border">
                  <span className="font-semibold">Auto-repay on next inflow</span>
                  <span className="font-bold text-primary">
                    KSh {totalRepay.toLocaleString()}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="flex gap-3">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-medium text-foreground">How repayment works</p>
                  <ul className="text-muted-foreground space-y-1 list-disc pl-4">
                    <li>Lipafo settles the merchant on your behalf instantly.</li>
                    <li>The next deposit, salary, or transfer into your wallet is automatically debited until the BNPL balance is cleared.</li>
                    <li>No late fees if your inflow covers it. Partial inflows trigger partial repayments.</li>
                  </ul>
                </div>
              </div>
            </Card>

            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1"
              />
              <span className="text-muted-foreground">
                I authorize Lipafo to auto-debit my next wallet inflow until this BNPL balance is fully repaid.
              </span>
            </label>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
              <Button onClick={handleConfirmPurchase} disabled={!agreed}>
                Confirm BNPL Purchase
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5: Success */}
        {step === 5 && (
          <div className="space-y-4 text-center py-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground">BNPL Approved!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Lipafo has settled {merchant?.name} for you.
              </p>
            </div>
            <Card className="p-4 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount financed</span>
                <span className="font-medium">KSh {numericAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total to repay</span>
                <span className="font-bold text-primary">KSh {totalRepay.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">New outstanding balance</span>
                <span className="font-medium">KSh {outstanding.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
                <Clock className="h-3.5 w-3.5" />
                Repays automatically on your next inflow
              </div>
            </Card>
            <Button className="w-full" onClick={() => handleClose(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
