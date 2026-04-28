import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  Droplets,
  TrendingUp,
  ShieldCheck,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

type Status = "green" | "amber" | "red";

interface GapMetric {
  key: string;
  title: string;
  icon: React.ElementType;
  status: Status;
  headline: string;
  detail: string;
  score: number; // 0-100
  drivers: { label: string; value: string; status: Status }[];
  owner: string;
  nextAction: string;
}

const statusStyles: Record<Status, { badge: string; ring: string; dot: string; label: string; Icon: React.ElementType }> = {
  green: {
    badge: "bg-success/15 text-success border-success/30",
    ring: "ring-success/40",
    dot: "bg-success",
    label: "On track",
    Icon: CheckCircle2,
  },
  amber: {
    badge: "bg-warning/15 text-warning border-warning/30",
    ring: "ring-warning/40",
    dot: "bg-warning",
    label: "Needs attention",
    Icon: Clock,
  },
  red: {
    badge: "bg-destructive/15 text-destructive border-destructive/30",
    ring: "ring-destructive/40",
    dot: "bg-destructive",
    label: "At risk",
    Icon: XCircle,
  },
};

function pickStatus(score: number): Status {
  if (score >= 75) return "green";
  if (score >= 50) return "amber";
  return "red";
}

export function StrategicGapsDashboard() {
  const [metrics, setMetrics] = useState<GapMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 60_000);
    return () => clearInterval(interval);
  }, []);

  const loadMetrics = async () => {
    setLoading(true);

    // 1. Agent liquidity — % of agents with float >= 30% of max_float
    const { data: agents } = await supabase
      .from("bank_agents")
      .select("float_balance, max_float, status");
    const activeAgents = (agents ?? []).filter((a) => a.status === "active");
    const healthyAgents = activeAgents.filter(
      (a) => Number(a.float_balance) >= Number(a.max_float) * 0.3,
    );
    const dryAgents = activeAgents.filter(
      (a) => Number(a.float_balance) < Number(a.max_float) * 0.1,
    );
    const liquidityScore = activeAgents.length
      ? Math.round((healthyAgents.length / activeAgents.length) * 100)
      : 0;
    const liquidityStatus = pickStatus(liquidityScore);

    // 2. FX exposure — derived from corridor routes & recent FX volumes
    const { data: corridors } = await supabase
      .from("corridor_routes")
      .select("settlement_currency, active, extra_fee_bps");
    const activeCorridors = (corridors ?? []).filter((c) => c.active);
    const nonKesCorridors = activeCorridors.filter(
      (c) => c.settlement_currency && c.settlement_currency !== "KES",
    );
    // Heuristic: more unhedged FX corridors lowers score
    const fxScore = activeCorridors.length
      ? Math.max(0, 100 - nonKesCorridors.length * 12)
      : 50;
    const fxStatus = pickStatus(fxScore);

    // 3. Compliance / screening feed — flagged transactions reviewed in time
    const { data: flagged } = await supabase
      .from("flagged_transactions")
      .select("status, created_at, reviewed_at");
    const total = (flagged ?? []).length;
    const reviewed = (flagged ?? []).filter((f) => f.status !== "pending").length;
    const stale = (flagged ?? []).filter((f) => {
      if (f.status !== "pending") return false;
      const ageH = (Date.now() - new Date(f.created_at).getTime()) / 36e5;
      return ageH > 24;
    }).length;
    const complianceScore = total
      ? Math.max(0, Math.round((reviewed / total) * 100) - stale * 5)
      : 90;
    const complianceStatus = pickStatus(complianceScore);

    // 4. Regulatory tariff filing — last successful tariff refresh run
    const { data: runs } = await supabase
      .from("mpesa_global_tariff_runs")
      .select("status, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    const lastSuccess = (runs ?? []).find((r) => r.status === "success");
    const daysSince = lastSuccess
      ? Math.floor(
          (Date.now() - new Date(lastSuccess.created_at).getTime()) / 86_400_000,
        )
      : 999;
    const tariffScore =
      daysSince <= 7 ? 95 : daysSince <= 30 ? 65 : daysSince <= 90 ? 40 : 15;
    const tariffStatus = pickStatus(tariffScore);

    setMetrics([
      {
        key: "liquidity",
        title: "Agent Liquidity",
        icon: Droplets,
        status: liquidityStatus,
        headline: `${healthyAgents.length}/${activeAgents.length} agents above 30% float`,
        detail:
          dryAgents.length > 0
            ? `${dryAgents.length} agents below 10% float — risk of cash-out failures.`
            : "Float distribution is balanced across the network.",
        score: liquidityScore,
        drivers: [
          {
            label: "Healthy agents (≥30% float)",
            value: `${healthyAgents.length}`,
            status: "green",
          },
          {
            label: "Dry agents (<10% float)",
            value: `${dryAgents.length}`,
            status: dryAgents.length > 0 ? "red" : "green",
          },
          {
            label: "Total active agents",
            value: `${activeAgents.length}`,
            status: "amber",
          },
        ],
        owner: "Treasury & Agent Ops",
        nextAction:
          dryAgents.length > 0
            ? "Dispatch float top-up to dry agents within 24h"
            : "Maintain weekly float forecast",
      },
      {
        key: "fx",
        title: "FX Exposure",
        icon: TrendingUp,
        status: fxStatus,
        headline: `${nonKesCorridors.length} non-KES corridors live`,
        detail:
          nonKesCorridors.length > 3
            ? "Material multi-currency exposure — hedging policy required."
            : "Exposure is within tolerance; passive hedging acceptable.",
        score: fxScore,
        drivers: [
          {
            label: "Active corridors",
            value: `${activeCorridors.length}`,
            status: "green",
          },
          {
            label: "Non-KES settlement currencies",
            value: `${nonKesCorridors.length}`,
            status: nonKesCorridors.length > 3 ? "red" : "amber",
          },
          {
            label: "Hedging policy filed",
            value: "Pending",
            status: "red",
          },
        ],
        owner: "Treasury",
        nextAction: "Publish FX hedging policy & daily VaR report",
      },
      {
        key: "compliance",
        title: "Compliance Screening Feed",
        icon: ShieldCheck,
        status: complianceStatus,
        headline: `${reviewed}/${total || 0} flagged items reviewed`,
        detail:
          stale > 0
            ? `${stale} flags pending >24h — feed health degraded.`
            : "Sanctions / PEP screening feed healthy.",
        score: complianceScore,
        drivers: [
          {
            label: "Total flagged",
            value: `${total}`,
            status: "amber",
          },
          {
            label: "Reviewed",
            value: `${reviewed}`,
            status: "green",
          },
          {
            label: "Stale (>24h)",
            value: `${stale}`,
            status: stale > 0 ? "red" : "green",
          },
        ],
        owner: "Compliance / MLRO",
        nextAction:
          stale > 0
            ? "Clear stale alerts and verify sanctions feed connectivity"
            : "Run weekly screening feed reconciliation",
      },
      {
        key: "tariff",
        title: "Regulatory Tariff Filing",
        icon: FileCheck2,
        status: tariffStatus,
        headline: lastSuccess
          ? `Last refresh ${daysSince} day${daysSince === 1 ? "" : "s"} ago`
          : "No successful refresh recorded",
        detail:
          daysSince > 30
            ? "Filed tariff schedule may be out of date with regulator."
            : "Tariff schedule in sync with the latest regulator publication.",
        score: tariffScore,
        drivers: [
          {
            label: "Last successful refresh",
            value: lastSuccess
              ? new Date(lastSuccess.created_at).toLocaleDateString()
              : "—",
            status: tariffStatus,
          },
          {
            label: "Recent runs (5)",
            value: `${runs?.length ?? 0}`,
            status: "amber",
          },
          {
            label: "Filed with regulator",
            value: daysSince <= 30 ? "Current" : "Overdue",
            status: daysSince <= 30 ? "green" : "red",
          },
        ],
        owner: "Regulatory Affairs",
        nextAction:
          daysSince > 30
            ? "Trigger tariff refresh and re-file schedule with regulator"
            : "Schedule next quarterly filing review",
      },
    ]);

    setLastRefreshed(new Date());
    setLoading(false);
  };

  const overall: Status = metrics.length
    ? metrics.some((m) => m.status === "red")
      ? "red"
      : metrics.some((m) => m.status === "amber")
        ? "amber"
        : "green"
    : "amber";

  const overallStyle = statusStyles[overall];

  return (
    <div className="space-y-6">
      {/* Header / overall status */}
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Strategic Risk Gaps
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Non-technical risks the leadership team must own. Auto-refreshes every minute.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={overallStyle.badge}>
              <span className={`inline-block h-2 w-2 rounded-full mr-2 ${overallStyle.dot}`} />
              Overall: {overallStyle.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          </div>
        </CardHeader>
      </Card>

      {/* Metric grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading && metrics.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="glass-card animate-pulse h-64" />
            ))
          : metrics.map((m) => {
              const style = statusStyles[m.status];
              const Icon = m.icon;
              return (
                <Card
                  key={m.key}
                  className={`glass-card ring-1 ${style.ring} transition-all hover:shadow-lg`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${style.badge}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{m.title}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Owner: {m.owner}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={style.badge}>
                        <style.Icon className="h-3 w-3 mr-1" />
                        {style.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {m.headline}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{m.detail}</p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Health score</span>
                        <span className="font-mono">{m.score}/100</span>
                      </div>
                      <Progress value={m.score} className="h-2" />
                    </div>

                    <div className="space-y-1.5">
                      {m.drivers.map((d) => {
                        const ds = statusStyles[d.status];
                        return (
                          <div
                            key={d.label}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <span className={`h-1.5 w-1.5 rounded-full ${ds.dot}`} />
                              {d.label}
                            </span>
                            <span className="font-medium text-foreground">{d.value}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground">Next action</p>
                      <p className="text-sm text-foreground font-medium">
                        {m.nextAction}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>
    </div>
  );
}
