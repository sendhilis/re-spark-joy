import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator, Info, Layers, TrendingUp } from "lucide-react";

/**
 * Mirrors the constants in src/components/wallet/flows/CrossBorderMerchantFlow.tsx.
 * Kept in sync manually — if either changes, update both.
 */
const TIERS: { label: string; min: number; max: number; fee: number; segment: string }[] = [
  { label: "Tier 1 — Micro",    min: 1,         max: 5_000,    fee: 50,  segment: "Micro-remittance" },
  { label: "Tier 2 — Retail",   min: 5_001,     max: 50_000,   fee: 120, segment: "Family support / retail" },
  { label: "Tier 3 — SME",      min: 50_001,    max: 250_000,  fee: 250, segment: "SME / school fees" },
  { label: "Tier 4 — Corporate",min: 250_001,   max: Infinity, fee: 450, segment: "Corporate / property" },
];

const CHANNELS: { id: string; label: string; bps: number }[] = [
  { id: "wire",       label: "International Wire Transfer",   bps: 35 },
  { id: "eft",        label: "Electronic Fund Transfer",      bps: 20 },
  { id: "wallet",     label: "Lipafo Wallet Balance",         bps: 15 },
  { id: "card",       label: "Debit / Credit Card",           bps: 30 },
  { id: "crypto",     label: "Digital Currency (USDC/cNGN)",  bps: 25 },
  { id: "moneyorder", label: "Money Order / Cheque",          bps: 40 },
];

const computeSwitchFee = (kes: number) => {
  if (kes <= 0) return 0;
  if (kes <= 5_000) return 50;
  if (kes <= 50_000) return 120;
  if (kes <= 250_000) return 250;
  return 450;
};

const computeLegacyEstimate = (kes: number) => {
  const flat = 220 + 350; // M-PESA + correspondent bank
  const fxMargin = kes * 0.035; // 3.5% blended FX spread
  return Math.round(flat + fxMargin);
};

export function SwitchFeeExplainer() {
  const [amount, setAmount] = useState<number>(25_000);
  const [channelId, setChannelId] = useState<string>("wallet");

  const channel = CHANNELS.find(c => c.id === channelId)!;
  const switchFee = useMemo(() => computeSwitchFee(amount), [amount]);
  const fxMargin = useMemo(() => Math.round(amount * (channel.bps / 10_000)), [amount, channel]);
  const legacyCost = useMemo(() => computeLegacyEstimate(amount), [amount]);
  const totalKcbRevenue = switchFee + fxMargin;
  const userSavings = legacyCost - switchFee;
  const activeTier = TIERS.findIndex(t => amount >= t.min && amount <= t.max);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Calculator className="h-5 w-5 text-primary" />
            KCB Switch Fee — Logic Explainer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            The cross-border merchant fee shown to users is a <span className="text-foreground font-semibold">flat 4-tier step function</span> of the
            sent KES amount, plus a <span className="text-foreground font-semibold">basis-points FX margin</span> that depends on the funding channel.
            This panel mirrors the live constants used in <code className="text-xs bg-muted px-1 py-0.5 rounded">CrossBorderMerchantFlow.tsx</code>.
          </p>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
            <Info className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <p className="text-xs text-foreground">
              These values are <span className="font-semibold">illustrative</span> — anchored to undercut the legacy M-PESA + correspondent-bank cost.
              They are not a published KCB rate card. Replace with DB-driven tariffs before production.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tier table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground text-base">
            <Layers className="h-4 w-4 text-primary" />
            Step function — fee tiers (KES)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead>Band</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead className="text-right">Flat fee</TableHead>
                <TableHead className="text-right">Effective % @ band max</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TIERS.map((t, i) => {
                const max = Number.isFinite(t.max) ? t.max : 1_000_000;
                const eff = ((t.fee / max) * 100).toFixed(3);
                const isActive = i === activeTier;
                return (
                  <TableRow key={t.label} className={isActive ? "bg-primary/10" : ""}>
                    <TableCell className="font-medium">
                      {t.label} {isActive && <Badge variant="secondary" className="ml-2">active</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.min.toLocaleString()} – {Number.isFinite(t.max) ? t.max.toLocaleString() : "∞"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.segment}</TableCell>
                    <TableCell className="text-right font-semibold text-foreground">KES {t.fee}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{eff}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Live calculator */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Live calculator — inputs &amp; outputs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amt">Amount sent (KES)</Label>
              <Input
                id="amt"
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch">Funding channel (FX margin bps)</Label>
              <Select value={channelId} onValueChange={setChannelId}>
                <SelectTrigger id="ch"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label} — {c.bps} bps
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground">Switch fee (NFI)</div>
              <div className="text-lg font-bold text-foreground">KES {switchFee.toLocaleString()}</div>
              <div className="text-[10px] text-muted-foreground">step function lookup</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground">FX margin</div>
              <div className="text-lg font-bold text-foreground">KES {fxMargin.toLocaleString()}</div>
              <div className="text-[10px] text-muted-foreground">amount × {channel.bps}/10,000</div>
            </div>
            <div className="p-3 rounded-lg bg-success/10 border border-success/30">
              <div className="text-xs text-muted-foreground">Total KCB revenue</div>
              <div className="text-lg font-bold text-success">KES {totalKcbRevenue.toLocaleString()}</div>
              <div className="text-[10px] text-muted-foreground">switch + FX</div>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
              <div className="text-xs text-muted-foreground">User savings vs legacy</div>
              <div className={`text-lg font-bold ${userSavings >= 0 ? "text-primary" : "text-destructive"}`}>
                KES {userSavings.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground">legacy est. KES {legacyCost.toLocaleString()}</div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1 p-3 rounded-lg bg-muted/20 border border-border">
            <div className="font-semibold text-foreground">Formulas</div>
            <div><code>switch_fee(amount)</code> = step function above</div>
            <div><code>fx_margin</code> = amount × channel.bps / 10,000</div>
            <div><code>legacy_estimate</code> = 570 + amount × 0.035 &nbsp;<span className="opacity-60">(M-PESA 220 + bank 350 + 3.5% FX)</span></div>
            <div><code>user_savings</code> = legacy_estimate − switch_fee</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
