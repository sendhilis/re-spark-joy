import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, TrendingUp, TrendingDown, ArrowRightLeft, PlayCircle, Banknote } from "lucide-react";

type Position = {
  id: string;
  position_date: string;
  participating_bank: string;
  inbound_volume: number;
  outbound_volume: number;
  net_position: number;
  transaction_count: number;
  cutoff_at: string;
  status: string;
};

type Dispatch = {
  id: string;
  position_id: string | null;
  beneficiary_bank: string;
  amount: number;
  scheduled_at: string;
  dispatched_at: string | null;
  reference: string;
  status: string;
  float_revenue: number;
};

const PARTICIPATING_BANKS = [
  "KCB Bank Kenya", "Equity Bank", "Co-operative Bank", "NCBA Bank",
  "Stanbic Bank", "Family Bank", "Absa Bank", "I&M Bank",
];

const fmtKES = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);

export function SettlementEngine() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [pRes, dRes] = await Promise.all([
      supabase.from("settlement_positions").select("*").order("position_date", { ascending: false }).limit(100),
      supabase.from("settlement_dispatches").select("*").order("scheduled_at", { ascending: false }).limit(100),
    ]);
    if (pRes.data) setPositions(pRes.data as Position[]);
    if (dRes.data) setDispatches(dRes.data as Dispatch[]);
  };

  useEffect(() => { load(); }, []);

  const runEodCutoff = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const cutoff = new Date();
      cutoff.setHours(13, 0, 0, 0);

      // Generate synthetic positions for today across participating banks
      const newPositions = PARTICIPATING_BANKS.map((bank) => {
        const inbound = Math.round(5_000_000 + Math.random() * 30_000_000);
        const outbound = Math.round(5_000_000 + Math.random() * 30_000_000);
        return {
          position_date: today,
          participating_bank: bank,
          inbound_volume: inbound,
          outbound_volume: outbound,
          net_position: inbound - outbound,
          transaction_count: Math.round(500 + Math.random() * 5000),
          cutoff_at: cutoff.toISOString(),
          status: "pending",
        };
      });

      const { data: inserted, error } = await supabase
        .from("settlement_positions")
        .insert(newPositions)
        .select();

      if (error) throw error;

      // Create T+1 dispatches for any net-negative banks (KCB pays them)
      const dispatchRows = (inserted || [])
        .filter((p) => p.net_position < 0)
        .map((p) => {
          const dispatchAt = new Date(p.cutoff_at);
          dispatchAt.setDate(dispatchAt.getDate() + 1);
          const amt = Math.abs(p.net_position);
          return {
            position_id: p.id,
            beneficiary_bank: p.participating_bank,
            amount: amt,
            scheduled_at: dispatchAt.toISOString(),
            reference: `LPF-DSP-${Date.now()}-${p.participating_bank.split(" ")[0].toUpperCase()}`,
            status: "scheduled",
            float_revenue: Math.round(amt * 0.0002), // ~2 bps overnight
          };
        });

      if (dispatchRows.length > 0) {
        await supabase.from("settlement_dispatches").insert(dispatchRows);
      }

      toast.success(`EOD cut-off run complete: ${inserted?.length} positions, ${dispatchRows.length} dispatches scheduled`);
      await load();
    } catch (e) {
      toast.error(`Cut-off failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const dispatchNow = async (id: string) => {
    const { error } = await supabase
      .from("settlement_dispatches")
      .update({ status: "dispatched", dispatched_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Dispatched"); load(); }
  };

  const totalNetPositive = positions.filter((p) => p.net_position > 0).reduce((s, p) => s + p.net_position, 0);
  const totalNetNegative = positions.filter((p) => p.net_position < 0).reduce((s, p) => s + Math.abs(p.net_position), 0);
  const totalFloatRevenue = dispatches.reduce((s, d) => s + Number(d.float_revenue), 0);
  const pendingDispatches = dispatches.filter((d) => d.status === "scheduled").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Settlement Engine</h2>
          <p className="text-sm text-muted-foreground">EOD net positions, 1pm cut-off, T+1 dispatch ledger</p>
        </div>
        <Button onClick={runEodCutoff} disabled={loading} className="button-3d">
          <PlayCircle className="h-4 w-4 mr-2" />
          {loading ? "Running…" : "Run EOD Cut-off Now"}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Net Inbound (KCB owed)</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-success">{fmtKES(totalNetPositive)}</div></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Net Outbound (KCB owes)</CardTitle>
            <TrendingDown className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-warning">{fmtKES(totalNetNegative)}</div></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Float Revenue (overnight)</CardTitle>
            <Banknote className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-primary">{fmtKES(totalFloatRevenue)}</div></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pending Dispatches</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-foreground">{pendingDispatches}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="positions" className="space-y-4">
        <TabsList className="glass-card">
          <TabsTrigger value="positions"><ArrowRightLeft className="h-4 w-4 mr-2" />Net Positions</TabsTrigger>
          <TabsTrigger value="dispatches"><Banknote className="h-4 w-4 mr-2" />Dispatch Ledger (T+1)</TabsTrigger>
        </TabsList>

        <TabsContent value="positions">
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Participating Bank</TableHead>
                    <TableHead className="text-right">Inbound</TableHead>
                    <TableHead className="text-right">Outbound</TableHead>
                    <TableHead className="text-right">Net Position</TableHead>
                    <TableHead className="text-right">Tx Count</TableHead>
                    <TableHead>Cut-off</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{p.position_date}</TableCell>
                      <TableCell className="font-medium">{p.participating_bank}</TableCell>
                      <TableCell className="text-right text-xs">{fmtKES(Number(p.inbound_volume))}</TableCell>
                      <TableCell className="text-right text-xs">{fmtKES(Number(p.outbound_volume))}</TableCell>
                      <TableCell className={`text-right font-bold text-xs ${Number(p.net_position) >= 0 ? "text-success" : "text-warning"}`}>
                        {fmtKES(Number(p.net_position))}
                      </TableCell>
                      <TableCell className="text-right text-xs">{p.transaction_count.toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{new Date(p.cutoff_at).toLocaleString("en-KE", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "settled" ? "default" : p.status === "dispatched" ? "secondary" : "outline"}>
                          {p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {positions.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No positions yet — run the EOD cut-off.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dispatches">
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Beneficiary Bank</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Float Rev</TableHead>
                    <TableHead>Scheduled (T+1)</TableHead>
                    <TableHead>Dispatched</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dispatches.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.reference}</TableCell>
                      <TableCell className="font-medium">{d.beneficiary_bank}</TableCell>
                      <TableCell className="text-right text-xs">{fmtKES(Number(d.amount))}</TableCell>
                      <TableCell className="text-right text-xs text-primary">{fmtKES(Number(d.float_revenue))}</TableCell>
                      <TableCell className="text-xs">{new Date(d.scheduled_at).toLocaleString("en-KE")}</TableCell>
                      <TableCell className="text-xs">{d.dispatched_at ? new Date(d.dispatched_at).toLocaleString("en-KE") : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={d.status === "dispatched" ? "default" : "outline"}>{d.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {d.status === "scheduled" && (
                          <Button size="sm" variant="outline" onClick={() => dispatchNow(d.id)}>Dispatch</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {dispatches.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No dispatches yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
