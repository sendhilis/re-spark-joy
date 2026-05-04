import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Banknote, FileSignature, Send, CheckCircle2, ShieldCheck, Building2, AlertTriangle, Search } from "lucide-react";

type Agent = { id: string; agent_name: string; agent_code: string; bic: string | null; settlement_account: string; cutoff_local: string; status: string };
type Collateral = { id: string; member_bank: string; collateral_account: string; posted_balance: number; utilised_amount: number; available_balance: number; cap_amount: number; currency: string; last_topup_at: string | null };
type Instruction = { id: string; instruction_ref: string; cycle_date: string; debtor_bank: string; creditor_bank: string; amount: number; currency: string; message_type: string; status: string; dispatched_at: string | null; confirmed_at: string | null; agent_reference: string | null; rejection_reason: string | null; payload: any };
type Confirmation = { id: string; instruction_id: string; agent_reference: string; outcome: string; settled_amount: number | null; received_at: string; reason: string | null; raw_payload: any };

// ISO 20022 reject reason code → plain-English meaning + recommended ops action
const REJECT_PLAYBOOK: Record<string, { title: string; meaning: string; remediation: string; owner: string; severity: "high" | "medium" | "low" }> = {
  AC03: { title: "Invalid Creditor Account", meaning: "The creditor account number sent in the pacs.009 is not recognised by the beneficiary bank.", remediation: "Re-validate the beneficiary's settlement account in participating_banks. Re-issue pacs.009 with corrected CdtrAcct. Confirm via member-bank ops desk before retry.", owner: "Settlement Ops", severity: "high" },
  AG01: { title: "Transaction Forbidden On Account", meaning: "Beneficiary account is blocked, dormant or restricted from receiving interbank credits.", remediation: "Contact creditor bank's ops to lift block or supply alternate settlement account. Hold instruction and re-instruct on next cycle.", owner: "Member Bank Ops", severity: "high" },
  RC01: { title: "Bank Identifier Incorrect", meaning: "BIC of debtor or creditor agent failed validation at the agent.", remediation: "Reconcile bank_connectors.bank_code & participating_banks.bic. Update BIC, regenerate instruction, dispatch.", owner: "Switch Engineering", severity: "medium" },
  DUPL: { title: "Duplicate MsgId", meaning: "Agent already booked an instruction with the same MsgId — likely retry without idempotency.", remediation: "Confirm original posting in settlement_confirmations. Mark this instruction as duplicate-resolved (no new cash movement). Investigate dispatcher retry logic.", owner: "Switch Engineering", severity: "low" },
  FF01: { title: "Invalid File Format", meaning: "pacs.009 XML/JSON failed schema validation at agent gateway.", remediation: "Validate payload against ISO 20022 pacs.009.001.08 schema. Check mandatory fields (SttlmMtd, IntrBkSttlmAmt). Patch generator and redeploy.", owner: "Switch Engineering", severity: "high" },
  AM04: { title: "Insufficient Funds At Agent", meaning: "Debtor's collateral position at the agent was insufficient when the instruction was booked.", remediation: "Trigger collateral top-up via settlement-agent-loop (action: topup) for the debtor bank. Re-instruct only after posted_balance ≥ amount.", owner: "Treasury", severity: "high" },
};

function parseRejectCode(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const m = reason.match(/\b([A-Z]{2}\d{2}|DUPL)\b/);
  return m ? m[1] : null;
}

const fmt = (n: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);

export function SettlementAgentConsole() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [collateral, setCollateral] = useState<Collateral[]>([]);
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<Instruction | null>(null);

  const confByInstruction = new Map(confirmations.map((c) => [c.instruction_id, c]));
  const rejected = instructions.filter((i) => i.status === "rejected");

  const load = async () => {
    const [a, c, i, cf] = await Promise.all([
      supabase.from("settlement_agents").select("*").eq("agent_code", "KCB_KE_AGENT").maybeSingle(),
      supabase.from("member_collateral").select("*").order("member_bank"),
      supabase.from("settlement_instructions").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("settlement_confirmations").select("*").order("received_at", { ascending: false }).limit(100),
    ]);
    if (a.data) setAgent(a.data as Agent);
    if (c.data) setCollateral(c.data as Collateral[]);
    if (i.data) setInstructions(i.data as Instruction[]);
    if (cf.data) setConfirmations(cf.data as Confirmation[]);
  };

  useEffect(() => { load(); }, []);

  const run = async (action: "generate" | "dispatch" | "confirm") => {
    setBusy(action);
    try {
      const { data, error } = await supabase.functions.invoke("settlement-agent-loop", { body: { action } });
      if (error) throw error;
      toast.success(`${action.toUpperCase()} → ${JSON.stringify(data)}`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const totalPosted = collateral.reduce((s, c) => s + Number(c.posted_balance), 0);
  const totalUtilised = collateral.reduce((s, c) => s + Number(c.utilised_amount), 0);
  const generated = instructions.filter((i) => i.status === "generated").length;
  const dispatched = instructions.filter((i) => i.status === "dispatched").length;
  const confirmed = instructions.filter((i) => i.status === "confirmed").length;

  const statusBadge = (s: string) => {
    const v: any = s === "confirmed" ? "default" : s === "dispatched" ? "secondary" : s === "rejected" ? "destructive" : "outline";
    return <Badge variant={v} className="capitalize">{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Settlement Agent Console
          </h2>
          <p className="text-sm text-muted-foreground">
            Lipafo clears; the <strong>Settlement Agent ({agent?.agent_name ?? "—"})</strong> moves the cash between member-bank collateral accounts.
            Cycle cut-off {agent?.cutoff_local ?? "13:00"} · ISO 20022 pacs.009.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => run("generate")} disabled={!!busy} variant="outline" className="gap-1"><FileSignature className="h-4 w-4" />1. Generate</Button>
          <Button onClick={() => run("dispatch")} disabled={!!busy} variant="outline" className="gap-1"><Send className="h-4 w-4" />2. Dispatch to Agent</Button>
          <Button onClick={() => run("confirm")} disabled={!!busy} className="button-3d gap-1"><CheckCircle2 className="h-4 w-4" />3. Receive Confirmations</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Building2 className="h-4 w-4 text-primary" />} title="Agent" value={agent?.agent_code ?? "—"} sub={agent?.bic ?? ""} />
        <StatCard icon={<Banknote className="h-4 w-4 text-success" />} title="Total Collateral Posted" value={fmt(totalPosted)} sub={`${collateral.length} member banks`} />
        <StatCard icon={<FileSignature className="h-4 w-4 text-warning" />} title="Cycle Pipeline" value={`${generated} / ${dispatched} / ${confirmed}`} sub="generated / dispatched / confirmed" />
        <StatCard icon={<ShieldCheck className="h-4 w-4 text-primary" />} title="Currently Earmarked" value={fmt(totalUtilised)} sub="vs available collateral" />
      </div>

      {rejected.length > 0 && (
        <Card className="glass-card border-destructive/40">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-destructive">
                {rejected.length} rejected instruction{rejected.length > 1 ? "s" : ""} · {fmt(rejected.reduce((s, r) => s + Number(r.amount), 0))} unsettled
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {rejected.slice(0, 6).map((r) => {
                  const code = parseRejectCode(r.rejection_reason ?? confByInstruction.get(r.id)?.reason) ?? "UNK";
                  return (
                    <button key={r.id} onClick={() => setDrilldown(r)} className="text-[11px] px-2 py-1 rounded-md bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 font-mono text-destructive transition-colors">
                      {code} · {r.instruction_ref}
                    </button>
                  );
                })}
                {rejected.length > 6 && <span className="text-[11px] text-muted-foreground self-center">+{rejected.length - 6} more</span>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="collateral" className="space-y-4">
        <TabsList className="glass-card flex-wrap h-auto">
          <TabsTrigger value="collateral">Member Collateral</TabsTrigger>
          <TabsTrigger value="instructions">Settlement Instructions (pacs.009)</TabsTrigger>
          <TabsTrigger value="confirmations">Agent Confirmations</TabsTrigger>
        </TabsList>

        <TabsContent value="collateral">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pre-funded collateral held at {agent?.agent_name ?? "Settlement Agent"}</CardTitle>
              <p className="text-xs text-muted-foreground">Lipafo will not accept clearing volume from a member bank beyond its available balance.</p>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member Bank</TableHead>
                    <TableHead>Collateral Account</TableHead>
                    <TableHead className="text-right">Posted</TableHead>
                    <TableHead className="text-right">Earmarked</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="w-[180px]">Utilisation</TableHead>
                    <TableHead className="text-right">Cap</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collateral.map((c) => {
                    const util = c.posted_balance > 0 ? (Number(c.utilised_amount) / Number(c.posted_balance)) * 100 : 0;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.member_bank}</TableCell>
                        <TableCell className="font-mono text-[11px]">{c.collateral_account}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(Number(c.posted_balance))}</TableCell>
                        <TableCell className="text-right text-xs text-warning">{fmt(Number(c.utilised_amount))}</TableCell>
                        <TableCell className="text-right text-xs font-semibold text-success">{fmt(Number(c.available_balance))}</TableCell>
                        <TableCell><Progress value={util} className="h-2" /></TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{fmt(Number(c.cap_amount))}</TableCell>
                      </TableRow>
                    );
                  })}
                  {collateral.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No collateral records.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="instructions">
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead>Debtor → Creditor</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dispatched</TableHead>
                    <TableHead>Confirmed</TableHead>
                    <TableHead>Agent Ref</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instructions.map((i) => {
                    const isRejected = i.status === "rejected";
                    const code = isRejected ? parseRejectCode(i.rejection_reason ?? confByInstruction.get(i.id)?.reason) : null;
                    return (
                      <TableRow key={i.id} className={isRejected ? "bg-destructive/5" : ""}>
                        <TableCell className="font-mono text-[11px]">{i.instruction_ref}</TableCell>
                        <TableCell className="text-xs">{i.cycle_date}</TableCell>
                        <TableCell className="text-xs">{i.debtor_bank} → {i.creditor_bank}</TableCell>
                        <TableCell className="text-right text-xs font-semibold">{fmt(Number(i.amount))}</TableCell>
                        <TableCell className="text-xs"><Badge variant="outline">{i.message_type}</Badge></TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            {statusBadge(i.status)}
                            {code && <span className="font-mono text-[10px] text-destructive">{code}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-[11px]">{i.dispatched_at ? new Date(i.dispatched_at).toLocaleTimeString("en-KE") : "—"}</TableCell>
                        <TableCell className="text-[11px]">{i.confirmed_at ? new Date(i.confirmed_at).toLocaleTimeString("en-KE") : "—"}</TableCell>
                        <TableCell className="font-mono text-[10px]">{i.agent_reference ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          {isRejected ? (
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => setDrilldown(i)}>
                              <Search className="h-3 w-3" />Investigate
                            </Button>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {instructions.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No instructions yet — click <strong>Generate</strong> after the EOD cut-off.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="confirmations">
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent Ref</TableHead>
                    <TableHead>Instruction</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead className="text-right">Settled Amount</TableHead>
                    <TableHead>Received</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {confirmations.map((c) => {
                    const ins = instructions.find((i) => i.id === c.instruction_id);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-[11px]">{c.agent_reference}</TableCell>
                        <TableCell className="font-mono text-[11px]">{ins?.instruction_ref ?? c.instruction_id.slice(0, 8)}</TableCell>
                        <TableCell>{statusBadge(c.outcome)}</TableCell>
                        <TableCell className="text-right text-xs">{c.settled_amount ? fmt(Number(c.settled_amount)) : "—"}</TableCell>
                        <TableCell className="text-[11px]">{new Date(c.received_at).toLocaleString("en-KE")}</TableCell>
                      </TableRow>
                    );
                  })}
                  {confirmations.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No confirmations yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon, title, value, sub }: { icon: React.ReactNode; title: string; value: string; sub?: string }) {
  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-base font-bold text-foreground truncate">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
      </CardContent>
    </Card>
  );
}
