import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, FileText, Banknote, Zap, GraduationCap, TrendingUp, Car, Home, Sparkles, Clock, Percent } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface LipafoAction {
  stage: "discover" | "recommend" | "eligibility" | "documents" | "review" | "submit";
  data: any;
}

const PRODUCT_CATALOG: Record<string, { name: string; icon: any; rate: number; processing: string; color: string }> = {
  "instant-cash":     { name: "Instant Cash",     icon: Zap,           rate: 8.5,  processing: "5 min",  color: "from-green-500 to-emerald-600" },
  "salary-advance":   { name: "Salary Advance",   icon: Banknote,      rate: 12,   processing: "1 hour", color: "from-blue-500 to-cyan-600" },
  "education-loan":   { name: "Education Loan",   icon: GraduationCap, rate: 15,   processing: "24 h",   color: "from-purple-500 to-pink-600" },
  "business-boost":   { name: "Business Boost",   icon: TrendingUp,    rate: 18,   processing: "2 h",    color: "from-orange-500 to-red-600" },
  "asset-financing":  { name: "Asset Financing",  icon: Car,           rate: 14,   processing: "3 h",    color: "from-indigo-500 to-purple-600" },
  "housing-loan":     { name: "Housing Loan",     icon: Home,          rate: 16,   processing: "5 h",    color: "from-teal-500 to-green-600" },
};

interface Props {
  action: LipafoAction;
  onUserReply: (text: string) => void;
}

export function LoanOriginationPanel({ action, onUserReply }: Props) {
  const { stage, data } = action;
  const { updateBalance, addTransaction } = useWallet();
  const auth = (() => { try { return useAuth(); } catch { return null; } })();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [docsConfirmed, setDocsConfirmed] = useState<Set<string>>(new Set());

  const stages = ["discover", "recommend", "eligibility", "documents", "review", "submit"];
  const currentIdx = stages.indexOf(stage);

  const StageRail = () => (
    <div className="flex items-center gap-1 mb-3 overflow-x-auto no-scrollbar">
      {stages.map((s, i) => (
        <div key={s} className="flex items-center gap-1 shrink-0">
          <div className={`w-2 h-2 rounded-full ${i <= currentIdx ? "bg-primary" : "bg-muted"}`} />
          <span className={`text-[10px] uppercase tracking-wide ${i === currentIdx ? "text-primary font-bold" : "text-muted-foreground"}`}>
            {s}
          </span>
          {i < stages.length - 1 && <div className={`w-3 h-px ${i < currentIdx ? "bg-primary" : "bg-muted"}`} />}
        </div>
      ))}
    </div>
  );

  // RECOMMEND
  if (stage === "recommend" && Array.isArray(data?.products)) {
    return (
      <div className="glass-card rounded-2xl p-3 border-primary/20 mt-2">
        <StageRail />
        <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-primary" /> Recommended for you
        </p>
        <div className="space-y-2">
          {data.products.map((pid: string) => {
            const p = PRODUCT_CATALOG[pid];
            if (!p) return null;
            const Icon = p.icon;
            return (
              <button
                key={pid}
                onClick={() => onUserReply(`I'd like to apply for ${p.name}.`)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-background/50 hover:bg-primary/10 border border-border/30 hover:border-primary/40 transition-all text-left touch-feedback"
              >
                <div className={`p-2 rounded-lg bg-gradient-to-br ${p.color}`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <span className="flex items-center gap-0.5"><Percent className="h-2.5 w-2.5" />{p.rate}%</span>
                    <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{p.processing}</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">Select</Badge>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // DOCUMENTS
  if (stage === "documents" && Array.isArray(data?.documents)) {
    const allConfirmed = data.documents.every((d: string) => docsConfirmed.has(d));
    return (
      <div className="glass-card rounded-2xl p-3 border-primary/20 mt-2">
        <StageRail />
        <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
          <FileText className="h-3 w-3 text-primary" /> Documents needed
        </p>
        <div className="space-y-1.5 mb-3">
          {data.documents.map((doc: string) => {
            const checked = docsConfirmed.has(doc);
            return (
              <button
                key={doc}
                onClick={() => {
                  const next = new Set(docsConfirmed);
                  if (checked) next.delete(doc); else next.add(doc);
                  setDocsConfirmed(next);
                }}
                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-primary/5 text-left"
              >
                {checked
                  ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                <span className={`text-xs ${checked ? "text-foreground line-through" : "text-foreground"}`}>{doc}</span>
              </button>
            );
          })}
        </div>
        <Button
          size="sm"
          className="w-full button-3d"
          disabled={!allConfirmed}
          onClick={() => onUserReply("I've gathered all documents. Please proceed to review.")}
        >
          {allConfirmed ? "All ready — continue to review" : `Tick ${data.documents.length - docsConfirmed.size} more`}
        </Button>
      </div>
    );
  }

  // REVIEW
  if (stage === "review") {
    const p = PRODUCT_CATALOG[data?.productId];
    return (
      <div className="glass-card rounded-2xl p-3 border-primary/20 mt-2">
        <StageRail />
        <p className="text-xs font-semibold text-foreground mb-2">Application summary</p>
        <div className="space-y-1.5 text-xs bg-background/50 rounded-xl p-3 mb-3">
          <Row label="Product" value={p?.name || data?.productId} />
          <Row label="Amount" value={`KES ${Number(data?.amount || 0).toLocaleString()}`} />
          <Row label="Term" value={`${data?.termMonths || 1} month${data?.termMonths > 1 ? "s" : ""}`} />
          <Row label="Purpose" value={data?.purpose || "—"} />
          <Row label="Monthly payment" value={`KES ${Number(data?.monthlyPayment || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} highlight />
          {data?.monthlyIncome && <Row label="Monthly income" value={`KES ${Number(data.monthlyIncome).toLocaleString()}`} />}
          {data?.employment && <Row label="Employment" value={data.employment} />}
        </div>
        <Button
          size="sm"
          className="w-full button-3d"
          onClick={() => onUserReply("Yes, please submit my application.")}
        >
          Confirm & continue
        </Button>
      </div>
    );
  }

  // SUBMIT — actually write to DB and disburse
  if (stage === "submit") {
    const p = PRODUCT_CATALOG[data?.productId];
    const amount = Number(data?.amount || 0);
    const monthlyPayment = Number(data?.monthlyPayment || amount);

    const handleSubmit = async () => {
      if (submitting || submitted) return;
      setSubmitting(true);
      try {
        if (auth?.user?.id && p && amount > 0) {
          await supabase.from("loan_applications").insert({
            user_id: auth.user.id,
            loan_type: data.productId,
            amount,
            duration_months: data?.termMonths || 1,
            interest_rate: p.rate,
            monthly_payment: monthlyPayment,
            purpose: data?.purpose || "AI-assisted application",
            status: "approved",
          });
        }
        updateBalance("main", amount);
        addTransaction({
          type: "received",
          amount,
          description: `${p?.name || "Loan"} - AI-assisted disbursement`,
          status: "completed",
          walletType: "main",
        });
        toast({
          title: "Loan approved 🎉",
          description: `KES ${amount.toLocaleString()} disbursed to your main wallet.`,
        });
        setSubmitted(true);
      } catch (e) {
        console.error(e);
        toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" });
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="glass-card rounded-2xl p-3 border-primary/20 mt-2">
        <StageRail />
        {submitted ? (
          <div className="text-center py-3">
            <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-2" />
            <p className="text-sm font-bold text-foreground">Disbursed!</p>
            <p className="text-xs text-muted-foreground">KES {amount.toLocaleString()} sent to your main wallet.</p>
          </div>
        ) : (
          <Button size="sm" className="w-full button-3d" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : `Submit & disburse KES ${amount.toLocaleString()}`}
          </Button>
        )}
      </div>
    );
  }

  // discover / eligibility — purely conversational, just show the rail
  return (
    <div className="mt-2 px-1">
      <StageRail />
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${highlight ? "text-primary" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

// Parser for the AI's action blocks
export function extractLipafoAction(text: string): { cleaned: string; action: LipafoAction | null } {
  const re = /\[\[LIPAFO_ACTION\]\]([\s\S]*?)\[\[\/LIPAFO_ACTION\]\]/;
  const m = text.match(re);
  if (!m) return { cleaned: text, action: null };
  try {
    const parsed = JSON.parse(m[1].trim());
    if (parsed?.stage) {
      return { cleaned: text.replace(re, "").trim(), action: parsed as LipafoAction };
    }
  } catch { /* malformed — leave inline */ }
  return { cleaned: text, action: null };
}
