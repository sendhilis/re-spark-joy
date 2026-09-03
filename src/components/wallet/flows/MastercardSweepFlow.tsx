/**
 * MastercardSweepFlow — salary-day loan collection.
 *
 * Implements the Mastercard card-linking + salary-day sweep design:
 *   1. MPGS Hosted Session capture (PCI DSS SAQ A — see HostedCardSession)
 *   2. VERIFY + EMV 3DS2 at link time, MDES network token + STANDING_INSTRUCTION agreement
 *   3. A revocable sweep mandate (policy / percentage / cap / debit window)
 *   4. Salary-credit detection (CBS webhook, batch file, or manual fallback)
 *   5. Idempotent MPGS PAY (merchant-initiated) + atomic wallet credit & loan repayment
 *   6. Proactive nudges before and after every sweep
 *
 * No card charge or ledger posting happens in this component — it only calls the
 * orchestrator edge function, which owns all money movement.
 */
import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CreditCard, ShieldCheck, Loader2, CheckCircle2, XCircle, Bell, Landmark,
  RefreshCw, CalendarClock, Banknote, AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { HostedCardSession, type CardSummary } from "../HostedCardSession";

interface Props { open: boolean; onOpenChange: (open: boolean) => void }

type Policy = "EMI_ONLY" | "PERCENTAGE" | "FULL_SALARY";

const policyLabel: Record<Policy, string> = {
  EMI_ONLY: "Monthly instalment only",
  PERCENTAGE: "Percentage of each salary",
  FULL_SALARY: "Full salary credit",
};

export function MastercardSweepFlow({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [card, setCard] = useState<any>(null);
  const [mandate, setMandate] = useState<any>(null);
  const [loan, setLoan] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);
  const [nudges, setNudges] = useState<any[]>([]);

  // linking state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [captured, setCaptured] = useState<{ sessionId: string; sessionBlob: string; summary: CardSummary } | null>(null);
  const [linking, setLinking] = useState(false);
  const [policy, setPolicy] = useState<Policy>("EMI_ONLY");
  const [percentage, setPercentage] = useState(20);
  const [capAmount, setCapAmount] = useState(50000);
  const [issuerCountry, setIssuerCountry] = useState("AE");

  // salary simulation (manual / batch fallback path)
  const [salaryAmount, setSalaryAmount] = useState("4500");
  const [salaryCurrency, setSalaryCurrency] = useState("AED");
  const [sweeping, setSweeping] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [c, m, l, e, x, n] = await Promise.all([
      supabase.from("linked_cards").select("*").eq("status", "ACTIVE").order("linked_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("sweep_mandates").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("loan_accounts").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("salary_credit_events").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("sweep_executions").select("*").order("executed_at", { ascending: false }).limit(15),
      supabase.from("nudge_log").select("*").order("sent_at", { ascending: false }).limit(15),
    ]);
    setCard(c.data); setMandate(m.data); setLoan(l.data);
    setEvents(e.data ?? []); setExecutions(x.data ?? []); setNudges(n.data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { if (open) refresh(); }, [open, refresh]);

  const startSession = async () => {
    setCaptured(null);
    const { data, error } = await supabase.functions.invoke("mc-card-link", { body: { action: "create_session" } });
    if (error || data?.error) {
      toast({ title: "Could not start secure session", description: data?.error ?? error?.message, variant: "destructive" });
      return;
    }
    setSessionId(data.session_id);
  };

  useEffect(() => { if (open && !card) startSession(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, card]);

  const confirmLink = async () => {
    if (!captured) return;
    setLinking(true);
    const { data, error } = await supabase.functions.invoke("mc-card-link", {
      body: {
        action: "confirm_link",
        session_id: captured.sessionId,
        session_blob: captured.sessionBlob,
        issuer_country: issuerCountry,
        policy, percentage, cap_amount: capAmount,
        debit_window: "SAME_DAY",
      },
    });
    setLinking(false);
    if (error || data?.error) {
      toast({
        title: data?.error === "verification_declined" ? "Issuer declined verification" : "Linking failed",
        description: data?.gateway_code ? `${data.gateway_code} · ${data.three_ds ?? ""}` : (data?.error ?? error?.message),
        variant: "destructive",
      });
      setSessionId(null);
      await startSession();
      return;
    }
    toast({ title: "Card linked & mandate active", description: `3-D Secure authenticated. Network token ${data.token.mdes_token_id?.slice(0, 14)}… stored.` });
    setCaptured(null);
    await refresh();
  };

  const updateMandate = async (patch: Record<string, unknown>) => {
    if (!mandate) return;
    const { data, error } = await supabase.functions.invoke("mc-card-link", {
      body: { action: "update_mandate", mandate_id: mandate.id, ...patch },
    });
    if (error || data?.error) { toast({ title: "Update failed", description: data?.error ?? error?.message, variant: "destructive" }); return; }
    setMandate(data.mandate);
    toast({ title: "Mandate updated", description: `Status ${data.mandate.status} · ${policyLabel[data.mandate.policy as Policy]}` });
  };

  const triggerSalaryCredit = async (source: "WEBHOOK" | "BATCH" | "MANUAL") => {
    if (!user) return;
    const amount = parseFloat(salaryAmount);
    if (!(amount > 0)) { toast({ title: "Enter a salary amount", variant: "destructive" }); return; }
    setSweeping(true);
    const { data, error } = await supabase.functions.invoke("equity-cbs-salary-webhook", {
      body: {
        user_id: user.id, amount, currency: salaryCurrency, source,
        reference: `${source}-${Date.now()}`,
        value_date: new Date().toISOString().slice(0, 10),
      },
    });
    setSweeping(false);
    if (error || data?.error) { toast({ title: "Salary event rejected", description: data?.error ?? error?.message, variant: "destructive" }); return; }
    const r = data?.sweep?.results?.[0];
    if (r?.status === "SUCCESS") {
      toast({ title: "Sweep completed", description: `KES ${Number(r.repaid).toLocaleString()} collected from your card and posted to your loan. New balance KES ${Number(r.new_loan_balance).toLocaleString()}.` });
    } else if (r?.status === "FAILED") {
      toast({ title: "Sweep declined", description: `${r.gateway_code} on attempt ${r.attempt}. A retry is scheduled and a nudge was sent.`, variant: "destructive" });
    } else {
      toast({ title: "Salary credit recorded", description: r?.reason ? `Not swept: ${r.reason}` : "Awaiting sweep." });
    }
    await refresh();
  };

  const runOrchestrator = async () => {
    setSweeping(true);
    const { data } = await supabase.functions.invoke("mc-sweep-orchestrator", { body: {} });
    setSweeping(false);
    toast({ title: "Orchestrator scan complete", description: `${data?.processed ?? 0} unresolved salary event(s) evaluated.` });
    await refresh();
  };

  const projectedSweep = (() => {
    const kes = parseFloat(salaryAmount || "0") * (salaryCurrency === "AED" ? 35.2 : salaryCurrency === "USD" ? 129 : 1);
    const emi = Number(loan?.emi_amount ?? 0);
    let s = policy === "FULL_SALARY" ? kes : policy === "PERCENTAGE" ? kes * (percentage / 100) : emi;
    s = Math.min(s, capAmount, kes);
    if (Number(loan?.outstanding_balance ?? 0) > 0) s = Math.min(s, Number(loan.outstanding_balance));
    return Math.round(s);
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-glass-border max-w-3xl max-h-[90vh] overflow-hidden p-0 flex flex-col">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <CreditCard className="h-5 w-5 text-primary" />Salary-Day Loan Repayment
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Link your Mastercard salary card once — Rukisha collects your loan repayment automatically the day your salary lands.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto px-6 pb-6 touch-pan-y">
          <Tabs defaultValue={card ? "mandate" : "link"} className="w-full">
            <TabsList className="grid grid-cols-4 w-full glass-card">
              <TabsTrigger value="link">Card</TabsTrigger>
              <TabsTrigger value="mandate">Mandate</TabsTrigger>
              <TabsTrigger value="salary">Salary Day</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            {/* ── Card linking ─────────────────────────────────────────── */}
            <TabsContent value="link" className="space-y-4 pt-4">
              {card ? (
                <Card className="glass-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success" />{card.scheme} salary card linked
                    </div>
                    <Badge variant="outline" className="border-success/40 text-success">{card.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Masked PAN</span><p className="font-mono text-foreground">{card.masked_pan}</p></div>
                    <div><span className="text-muted-foreground">Expiry</span><p className="font-mono text-foreground">{String(card.expiry_month).padStart(2, "0")}/{String(card.expiry_year).slice(-2)}</p></div>
                    <div><span className="text-muted-foreground">MPGS token</span><p className="font-mono text-xs text-foreground break-all">{card.mc_token_ref}</p></div>
                    <div><span className="text-muted-foreground">MDES network token</span><p className="font-mono text-xs text-foreground break-all">{card.mdes_token_id}</p></div>
                    <div><span className="text-muted-foreground">Standing instruction</span><p className="font-mono text-xs text-foreground break-all">{card.mpgs_agreement_id}</p></div>
                    <div><span className="text-muted-foreground">3-D Secure</span><p className="text-foreground">{card.three_ds_status}</p></div>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground pt-2 border-t border-glass-border">
                    <ShieldCheck className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    <p>No card number or security code is stored — only the token reference and masked PAN above (PCI DSS SAQ A).</p>
                  </div>
                  <Button variant="outline" className="w-full" onClick={async () => { setCard(null); await startSession(); }}>
                    Replace card
                  </Button>
                </Card>
              ) : captured ? (
                <div className="space-y-4">
                  <Card className="glass-card p-4 space-y-2 text-sm">
                    <p className="font-semibold text-foreground">Card captured by gateway</p>
                    <div className="flex justify-between"><span className="text-muted-foreground">Scheme</span><span className="text-foreground">{captured.summary.scheme}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Masked PAN</span><span className="font-mono text-foreground">{captured.summary.number}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Expiry</span><span className="font-mono text-foreground">{String(captured.summary.expiry.month).padStart(2, "0")}/{String(captured.summary.expiry.year).slice(-2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Funding</span><span className="text-foreground">{captured.summary.fundingMethod}</span></div>
                  </Card>

                  <Card className="glass-card p-4 space-y-4">
                    <p className="font-semibold text-foreground">Set your sweep mandate</p>
                    <div>
                      <Label>Collection policy</Label>
                      <Select value={policy} onValueChange={(v) => setPolicy(v as Policy)}>
                        <SelectTrigger className="glass-card"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EMI_ONLY">Monthly instalment only</SelectItem>
                          <SelectItem value="PERCENTAGE">Percentage of each salary</SelectItem>
                          <SelectItem value="FULL_SALARY">Full salary credit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {policy === "PERCENTAGE" && (
                      <div>
                        <Label>Percentage of salary: {percentage}%</Label>
                        <Slider value={[percentage]} onValueChange={([v]) => setPercentage(v)} min={5} max={80} step={5} className="mt-2" />
                      </div>
                    )}
                    <div>
                      <Label>Per-debit cap (KES)</Label>
                      <Input type="number" value={capAmount} onChange={(e) => setCapAmount(Number(e.target.value))} className="glass-card" />
                    </div>
                    <div>
                      <Label>Card issuing country</Label>
                      <Select value={issuerCountry} onValueChange={setIssuerCountry}>
                        <SelectTrigger className="glass-card"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AE">United Arab Emirates</SelectItem>
                          <SelectItem value="SA">Saudi Arabia</SelectItem>
                          <SelectItem value="QA">Qatar</SelectItem>
                          <SelectItem value="GB">United Kingdom</SelectItem>
                          <SelectItem value="US">United States</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg p-3">
                      I authorise Equity Bank (Rukisha) to debit this card on each detected salary credit under a
                      Mastercard standing instruction, applying{" "}
                      {policy === "FULL_SALARY" ? "the full salary credit" : policy === "PERCENTAGE" ? `${percentage}% of the credit` : "my monthly instalment"}{" "}
                      to my loan, capped at KES {capAmount.toLocaleString()} per debit. I can pause or cancel this
                      mandate at any time from this screen.
                    </div>
                    <Button onClick={confirmLink} disabled={linking} className="w-full button-3d">
                      {linking ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying with 3-D Secure…</> : "Authorise & activate mandate"}
                    </Button>
                  </Card>
                </div>
              ) : (
                <HostedCardSession sessionId={sessionId} onCaptured={setCaptured} />
              )}
            </TabsContent>

            {/* ── Mandate ─────────────────────────────────────────────── */}
            <TabsContent value="mandate" className="space-y-4 pt-4">
              {mandate ? (
                <>
                  <Card className="glass-card p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">Standing instruction</p>
                        <p className="text-xs text-muted-foreground">{policyLabel[mandate.policy as Policy]} · cap KES {Number(mandate.cap_amount).toLocaleString()} · {mandate.debit_window.replace("_", " ").toLowerCase()}</p>
                      </div>
                      <Badge variant={mandate.status === "ACTIVE" ? "default" : "outline"}>{mandate.status}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                      <div className="flex items-center gap-2 text-sm text-foreground"><CalendarClock className="h-4 w-4 text-primary" />Sweep enabled</div>
                      <Switch checked={mandate.status === "ACTIVE"} onCheckedChange={(v) => updateMandate({ status: v ? "ACTIVE" : "PAUSED" })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Policy</Label>
                        <Select value={mandate.policy} onValueChange={(v) => updateMandate({ policy: v })}>
                          <SelectTrigger className="glass-card"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EMI_ONLY">Instalment only</SelectItem>
                            <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                            <SelectItem value="FULL_SALARY">Full salary</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Cap (KES)</Label>
                        <Input type="number" defaultValue={mandate.cap_amount} className="glass-card"
                          onBlur={(e) => Number(e.target.value) !== Number(mandate.cap_amount) && updateMandate({ cap_amount: Number(e.target.value) })} />
                      </div>
                    </div>
                    {mandate.policy === "PERCENTAGE" && (
                      <div>
                        <Label>Percentage: {mandate.percentage}%</Label>
                        <Slider value={[Number(mandate.percentage)]} min={5} max={80} step={5} className="mt-2"
                          onValueChange={([v]) => setMandate({ ...mandate, percentage: v })}
                          onValueCommit={([v]) => updateMandate({ percentage: v })} />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground border-t border-glass-border pt-3">{mandate.consent_text}</p>
                    <Button variant="outline" className="w-full text-destructive" onClick={() => updateMandate({ status: "CANCELLED" })}>
                      Cancel mandate
                    </Button>
                  </Card>

                  {loan && (
                    <Card className="glass-card p-5 space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-foreground"><Landmark className="h-4 w-4 text-primary" />Loan {loan.loan_reference}</div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Outstanding</span><span className="text-foreground font-semibold">KES {Number(loan.outstanding_balance).toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Monthly instalment</span><span className="text-foreground">KES {Number(loan.emi_amount).toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Status</span><span className="text-foreground">{loan.status}</span></div>
                    </Card>
                  )}
                </>
              ) : (
                <Card className="glass-card p-6 text-center text-sm text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto text-primary mb-3" />
                  Link your Mastercard salary card first — the mandate is created as part of the 3-D Secure authorisation.
                </Card>
              )}
            </TabsContent>

            {/* ── Salary day ──────────────────────────────────────────── */}
            <TabsContent value="salary" className="space-y-4 pt-4">
              <Card className="glass-card p-5 space-y-4">
                <div>
                  <p className="font-semibold text-foreground">Salary credit detection</p>
                  <p className="text-xs text-muted-foreground">
                    Preferred path is the real-time credit notification from Equity's core banking system. A nightly
                    batch file and this manual entry are fallbacks.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label>Salary amount</Label>
                    <Input type="number" value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} className="glass-card" />
                  </div>
                  <div>
                    <Label>Currency</Label>
                    <Select value={salaryCurrency} onValueChange={setSalaryCurrency}>
                      <SelectTrigger className="glass-card"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AED">AED</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="KES">KES</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Projected sweep</span><span className="font-semibold text-foreground">KES {projectedSweep.toLocaleString()}</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>Policy</span><span>{policyLabel[(mandate?.policy ?? policy) as Policy]}</span></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button onClick={() => triggerSalaryCredit("WEBHOOK")} disabled={sweeping} className="button-3d">
                    {sweeping ? <Loader2 className="h-4 w-4 animate-spin" /> : "CBS webhook"}
                  </Button>
                  <Button variant="outline" onClick={() => triggerSalaryCredit("BATCH")} disabled={sweeping}>Batch file</Button>
                  <Button variant="outline" onClick={() => triggerSalaryCredit("MANUAL")} disabled={sweeping}>Manual</Button>
                </div>
                <Button variant="ghost" size="sm" className="w-full" onClick={runOrchestrator} disabled={sweeping}>
                  <RefreshCw className="h-3.5 w-3.5 mr-2" />Run orchestrator safety-net scan
                </Button>
              </Card>

              <Card className="glass-card p-5 space-y-3">
                <p className="font-semibold text-foreground text-sm">Detected salary credits</p>
                {events.length === 0 && <p className="text-xs text-muted-foreground">No salary credits detected yet.</p>}
                {events.map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-sm border-b border-glass-border pb-2 last:border-0">
                    <div>
                      <p className="text-foreground">{e.currency} {Number(e.amount).toLocaleString()} <span className="text-muted-foreground text-xs">≈ KES {Number(e.amount_kes ?? 0).toLocaleString()}</span></p>
                      <p className="text-xs text-muted-foreground">{e.source} · {e.value_date} · {e.raw_reference}</p>
                    </div>
                    <Badge variant="outline" className={e.processed ? "border-success/40 text-success" : ""}>{e.processed ? "processed" : "pending"}</Badge>
                  </div>
                ))}
              </Card>
            </TabsContent>

            {/* ── Activity ────────────────────────────────────────────── */}
            <TabsContent value="activity" className="space-y-4 pt-4">
              <Card className="glass-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground text-sm flex items-center gap-2"><Banknote className="h-4 w-4 text-primary" />Sweep executions</p>
                  <Button variant="ghost" size="icon" onClick={refresh}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
                </div>
                {executions.length === 0 && <p className="text-xs text-muted-foreground">No sweeps attempted yet.</p>}
                {executions.map((x) => (
                  <div key={x.id} className="text-sm border-b border-glass-border pb-2 last:border-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground font-medium">KES {Number(x.amount).toLocaleString()}</span>
                      <Badge variant="outline" className={x.status === "SUCCESS" ? "border-success/40 text-success" : x.status === "FAILED" ? "border-destructive/40 text-destructive" : ""}>
                        {x.status === "SUCCESS" ? <CheckCircle2 className="h-3 w-3 mr-1" /> : x.status === "FAILED" ? <XCircle className="h-3 w-3 mr-1" /> : null}{x.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono break-all">
                      attempt {x.attempt_number} · {x.gateway_code ?? "—"} · order {x.mpgs_order_id ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono break-all">idempotency {x.idempotency_key}</p>
                  </div>
                ))}
              </Card>

              <Card className="glass-card p-5 space-y-3">
                <p className="font-semibold text-foreground text-sm flex items-center gap-2"><Bell className="h-4 w-4 text-primary" />Nudges</p>
                {nudges.length === 0 && <p className="text-xs text-muted-foreground">No nudges yet.</p>}
                {nudges.map((n) => (
                  <div key={n.id} className="text-sm border-b border-glass-border pb-2 last:border-0">
                    <p className="text-foreground">{n.message}</p>
                    <p className="text-xs text-muted-foreground">{n.event_type} · {n.channel} · {new Date(n.sent_at).toLocaleString()}</p>
                  </div>
                ))}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
