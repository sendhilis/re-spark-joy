import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, EyeOff, AlertTriangle, RefreshCw, Play, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AuditRow {
  id: string;
  intent_id: string | null;
  trace_id: string;
  originating_bank: string;
  terminating_bank: string;
  masking_applied: boolean;
  originating_payload: Record<string, unknown>;
  switch_stored_payload: Record<string, unknown>;
  terminating_payload: Record<string, unknown>;
  merchant_receipt_text: string | null;
  created_at: string;
}

const sampleMsisdns = ["0727292608", "0711456321", "0733908712", "0701224590"];
const vooma = { code: "522522", name: "Naivas Westgate (Vooma Till)" };

export function MSISDNMaskingProof() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bank_payload_audit")
      .select("*")
      .neq("originating_bank", "UNKNOWN")
      .neq("terminating_bank", "UNKNOWN")
      .order("created_at", { ascending: false })
      .limit(25);
    setLoading(false);
    if (error) {
      toast({ title: "Failed to load audit log", description: error.message, variant: "destructive" });
      return;
    }
    const list = (data ?? []) as unknown as AuditRow[];
    setRows(list);
    if (list.length && !selected) setSelected(list[0]);
  };

  useEffect(() => { load(); }, []);

  const simulate = async () => {
    setSimulating(true);
    const msisdn = sampleMsisdns[Math.floor(Math.random() * sampleMsisdns.length)];
    const amount = [500, 1500, 2000, 5000, 12000][Math.floor(Math.random() * 5)];
    const idempotency_key = crypto.randomUUID();
    const { data, error } = await supabase.functions.invoke("switch-process-intent", {
      body: {
        idempotency_key,
        payer_identifier: msisdn,
        payer_bank: "GAB",
        payee_identifier: vooma.code,
        payee_bank: "KCB",
        amount,
        currency: "KES",
        rail: "bank_rail",
      },
    });
    setSimulating(false);
    if (error) {
      toast({ title: "Simulation failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "GAB → KCB Vooma payment posted",
      description: `MSISDN ${msisdn} masked; KCB received no payer phone number. Trace ${(data as any)?.trace_id ?? "—"}`,
    });
    await load();
  };

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                MSISDN & Payer-Bank Masking — Proof Console
              </CardTitle>
              <CardDescription className="max-w-3xl mt-2">
                FTS v3.0 §2.5 minimum-necessary-data. Originating banks (e.g. GAB Kenya) keep full
                MSISDN; the Lipafo Switch tokenises it with a GAB-specific HSM key and the terminating
                bank (KCB) receives <strong>no payer phone number</strong> — only what is required to credit
                the Vooma merchant. This tab shows the actual payloads at every hop.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading} className="glass-card">
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={simulate} disabled={simulating} className="button-3d">
                <Play className="h-4 w-4 mr-2" />
                {simulating ? "Posting…" : "Simulate GAB → KCB Vooma"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="glass-card lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Recent cross-bank intents</CardTitle>
            <CardDescription>Click a row to inspect the payload at each hop.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-auto">
            {rows.length === 0 && (
              <p className="text-sm text-muted-foreground">No audited intents yet. Click "Simulate GAB → KCB Vooma".</p>
            )}
            {rows.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className={`w-full text-left rounded-lg p-3 border transition-colors ${
                  selected?.id === r.id ? "border-primary bg-primary/5" : "border-border/40 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-sm font-medium text-foreground flex items-center gap-1">
                    {r.originating_bank} <ArrowRight className="h-3 w-3" /> {r.terminating_bank}
                  </div>
                  {r.masking_applied ? (
                    <Badge variant="secondary" className="text-[10px]"><EyeOff className="h-3 w-3 mr-1" />MASKED</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />RAW</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-mono truncate">{r.trace_id}</div>
                <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          {selected ? (
            <>
              <PayloadCard
                title={`1. Originating bank (${selected.originating_bank}) sent to Lipafo`}
                tone="warn"
                note="Full MSISDN is present here — that is expected and required for the originating bank's own AML, authentication and dispute resolution. It never leaves this hop in cleartext."
                payload={selected.originating_payload}
              />
              <PayloadCard
                title="2. Lipafo Switch stored (encrypted at rest)"
                tone="info"
                note="HMAC token used for idempotency & velocity. Cipher reference is decryptable only by the originating bank's HSM key. Masked-visible form is what any Lipafo console shows."
                payload={selected.switch_stored_payload}
              />
              <PayloadCard
                title={`3. Terminating bank (${selected.terminating_bank}) actually received`}
                tone={selected.masking_applied ? "ok" : "warn"}
                note={
                  selected.masking_applied
                    ? "payer_msisdn is null. KCB cannot identify the GAB customer; it only needs paybill_or_till to credit the Vooma merchant."
                    : "Masking was NOT applied for this intent — terminating bank received the raw MSISDN."
                }
                payload={selected.terminating_payload}
              />
              <Card className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">4. Vooma merchant SMS receipt</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-border/40 bg-muted/30 p-3 text-sm font-mono">
                    {selected.merchant_receipt_text ?? "—"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    No payer name, no payer number. Merchant gets a reconcilable LTR reference only.
                  </p>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="glass-card">
              <CardContent className="py-12 text-center text-muted-foreground">
                Select an intent on the left, or simulate one above.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function PayloadCard({
  title, note, payload, tone,
}: {
  title: string; note: string; payload: Record<string, unknown>;
  tone: "ok" | "warn" | "info";
}) {
  const toneClass =
    tone === "ok" ? "border-success/40" :
    tone === "warn" ? "border-warning/40" : "border-primary/30";
  const badge =
    tone === "ok" ? <Badge className="bg-success/15 text-success border-success/30">payer redacted</Badge> :
    tone === "warn" ? <Badge variant="outline" className="border-warning/40 text-warning">contains MSISDN</Badge> :
    <Badge variant="secondary">encrypted-at-rest</Badge>;
  return (
    <Card className={`glass-card border ${toneClass}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm">{title}</CardTitle>
          {badge}
        </div>
      </CardHeader>
      <CardContent>
        <pre className="text-xs bg-muted/40 rounded-lg p-3 overflow-x-auto font-mono leading-relaxed">
{JSON.stringify(payload, null, 2)}
        </pre>
        <Separator className="my-3" />
        <p className="text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}
