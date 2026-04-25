import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Banknote, TrendingUp, Coins, Wallet, Globe2, Repeat } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";

const fmtKES = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);

export function KCBBenefitsDashboard() {
  const [positions, setPositions] = useState<any[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [p, d, m, s] = await Promise.all([
        supabase.from("settlement_positions").select("*").order("position_date", { ascending: true }).limit(200),
        supabase.from("settlement_dispatches").select("*").limit(200),
        supabase.from("merchants").select("*"),
        supabase.from("merchant_settlements").select("*").limit(200),
      ]);
      setPositions(p.data || []);
      setDispatches(d.data || []);
      setMerchants(m.data || []);
      setSettlements(s.data || []);
    })();
  }, []);

  // KPIs
  const totalNFI = settlements.reduce((s, x) => s + Number(x.fee_amount), 0);
  const totalFXMargin = positions.reduce((s, p) => s + Number(p.inbound_volume) * 0.0015, 0); // 15 bps assumed
  const totalFloatRevenue = dispatches.reduce((s, x) => s + Number(x.float_revenue), 0);
  const totalThroughput = positions.reduce((s, p) => s + Number(p.inbound_volume) + Number(p.outbound_volume), 0);
  const depositRetention = merchants
    .filter((m) => m.settlement_bank?.startsWith("KCB"))
    .reduce((s, m) => s + Number(m.monthly_volume), 0);
  const kcbMerchants = merchants.filter((m) => m.settlement_bank?.startsWith("KCB")).length;

  // Charts
  const revenueByDay = positions.reduce<Record<string, { date: string; nfi: number; fx: number; float: number }>>((acc, p) => {
    const d = p.position_date as string;
    if (!acc[d]) acc[d] = { date: d, nfi: 0, fx: 0, float: 0 };
    acc[d].fx += Number(p.inbound_volume) * 0.0015;
    return acc;
  }, {});
  settlements.forEach((s) => {
    const d = s.settlement_date as string;
    if (!revenueByDay[d]) revenueByDay[d] = { date: d, nfi: 0, fx: 0, float: 0 };
    revenueByDay[d].nfi += Number(s.fee_amount);
  });
  dispatches.forEach((x) => {
    const d = (x.scheduled_at as string).slice(0, 10);
    if (!revenueByDay[d]) revenueByDay[d] = { date: d, nfi: 0, fx: 0, float: 0 };
    revenueByDay[d].float += Number(x.float_revenue);
  });
  const revenueSeries = Object.values(revenueByDay).sort((a, b) => a.date.localeCompare(b.date));

  const bankShare = positions.reduce<Record<string, number>>((acc, p) => {
    acc[p.participating_bank] = (acc[p.participating_bank] || 0) + Number(p.inbound_volume) + Number(p.outbound_volume);
    return acc;
  }, {});
  const bankSeries = Object.entries(bankShare).map(([bank, volume]) => ({ bank: bank.replace(" Bank", ""), volume }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">KCB Benefits Dashboard</h2>
        <p className="text-sm text-muted-foreground">Quantified ROI: NFI, FX gains, float-held revenue, deposit retention</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs text-muted-foreground">NFI (Fees)</CardTitle>
            <Banknote className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-lg font-bold text-primary">{fmtKES(totalNFI)}</div></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs text-muted-foreground">FX Margin</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent><div className="text-lg font-bold text-success">{fmtKES(totalFXMargin)}</div></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs text-muted-foreground">Float Revenue</CardTitle>
            <Coins className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent><div className="text-lg font-bold text-warning">{fmtKES(totalFloatRevenue)}</div></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs text-muted-foreground">Throughput</CardTitle>
            <Repeat className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-lg font-bold">{fmtKES(totalThroughput)}</div></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs text-muted-foreground">Deposit Retention</CardTitle>
            <Wallet className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-success">{fmtKES(depositRetention)}</div>
            <div className="text-[10px] text-muted-foreground">{kcbMerchants} merchants on KCB</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs text-muted-foreground">Total Revenue</CardTitle>
            <Globe2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-lg font-bold text-primary">{fmtKES(totalNFI + totalFXMargin + totalFloatRevenue)}</div></CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Daily Revenue Mix (NFI · FX · Float)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={revenueSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                formatter={(v: number) => fmtKES(v)}
              />
              <Legend />
              <Line type="monotone" dataKey="nfi" stroke="hsl(var(--primary))" strokeWidth={2} name="NFI" />
              <Line type="monotone" dataKey="fx" stroke="hsl(var(--success))" strokeWidth={2} name="FX Margin" />
              <Line type="monotone" dataKey="float" stroke="hsl(var(--warning))" strokeWidth={2} name="Float" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Throughput by Participating Bank</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={bankSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="bank" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                formatter={(v: number) => fmtKES(v)}
              />
              <Bar dataKey="volume" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
