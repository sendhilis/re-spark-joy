import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { DollarSign, ArrowRightLeft, TrendingUp } from "lucide-react";

const feeModelColors: Record<string, string> = {
  flat: "bg-blue-500/10 text-blue-400",
  percentage: "bg-purple-500/10 text-purple-400",
  tiered: "bg-emerald-500/10 text-emerald-400",
  hybrid: "bg-orange-500/10 text-orange-400",
};

export function CountryFeePanel() {
  const { config, formatCurrency, allTenants } = useTenant();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-4xl">{config.flag}</span>
        <div>
          <h3 className="text-xl font-bold text-foreground">{config.nameLocal} — Fee Schedule</h3>
          <p className="text-sm text-muted-foreground">Country-specific fee overrides in {config.currencySymbol} ({config.currency})</p>
        </div>
      </div>

      {/* Fee Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{config.feeOverrides.length}</div>
          <div className="text-xs text-muted-foreground">Fee Rules</div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-orange-400">{config.taxes.vatRate}%</div>
          <div className="text-xs text-muted-foreground">{config.taxes.vatName.split('(')[0].trim()}</div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-purple-400">{config.taxes.exciseDutyRate}%</div>
          <div className="text-xs text-muted-foreground">Excise Duty</div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{config.taxes.withholdingTaxRate}%</div>
          <div className="text-xs text-muted-foreground">Withholding Tax</div>
        </CardContent></Card>
      </div>

      {/* Country Fee Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><DollarSign className="h-4 w-4 text-primary" />Fee Schedule — {config.nameLocal}</CardTitle>
          <CardDescription>All amounts in {config.currencySymbol}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transaction Type</TableHead>
                <TableHead>Local Name</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead className="text-right">Min / Max</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {config.feeOverrides.map((fee, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-foreground">{fee.transactionType}</TableCell>
                  <TableCell className="text-sm text-muted-foreground italic">{fee.feeName}</TableCell>
                  <TableCell><Badge variant="outline" className={feeModelColors[fee.feeModel]}>{fee.feeModel}</Badge></TableCell>
                  <TableCell className="text-right font-mono">
                    {fee.feeModel === 'flat' && formatCurrency(fee.amount || 0)}
                    {fee.feeModel === 'percentage' && `${fee.percentage}%`}
                    {fee.feeModel === 'tiered' && 'Tiered'}
                    {fee.feeModel === 'hybrid' && `${formatCurrency(fee.amount || 0)} + ${fee.percentage}%`}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatCurrency(fee.minFee)} / {formatCurrency(fee.maxFee)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cross-Country Comparison */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ArrowRightLeft className="h-4 w-4 text-primary" />Cross-Country Fee Comparison</CardTitle>
          <CardDescription>Diaspora Remittance fee comparison across all tenants</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Country</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Base Fee</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Max Fee</TableHead>
                <TableHead className="text-right">TVA</TableHead>
                <TableHead className="text-right">Excise</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allTenants.map(t => {
                const diaspora = t.feeOverrides.find(f => f.transactionType === 'Diaspora Remittance');
                if (!diaspora) return null;
                return (
                  <TableRow key={t.code} className={t.code === config.code ? 'bg-primary/5' : ''}>
                    <TableCell className="font-medium">
                      <span className="mr-2">{t.flag}</span>{t.nameLocal}
                      {t.code === config.code && <Badge variant="outline" className="ml-2 text-[10px] border-primary/30 text-primary">Current</Badge>}
                    </TableCell>
                    <TableCell><Badge variant="outline" className={feeModelColors[diaspora.feeModel]}>{diaspora.feeModel}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{diaspora.amount?.toLocaleString()} FCFA</TableCell>
                    <TableCell className="text-right font-mono">{diaspora.percentage}%</TableCell>
                    <TableCell className="text-right font-mono">{diaspora.maxFee.toLocaleString()} FCFA</TableCell>
                    <TableCell className="text-right font-mono">{t.taxes.vatRate}%</TableCell>
                    <TableCell className="text-right font-mono">{t.taxes.exciseDutyRate}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* FX Rates */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-primary" />FX Rates</CardTitle>
          <CardDescription>Exchange rates applicable for {config.nameLocal}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {config.fxRates.map(fx => (
              <Card key={fx.pair} className="glass-card">
                <CardContent className="p-4">
                  <div className="text-sm font-medium text-muted-foreground">{fx.pair}</div>
                  <div className="text-2xl font-bold text-foreground mt-1">{fx.rate.toFixed(fx.pair === 'USD/EUR' ? 3 : 2)}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">Spread: {fx.spread}%</span>
                    <span className="text-xs text-muted-foreground">{fx.source}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
