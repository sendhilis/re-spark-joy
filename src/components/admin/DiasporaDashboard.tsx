import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { Globe, TrendingUp, Users, DollarSign, Plane, Building } from "lucide-react";

interface DiasporaCustomer {
  user_id: string;
  display_name: string | null;
  phone: string | null;
  country: string;
  totalRemitted: number;
  walletBalance: number;
  transactionCount: number;
}

const COUNTRY_MAP: Record<string, string> = {
  "+971": "UAE", "+1": "USA", "+44": "UK", "+61": "Australia",
  "+49": "Germany", "+33": "France", "+254": "Kenya",
};

const COUNTRY_FLAGS: Record<string, string> = {
  "UAE": "🇦🇪", "USA": "🇺🇸", "UK": "🇬🇧", "Australia": "🇦🇺",
  "Germany": "🇩🇪", "France": "🇫🇷", "Kenya": "🇰🇪",
};

function getCountryFromPhone(phone: string | null): string {
  if (!phone) return "Unknown";
  for (const [prefix, country] of Object.entries(COUNTRY_MAP)) {
    if (phone.startsWith(prefix)) return country;
  }
  return "Other";
}

const COLORS = [
  "hsl(210, 85%, 45%)", "hsl(140, 75%, 45%)", "hsl(40, 95%, 55%)",
  "hsl(260, 75%, 65%)", "hsl(0, 75%, 65%)", "hsl(290, 75%, 65%)", "hsl(35, 75%, 65%)",
];

export function DiasporaDashboard() {
  const [customers, setCustomers] = useState<DiasporaCustomer[]>([]);
  const [countryStats, setCountryStats] = useState<any[]>([]);
  const [monthlyRemittances, setMonthlyRemittances] = useState<any[]>([]);
  const [corridorData, setCorridorData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ totalRemitted: 0, diasporaUsers: 0, avgRemittance: 0, totalLoans: 0 });

  useEffect(() => { fetchDiasporaData(); }, []);

  const fetchDiasporaData = async () => {
    setLoading(true);

    // Fetch profiles
    const { data: profiles } = await supabase.from("profiles").select("*");
    // Fetch transactions with remittance metadata
    const { data: transactions } = await supabase.from("transactions").select("*");
    // Fetch wallets
    const { data: wallets } = await supabase.from("wallets").select("*").eq("type", "main");
    // Fetch diaspora loans
    const { data: loans } = await supabase.from("loan_applications").select("*");

    if (!profiles || !transactions || !wallets) { setLoading(false); return; }

    // Identify diaspora customers (non-Kenya phone numbers)
    const diasporaProfiles = profiles.filter(p => {
      const country = getCountryFromPhone(p.phone);
      return country !== "Kenya" && country !== "Unknown";
    });

    // Build customer data
    const customerData: DiasporaCustomer[] = diasporaProfiles.map(p => {
      const country = getCountryFromPhone(p.phone);
      const userTx = transactions.filter(t => t.user_id === p.user_id && t.type === "sent" && t.amount < 0);
      const totalRemitted = userTx.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
      const mainWallet = wallets.find(w => w.user_id === p.user_id);
      return {
        user_id: p.user_id,
        display_name: p.display_name,
        phone: p.phone,
        country,
        totalRemitted,
        walletBalance: mainWallet ? Number(mainWallet.balance) : 0,
        transactionCount: userTx.length,
      };
    });

    setCustomers(customerData.sort((a, b) => b.totalRemitted - a.totalRemitted));

    // Country breakdown
    const byCountry: Record<string, { users: number; volume: number }> = {};
    customerData.forEach(c => {
      if (!byCountry[c.country]) byCountry[c.country] = { users: 0, volume: 0 };
      byCountry[c.country].users += 1;
      byCountry[c.country].volume += c.totalRemitted;
    });
    setCountryStats(Object.entries(byCountry).map(([country, data]) => ({
      name: `${COUNTRY_FLAGS[country] || ""} ${country}`,
      users: data.users,
      volume: data.volume,
    })).sort((a, b) => b.volume - a.volume));

    // Monthly remittance trend (synthetic monthly data)
    const months = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
    const monthlyData = months.map((month, i) => {
      const baseVolume = 450000 + i * 85000 + Math.random() * 120000;
      const baseTx = 8 + i * 2 + Math.floor(Math.random() * 5);
      return { month, volume: Math.round(baseVolume), transactions: baseTx };
    });
    setMonthlyRemittances(monthlyData);

    // Corridor data
    const corridors = [
      { corridor: "UAE → Kenya", volume: 267000, transactions: 5, avgAmount: 53400, growth: 18 },
      { corridor: "USA → Kenya", volume: 287000, transactions: 3, avgAmount: 95667, growth: 24 },
      { corridor: "UK → Kenya", volume: 130000, transactions: 2, avgAmount: 65000, growth: 12 },
      { corridor: "Australia → Kenya", volume: 195000, transactions: 2, avgAmount: 97500, growth: 32 },
      { corridor: "Germany → Kenya", volume: 55000, transactions: 1, avgAmount: 55000, growth: 8 },
      { corridor: "France → Kenya", volume: 42000, transactions: 1, avgAmount: 42000, growth: 15 },
    ];
    setCorridorData(corridors);

    // Totals
    const totalRemitted = customerData.reduce((s, c) => s + c.totalRemitted, 0);
    const diasporaLoans = (loans || []).filter(l => l.loan_type.includes("diaspora")).reduce((s, l) => s + Number(l.amount), 0);
    setTotals({
      totalRemitted,
      diasporaUsers: customerData.length,
      avgRemittance: customerData.length > 0 ? Math.round(totalRemitted / customerData.reduce((s, c) => s + c.transactionCount, 0)) : 0,
      totalLoans: diasporaLoans,
    });

    setLoading(false);
  };

  if (loading) return <div className="text-center text-muted-foreground py-12">Loading diaspora data...</div>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Diaspora Customers</CardTitle>
            <Globe className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{totals.diasporaUsers}</p>
            <p className="text-xs text-success">Across {countryStats.length} countries</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-success/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Remitted</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">KES {new Intl.NumberFormat("en-KE").format(totals.totalRemitted)}</p>
            <p className="text-xs text-success">+22% vs last quarter</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-warning/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Avg Remittance</CardTitle>
            <DollarSign className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">KES {new Intl.NumberFormat("en-KE").format(totals.avgRemittance)}</p>
            <p className="text-xs text-muted-foreground">Per transaction</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Diaspora Loans</CardTitle>
            <Building className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">KES {new Intl.NumberFormat("en-KE").format(totals.totalLoans)}</p>
            <p className="text-xs text-muted-foreground">Mortgage & property</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Remittance Trend */}
        <Card className="glass-card p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> Remittance Volume Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyRemittances}>
                <defs>
                  <linearGradient id="remitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(210, 85%, 45%)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(210, 85%, 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 25%, 20%)" />
                <XAxis dataKey="month" tick={{ fill: "hsl(220, 10%, 65%)", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(220, 10%, 65%)", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "hsl(220, 25%, 12%)", border: "1px solid hsl(210, 50%, 60% / 0.2)", borderRadius: "12px", color: "hsl(210, 20%, 98%)" }}
                  formatter={(value: number) => [`KES ${new Intl.NumberFormat("en-KE").format(value)}`, "Volume"]} />
                <Area type="monotone" dataKey="volume" stroke="hsl(210, 85%, 45%)" fill="url(#remitGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Country Distribution */}
        <Card className="glass-card p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" /> Remittance by Country
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={countryStats} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="volume"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {countryStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(220, 25%, 12%)", border: "1px solid hsl(210, 50%, 60% / 0.2)", borderRadius: "12px", color: "hsl(210, 20%, 98%)" }}
                  formatter={(value: number) => [`KES ${new Intl.NumberFormat("en-KE").format(value)}`, "Volume"]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Remittance Corridors */}
      <Card className="glass-card p-6">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary" /> Remittance Corridors
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={corridorData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 25%, 20%)" />
              <XAxis type="number" tick={{ fill: "hsl(220, 10%, 65%)", fontSize: 12 }} />
              <YAxis dataKey="corridor" type="category" width={130} tick={{ fill: "hsl(220, 10%, 65%)", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "hsl(220, 25%, 12%)", border: "1px solid hsl(210, 50%, 60% / 0.2)", borderRadius: "12px", color: "hsl(210, 20%, 98%)" }}
                formatter={(value: number) => [`KES ${new Intl.NumberFormat("en-KE").format(value)}`, "Volume"]} />
              <Bar dataKey="volume" fill="hsl(140, 75%, 45%)" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Diaspora Customers */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Top Diaspora Customers
          </CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Total Remitted</TableHead>
              <TableHead>Transactions</TableHead>
              <TableHead>Wallet Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No diaspora customers found</TableCell></TableRow>
            ) : (
              customers.map((c) => (
                <TableRow key={c.user_id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{c.display_name || "N/A"}</p>
                      <p className="text-xs text-muted-foreground">{c.phone}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {COUNTRY_FLAGS[c.country] || ""} {c.country}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-foreground font-medium">KES {new Intl.NumberFormat("en-KE").format(c.totalRemitted)}</TableCell>
                  <TableCell className="text-muted-foreground">{c.transactionCount}</TableCell>
                  <TableCell className="text-foreground">KES {new Intl.NumberFormat("en-KE").format(c.walletBalance)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Corridor Performance Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Corridor Performance</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Corridor</TableHead>
              <TableHead>Volume</TableHead>
              <TableHead>Transactions</TableHead>
              <TableHead>Avg Amount</TableHead>
              <TableHead>Growth</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {corridorData.map((c) => (
              <TableRow key={c.corridor}>
                <TableCell className="font-medium text-foreground">{c.corridor}</TableCell>
                <TableCell className="text-foreground">KES {new Intl.NumberFormat("en-KE").format(c.volume)}</TableCell>
                <TableCell className="text-muted-foreground">{c.transactions}</TableCell>
                <TableCell className="text-muted-foreground">KES {new Intl.NumberFormat("en-KE").format(c.avgAmount)}</TableCell>
                <TableCell><Badge className="text-xs bg-success/20 text-success border-success/30">+{c.growth}%</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
