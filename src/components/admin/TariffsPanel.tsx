import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, ExternalLink, Loader2 } from "lucide-react";

interface Tariff {
  id: string;
  corridor_code: string;
  country_name: string;
  band_min_kes: number;
  band_max_kes: number;
  fee_kes: number;
  fx_margin_bps: number | null;
  source_url: string;
  snapshot_at: string;
}

interface TariffRun {
  id: string;
  status: string;
  message: string | null;
  rows_imported: number;
  source_url: string | null;
  created_at: string;
}

export function TariffsPanel() {
  const { toast } = useToast();
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [runs, setRuns] = useState<TariffRun[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: r }] = await Promise.all([
      supabase.from("mpesa_global_tariffs").select("*").order("snapshot_at", { ascending: false }).limit(500),
      supabase.from("mpesa_global_tariff_runs").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    setTariffs((t as Tariff[]) ?? []);
    setRuns((r as TariffRun[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("refresh-mpesa-tariffs", { body: {} });
      if (error) throw error;
      toast({ title: "Tariffs refreshed", description: `Imported ${data?.rowsImported ?? 0} rows from Safaricom.` });
      await load();
    } catch (e: any) {
      toast({ title: "Refresh failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  const latestSnapshot = tariffs[0]?.snapshot_at ?? null;
  const latestTariffs = latestSnapshot
    ? tariffs.filter(t => t.snapshot_at === latestSnapshot)
    : [];

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground">M-PESA Global tariffs</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Scraped from{" "}
              <a href="https://www.safaricom.co.ke/main-mpesa-resources/m-pesa-global/tariffs"
                 target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1">
                safaricom.co.ke <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={refreshing} className="button-3d">
            {refreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh now
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground text-sm">Loading…</div>
          ) : latestTariffs.length === 0 ? (
            <div className="text-muted-foreground text-sm">
              No tariff data yet. Click <strong>Refresh now</strong> to scrape Safaricom.
            </div>
          ) : (
            <>
              <div className="text-xs text-muted-foreground mb-2">
                Latest snapshot: <span className="text-foreground font-mono">{new Date(latestSnapshot!).toLocaleString()}</span>
                {" · "}<Badge variant="secondary">{latestTariffs.length} rows</Badge>
              </div>
              <div className="overflow-auto max-h-[420px] rounded-lg border border-glass-border/30">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Corridor</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead className="text-right">Band (KES)</TableHead>
                      <TableHead className="text-right">Fee (KES)</TableHead>
                      <TableHead className="text-right">FX margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {latestTariffs.map(t => (
                      <TableRow key={t.id}>
                        <TableCell><Badge variant="outline">{t.corridor_code}</Badge></TableCell>
                        <TableCell>{t.country_name}</TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(t.band_min_kes).toLocaleString()} – {Number(t.band_max_kes).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">{Number(t.fee_kes).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono">
                          {t.fx_margin_bps != null ? `${t.fx_margin_bps} bps` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-foreground">Refresh history</CardTitle></CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="text-muted-foreground text-sm">No runs yet.</div>
          ) : (
            <div className="space-y-2">
              {runs.map(r => (
                <div key={r.id} className="flex items-center justify-between text-xs glass-card p-2 rounded-lg border border-glass-border/30">
                  <div className="flex items-center gap-2">
                    <Badge variant={r.status === "success" ? "default" : "destructive"}>{r.status}</Badge>
                    <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-muted-foreground truncate max-w-[60%]">
                    {r.message ?? `${r.rows_imported} rows`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
