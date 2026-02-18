import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import {
  MapPin, Banknote, ArrowDownToLine, ArrowUpFromLine, AlertTriangle,
  TrendingUp, Users, Activity, Search, RefreshCw, CheckCircle2,
  XCircle, Clock, Wifi, WifiOff, Star, Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Agent {
  id: string;
  agent_code: string;
  agent_name: string;
  location: string;
  county: string;
  phone: string | null;
  bank_partner: string;
  status: string;
  float_balance: number;
  max_float: number;
  daily_transaction_limit: number;
  created_at: string;
}

interface AgentTx {
  id: string;
  agent_id: string;
  transaction_type: string;
  amount: number;
  transaction_code: string | null;
  status: string;
  created_at: string;
}

interface AgentStat {
  agent: Agent;
  totalVolume: number;
  txCount: number;
  cashIn: number;
  cashOut: number;
  flaggedCount: number;
  performanceScore: number;
}

const COLORS = [
  "hsl(210, 85%, 45%)", "hsl(140, 75%, 45%)", "hsl(40, 95%, 55%)",
  "hsl(260, 75%, 65%)", "hsl(0, 75%, 65%)",
];

const TOOLTIP_STYLE = {
  background: "hsl(220, 25%, 12%)",
  border: "1px solid hsl(210, 50%, 60% / 0.2)",
  borderRadius: "12px",
  color: "hsl(210, 20%, 98%)",
};

function fmtKES(v: number) {
  return "KES " + new Intl.NumberFormat("en-KE").format(Math.round(v));
}

function floatPct(agent: Agent) {
  return agent.max_float > 0 ? (agent.float_balance / agent.max_float) * 100 : 0;
}

function scoreAgent(stats: Omit<AgentStat, "performanceScore">) {
  // 0-100 score based on volume, uptime (non-flagged ratio), float health
  const flagRatio = stats.txCount > 0 ? stats.flaggedCount / stats.txCount : 0;
  const floatHealth = floatPct(stats.agent) / 100;
  const score = Math.max(0, Math.min(100, Math.round(
    (1 - flagRatio) * 60 + floatHealth * 40
  )));
  return score;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "text-success border-success/40 bg-success/10"
    : score >= 60 ? "text-warning border-warning/40 bg-warning/10"
    : "text-destructive border-destructive/40 bg-destructive/10";
  const icon = score >= 80 ? <Star className="h-3 w-3" />
    : score >= 60 ? <Shield className="h-3 w-3" />
    : <AlertTriangle className="h-3 w-3" />;
  return (
    <Badge variant="outline" className={`text-xs gap-1 ${color}`}>
      {icon}{score}/100
    </Badge>
  );
}

export function AgentNetworkDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentTxs, setAgentTxs] = useState<AgentTx[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStat[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { toast } = useToast();

  const buildStats = useCallback((agentList: Agent[], txList: AgentTx[]) => {
    const stats: AgentStat[] = agentList.map((agent) => {
      const txs = txList.filter((t) => t.agent_id === agent.id);
      const cashIn = txs.filter((t) => t.transaction_type === "cash_in").reduce((s, t) => s + Number(t.amount), 0);
      const cashOut = txs.filter((t) => t.transaction_type !== "cash_in").reduce((s, t) => s + Number(t.amount), 0);
      const flaggedCount = txs.filter((t) => t.status === "flagged").length;
      const totalVolume = txs.reduce((s, t) => s + Number(t.amount), 0);
      const base = { agent, totalVolume, txCount: txs.length, cashIn, cashOut, flaggedCount };
      return { ...base, performanceScore: scoreAgent(base) };
    });
    setAgentStats(stats.sort((a, b) => b.totalVolume - a.totalVolume));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [agentsRes, txsRes] = await Promise.all([
      supabase.from("bank_agents").select("*").order("created_at", { ascending: true }),
      supabase.from("agent_transactions").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    if (agentsRes.error) toast({ title: "Error loading agents", description: agentsRes.error.message, variant: "destructive" });
    if (txsRes.error) toast({ title: "Error loading transactions", description: txsRes.error.message, variant: "destructive" });
    const aList = (agentsRes.data || []) as Agent[];
    const tList = (txsRes.data || []) as AgentTx[];
    setAgents(aList);
    setAgentTxs(tList);
    buildStats(aList, tList);
    setLastUpdated(new Date());
    setLoading(false);
  }, [toast, buildStats]);

  // Initial fetch
  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime subscriptions
  useEffect(() => {
    const agentChannel = supabase
      .channel("admin-agents-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "bank_agents" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_transactions" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(agentChannel); };
  }, [fetchData]);

  const toggleAgentStatus = async (agent: Agent) => {
    const newStatus = agent.status === "active" ? "suspended" : "active";
    const { error } = await supabase.from("bank_agents").update({ status: newStatus }).eq("id", agent.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Agent ${newStatus === "active" ? "reactivated" : "suspended"}`, description: agent.agent_name });
    }
  };

  const resolveFlag = async (txId: string) => {
    const { error } = await supabase.from("agent_transactions").update({ status: "completed" }).eq("id", txId);
    if (!error) toast({ title: "Flag resolved", description: "Transaction marked completed" });
  };

  // Filtered agents
  const filteredStats = agentStats.filter((s) =>
    [s.agent.agent_name, s.agent.location, s.agent.county, s.agent.agent_code, s.agent.bank_partner]
      .join(" ").toLowerCase().includes(search.toLowerCase())
  );

  // Summary totals
  const totalVolume = agentTxs.reduce((s, t) => s + Number(t.amount), 0);
  const totalCashIn = agentTxs.filter((t) => t.transaction_type === "cash_in").reduce((s, t) => s + Number(t.amount), 0);
  const totalCashOut = agentTxs.filter((t) => t.transaction_type !== "cash_in").reduce((s, t) => s + Number(t.amount), 0);
  const flaggedTxs = agentTxs.filter((t) => t.status === "flagged");
  const activeAgents = agents.filter((a) => a.status === "active").length;

  // Chart data: volume by county
  const countyData = agents.reduce((acc: Record<string, number>, a) => {
    const vol = agentStats.find((s) => s.agent.id === a.id)?.totalVolume || 0;
    acc[a.county] = (acc[a.county] || 0) + vol;
    return acc;
  }, {});
  const countyChartData = Object.entries(countyData).map(([county, volume]) => ({ county, volume })).sort((a, b) => b.volume - a.volume);

  // Chart data: tx type distribution
  const txTypeDist = [
    { name: "Cash In", value: agentTxs.filter((t) => t.transaction_type === "cash_in").length },
    { name: "Cash Out", value: agentTxs.filter((t) => t.transaction_type === "cash_out").length },
    { name: "ATM", value: agentTxs.filter((t) => t.transaction_type === "atm_withdrawal").length },
    { name: "Flagged", value: flaggedTxs.length },
  ].filter((d) => d.value > 0);

  // Hourly activity (last 24h)
  const hourlyData = Array.from({ length: 24 }, (_, h) => {
    const count = agentTxs.filter((t) => {
      const d = new Date(t.created_at);
      return d.getHours() === h;
    }).length;
    return { hour: `${h}:00`, transactions: count };
  });

  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground">
      <RefreshCw className="h-5 w-5 animate-spin" /> Loading agent network data...
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span className="text-sm text-muted-foreground">Live · Updated {lastUpdated.toLocaleTimeString()}</span>
        </div>
        <Button variant="outline" size="sm" className="glass-card gap-2" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="glass-card border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-muted-foreground">Active Agents</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{activeAgents}</p>
            <p className="text-xs text-muted-foreground">{agents.length} total</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-success/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total Volume</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-foreground">{fmtKES(totalVolume)}</p>
            <p className="text-xs text-muted-foreground">{agentTxs.length} transactions</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-muted-foreground">Cash In</CardTitle>
            <ArrowDownToLine className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-foreground">{fmtKES(totalCashIn)}</p>
            <p className="text-xs text-muted-foreground">{agentTxs.filter((t) => t.transaction_type === "cash_in").length} tx</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-warning/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-muted-foreground">Cash Out</CardTitle>
            <ArrowUpFromLine className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-foreground">{fmtKES(totalCashOut)}</p>
            <p className="text-xs text-muted-foreground">{agentTxs.filter((t) => t.transaction_type !== "cash_in").length} tx</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-destructive/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-muted-foreground">Flagged</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{flaggedTxs.length}</p>
            <p className="text-xs text-muted-foreground">Needs review</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly activity */}
        <Card className="glass-card p-6 lg:col-span-2">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Transaction Activity (24h)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={hourlyData}>
                <defs>
                  <linearGradient id="agentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(210, 85%, 45%)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(210, 85%, 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 25%, 20%)" />
                <XAxis dataKey="hour" tick={{ fill: "hsl(220, 10%, 65%)", fontSize: 11 }} interval={3} />
                <YAxis tick={{ fill: "hsl(220, 10%, 65%)", fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="transactions" stroke="hsl(210, 85%, 45%)" fill="url(#agentGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* TX type distribution */}
        <Card className="glass-card p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <Banknote className="h-4 w-4 text-primary" /> Transaction Mix
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={txTypeDist} cx="50%" cy="50%" outerRadius={80} innerRadius={45} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}>
                  {txTypeDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Volume by County */}
      <Card className="glass-card p-6">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> Agent Volume by County
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={countyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 25%, 20%)" />
              <XAxis dataKey="county" tick={{ fill: "hsl(220, 10%, 65%)", fontSize: 12 }} />
              <YAxis tick={{ fill: "hsl(220, 10%, 65%)", fontSize: 12 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [fmtKES(v), "Volume"]} />
              <Bar dataKey="volume" fill="hsl(140, 75%, 45%)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Agent sub-tabs */}
      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList className="glass-card">
          <TabsTrigger value="agents" className="gap-2"><Users className="h-4 w-4" /> All Agents</TabsTrigger>
          <TabsTrigger value="flagged" className="gap-2">
            <AlertTriangle className="h-4 w-4" /> Flagged
            {flaggedTxs.length > 0 && (
              <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-destructive text-destructive-foreground">
                {flaggedTxs.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-2"><Star className="h-4 w-4" /> Performance</TabsTrigger>
          <TabsTrigger value="live" className="gap-2"><Wifi className="h-4 w-4" /> Live Feed</TabsTrigger>
        </TabsList>

        {/* ALL AGENTS */}
        <TabsContent value="agents">
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center gap-3 flex-wrap">
                <CardTitle className="text-base text-foreground">Agent Registry</CardTitle>
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by name, location, bank..." className="pl-10 glass-card h-9"
                    value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Bank Partner</TableHead>
                  <TableHead>Float Balance</TableHead>
                  <TableHead>Volume (7d)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStats.map(({ agent, totalVolume }) => {
                  const pct = floatPct(agent);
                  const floatColor = pct < 20 ? "text-destructive" : pct < 50 ? "text-warning" : "text-success";
                  return (
                    <TableRow key={agent.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground text-sm">{agent.agent_name}</p>
                          <p className="text-xs text-muted-foreground">{agent.agent_code} · {agent.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm text-foreground">{agent.location}</p>
                            <p className="text-xs text-muted-foreground">{agent.county}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{agent.bank_partner}</Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className={`text-sm font-medium ${floatColor}`}>{fmtKES(agent.float_balance)}</p>
                          <div className="w-24 h-1.5 bg-muted rounded-full mt-1">
                            <div className={`h-1.5 rounded-full transition-all ${pct < 20 ? "bg-destructive" : pct < 50 ? "bg-warning" : "bg-success"}`}
                              style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                          <p className="text-xs text-muted-foreground">{pct.toFixed(0)}% of limit</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground text-sm font-medium">{fmtKES(totalVolume)}</TableCell>
                      <TableCell>
                        {agent.status === "active" ? (
                          <Badge className="text-xs bg-success/20 text-success border-success/30 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Active
                          </Badge>
                        ) : (
                          <Badge className="text-xs bg-destructive/20 text-destructive border-destructive/30 gap-1">
                            <XCircle className="h-3 w-3" /> Suspended
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" className="text-xs glass-card h-7"
                          onClick={() => toggleAgentStatus(agent)}>
                          {agent.status === "active" ? "Suspend" : "Reactivate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* FLAGGED TRANSACTIONS */}
        <TabsContent value="flagged">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Flagged Agent Transactions
                <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-xs">{flaggedTxs.length} pending</Badge>
              </CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flaggedTxs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-success" />
                      No flagged transactions
                    </TableCell>
                  </TableRow>
                ) : flaggedTxs.map((tx) => {
                  const agent = agents.find((a) => a.id === tx.agent_id);
                  return (
                    <TableRow key={tx.id} className="border-l-2 border-l-destructive/50">
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(tx.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-foreground">{agent?.agent_name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{agent?.location}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {tx.transaction_type.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-destructive font-medium text-sm">{fmtKES(tx.amount)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{tx.transaction_code || "—"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" className="text-xs glass-card h-7 text-success border-success/40"
                          onClick={() => resolveFlag(tx.id)}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Resolve
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* PERFORMANCE LEADERBOARD */}
        <TabsContent value="performance">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {agentStats.slice(0, 3).map((s, i) => (
                <Card key={s.agent.id} className={`glass-card border-${i === 0 ? "warning" : "primary"}/30 p-4`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                        <ScoreBadge score={s.performanceScore} />
                      </div>
                      <p className="font-semibold text-foreground text-sm">{s.agent.agent_name}</p>
                      <p className="text-xs text-muted-foreground">{s.agent.location}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="glass-card rounded-lg p-2">
                      <p className="text-muted-foreground">Volume</p>
                      <p className="font-bold text-foreground">{fmtKES(s.totalVolume)}</p>
                    </div>
                    <div className="glass-card rounded-lg p-2">
                      <p className="text-muted-foreground">Transactions</p>
                      <p className="font-bold text-foreground">{s.txCount}</p>
                    </div>
                    <div className="glass-card rounded-lg p-2">
                      <p className="text-muted-foreground">Cash In</p>
                      <p className="font-bold text-success">{fmtKES(s.cashIn)}</p>
                    </div>
                    <div className="glass-card rounded-lg p-2">
                      <p className="text-muted-foreground">Cash Out</p>
                      <p className="font-bold text-warning">{fmtKES(s.cashOut)}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base text-foreground">Full Performance Table</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Transactions</TableHead>
                    <TableHead>Cash In</TableHead>
                    <TableHead>Cash Out</TableHead>
                    <TableHead>Flagged</TableHead>
                    <TableHead>Float Health</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentStats.map((s, i) => {
                    const pct = floatPct(s.agent);
                    return (
                      <TableRow key={s.agent.id}>
                        <TableCell className="text-muted-foreground font-mono text-sm">#{i + 1}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground text-sm">{s.agent.agent_name}</p>
                            <p className="text-xs text-muted-foreground">{s.agent.agent_code}</p>
                          </div>
                        </TableCell>
                        <TableCell><ScoreBadge score={s.performanceScore} /></TableCell>
                        <TableCell className="text-foreground text-sm font-medium">{fmtKES(s.totalVolume)}</TableCell>
                        <TableCell className="text-muted-foreground">{s.txCount}</TableCell>
                        <TableCell className="text-success text-sm">{fmtKES(s.cashIn)}</TableCell>
                        <TableCell className="text-warning text-sm">{fmtKES(s.cashOut)}</TableCell>
                        <TableCell>
                          {s.flaggedCount > 0 ? (
                            <Badge className="text-xs bg-destructive/20 text-destructive border-destructive/30">{s.flaggedCount}</Badge>
                          ) : (
                            <Badge className="text-xs bg-success/20 text-success border-success/30">Clean</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full">
                              <div className={`h-1.5 rounded-full ${pct < 20 ? "bg-destructive" : pct < 50 ? "bg-warning" : "bg-success"}`}
                                style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        {/* LIVE FEED */}
        <TabsContent value="live">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <Wifi className="h-4 w-4 text-success animate-pulse" />
                Live Agent Transaction Feed
                <Badge className="text-xs bg-success/20 text-success border-success/30">REALTIME</Badge>
              </CardTitle>
            </CardHeader>
            <div className="max-h-[520px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentTxs.slice(0, 100).map((tx) => {
                    const agent = agents.find((a) => a.id === tx.agent_id);
                    const typeIcon = tx.transaction_type === "cash_in"
                      ? <ArrowDownToLine className="h-3 w-3 text-success" />
                      : tx.transaction_type === "atm_withdrawal"
                        ? <Banknote className="h-3 w-3 text-primary" />
                        : <ArrowUpFromLine className="h-3 w-3 text-warning" />;
                    return (
                      <TableRow key={tx.id}
                        className={tx.status === "flagged" ? "bg-destructive/5 border-l-2 border-l-destructive/50" : ""}>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(tx.created_at).toLocaleTimeString()}
                          </div>
                          <p className="text-xs text-muted-foreground/60">{new Date(tx.created_at).toLocaleDateString()}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-foreground">{agent?.agent_name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{agent?.county}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {typeIcon}
                            <span className="text-xs capitalize text-foreground">{tx.transaction_type.replace("_", " ")}</span>
                          </div>
                        </TableCell>
                        <TableCell className={`text-sm font-medium ${tx.transaction_type === "cash_in" ? "text-success" : "text-warning"}`}>
                          {fmtKES(tx.amount)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{tx.transaction_code || "—"}</TableCell>
                        <TableCell>
                          {tx.status === "completed" && <Badge className="text-xs bg-success/20 text-success border-success/30 gap-1"><CheckCircle2 className="h-3 w-3" />Done</Badge>}
                          {tx.status === "pending" && <Badge className="text-xs bg-warning/20 text-warning border-warning/30 gap-1"><Clock className="h-3 w-3" />Pending</Badge>}
                          {tx.status === "flagged" && <Badge className="text-xs bg-destructive/20 text-destructive border-destructive/30 gap-1"><AlertTriangle className="h-3 w-3" />Flagged</Badge>}
                          {tx.status === "failed" && <Badge className="text-xs bg-muted text-muted-foreground gap-1"><WifiOff className="h-3 w-3" />Failed</Badge>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
