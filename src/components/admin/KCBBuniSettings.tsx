import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Save, Loader2, KeyRound, Globe, Network, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type Env = "UAT" | "PROD";

interface BuniSettings {
  id?: string;
  environment: Env;
  base_url: string;
  client_id: string;
  client_secret: string;
  callback_url: string;
  egress_ips: string[];
  technical_contact: string;
  notes: string;
  updated_at?: string;
}

const EMPTY = (env: Env): BuniSettings => ({
  environment: env,
  base_url: env === "UAT" ? "https://uat.buni.kcbgroup.com" : "https://buni.kcbgroup.com",
  client_id: "",
  client_secret: "",
  callback_url: "",
  egress_ips: [],
  technical_contact: "",
  notes: "",
});

function EnvForm({ env }: { env: Env }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<BuniSettings>(EMPTY(env));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [egressInput, setEgressInput] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: row, error } = await supabase
        .from("kcb_buni_settings")
        .select("*")
        .eq("environment", env)
        .maybeSingle();
      if (error) {
        toast({ title: "Load failed", description: error.message, variant: "destructive" });
      } else if (row) {
        setData(row as BuniSettings);
        setEgressInput((row.egress_ips || []).join(", "));
      }
      setLoading(false);
    })();
  }, [env, toast]);

  const save = async () => {
    setSaving(true);
    const egress_ips = egressInput
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      ...data,
      egress_ips,
      environment: env,
      updated_by: user?.id ?? null,
    };
    const { error } = await supabase
      .from("kcb_buni_settings")
      .upsert(payload, { onConflict: "environment" });
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Settings saved", description: `${env} configuration updated.` });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading {env} settings…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Badge variant={env === "PROD" ? "destructive" : "secondary"} className="text-xs">
          {env === "PROD" ? "PRODUCTION" : "SANDBOX / UAT"}
        </Badge>
        {data.updated_at && (
          <span className="text-xs text-muted-foreground">
            Last updated {new Date(data.updated_at).toLocaleString()}
          </span>
        )}
      </div>

      <div className="grid gap-2">
        <Label className="flex items-center gap-2"><Globe className="h-4 w-4" /> BUNI Base URL</Label>
        <Input
          value={data.base_url}
          onChange={(e) => setData({ ...data, base_url: e.target.value })}
          placeholder="https://uat.buni.kcbgroup.com"
        />
      </div>

      <div className="grid gap-2">
        <Label className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> KCB_BUNI_CLIENT_ID</Label>
        <Input
          value={data.client_id}
          onChange={(e) => setData({ ...data, client_id: e.target.value })}
          placeholder="consumer_key issued by BUNI"
        />
      </div>

      <div className="grid gap-2">
        <Label className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> KCB_BUNI_CLIENT_SECRET</Label>
        <div className="flex gap-2">
          <Input
            type={showSecret ? "text" : "password"}
            value={data.client_secret}
            onChange={(e) => setData({ ...data, client_secret: e.target.value })}
            placeholder="consumer_secret"
            autoComplete="new-password"
          />
          <Button type="button" variant="outline" size="icon" onClick={() => setShowSecret((s) => !s)}>
            {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Stored encrypted-at-rest in Lovable Cloud; visible only to admins.
        </p>
      </div>

      <div className="grid gap-2">
        <Label className="flex items-center gap-2"><Globe className="h-4 w-4" /> Callback URL (Lipafo switch webhook)</Label>
        <Input
          value={data.callback_url}
          onChange={(e) => setData({ ...data, callback_url: e.target.value })}
          placeholder="https://switch.lipafo.africa/webhooks/kcb-buni"
        />
        <p className="text-xs text-muted-foreground">Must be pre-registered on the BUNI app by KCB.</p>
      </div>

      <div className="grid gap-2">
        <Label className="flex items-center gap-2"><Network className="h-4 w-4" /> Egress IPs (whitelist on BUNI)</Label>
        <Textarea
          value={egressInput}
          onChange={(e) => setEgressInput(e.target.value)}
          placeholder="203.0.113.10, 203.0.113.11"
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Comma or whitespace separated. These are the public NAT IPs of the Lipafo switch host(s).
        </p>
      </div>

      <div className="grid gap-2">
        <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> KCB BUNI Technical Contact</Label>
        <Input
          value={data.technical_contact}
          onChange={(e) => setData({ ...data, technical_contact: e.target.value })}
          placeholder="Name / Email / Phone"
        />
      </div>

      <div className="grid gap-2">
        <Label>Notes</Label>
        <Textarea
          value={data.notes}
          onChange={(e) => setData({ ...data, notes: e.target.value })}
          rows={3}
          placeholder="API products enabled, ticket refs, rotation dates…"
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="button-3d">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save {env} settings
        </Button>
      </div>
    </div>
  );
}

export function KCBBuniSettings() {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          KCB BUNI Integration Settings
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Capture the credentials and network parameters required for the KCB pilot integration.
          UAT and PROD are stored separately and never share values.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="UAT" className="space-y-4">
          <TabsList className="glass-card">
            <TabsTrigger value="UAT">UAT (Sandbox)</TabsTrigger>
            <TabsTrigger value="PROD">PROD (Live)</TabsTrigger>
          </TabsList>
          <TabsContent value="UAT"><EnvForm env="UAT" /></TabsContent>
          <TabsContent value="PROD"><EnvForm env="PROD" /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
