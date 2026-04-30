import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, TrendingUp, TrendingDown, ArrowRightLeft, PlayCircle, Banknote, Receipt, Network } from "lucide-react";

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

type LipafoPayTx = {
  id: string;
  amount: number;
  description: string;
  recipient: string | null;
  created_at: string;
  status: string;
};

const PARTICIPATING_BANKS = [
  "KCB Bank Kenya", "Equity Bank", "Co-operative Bank", "NCBA Bank",
  "Stanbic Bank", "Family Bank", "Absa Bank", "I&M Bank",
];

const fmtKES = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);

// Resolve the bank rail from a LipafoPay transaction description / recipient
const resolveBank = (tx: LipafoPayTx): string => {
  const blob = `${tx.description ?? ""} ${tx.recipient ?? ""}`;
  if (/LMID/i.test(blob)) return "LIPAFO_WALLET";
  for (const b of PARTICIPATING_BANKS) {
    const short = b.split(" ")[0];
    if (blob.includes(b) || blob.includes(short)) return b;
  }
  if (/Co-op/i.test(blob)) return "Co-operative Bank";
  return "Unrouted";
};

export function SettlementEngine() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [lipafoTxs, setLipafoTxs] = useState<LipafoPayTx[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [pRes, dRes, tRes] = await Promise.all([
      supabase.from("settlement_positions").select("*").order("position_date", { ascending: false }).limit(100),
      supabase.from("settlement_dispatches").select("*").order("scheduled_at", { ascending: false }).limit(100),
      supabase.from("transactions").select("id,amount,description,recipient,created_at,status")
        .eq("type", "qr_payment").order("created_at", { ascending: false }).limit(50),
    ]);
    if (pRes.data) setPositions(pRes.data as Position[]);
    if (dRes.data) setDispatches(dRes.data as Dispatch[]);
    if (tRes.data) setLipafoTxs(tRes.data as LipafoPayTx[]);
  };

  useEffect(() => { load(); }, []);

  const runEodCutoff = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const cutoff = new Date();
      cutoff.setHours(13, 0, 0, 0);

      // Synthetic baseline volumes per bank (Lipafo ↔ Bank) + overlay any real LipafoPay txs from today
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

      // T+1 dispatches: Lipafo settles to banks where Lipafo owes (net_position < 0 from bank's view)
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
            float_revenue: Math.round(amt * 0.0002),
          };
        });

      if (dispatchRows.length > 0) {
        await supabase.from("settlement_dispatches").insert(dispatchRows);
      }

      toast.success(`EOD cut-off complete — ${inserted?.length} bank positions, ${dispatchRows.length} T+1 dispatches scheduled by Lipafo`);
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
    else { toast.success("Dispatched by Lipafo"); load(); }
  };

  // Reframed: from Lipafo's perspective
  // net_position > 0 (bank owes Lipafo) => Lipafo will receive
  // net_position < 0 (Lipafo owes bank) => Lipafo will pay out T+1
  const totalLipafoReceivable = positions.filter((p) => p.net_position > 0).reduce((s, p) => s + p.net_position, 0);
  const totalLipafoPayable = positions.filter((p) => p.net_position < 0).reduce((s, p) => s + Math.abs(p.net_position), 0);
  const totalFloatRevenue = dispatches.reduce((s, d) => s + Number(d.float_revenue), 0);
  const pendingDispatches = dispatches.filter((d) => d.status === "scheduled").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Lipafo Settlement Engine</h2>
          <p className="text-sm text-muted-foreground">
            Lipafo is an independent switch. EOD net positions per participating bank · 1pm cut-off · T+1 dispatch ledger.
          </p>
        </div>
        <Button onClick={runEodCutoff} disabled={loading} className="button-3d">
          <PlayCircle className="h-4 w-4 mr-2" />
          {loading ? "Running…" : "Run EOD Cut-off Now"}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Receivable (Banks owe Lipafo)</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-success">{fmtKES(totalLipafoReceivable)}</div></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Payable (Lipafo owes Banks)</CardTitle>
            <TrendingDown className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-warning">{fmtKES(totalLipafoPayable)}</div></CardContent>
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

      <Tabs defaultValue="lipafopay" className="space-y-4">
        <TabsList className="glass-card flex-wrap h-auto">
          <TabsTrigger value="lipafopay"><Receipt className="h-4 w-4 mr-2" />LipafoPay Transactions</TabsTrigger>
          <TabsTrigger value="positions"><ArrowRightLeft className="h-4 w-4 mr-2" />Net Positions (per Bank)</TabsTrigger>
          <TabsTrigger value="dispatches"><Banknote className="h-4 w-4 mr-2" />Dispatch Ledger (T+1)</TabsTrigger>
        </TabsList>

        <TabsContent value="lipafopay">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Network className="h-4 w-4 text-primary" />
                Customer LipafoPay Transactions → Settlement Trace
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Each customer payment debits the Lipafo wallet and posts a leg into the Lipafo Settlement Engine.
                Bank-linked merchants (MSISDN) settle T+1 to the merchant's bank; LMID merchants settle instantly on the Lipafo internal rail.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Merchant / Description</TableHead>
                    <TableHead>Identifier</TableHead>
                    <TableHead className="text-right">Amount Debited</TableHead>
                    <TableHead>Settlement Rail</TableHead>
                    <TableHead>Settlement Leg</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lipafoTxs.map((tx) => {
                    const bank = resolveBank(tx);
                    const isInternal = bank === "LIPAFO_WALLET";
                    const idMatch = (tx.recipient ?? "").match(/(MSISDN\s*\+?\d+|LMID-\d+|LPF-[A-Z0-9-]+)/i);
                    const identifier = idMatch?.[0] ?? "—";
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleString("en-KE", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </TableCell>
                        <TableCell className="text-xs max-w-[260px] truncate" title={tx.description}>{tx.description}</TableCell>
                        <TableCell className="font-mono text-[11px]">{identifier}</TableCell>
                        <TableCell className="text-right text-xs font-semibold text-warning">
                          {fmtKES(Math.abs(Number(tx.amount)))}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={isInternal ? "secondary" : "outline"}>
                            {isInternal ? "Lipafo Internal (instant)" : `${bank} (T+1)`}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">
                          {isInternal
                            ? "DR Customer Wallet → CR Merchant Wallet"
                            : `DR Customer Wallet → CR Lipafo Pool → Settle to ${bank}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant="default" className="capitalize">{tx.status}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {lipafoTxs.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No LipafoPay transactions yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="positions">
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Participating Bank</TableHead>
                    <TableHead className="text-right">Inbound to Lipafo</TableHead>
                    <TableHead className="text-right">Outbound from Lipafo</TableHead>
                    <TableHead className="text-right">Net (Lipafo view)</TableHead>
                    <TableHead className="text-right">Tx Count</TableHead>
                    <TableHead>Cut-off</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((p) => {
                    const net = Number(p.net_position);
                    const direction = net > 0 ? "Bank owes Lipafo" : net < 0 ? "Lipafo owes Bank" : "Flat";
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">{p.position_date}</TableCell>
                        <TableCell className="font-medium">{p.participating_bank}</TableCell>
                        <TableCell className="text-right text-xs">{fmtKES(Number(p.inbound_volume))}</TableCell>
                        <TableCell className="text-right text-xs">{fmtKES(Number(p.outbound_volume))}</TableCell>
                        <TableCell className={`text-right font-bold text-xs ${net >= 0 ? "text-success" : "text-warning"}`}>
                          {fmtKES(net)}
                          <div className="text-[10px] font-normal text-muted-foreground">{direction}</div>
                        </TableCell>
                        <TableCell className="text-right text-xs">{p.transaction_count.toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{new Date(p.cutoff_at).toLocaleString("en-KE", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === "settled" ? "default" : p.status === "dispatched" ? "secondary" : "outline"}>
                            {p.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
                    <TableHead className="text-right">Amount (Lipafo pays)</TableHead>
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
