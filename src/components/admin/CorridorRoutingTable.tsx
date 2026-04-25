import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Globe, Network, Building2, Plus, Info } from "lucide-react";

type CorridorType = "on_us" | "papss" | "correspondent";

type Route = {
  id: string;
  country_code: string;
  country_name: string;
  corridor_type: CorridorType;
  partner_bank: string | null;
  settlement_currency: string;
  extra_fee_bps: number;
  settlement_time: string;
  active: boolean;
  notes: string | null;
};

const TYPE_META: Record<CorridorType, { label: string; icon: typeof Globe; cls: string; desc: string }> = {
  on_us:         { label: "On-Us (Intra-KCB)", icon: Building2, cls: "bg-success/15 text-success border-success/30",     desc: "Same banking group, internal book transfer. No SWIFT, no correspondent." },
  papss:         { label: "PAPSS",              icon: Network,  cls: "bg-primary/15 text-primary border-primary/30",     desc: "Pan-African Payment & Settlement System. Local-currency, no USD leg." },
  correspondent: { label: "Correspondent",      icon: Globe,    cls: "bg-warning/15 text-warning border-warning/30",     desc: "Partner bank via SWIFT / nostro. Slowest, most expensive." },
};

export function CorridorRoutingTable() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    country_code: "",
    country_name: "",
    corridor_type: "papss" as CorridorType,
    partner_bank: "",
    settlement_currency: "",
    extra_fee_bps: 15,
    settlement_time: "T+1",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("corridor_routes")
      .select("*")
      .order("corridor_type", { ascending: true })
      .order("country_name", { ascending: true });
    if (error) toast.error(error.message);
    else setRoutes((data ?? []) as Route[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (r: Route) => {
    const { error } = await supabase.from("corridor_routes").update({ active: !r.active }).eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success(`${r.country_name} ${!r.active ? "enabled" : "disabled"}`); load(); }
  };

  const updateType = async (r: Route, t: CorridorType) => {
    const { error } = await supabase.from("corridor_routes").update({ corridor_type: t }).eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success(`${r.country_name} → ${TYPE_META[t].label}`); load(); }
  };

  const addRoute = async () => {
    if (!form.country_code || !form.country_name || !form.settlement_currency) {
      toast.error("Country code, name, and currency required"); return;
    }
    const { error } = await supabase.from("corridor_routes").insert({
      country_code: form.country_code.toUpperCase(),
      country_name: form.country_name,
      corridor_type: form.corridor_type,
      partner_bank: form.partner_bank || null,
      settlement_currency: form.settlement_currency.toUpperCase(),
      extra_fee_bps: form.extra_fee_bps,
      settlement_time: form.settlement_time,
      notes: form.notes || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`Route added — ${form.country_name}`);
      setOpen(false);
      setForm({ country_code: "", country_name: "", corridor_type: "papss", partner_bank: "", settlement_currency: "", extra_fee_bps: 15, settlement_time: "T+1", notes: "" });
      load();
    }
  };

  const counts = {
    on_us: routes.filter(r => r.corridor_type === "on_us" && r.active).length,
    papss: routes.filter(r => r.corridor_type === "papss" && r.active).length,
    correspondent: routes.filter(r => r.corridor_type === "correspondent" && r.active).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Corridor Routing</h2>
          <p className="text-sm text-muted-foreground">
            Per-country rail selection — drives the cross-border merchant flow and settlement engine.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="button-3d"><Plus className="h-4 w-4 mr-2" />Add Route</Button>
          </DialogTrigger>
          <DialogContent className="glass-card">
            <DialogHeader><DialogTitle>Add corridor route</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Country code (ISO-2)</Label><Input value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value })} placeholder="MA" /></div>
                <div><Label>Country name</Label><Input value={form.country_name} onChange={(e) => setForm({ ...form, country_name: e.target.value })} placeholder="Morocco" /></div>
              </div>
              <div>
                <Label>Corridor type</Label>
                <Select value={form.corridor_type} onValueChange={(v) => setForm({ ...form, corridor_type: v as CorridorType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_META) as CorridorType[]).map(k => (
                      <SelectItem key={k} value={k}>{TYPE_META[k].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">{TYPE_META[form.corridor_type].desc}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Partner bank</Label><Input value={form.partner_bank} onChange={(e) => setForm({ ...form, partner_bank: e.target.value })} placeholder="PAPSS Network / Bank name" /></div>
                <div><Label>Settlement currency</Label><Input value={form.settlement_currency} onChange={(e) => setForm({ ...form, settlement_currency: e.target.value })} placeholder="MAD" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Extra fee (bps)</Label><Input type="number" value={form.extra_fee_bps} onChange={(e) => setForm({ ...form, extra_fee_bps: Number(e.target.value) || 0 })} /></div>
                <div><Label>Settlement time</Label><Input value={form.settlement_time} onChange={(e) => setForm({ ...form, settlement_time: e.target.value })} placeholder="T+1" /></div>
              </div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={addRoute} className="button-3d">Add route</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.keys(TYPE_META) as CorridorType[]).map(k => {
          const Icon = TYPE_META[k].icon;
          return (
            <Card key={k} className="glass-card">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Icon className="h-4 w-4" /> {TYPE_META[k].label}
                </CardTitle>
                <Badge variant="outline" className={TYPE_META[k].cls}>{counts[k]}</Badge>
              </CardHeader>
              <CardContent><p className="text-xs text-muted-foreground">{TYPE_META[k].desc}</p></CardContent>
            </Card>
          );
        })}
      </div>

      {/* Routing logic explainer */}
      <Card className="glass-card">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="text-foreground font-semibold">Routing logic</div>
            <div>1. Cross-border flow looks up <code className="bg-muted px-1 rounded">corridor_routes</code> by destination country.</div>
            <div>2. <span className="text-success font-semibold">on_us</span> → KCB intra-group book transfer (no SWIFT, T+0/T+1).</div>
            <div>3. <span className="text-primary font-semibold">papss</span> → routed via PAPSS for African corridors without a KCB sub. Adds <code className="bg-muted px-1 rounded">extra_fee_bps</code> on top of switch fee.</div>
            <div>4. <span className="text-warning font-semibold">correspondent</span> → SWIFT/nostro via partner bank. Highest fee, T+2.</div>
            <div>5. Inactive routes block onboarding for that country in the Merchant Portal.</div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Country</TableHead>
                <TableHead>Corridor</TableHead>
                <TableHead>Partner / Network</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Extra fee (bps)</TableHead>
                <TableHead>Settlement</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
              )}
              {!loading && routes.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No routes yet.</TableCell></TableRow>
              )}
              {routes.map(r => {
                const meta = TYPE_META[r.corridor_type];
                return (
                  <TableRow key={r.id} className={!r.active ? "opacity-50" : ""}>
                    <TableCell className="font-medium">
                      {r.country_name}
                      <div className="text-xs text-muted-foreground font-mono">{r.country_code}</div>
                    </TableCell>
                    <TableCell>
                      <Select value={r.corridor_type} onValueChange={(v) => updateType(r, v as CorridorType)}>
                        <SelectTrigger className={`w-[180px] h-8 text-xs ${meta.cls}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(TYPE_META) as CorridorType[]).map(k => (
                            <SelectItem key={k} value={k}>{TYPE_META[k].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs">{r.partner_bank ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{r.settlement_currency}</Badge></TableCell>
                    <TableCell className="text-right text-xs">{r.extra_fee_bps}</TableCell>
                    <TableCell className="text-xs">{r.settlement_time}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate" title={r.notes ?? ""}>{r.notes ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Switch checked={r.active} onCheckedChange={() => toggleActive(r)} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
