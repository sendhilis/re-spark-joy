import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Store, Receipt } from "lucide-react";

type CorridorType = "on_us" | "papss" | "correspondent";

type Merchant = {
  id: string;
  merchant_name: string;
  till_code: string;
  lipafo_code: string;
  category: string;
  country_code: string;
  settlement_bank: string;
  settlement_account: string | null;
  status: string;
  monthly_volume: number;
  contact_email: string | null;
  corridor_type: CorridorType;
};

type Route = {
  country_code: string;
  country_name: string;
  corridor_type: CorridorType;
  partner_bank: string | null;
  active: boolean;
};

const CORRIDOR_BADGE: Record<CorridorType, string> = {
  on_us:         "bg-success/15 text-success border-success/30",
  papss:         "bg-primary/15 text-primary border-primary/30",
  correspondent: "bg-warning/15 text-warning border-warning/30",
};
const CORRIDOR_LABEL: Record<CorridorType, string> = {
  on_us: "On-Us", papss: "PAPSS", correspondent: "Correspondent",
};

type MerchantSettlement = {
  id: string;
  merchant_id: string;
  settlement_date: string;
  gross_amount: number;
  fee_amount: number;
  net_amount: number;
  transaction_count: number;
  scheduled_payout_at: string;
  paid_out_at: string | null;
  status: string;
};

const SETTLEMENT_BANKS = [
  "KCB Bank Kenya", "Equity Bank", "Co-operative Bank", "NCBA Bank",
  "Stanbic Bank", "KCB Bank Uganda", "KCB Bank Tanzania", "KCB Bank Rwanda",
  "PAPSS Network", "Standard Bank", "NatWest", "Citibank N.A.",
];
const CATEGORIES = ["retail", "food", "fuel", "health", "education", "travel", "utility"];

const fmtKES = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);

const generateLipafoCode = (country: string, corridor: CorridorType) => {
  if (corridor === "on_us" && country === "KE") return `LPF-MR-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`;
  if (corridor === "papss") return `LPF-PA-${country}-${String(Math.floor(Math.random() * 999)).padStart(3, "0")}`;
  if (corridor === "correspondent") return `LPF-CB-${country}-${String(Math.floor(Math.random() * 999)).padStart(3, "0")}`;
  return `LPF-XB-${country}-${String(Math.floor(Math.random() * 999)).padStart(3, "0")}`;
};

const generateTillCode = (country: string) =>
  country === "KE"
    ? String(500000 + Math.floor(Math.random() * 99999))
    : `${country}-${String(200000 + Math.floor(Math.random() * 99999))}`;

export function MerchantPortal() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [settlements, setSettlements] = useState<MerchantSettlement[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    merchant_name: "",
    category: "retail",
    country_code: "KE",
    settlement_bank: "KCB Bank Kenya",
    settlement_account: "",
    contact_email: "",
    contact_phone: "",
  });

  const load = async () => {
    const [mRes, sRes, rRes] = await Promise.all([
      supabase.from("merchants").select("*").order("created_at", { ascending: false }),
      supabase.from("merchant_settlements").select("*").order("settlement_date", { ascending: false }).limit(50),
      supabase.from("corridor_routes").select("country_code,country_name,corridor_type,partner_bank,active").eq("active", true).order("country_name"),
    ]);
    if (mRes.data) setMerchants(mRes.data as Merchant[]);
    if (sRes.data) setSettlements(sRes.data as MerchantSettlement[]);
    if (rRes.data) setRoutes(rRes.data as Route[]);
  };

  useEffect(() => { load(); }, []);

  const selectedRoute = routes.find(r => r.country_code === form.country_code);

  const onCountryChange = (code: string) => {
    const r = routes.find(x => x.country_code === code);
    setForm(f => ({
      ...f,
      country_code: code,
      settlement_bank: r?.partner_bank || f.settlement_bank,
    }));
  };

  const onboard = async () => {
    if (!form.merchant_name) { toast.error("Merchant name required"); return; }
    if (!selectedRoute) { toast.error("No active corridor route for this country"); return; }
    const corridor_type = selectedRoute.corridor_type;
    const till_code = generateTillCode(form.country_code);
    const lipafo_code = generateLipafoCode(form.country_code, corridor_type);
    const { error } = await supabase.from("merchants").insert({
      ...form,
      till_code,
      lipafo_code,
      corridor_type,
      mcc: null,
      monthly_volume: 0,
      status: "active",
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`Merchant onboarded via ${CORRIDOR_LABEL[corridor_type]} — Till ${till_code} / ${lipafo_code}`);
      setOpen(false);
      setForm({ merchant_name: "", category: "retail", country_code: "KE", settlement_bank: "KCB Bank Kenya", settlement_account: "", contact_email: "", contact_phone: "" });
      load();
    }
  };

  const merchantById = (id: string) => merchants.find((m) => m.id === id);
  const totalGross = settlements.reduce((s, x) => s + Number(x.gross_amount), 0);
  const totalNet = settlements.reduce((s, x) => s + Number(x.net_amount), 0);
  const totalFees = settlements.reduce((s, x) => s + Number(x.fee_amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Merchant Portal</h2>
          <p className="text-sm text-muted-foreground">Onboarding, Till/Lipafo code issuance, settlement bank mapping</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="button-3d"><Plus className="h-4 w-4 mr-2" />Onboard Merchant</Button>
          </DialogTrigger>
          <DialogContent className="glass-card">
            <DialogHeader><DialogTitle>Onboard New Merchant</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Merchant Name</Label>
                <Input value={form.merchant_name} onChange={(e) => setForm({ ...form, merchant_name: e.target.value })} placeholder="e.g. Naivas Kilimani" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Country</Label>
                  <Select value={form.country_code} onValueChange={onCountryChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {routes.map((r) => (
                        <SelectItem key={r.country_code} value={r.country_code}>
                          {r.country_name} ({r.country_code}) — {CORRIDOR_LABEL[r.corridor_type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {selectedRoute && (
                <div className={`p-2 rounded-md border text-xs ${CORRIDOR_BADGE[selectedRoute.corridor_type]}`}>
                  Rail: <span className="font-semibold">{CORRIDOR_LABEL[selectedRoute.corridor_type]}</span>
                  {selectedRoute.partner_bank && <> · via {selectedRoute.partner_bank}</>}
                </div>
              )}
              <div>
                <Label>Settlement Bank</Label>
                <Select value={form.settlement_bank} onValueChange={(v) => setForm({ ...form, settlement_bank: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SETTLEMENT_BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Settlement Account</Label>
                <Input value={form.settlement_account} onChange={(e) => setForm({ ...form, settlement_account: e.target.value })} placeholder="e.g. KCB-1100023401" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Contact Email</Label>
                  <Input value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
                </div>
                <div>
                  <Label>Contact Phone</Label>
                  <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Till code and Lipafo code will be auto-issued upon onboarding.</p>
            </div>
            <DialogFooter><Button onClick={onboard} className="button-3d">Issue codes & onboard</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active Merchants</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{merchants.filter((m) => m.status === "active").length}</div></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Gross Settled (last 50)</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">{fmtKES(totalGross)}</div></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Fees Captured</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold text-primary">{fmtKES(totalFees)}</div></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Net Paid Out</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold text-success">{fmtKES(totalNet)}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="merchants" className="space-y-4">
        <TabsList className="glass-card">
          <TabsTrigger value="merchants"><Store className="h-4 w-4 mr-2" />Merchants</TabsTrigger>
          <TabsTrigger value="settlements"><Receipt className="h-4 w-4 mr-2" />Settlements (T+1)</TabsTrigger>
        </TabsList>

        <TabsContent value="merchants">
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Till</TableHead>
                    <TableHead>Lipafo Code</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Settlement Bank</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Monthly Vol</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {merchants.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.merchant_name}<div className="text-xs text-muted-foreground">{m.category}</div></TableCell>
                      <TableCell className="font-mono text-xs">{m.till_code}</TableCell>
                      <TableCell className="font-mono text-xs text-primary">{m.lipafo_code}</TableCell>
                      <TableCell><Badge variant="outline">{m.country_code}</Badge></TableCell>
                      <TableCell className="text-xs">{m.settlement_bank}</TableCell>
                      <TableCell className="font-mono text-xs">{m.settlement_account || "—"}</TableCell>
                      <TableCell className="text-right text-xs">{fmtKES(Number(m.monthly_volume))}</TableCell>
                      <TableCell><Badge variant={m.status === "active" ? "default" : "outline"}>{m.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settlements">
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Tx</TableHead>
                    <TableHead>Payout</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlements.map((s) => {
                    const m = merchantById(s.merchant_id);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs">{s.settlement_date}</TableCell>
                        <TableCell className="text-xs">{m?.merchant_name || s.merchant_id.slice(0, 8)}</TableCell>
                        <TableCell className="text-right text-xs">{fmtKES(Number(s.gross_amount))}</TableCell>
                        <TableCell className="text-right text-xs text-primary">{fmtKES(Number(s.fee_amount))}</TableCell>
                        <TableCell className="text-right text-xs font-bold">{fmtKES(Number(s.net_amount))}</TableCell>
                        <TableCell className="text-right text-xs">{s.transaction_count}</TableCell>
                        <TableCell className="text-xs">{new Date(s.scheduled_payout_at).toLocaleString("en-KE", { dateStyle: "short", timeStyle: "short" })}</TableCell>
                        <TableCell><Badge variant={s.status === "paid" ? "default" : "outline"}>{s.status}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
