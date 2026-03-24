import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRightLeft, TrendingUp } from "lucide-react";

export function FXRateWidget() {
  const { config, formatCurrency, convertToUSD } = useTenant();

  const xofUsd = config.fxRates.find(r => r.pair === 'XOF/USD');
  const xofEur = config.fxRates.find(r => r.pair === 'XOF/EUR');

  return (
    <Card className="glass-card border border-glass-border/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">FX Rates</h4>
            <p className="text-[10px] text-muted-foreground">{config.flag} {config.nameLocal} • {config.currencySymbol}</p>
          </div>
        </div>

        <div className="space-y-2">
          {xofUsd && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/10">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">FCFA</span>
                <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">USD</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-foreground">1 USD = {xofUsd.rate.toFixed(2)} FCFA</div>
                <div className="text-[10px] text-muted-foreground">Spread: {xofUsd.spread}%</div>
              </div>
            </div>
          )}

          {xofEur && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/10">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">FCFA</span>
                <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">EUR</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-foreground">1 EUR = {xofEur.rate.toFixed(3)} FCFA</div>
                <div className="text-[10px] text-emerald-400">Fixed Peg</div>
              </div>
            </div>
          )}

          {/* Quick converter preview */}
          <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/10 text-center">
            <div className="text-xs text-muted-foreground">10,000 FCFA ≈ {convertToUSD(10000).toFixed(2)} USD</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
