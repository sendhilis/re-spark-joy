import { useEffect, useMemo, useState } from "react";
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
import { Plus, Store, Landmark, Webhook, RefreshCw, Copy, Hash, Building2 } from "lucide-react";

type Bank = {
  id: string;
  bank_name: string;
  bank_code: string;
  paybill_prefix: string | null;
  sync_api_key: string;
  last_sync_at: string | null;
  lifecycle_stage: string;
};

type BankMerchant = {
  id: string;
  bank_id: string;
  merchant_name: string;
  category: string;
  paybill_number: string;
  till_number: string | null;
  status: string;
  synced_at: string;
};

type SyncLog = {
  id: string;
  bank_id: string | null;
  received_count: number;
  inserted_count: number;
  updated_count: number;
  status: string;
  error_message: string | null;
  created_at: string;
};

const CATEGORIES = ["retail", "food", "fuel", "health", "education", "travel", "utility", "supermarket", "telecoms"];

const PROJECT_REF = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const WEBHOOK_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/bank-merchant-sync`;

export function MerchantPortal() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [merchants, setMerchants] = useState<BankMerchant[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [filterBank, setFilterBank] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [showKey, setShowKey] = useState<string | null>(null);
  const [form, setForm] = useState({ bank_id: "", merchant_name: "", category: "retail", paybill_number: "", till_number: "" });

  const load = async () => {
    const [b, m, l] = await Promise.all([
      supabase.from("participating_banks").select("id,bank_name,bank_code,paybill_prefix,sync_api_key,last_sync_at,lifecycle_stage").order("bank_name"),
      supabase.from("bank_merchants").select("*").order("synced_at", { ascending: false }).limit(500),
      supabase.from("bank_merchant_sync_logs").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    if (b.data) setBanks(b.data as Bank[]);
    if (m.data) setMerchants(m.data as BankMerchant[]);
    if (l.data) setLogs(l.data as SyncLog[]);
  };
  useEffect(() => { load(); }, []);

  const bankMap = useMemo(() => Object.fromEntries(banks.map(b => [b.id, b])), [banks]);

  const filtered = merchants.filter(m =>
    (filterBank === "all" || m.bank_id === filterBank) &&
    (filterCategory === "all" || m.category === filterCategory) &&
    (!search.trim() || m.merchant_name.toLowerCase().includes(search.toLowerCase()) || m.paybill_number.includes(search) || (m.till_number || "").includes(search))
  );

  const byBank = useMemo(() => {
    const map: Record<string, number> = {};
    merchants.forEach(m => { map[m.bank_id] = (map[m.bank_id] || 0) + 1; });
    return map;
  }, [merchants]);

  const copy = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    toast.success(`${label} copied`);
  };

  const rotateKey = async (bankId: string) => {
    const newKey = crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase.from("participating_banks").update({ sync_api_key: newKey }).eq("id", bankId);
    if (error) return toast.error(error.message);
    toast.success("Sync key rotated");
    load();
  };

  const manualPush = async () => {
    if (!form.bank_id || !form.merchant_name || !form.paybill_number) { toast.error("Bank, merchant name & paybill required"); return; }
    const { error } = await supabase.from("bank_merchants").upsert({
      bank_id: form.bank_id,
      merchant_name: form.merchant_name,
      category: form.category,
      paybill_number: form.paybill_number,
      till_number: form.till_number || null,
      status: "active",
      synced_at: new Date().toISOString(),
    }, { onConflict: "bank_id,paybill_number,till_number" });
    if (error) return toast.error(error.message);
    toast.success("Merchant added (manual sync)");
    setManualOpen(false);
    setForm({ bank_id: "", merchant_name: "", category: "retail", paybill_number: "", till_number: "" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Merchant Portal</h2>
          <p className="text-sm text-muted-foreground">
            Participating banks push their merchants (paybill + till) into Lipafo. Direct credit to merchant via Lipafo switch — zero M-PESA involvement.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-1.5" />Refresh</Button>
          <Dialog open={manualOpen} onOpenChange={setManualOpen}>
            <DialogTrigger asChild>
              <Button className="button-3d"><Plus className="h-4 w-4 mr-2" />Manual Add</Button>
            </DialogTrigger>
            <DialogContent className="glass-card">
              <DialogHeader><DialogTitle>Manually push a merchant (admin override)</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Source Bank</Label>
                  <Select value={form.bank_id} onValueChange={(v) => setForm({ ...form, bank_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select participating bank" /></SelectTrigger>
                    <SelectContent>{banks.map(b => <SelectItem key={b.id} value={b.id}>{b.bank_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Merchant Name</Label><Input value={form.merchant_name} onChange={e => setForm({ ...form, merchant_name: e.target.value })} placeholder="Naivas Kilimani" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Paybill Number</Label><Input value={form.paybill_number} onChange={e => setForm({ ...form, paybill_number: e.target.value })} placeholder="247247" /></div>
                  <div><Label>Till Number (optional)</Label><Input value={form.till_number} onChange={e => setForm({ ...form, till_number: e.target.value })} placeholder="5012345" /></div>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">Mobile numbers (MSISDN) are <strong>not</strong> stored — confidential bank data.</p>
              </div>
              <DialogFooter><Button onClick={manualPush} className="button-3d">Push to Portal</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Participating Banks</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" />{banks.length}</div></CardContent></Card>
        <Card className="glass-card"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Bank-Synced Merchants</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold flex items-center gap-2"><Store className="h-5 w-5 text-success" />{merchants.length}</div></CardContent></Card>
        <Card className="glass-card"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Last Sync</CardTitle></CardHeader><CardContent><div className="text-sm font-medium">{logs[0] ? new Date(logs[0].created_at).toLocaleString("en-KE", { dateStyle: "short", timeStyle: "short" }) : "—"}</div></CardContent></Card>
        <Card className="glass-card"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">M-PESA in flow</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-success">ZERO</div></CardContent></Card>
      </div>

      <Tabs defaultValue="merchants" className="space-y-4">
        <TabsList className="glass-card">
          <TabsTrigger value="merchants"><Store className="h-4 w-4 mr-2" />Bank-Synced Merchants</TabsTrigger>
          <TabsTrigger value="banks"><Landmark className="h-4 w-4 mr-2" />Banks & Sync Endpoints</TabsTrigger>
          <TabsTrigger value="logs"><Webhook className="h-4 w-4 mr-2" />Sync Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="merchants" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={filterBank} onValueChange={setFilterBank}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Banks ({merchants.length})</SelectItem>
                {banks.map(b => <SelectItem key={b.id} value={b.id}>{b.bank_name} ({byBank[b.id] || 0})</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="max-w-xs" placeholder="Search name / paybill / till…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Card className="glass-card">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Source Bank</TableHead>
                  <TableHead>Paybill</TableHead>
                  <TableHead>Till</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Synced</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.merchant_name}</TableCell>
                      <TableCell><Badge variant="outline" className="bg-primary/10 text-primary border-primary/30"><Building2 className="h-3 w-3 mr-1" />{bankMap[m.bank_id]?.bank_name || "—"}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{m.paybill_number}</TableCell>
                      <TableCell className="font-mono text-xs">{m.till_number || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{m.category}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(m.synced_at).toLocaleString("en-KE", { dateStyle: "short", timeStyle: "short" })}</TableCell>
                      <TableCell><Badge variant={m.status === "active" ? "default" : "outline"}>{m.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">No merchants match filters.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="banks" className="space-y-3">
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Webhook className="h-4 w-4 text-primary" />Webhook Endpoint (shared)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded break-all">{WEBHOOK_URL}</code>
                <Button size="sm" variant="outline" onClick={() => copy(WEBHOOK_URL, "Webhook URL")}><Copy className="h-3 w-3" /></Button>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>POST</strong> with header <code className="text-primary">x-bank-sync-key: &lt;your_key&gt;</code>. Body: <code>{`{"merchants":[{"merchant_name":"Naivas Kilimani","category":"supermarket","paybill_number":"247247","till_number":"5012345"}]}`}</code>
              </p>
              <p className="text-xs text-warning">Banks must NOT send mobile numbers (MSISDN). Only paybill + till + name + category.</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Bank</TableHead><TableHead>Code</TableHead><TableHead>Paybill Prefix</TableHead><TableHead>Merchants</TableHead><TableHead>Last Sync</TableHead><TableHead>Sync Key</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {banks.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.bank_name}<div className="text-[10px] text-muted-foreground">{b.lifecycle_stage}</div></TableCell>
                      <TableCell className="font-mono text-xs">{b.bank_code}</TableCell>
                      <TableCell className="font-mono text-xs">{b.paybill_prefix || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{byBank[b.id] || 0}</Badge></TableCell>
                      <TableCell className="text-xs">{b.last_sync_at ? new Date(b.last_sync_at).toLocaleString("en-KE", { dateStyle: "short", timeStyle: "short" }) : <span className="text-muted-foreground">never</span>}</TableCell>
                      <TableCell className="font-mono text-[10px]">
                        {showKey === b.id ? (
                          <span className="break-all">{b.sync_api_key}</span>
                        ) : (
                          <span>•••••••••{b.sync_api_key.slice(-6)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setShowKey(showKey === b.id ? null : b.id)}>{showKey === b.id ? "Hide" : "Show"}</Button>
                          <Button size="sm" variant="ghost" onClick={() => copy(b.sync_api_key, "Sync key")}><Copy className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => rotateKey(b.id)}><RefreshCw className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card className="glass-card">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>When</TableHead><TableHead>Bank</TableHead><TableHead>Received</TableHead><TableHead>Inserted</TableHead><TableHead>Updated</TableHead><TableHead>Status</TableHead><TableHead>Error</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {logs.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("en-KE", { dateStyle: "short", timeStyle: "short" })}</TableCell>
                      <TableCell className="text-xs">{l.bank_id ? bankMap[l.bank_id]?.bank_name || "—" : "—"}</TableCell>
                      <TableCell><Badge variant="outline">{l.received_count}</Badge></TableCell>
                      <TableCell className="text-success text-xs">+{l.inserted_count}</TableCell>
                      <TableCell className="text-primary text-xs">~{l.updated_count}</TableCell>
                      <TableCell><Badge variant={l.status === "success" ? "default" : "destructive"}>{l.status}</Badge></TableCell>
                      <TableCell className="text-xs text-destructive max-w-[300px] truncate">{l.error_message || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">No syncs yet. Banks POST to the webhook above with their sync key.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
