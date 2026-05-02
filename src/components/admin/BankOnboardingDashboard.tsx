import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Building2, Plus, ShieldCheck, Activity, FlaskConical, Rocket, FileCheck2, Settings2, RefreshCw, CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

type Stage = "application" | "kyb_legal" | "technical_setup" | "sandbox_certification" | "production_live" | "suspended" | "rejected";

const STAGE_ORDER: Stage[] = ["application", "kyb_legal", "technical_setup", "sandbox_certification", "production_live"];
const STAGE_LABEL: Record<Stage, string> = {
  application: "Application",
  kyb_legal: "KYB & Legal",
  technical_setup: "Technical Setup",
  sandbox_certification: "Sandbox Certification",
  production_live: "Production Live",
  suspended: "Suspended",
  rejected: "Rejected",
};

const STAGE_BADGE: Record<Stage, string> = {
  application: "bg-muted text-muted-foreground",
  kyb_legal: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  technical_setup: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  sandbox_certification: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  production_live: "bg-success/20 text-success",
  suspended: "bg-warning/20 text-warning",
  rejected: "bg-destructive/20 text-destructive",
};

interface Bank {
  id: string; bank_code: string; bank_name: string; bic: string | null;
  legal_entity_name: string | null; registration_number: string | null;
  cbk_license_number: string | null;
  contact_name: string | null; contact_email: string | null; contact_phone: string | null;
  tech_contact_name: string | null; tech_contact_email: string | null;
  lifecycle_stage: Stage; kyb_status: string; sandbox_certified_at: string | null;
  go_live_at: string | null; notes: string | null; created_at: string;
}

interface Profile {
  id?: string; bank_id: string; environment: "sandbox" | "production";
  pacs008_endpoint: string | null; pacs009_endpoint: string | null; pacs002_endpoint: string | null;
  webhook_callback_url: string | null; ip_allowlist: string[];
  mtls_client_cert_ref: string | null; mtls_server_ca_ref: string | null;
  hmac_key_ref: string | null; hmac_algorithm: string;
  timeout_ms: number; rate_limit_tps: number;
  breaker_failure_threshold: number; breaker_recovery_ms: number;
  is_active: boolean;
}

export function BankOnboardingDashboard() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);

  const fetchBanks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("participating_banks").select("*").order("created_at", { ascending: false });
    setBanks((data as Bank[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBanks(); }, [fetchBanks]);

  const selected = banks.find(b => b.id === selectedBankId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6 text-primary" /> Participating Bank Onboarding</h2>
          <p className="text-sm text-muted-foreground">5-stage lifecycle: Application → KYB → Technical → Sandbox Cert → Production Live</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchBanks}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />Onboard Bank</Button>
        </div>
      </div>

      {/* Stage funnel summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STAGE_ORDER.map(s => {
          const count = banks.filter(b => b.lifecycle_stage === s).length;
          return (
            <Card key={s} className="glass-card">
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">{STAGE_LABEL[s]}</div>
                <div className="text-2xl font-bold">{count}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bank list */}
      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Participating Banks</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
          ) : banks.length === 0 ? (
            <div className="text-sm text-muted-foreground py-10 text-center">
              No participating banks yet. Click "Onboard Bank" to start.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 px-2">Bank</th>
                    <th className="text-left py-2 px-2">Code / BIC</th>
                    <th className="text-left py-2 px-2">Stage</th>
                    <th className="text-left py-2 px-2">KYB</th>
                    <th className="text-left py-2 px-2">Sandbox</th>
                    <th className="text-left py-2 px-2">Live</th>
                    <th className="text-right py-2 px-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {banks.map(b => (
                    <tr key={b.id} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="py-2 px-2 font-medium">{b.bank_name}</td>
                      <td className="py-2 px-2 text-muted-foreground">{b.bank_code} / {b.bic || "—"}</td>
                      <td className="py-2 px-2"><Badge className={STAGE_BADGE[b.lifecycle_stage]} variant="secondary">{STAGE_LABEL[b.lifecycle_stage]}</Badge></td>
                      <td className="py-2 px-2 text-xs">{b.kyb_status}</td>
                      <td className="py-2 px-2 text-xs">{b.sandbox_certified_at ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-muted-foreground" />}</td>
                      <td className="py-2 px-2 text-xs">{b.go_live_at ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-muted-foreground" />}</td>
                      <td className="py-2 px-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => setSelectedBankId(b.id)}>Open</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateBankDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={fetchBanks} />
      {selected && (
        <BankDetailDialog
          bank={selected}
          onClose={() => setSelectedBankId(null)}
          onChanged={fetchBanks}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Create Bank Dialog ───────────────────────── */

function CreateBankDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ bank_code: "", bank_name: "", bic: "", legal_entity_name: "", contact_name: "", contact_email: "" });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!form.bank_code || !form.bank_name) {
      toast({ title: "Missing fields", description: "Bank code and name are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("participating_banks").insert({
      bank_code: form.bank_code.toUpperCase(),
      bank_name: form.bank_name,
      bic: form.bic || null,
      legal_entity_name: form.legal_entity_name || null,
      contact_name: form.contact_name || null,
      contact_email: form.contact_email || null,
      lifecycle_stage: "application" as const,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Bank application created", description: "Now complete KYB and technical setup." });
    setForm({ bank_code: "", bank_name: "", bic: "", legal_entity_name: "", contact_name: "", contact_email: "" });
    onCreated(); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Onboard Participating Bank</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Bank Code *</Label><Input value={form.bank_code} onChange={e => setForm({ ...form, bank_code: e.target.value })} placeholder="e.g. KCB" /></div>
            <div><Label>BIC</Label><Input value={form.bic} onChange={e => setForm({ ...form, bic: e.target.value })} placeholder="KCBLKENX" /></div>
          </div>
          <div><Label>Bank Name *</Label><Input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} placeholder="KCB Bank Kenya" /></div>
          <div><Label>Legal Entity Name</Label><Input value={form.legal_entity_name} onChange={e => setForm({ ...form, legal_entity_name: e.target.value })} placeholder="Kenya Commercial Bank PLC" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Contact Name</Label><Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} /></div>
            <div><Label>Contact Email</Label><Input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></div>
          </div>
          <p className="text-xs text-muted-foreground">The bank will start in <b>Application</b> stage. Complete KYB, technical setup and sandbox certification before going live.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Creating…" : "Create Application"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Bank Detail Dialog (5-stage tabs) ───────────────────────── */

const STAGE_TO_TAB: Record<Stage, string> = {
  application: "kyb",
  kyb_legal: "kyb",
  technical_setup: "tech",
  sandbox_certification: "sandbox",
  production_live: "observability",
  suspended: "observability",
  rejected: "kyb",
};

function BankDetailDialog({ bank, onClose, onChanged }: { bank: Bank; onClose: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const stageIndex = STAGE_ORDER.indexOf(bank.lifecycle_stage);
  const progress = stageIndex >= 0 ? ((stageIndex + 1) / STAGE_ORDER.length) * 100 : 0;
  const defaultTab = STAGE_TO_TAB[bank.lifecycle_stage] || "kyb";

  const jumpToStage = async (target: Stage) => {
    await supabase.from("bank_lifecycle_events").insert({
      bank_id: bank.id, from_stage: bank.lifecycle_stage, to_stage: target,
      actor_user_id: user?.id, notes: "Admin override — jumped stage",
    });
    await supabase.from("participating_banks").update({ lifecycle_stage: target }).eq("id", bank.id);
    toast({ title: `Stage set to ${STAGE_LABEL[target]}` });
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> {bank.bank_name}
            <Badge className={STAGE_BADGE[bank.lifecycle_stage]} variant="secondary">{STAGE_LABEL[bank.lifecycle_stage]}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Onboarding progress</span><span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
            {STAGE_ORDER.map((s, i) => (
              <span key={s} className={i <= stageIndex ? "text-foreground font-medium" : ""}>{STAGE_LABEL[s]}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2">
            <span className="text-[10px] text-muted-foreground self-center mr-1">Admin jump:</span>
            {STAGE_ORDER.map(s => (
              <Button
                key={s}
                size="sm"
                variant={bank.lifecycle_stage === s ? "default" : "outline"}
                className="h-6 px-2 text-[10px]"
                onClick={() => jumpToStage(s)}
                disabled={bank.lifecycle_stage === s}
              >
                {STAGE_LABEL[s]}
              </Button>
            ))}
          </div>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="kyb"><FileCheck2 className="h-4 w-4 mr-1.5" />KYB & Legal</TabsTrigger>
            <TabsTrigger value="tech"><Settings2 className="h-4 w-4 mr-1.5" />Technical Setup</TabsTrigger>
            <TabsTrigger value="sandbox"><FlaskConical className="h-4 w-4 mr-1.5" />Sandbox Certification</TabsTrigger>
            <TabsTrigger value="golive"><Rocket className="h-4 w-4 mr-1.5" />Go-Live</TabsTrigger>
            <TabsTrigger value="observability"><Activity className="h-4 w-4 mr-1.5" />Observability</TabsTrigger>
          </TabsList>

          <TabsContent value="kyb"><KYBPanel bank={bank} onChanged={onChanged} /></TabsContent>
          <TabsContent value="tech"><TechnicalSetupPanel bank={bank} onChanged={onChanged} /></TabsContent>
          <TabsContent value="sandbox"><SandboxCertPanel bank={bank} onChanged={onChanged} /></TabsContent>
          <TabsContent value="golive"><GoLivePanel bank={bank} onChanged={onChanged} onClose={onClose} /></TabsContent>
          <TabsContent value="observability"><ObservabilityPanel bank={bank} /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Stage 2: KYB ───────────────────────── */

function KYBPanel({ bank, onChanged }: { bank: Bank; onChanged: () => void }) {
  const { user } = useAuth();
  const [reg, setReg] = useState(bank.registration_number || "");
  const [cbk, setCbk] = useState(bank.cbk_license_number || "");
  const [status, setStatus] = useState(bank.kyb_status);
  const [notes, setNotes] = useState(bank.notes || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("participating_banks").update({
      registration_number: reg || null, cbk_license_number: cbk || null,
      kyb_status: status, notes: notes || null,
    }).eq("id", bank.id);
    setSaving(false);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "KYB saved" });
    onChanged();
  };

  const advance = async () => {
    if (status !== "approved") {
      return toast({ title: "Cannot advance", description: "KYB must be approved before moving to Technical Setup.", variant: "destructive" });
    }
    await supabase.from("bank_lifecycle_events").insert({
      bank_id: bank.id, from_stage: bank.lifecycle_stage, to_stage: "technical_setup",
      actor_user_id: user?.id, notes: "KYB approved",
    });
    await supabase.from("participating_banks").update({ lifecycle_stage: "technical_setup" }).eq("id", bank.id);
    toast({ title: "Advanced to Technical Setup" });
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Company Registration Number</Label><Input value={reg} onChange={e => setReg(e.target.value)} /></div>
        <div><Label>CBK License Number</Label><Input value={cbk} onChange={e => setCbk(e.target.value)} /></div>
      </div>
      <div>
        <Label>KYB Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="submitted">Documents Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} /></div>
      <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground">
        <b>KYB checklist:</b> Certificate of Incorporation · CBK Banking Licence · Board Resolution · AML/CFT Policy · Beneficial Ownership Declaration · Most recent audited financials.
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {(bank.lifecycle_stage === "application") && (
          <Button variant="secondary" onClick={async () => {
            await supabase.from("bank_lifecycle_events").insert({ bank_id: bank.id, from_stage: "application", to_stage: "kyb_legal", actor_user_id: user?.id });
            await supabase.from("participating_banks").update({ lifecycle_stage: "kyb_legal" }).eq("id", bank.id);
            toast({ title: "Moved to KYB stage" }); onChanged();
          }}>Start KYB process →</Button>
        )}
        <Button variant="outline" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        <Button onClick={advance}>
          Advance to Technical Setup →
        </Button>
      </div>
    </div>
  );
}

/* ───────────────────────── Stage 3: Technical Setup (integration profile) ───────────────────────── */

function TechnicalSetupPanel({ bank, onChanged }: { bank: Bank; onChanged: () => void }) {
  const { user } = useAuth();
  const [env, setEnv] = useState<"sandbox" | "production">("sandbox");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("bank_integration_profiles").select("*").eq("bank_id", bank.id).eq("environment", env).maybeSingle();
    setProfile(data as Profile || {
      bank_id: bank.id, environment: env,
      pacs008_endpoint: "", pacs009_endpoint: "", pacs002_endpoint: "",
      webhook_callback_url: "", ip_allowlist: [],
      mtls_client_cert_ref: "", mtls_server_ca_ref: "", hmac_key_ref: "", hmac_algorithm: "HMAC-SHA256",
      timeout_ms: 2000, rate_limit_tps: 50,
      breaker_failure_threshold: 5, breaker_recovery_ms: 30000, is_active: false,
    });
    setLoading(false);
  }, [bank.id, env]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    const payload = { ...profile, bank_id: bank.id, environment: env };
    const { error } = await supabase.from("bank_integration_profiles").upsert(payload, { onConflict: "bank_id,environment" });
    setSaving(false);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: `${env} profile saved` });
    load();
  };

  const advance = async () => {
    if (!profile?.pacs008_endpoint || !profile?.pacs009_endpoint) {
      return toast({ title: "Endpoints required", description: "Both pacs.008 and pacs.009 endpoints must be set.", variant: "destructive" });
    }
    await supabase.from("bank_lifecycle_events").insert({
      bank_id: bank.id, from_stage: bank.lifecycle_stage, to_stage: "sandbox_certification",
      actor_user_id: user?.id, notes: "Technical setup complete",
    });
    await supabase.from("participating_banks").update({ lifecycle_stage: "sandbox_certification" }).eq("id", bank.id);
    toast({ title: "Advanced to Sandbox Certification" });
    onChanged();
  };

  if (loading || !profile) return <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>;

  const set = (k: keyof Profile, v: any) => setProfile({ ...profile, [k]: v });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label>Environment:</Label>
        <Select value={env} onValueChange={(v) => setEnv(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sandbox">Sandbox</SelectItem>
            <SelectItem value="production">Production</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant={profile.is_active ? "default" : "secondary"}>{profile.is_active ? "Active" : "Inactive"}</Badge>
      </div>

      <Card><CardHeader><CardTitle className="text-sm">ISO 20022 Endpoints</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>pacs.008 (Customer Credit Transfer) URL</Label><Input value={profile.pacs008_endpoint || ""} onChange={e => set("pacs008_endpoint", e.target.value)} placeholder="https://api.bank.co.ke/iso20022/pacs.008" /></div>
          <div><Label>pacs.009 (Bank-to-Bank Settlement) URL</Label><Input value={profile.pacs009_endpoint || ""} onChange={e => set("pacs009_endpoint", e.target.value)} placeholder="https://api.bank.co.ke/iso20022/pacs.009" /></div>
          <div><Label>pacs.002 (Status Report) URL</Label><Input value={profile.pacs002_endpoint || ""} onChange={e => set("pacs002_endpoint", e.target.value)} placeholder="https://api.bank.co.ke/iso20022/pacs.002" /></div>
          <div><Label>Webhook Callback URL (Lipafo → Bank)</Label><Input value={profile.webhook_callback_url || ""} onChange={e => set("webhook_callback_url", e.target.value)} placeholder="https://webhooks.bank.co.ke/lipafo" /></div>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="text-sm">Security</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>mTLS Client Cert Ref</Label><Input value={profile.mtls_client_cert_ref || ""} onChange={e => set("mtls_client_cert_ref", e.target.value)} placeholder="vault://certs/kcb-client" /></div>
            <div><Label>mTLS Server CA Ref</Label><Input value={profile.mtls_server_ca_ref || ""} onChange={e => set("mtls_server_ca_ref", e.target.value)} placeholder="vault://ca/kcb-root" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>HMAC Key Reference</Label><Input value={profile.hmac_key_ref || ""} onChange={e => set("hmac_key_ref", e.target.value)} placeholder="vault://hmac/kcb-signing-v1" /></div>
            <div><Label>HMAC Algorithm</Label>
              <Select value={profile.hmac_algorithm} onValueChange={(v) => set("hmac_algorithm", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HMAC-SHA256">HMAC-SHA256</SelectItem>
                  <SelectItem value="HMAC-SHA512">HMAC-SHA512</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>IP Allowlist (comma-separated CIDRs)</Label>
            <Input value={profile.ip_allowlist.join(", ")} onChange={e => set("ip_allowlist", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} placeholder="41.139.0.0/16, 196.201.0.0/16" />
          </div>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="text-sm">Reliability & Limits</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><Label>Timeout (ms)</Label><Input type="number" value={profile.timeout_ms} onChange={e => set("timeout_ms", parseInt(e.target.value || "0"))} /></div>
          <div><Label>Rate Limit (TPS)</Label><Input type="number" value={profile.rate_limit_tps} onChange={e => set("rate_limit_tps", parseInt(e.target.value || "0"))} /></div>
          <div><Label>Breaker Threshold</Label><Input type="number" value={profile.breaker_failure_threshold} onChange={e => set("breaker_failure_threshold", parseInt(e.target.value || "0"))} /></div>
          <div><Label>Recovery (ms)</Label><Input type="number" value={profile.breaker_recovery_ms} onChange={e => set("breaker_recovery_ms", parseInt(e.target.value || "0"))} /></div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Profile"}</Button>
        {bank.lifecycle_stage === "technical_setup" && env === "sandbox" && (
          <Button onClick={advance}>Advance to Sandbox Certification →</Button>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Stage 4: Sandbox Certification ───────────────────────── */

function SandboxCertPanel({ bank, onChanged }: { bank: Bank; onChanged: () => void }) {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [latestRun, setLatestRun] = useState<any | null>(null);

  const loadResults = useCallback(async () => {
    const { data } = await supabase.from("bank_certification_tests")
      .select("*").eq("bank_id", bank.id).eq("environment", "sandbox")
      .order("created_at", { ascending: false }).limit(50);
    setResults(data || []);
    if (data && data.length) {
      const runId = data[0].test_suite_run_id;
      setLatestRun(data.filter(d => d.test_suite_run_id === runId));
    }
  }, [bank.id]);
  useEffect(() => { loadResults(); }, [loadResults]);

  const runSuite = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("bank-certification-suite", {
        body: { bank_id: bank.id, environment: "sandbox" },
      });
      if (error) throw error;
      toast({
        title: data.all_required_passed ? "Certification PASSED" : "Certification incomplete",
        description: `${data.required_passed}/${data.required_total} required tests passed`,
        variant: data.all_required_passed ? "default" : "destructive",
      });
      await loadResults();
      if (data.all_required_passed) onChanged();
    } catch (e: any) {
      toast({ title: "Run failed", description: e.message, variant: "destructive" });
    } finally { setRunning(false); }
  };

  const advance = async () => {
    if (!bank.sandbox_certified_at) {
      return toast({ title: "Not certified", description: "All required tests must pass first.", variant: "destructive" });
    }
    await supabase.from("bank_lifecycle_events").insert({
      bank_id: bank.id, from_stage: bank.lifecycle_stage, to_stage: "production_live",
      actor_user_id: user?.id, notes: "Sandbox certified — going live",
    });
    await supabase.from("participating_banks").update({
      lifecycle_stage: "production_live", go_live_at: new Date().toISOString(),
    }).eq("id", bank.id);
    toast({ title: "🚀 Bank is now LIVE in production" });
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Runs the full ISO 20022 conformance suite against the sandbox profile.
          {bank.sandbox_certified_at && <span className="ml-2 text-success font-medium">✓ Certified {new Date(bank.sandbox_certified_at).toLocaleString()}</span>}
        </div>
        <Button onClick={runSuite} disabled={running}>
          {running ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Running…</> : <><FlaskConical className="h-4 w-4 mr-2" />Run Certification Suite</>}
        </Button>
      </div>

      {latestRun && latestRun.length > 0 && (
        <Card><CardHeader><CardTitle className="text-sm">Latest Run Results</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {latestRun.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-2 rounded border border-border/40 bg-muted/20">
                  <div className="flex items-center gap-2">
                    {r.status === "pass" ? <CheckCircle2 className="h-4 w-4 text-success" /> :
                     r.status === "fail" ? <XCircle className="h-4 w-4 text-destructive" /> :
                     <AlertCircle className="h-4 w-4 text-warning" />}
                    <div>
                      <div className="text-sm font-medium">{r.test_name} <span className="text-xs text-muted-foreground">({r.test_code})</span></div>
                      {r.error_message && <div className="text-xs text-destructive">{r.error_message}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!r.is_required && <Badge variant="outline" className="text-[10px]">optional</Badge>}
                    <span className="text-xs text-muted-foreground">{r.latency_ms}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {bank.sandbox_certified_at && bank.lifecycle_stage === "sandbox_certification" && (
        <div className="flex justify-end">
          <Button onClick={advance}><Rocket className="h-4 w-4 mr-2" />Promote to Production</Button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Stage 5: Go-Live ───────────────────────── */

function GoLivePanel({ bank, onChanged, onClose }: { bank: Bank; onChanged: () => void; onClose: () => void }) {
  const { user } = useAuth();
  const ready = bank.lifecycle_stage === "sandbox_certification" && !!bank.sandbox_certified_at;
  const live = bank.lifecycle_stage === "production_live";

  const goLive = async () => {
    await supabase.from("bank_lifecycle_events").insert({
      bank_id: bank.id, from_stage: bank.lifecycle_stage, to_stage: "production_live",
      actor_user_id: user?.id, notes: "Production cutover",
    });
    await supabase.from("participating_banks").update({
      lifecycle_stage: "production_live", go_live_at: new Date().toISOString(),
    }).eq("id", bank.id);
    // Activate the production profile if it exists
    await supabase.from("bank_integration_profiles").update({ is_active: true })
      .eq("bank_id", bank.id).eq("environment", "production");
    toast({ title: "🚀 Bank is LIVE in production" });
    onChanged(); onClose();
  };

  const suspend = async () => {
    await supabase.from("bank_lifecycle_events").insert({
      bank_id: bank.id, from_stage: bank.lifecycle_stage, to_stage: "suspended",
      actor_user_id: user?.id, notes: "Suspended by admin",
    });
    await supabase.from("participating_banks").update({ lifecycle_stage: "suspended" }).eq("id", bank.id);
    await supabase.from("bank_integration_profiles").update({ is_active: false }).eq("bank_id", bank.id);
    toast({ title: "Bank suspended" });
    onChanged(); onClose();
  };

  return (
    <div className="space-y-4">
      <Card className="border-success/30">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-success" />Production Readiness</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ReadyItem ok={bank.kyb_status === "approved"} label="KYB approved" />
          <ReadyItem ok={!!bank.sandbox_certified_at} label="Sandbox certification passed" />
          <ReadyItem ok={ready || live} label="Ready for production cutover" />
        </CardContent>
      </Card>

      {live ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm">
            <div className="font-semibold text-success">✓ {bank.bank_name} is LIVE in production</div>
            <div className="text-xs text-muted-foreground mt-1">Go-live: {new Date(bank.go_live_at!).toLocaleString()}</div>
          </div>
          <div className="flex justify-end">
            <Button variant="destructive" onClick={suspend}>Suspend Production Traffic</Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button onClick={goLive} disabled={!ready}><Rocket className="h-4 w-4 mr-2" />Cutover to Production</Button>
        </div>
      )}
    </div>
  );
}

function ReadyItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
      <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

/* ───────────────────────── Observability Panel ───────────────────────── */

function ObservabilityPanel({ bank }: { bank: Bank }) {
  const [events, setEvents] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [breaker, setBreaker] = useState<any | null>(null);

  const load = useCallback(async () => {
    const [evRes, testRes, brRes] = await Promise.all([
      supabase.from("switch_events").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("bank_certification_tests").select("*").eq("bank_id", bank.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("bank_connectors").select("*").eq("bank_code", bank.bank_code).maybeSingle(),
    ]);
    setEvents(evRes.data || []);
    setTests(testRes.data || []);
    setBreaker(brRes.data);
  }, [bank.bank_code, bank.id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  // Compute metrics from cert test latencies as proxy when no live traffic yet
  const allLat = tests.filter(t => t.latency_ms != null).map(t => t.latency_ms).sort((a, b) => a - b);
  const pct = (p: number) => allLat.length ? allLat[Math.max(0, Math.ceil(p / 100 * allLat.length) - 1)] : 0;
  const successCount = tests.filter(t => t.status === "pass").length;
  const successRate = tests.length ? (successCount / tests.length * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5"><RefreshCw className="h-3 w-3" />Auto-refreshes every 5s</div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Refresh now</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricTile label="Success rate" value={`${successRate}%`} />
        <MetricTile label="p50 latency" value={`${pct(50)}ms`} />
        <MetricTile label="p95 latency" value={`${pct(95)}ms`} />
        <MetricTile label="p99 latency" value={`${pct(99)}ms`} />
        <MetricTile label="Breaker"
          value={breaker?.circuit_state || "—"}
          variant={breaker?.circuit_state === "OPEN" ? "destructive" : breaker?.circuit_state === "HALF_OPEN" ? "warning" : "success"} />
      </div>

      <Card><CardHeader><CardTitle className="text-sm">Recent Test Messages (last 50)</CardTitle></CardHeader>
        <CardContent className="max-h-72 overflow-y-auto">
          {tests.length === 0 ? <div className="text-xs text-muted-foreground py-4 text-center">No traffic yet — run the certification suite to populate this view.</div> :
            <div className="space-y-1 text-xs">
              {tests.slice(0, 20).map(t => (
                <div key={t.id} className="flex items-center justify-between py-1 border-b border-border/30">
                  <span className="flex items-center gap-2">
                    {t.status === "pass" ? <CheckCircle2 className="h-3 w-3 text-success" /> : <XCircle className="h-3 w-3 text-destructive" />}
                    <span className="font-mono">{t.test_code}</span> <span className="text-muted-foreground">{t.test_name}</span>
                  </span>
                  <span className="text-muted-foreground">{t.latency_ms}ms · {new Date(t.created_at).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          }
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="text-sm">Recent Errors (with trace IDs)</CardTitle></CardHeader>
        <CardContent className="max-h-60 overflow-y-auto">
          {tests.filter(t => t.status === "fail").length === 0 ?
            <div className="text-xs text-muted-foreground py-4 text-center">No errors</div> :
            <div className="space-y-1 text-xs">
              {tests.filter(t => t.status === "fail").slice(0, 15).map(t => (
                <div key={t.id} className="p-2 rounded bg-destructive/5 border border-destructive/20">
                  <div className="flex items-center justify-between">
                    <span className="font-mono">{t.test_code}</span>
                    <span className="text-muted-foreground">trace: {t.test_suite_run_id?.slice(0, 8)}</span>
                  </div>
                  <div className="text-destructive mt-0.5">{t.error_message || "Unknown error"}</div>
                </div>
              ))}
            </div>
          }
        </CardContent>
      </Card>
    </div>
  );
}

function MetricTile({ label, value, variant }: { label: string; value: string; variant?: "success" | "warning" | "destructive" }) {
  const color = variant === "success" ? "text-success" : variant === "warning" ? "text-warning" : variant === "destructive" ? "text-destructive" : "";
  return (
    <Card className="glass-card"><CardContent className="pt-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </CardContent></Card>
  );
}
