import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crown, Sparkles, TrendingUp, MapPin, Heart, Zap, Trophy, Coins, Receipt } from "lucide-react";

export type ListingTier = "standard" | "category_boost" | "discovery_prime" | "anchor_partner";

export const TIER_CATALOG: Record<ListingTier, {
  label: string; icon: any; min: number; max: number; defaultFee: number;
  tagline: string; trigger: string; color: string;
}> = {
  standard:        { label: "Standard",        icon: Sparkles, min: 0,     max: 0,     defaultFee: 0,     tagline: "Free baseline listing",        trigger: "Live on Lipafo",         color: "bg-muted text-muted-foreground" },
  category_boost:  { label: "Category Boost",  icon: TrendingUp, min: 2500, max: 2500, defaultFee: 2500,  tagline: "Top of category, MCC badge",  trigger: "100K+ merchants",        color: "bg-primary/15 text-primary" },
  discovery_prime: { label: "Discovery Prime", icon: Zap,        min: 500,  max: 2500, defaultFee: 1200,  tagline: "Sponsored discovery feed slot", trigger: "3M+ MAU",              color: "bg-success/15 text-success" },
  anchor_partner:  { label: "Anchor Partner",  icon: Crown,      min: 15000,max: 50000,defaultFee: 25000, tagline: "National-chain top placement", trigger: "500K+ MAU bank",        color: "bg-warning/15 text-warning" },
};

// Algorithm weights from business case
export const PRIORITY_WEIGHTS = [
  { key: "velocity",   label: "Transaction Velocity",  weight: 30, icon: TrendingUp, hint: "30-day LipafoPay txn volume — organic merit" },
  { key: "tier",       label: "Category Priority Boost", weight: 25, icon: Crown,    hint: "Bank-paid Merchant Category Premium (MCP)" },
  { key: "proximity",  label: "Proximity Score",       weight: 20, icon: MapPin,    hint: "GPS distance to customer" },
  { key: "paid",       label: "Paid Discovery Boost",  weight: 15, icon: Coins,    hint: "Merchant-paid sponsored placement" },
  { key: "preference", label: "Customer Preference",   weight: 10, icon: Heart,    hint: "Prior payment history match" },
];

type Bank = { id: string; bank_name: string };
type Merchant = {
  id: string; bank_id: string; merchant_name: string; category: string;
  paybill_number: string; till_number: string | null;
  listing_tier: ListingTier; monthly_listing_fee: number;
  boost_started_at: string | null; boost_expires_at: string | null;
  txn_velocity_30d: number; preference_score: number; paid_boost_amount: number;
};
type RevenueRow = { id: string; merchant_id: string; bank_id: string; tier: ListingTier; period_month: string; amount: number; status: string };

// Priority score 0..100 — derived in-app from algorithm spec
export function computePriority(m: Merchant): number {
  const tierBoost = m.listing_tier === "anchor_partner" ? 100 : m.listing_tier === "discovery_prime" ? 80 : m.listing_tier === "category_boost" ? 60 : 0;
  const active = m.listing_tier !== "standard" && (!m.boost_expires_at || new Date(m.boost_expires_at) > new Date());
  const velocity = Math.min(100, m.txn_velocity_30d / 1000); // 100k txns/mo → 100
  const paid = Math.min(100, (m.paid_boost_amount || 0) / 25);
  const preference = Math.min(100, m.preference_score);
  const proximity = 50; // session-time GPS computed at runtime in mobile app — neutral placeholder
  return Math.round(
    velocity * 0.30 +
    tierBoost * 0.25 +
    proximity * 0.20 +
    (active ? paid : 0) * 0.15 +
    preference * 0.10
  );
}

const fmtKES = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

export function MerchantDiscoveryEngine() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [revenue, setRevenue] = useState<RevenueRow[]>([]);
  const [filterBank, setFilterBank] = useState<string>("all");
  const [filterTier, setFilterTier] = useState<string>("all");
  const [editing, setEditing] = useState<Merchant | null>(null);

  const load = async () => {
    const [b, m, r] = await Promise.all([
      supabase.from("participating_banks").select("id,bank_name").order("bank_name"),
      supabase.from("bank_merchants").select("*").order("merchant_name").limit(500),
      supabase.from("merchant_listing_revenue").select("*").order("period_month", { ascending: false }).limit(500),
    ]);
    if (b.data) setBanks(b.data as Bank[]);
    if (m.data) setMerchants(m.data as Merchant[]);
    if (r.data) setRevenue(r.data as RevenueRow[]);
  };
  useEffect(() => { load(); }, []);

  const bankMap = useMemo(() => Object.fromEntries(banks.map(b => [b.id, b.bank_name])), [banks]);

  const filtered = merchants.filter(m =>
    (filterBank === "all" || m.bank_id === filterBank) &&
    (filterTier === "all" || m.listing_tier === filterTier)
  );

  const ranked = useMemo(() =>
    [...filtered].map(m => ({ ...m, _score: computePriority(m) }))
                 .sort((a, b) => b._score - a._score),
    [filtered]
  );

  const tierTotals = useMemo(() => {
    const t: Record<ListingTier, { count: number; mrr: number }> = {
      standard: { count: 0, mrr: 0 }, category_boost: { count: 0, mrr: 0 },
      discovery_prime: { count: 0, mrr: 0 }, anchor_partner: { count: 0, mrr: 0 },
    };
    merchants.forEach(m => {
      t[m.listing_tier].count++;
      t[m.listing_tier].mrr += Number(m.monthly_listing_fee || 0);
    });
    return t;
  }, [merchants]);

  const totalMRR = Object.values(tierTotals).reduce((s, x) => s + x.mrr, 0);
  const annualised = totalMRR * 12;

  const revenueByBank = useMemo(() => {
    const map: Record<string, number> = {};
    revenue.forEach(r => { map[r.bank_id] = (map[r.bank_id] || 0) + Number(r.amount); });
    return map;
  }, [revenue]);

  const saveTier = async () => {
    if (!editing) return;
    const tier = editing.listing_tier;
    const fee = Number(editing.monthly_listing_fee || 0);
    const cat = TIER_CATALOG[tier];
    if (tier !== "standard" && (fee < cat.min || fee > cat.max)) {
      toast.error(`${cat.label} fee must be ${fmtKES(cat.min)}–${fmtKES(cat.max)}/mo`);
      return;
    }
    const updates: any = {
      listing_tier: tier,
      monthly_listing_fee: tier === "standard" ? 0 : fee,
      paid_boost_amount: editing.paid_boost_amount || 0,
      boost_started_at: tier === "standard" ? null : (editing.boost_started_at || new Date().toISOString()),
      boost_expires_at: editing.boost_expires_at,
    };
    const { error } = await supabase.from("bank_merchants").update(updates).eq("id", editing.id);
    if (error) return toast.error(error.message);

    // Invoice this month if paid tier
    if (tier !== "standard" && fee > 0) {
      const period = new Date(); period.setDate(1);
      const period_month = period.toISOString().slice(0, 10);
      await supabase.from("merchant_listing_revenue").upsert({
        merchant_id: editing.id, bank_id: editing.bank_id, tier, period_month, amount: fee, status: "invoiced",
      }, { onConflict: "merchant_id,period_month" });
    }
    toast.success("Listing tier updated");
    setEditing(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Trophy className="h-5 w-5 text-warning" /> Merchant Discovery Engine
        </h2>
        <p className="text-sm text-muted-foreground">
          Algorithmic priority engine that decides which merchants surface inside each bank's mobile app.
          Banks pay Lipafo for premium category placement; merchants pay for sponsored boosts. Listing fees are a high-margin Lipafo revenue line.
        </p>
      </div>

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Listing MRR</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-success flex items-center gap-1"><Coins className="h-5 w-5" />{fmtKES(totalMRR)}</div></CardContent></Card>
        <Card className="glass-card"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Annualised</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{fmtKES(annualised)}</div></CardContent></Card>
        <Card className="glass-card"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Boosted Merchants</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{merchants.length - tierTotals.standard.count} / {merchants.length}</div></CardContent></Card>
        <Card className="glass-card"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Anchor Partners</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-warning flex items-center gap-1"><Crown className="h-5 w-5" />{tierTotals.anchor_partner.count}</div></CardContent></Card>
      </div>

      {/* Algorithm */}
      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Priority Algorithm — Mobile App Surfacing Weights</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {PRIORITY_WEIGHTS.map(w => {
            const Icon = w.icon;
            return (
              <div key={w.key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium"><Icon className="h-4 w-4 text-primary" />{w.label}</span>
                  <span className="font-mono text-primary">{w.weight}%</span>
                </div>
                <Progress value={w.weight} className="h-2" />
                <p className="text-[11px] text-muted-foreground">{w.hint}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Tier catalog */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(TIER_CATALOG) as ListingTier[]).map(t => {
          const c = TIER_CATALOG[t]; const Icon = c.icon;
          const stats = tierTotals[t];
          return (
            <Card key={t} className="glass-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge className={c.color} variant="outline"><Icon className="h-3 w-3 mr-1" />{c.label}</Badge>
                  <span className="text-xs font-mono">{c.min === 0 ? "FREE" : `${fmtKES(c.min)}${c.max !== c.min ? `–${fmtKES(c.max)}` : ""}/mo`}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-xs text-muted-foreground">{c.tagline}</p>
                <p className="text-[10px] text-muted-foreground">Trigger: {c.trigger}</p>
                <div className="flex items-center justify-between pt-2 border-t border-border/40 mt-2">
                  <span className="text-xs">{stats.count} merchants</span>
                  <span className="text-xs font-mono text-success">{fmtKES(stats.mrr)}/mo</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Per-bank revenue summary */}
      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" />Listing Revenue by Bank (invoiced to date)</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Bank</TableHead><TableHead>Boosted Merchants</TableHead><TableHead>Current MRR</TableHead><TableHead>Invoiced (all time)</TableHead></TableRow></TableHeader>
            <TableBody>
              {banks.map(b => {
                const bm = merchants.filter(m => m.bank_id === b.id);
                const boosted = bm.filter(m => m.listing_tier !== "standard").length;
                const mrr = bm.reduce((s, m) => s + Number(m.monthly_listing_fee || 0), 0);
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.bank_name}</TableCell>
                    <TableCell><Badge variant="outline">{boosted}/{bm.length}</Badge></TableCell>
                    <TableCell className="font-mono text-success">{fmtKES(mrr)}</TableCell>
                    <TableCell className="font-mono text-primary">{fmtKES(revenueByBank[b.id] || 0)}</TableCell>
                  </TableRow>
                );
              })}
              {banks.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">No participating banks yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Priority leaderboard with tier controls */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Live Priority Ranking — what surfaces first in the bank app</CardTitle>
            <div className="flex gap-2">
              <Select value={filterBank} onValueChange={setFilterBank}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Banks</SelectItem>
                  {banks.map(b => <SelectItem key={b.id} value={b.id}>{b.bank_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterTier} onValueChange={setFilterTier}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  {(Object.keys(TIER_CATALOG) as ListingTier[]).map(t => <SelectItem key={t} value={t}>{TIER_CATALOG[t].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>Merchant</TableHead><TableHead>Bank</TableHead><TableHead>Category</TableHead>
              <TableHead>Tier</TableHead><TableHead>Velocity (30d)</TableHead><TableHead>MRR</TableHead>
              <TableHead className="w-[140px]">Priority Score</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {ranked.slice(0, 50).map((m, i) => {
                const c = TIER_CATALOG[m.listing_tier]; const Icon = c.icon;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                    <TableCell className="font-medium">{m.merchant_name}<div className="text-[10px] text-muted-foreground font-mono">{m.paybill_number}{m.till_number ? ` · ${m.till_number}` : ""}</div></TableCell>
                    <TableCell className="text-xs">{bankMap[m.bank_id] || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{m.category}</Badge></TableCell>
                    <TableCell><Badge className={c.color} variant="outline"><Icon className="h-3 w-3 mr-1" />{c.label}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{Number(m.txn_velocity_30d || 0).toLocaleString("en-KE")}</TableCell>
                    <TableCell className="font-mono text-xs text-success">{fmtKES(Number(m.monthly_listing_fee || 0))}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={m._score} className="h-2 w-16" />
                        <span className="text-xs font-mono w-7">{m._score}</span>
                      </div>
                    </TableCell>
                    <TableCell><Button size="sm" variant="outline" onClick={() => setEditing(m)}>Manage</Button></TableCell>
                  </TableRow>
                );
              })}
              {ranked.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-6">No merchants match filters.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tier editor */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="glass-card">
          <DialogHeader><DialogTitle>Manage listing — {editing?.merchant_name}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Listing Tier</Label>
                <Select value={editing.listing_tier} onValueChange={(v: ListingTier) => setEditing({ ...editing, listing_tier: v, monthly_listing_fee: TIER_CATALOG[v].defaultFee })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIER_CATALOG) as ListingTier[]).map(t => (
                      <SelectItem key={t} value={t}>{TIER_CATALOG[t].label} · {t === "standard" ? "Free" : `${fmtKES(TIER_CATALOG[t].min)}${TIER_CATALOG[t].max !== TIER_CATALOG[t].min ? `–${fmtKES(TIER_CATALOG[t].max)}` : ""}/mo`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">{TIER_CATALOG[editing.listing_tier].tagline} · trigger: {TIER_CATALOG[editing.listing_tier].trigger}</p>
              </div>
              {editing.listing_tier !== "standard" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Monthly Fee (KES)</Label>
                    <Input type="number" value={editing.monthly_listing_fee} onChange={e => setEditing({ ...editing, monthly_listing_fee: Number(e.target.value) })} />
                    <p className="text-[10px] text-muted-foreground">Range {fmtKES(TIER_CATALOG[editing.listing_tier].min)}–{fmtKES(TIER_CATALOG[editing.listing_tier].max)}</p>
                  </div>
                  <div>
                    <Label>Boost expires</Label>
                    <Input type="date" value={editing.boost_expires_at?.slice(0, 10) || ""} onChange={e => setEditing({ ...editing, boost_expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                  </div>
                  <div>
                    <Label>Merchant-paid boost (KES/mo)</Label>
                    <Input type="number" value={editing.paid_boost_amount} onChange={e => setEditing({ ...editing, paid_boost_amount: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Preference signal (0–100)</Label>
                    <Input type="number" value={editing.preference_score} onChange={e => setEditing({ ...editing, preference_score: Number(e.target.value) })} />
                  </div>
                </div>
              )}
              <div className="text-xs p-2 rounded bg-muted/40">
                Live priority score preview: <strong>{computePriority(editing)}</strong>/100
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={saveTier} className="button-3d">Save & Invoice</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
