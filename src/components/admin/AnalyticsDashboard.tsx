import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

export function AnalyticsDashboard() {
  const [walletStats, setWalletStats] = useState<any[]>([]);
  const [txStats, setTxStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAnalytics(); }, []);

  const fetchAnalytics = async () => {
    setLoading(true);

    // Wallet balances by type
    const { data: wallets } = await supabase.from("wallets").select("type, balance");
    if (wallets) {
      const grouped: Record<string, { total: number; count: number }> = {};
      wallets.forEach((w: any) => {
        if (!grouped[w.type]) grouped[w.type] = { total: 0, count: 0 };
        grouped[w.type].total += Number(w.balance);
        grouped[w.type].count += 1;
      });
      setWalletStats(Object.entries(grouped).map(([type, data]) => ({
        name: type.charAt(0).toUpperCase() + type.slice(1),
        total: Math.round(data.total),
        average: Math.round(data.total / data.count),
        users: data.count,
      })));
    }

    // Transaction type distribution
    const { data: transactions } = await supabase.from("transactions").select("type, amount");
    if (transactions) {
      const typeCounts: Record<string, { count: number; volume: number }> = {};
      transactions.forEach((t: any) => {
        const type = t.type.replace("_", " ");
        if (!typeCounts[type]) typeCounts[type] = { count: 0, volume: 0 };
        typeCounts[type].count += 1;
        typeCounts[type].volume += Math.abs(Number(t.amount));
      });
      setTxStats(Object.entries(typeCounts).map(([type, data]) => ({
        name: type.charAt(0).toUpperCase() + type.slice(1),
        count: data.count,
        volume: Math.round(data.volume),
      })));
    }

    setLoading(false);
  };

  const COLORS = [
    "hsl(210, 85%, 45%)", "hsl(140, 75%, 45%)", "hsl(40, 95%, 55%)",
    "hsl(260, 75%, 65%)", "hsl(0, 75%, 65%)", "hsl(290, 75%, 65%)",
  ];

  if (loading) {
    return <div className="text-center text-muted-foreground py-12">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wallet Balances by Type */}
        <Card className="glass-card p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-lg text-foreground">Total Balances by Wallet Type</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {walletStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={walletStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 25%, 20%)" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(220, 10%, 65%)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "hsl(220, 10%, 65%)", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(220, 25%, 12%)", border: "1px solid hsl(210, 50%, 60% / 0.2)", borderRadius: "12px", color: "hsl(210, 20%, 98%)" }}
                    formatter={(value: number) => [`KES ${new Intl.NumberFormat("en-KE").format(value)}`, "Total"]}
                  />
                  <Bar dataKey="total" fill="hsl(210, 85%, 45%)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-12">No wallet data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Transaction Type Distribution */}
        <Card className="glass-card p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-lg text-foreground">Transaction Type Distribution</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {txStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={txStats} cx="50%" cy="50%" outerRadius={100} dataKey="count" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {txStats.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(220, 25%, 12%)", border: "1px solid hsl(210, 50%, 60% / 0.2)", borderRadius: "12px", color: "hsl(210, 20%, 98%)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-12">No transaction data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction Volume by Type */}
      <Card className="glass-card p-6">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-lg text-foreground">Transaction Volume by Type (KES)</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {txStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={txStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 25%, 20%)" />
                <XAxis dataKey="name" tick={{ fill: "hsl(220, 10%, 65%)", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(220, 10%, 65%)", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(220, 25%, 12%)", border: "1px solid hsl(210, 50%, 60% / 0.2)", borderRadius: "12px", color: "hsl(210, 20%, 98%)" }}
                  formatter={(value: number) => [`KES ${new Intl.NumberFormat("en-KE").format(value)}`, "Volume"]}
                />
                <Bar dataKey="volume" fill="hsl(140, 75%, 45%)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-center py-12">No transaction data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {walletStats.map((stat) => (
          <Card key={stat.name} className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{stat.name} Wallet</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-foreground">KES {new Intl.NumberFormat("en-KE").format(stat.total)}</p>
              <p className="text-xs text-muted-foreground">{stat.users} users • Avg KES {new Intl.NumberFormat("en-KE").format(stat.average)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
