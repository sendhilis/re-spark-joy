import { useTenant, type TenantCountry } from "@/contexts/TenantContext";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Globe, Phone, Building2, Landmark, Wallet } from "lucide-react";

export function TenantSelector() {
  const { currentTenant, setCurrentTenant, config, allTenants } = useTenant();

  return (
    <Card className="glass-card border-2 border-primary/20">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Country Selector */}
          <div className="flex items-center gap-3 min-w-[260px]">
            <Globe className="h-5 w-5 text-primary shrink-0" />
            <Select value={currentTenant} onValueChange={(v) => setCurrentTenant(v as TenantCountry)}>
              <SelectTrigger className="glass-card border-primary/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allTenants.map(t => (
                  <SelectItem key={t.code} value={t.code}>
                    <span className="flex items-center gap-2">
                      <span className="text-lg">{t.flag}</span>
                      <span>{t.nameLocal}</span>
                      <Badge variant="outline" className="text-[10px] ml-1">{t.code}</Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quick Stats */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/20">
              <Wallet className="h-3 w-3 text-primary" />
              <span className="font-medium text-foreground">{config.currencySymbol}</span>
              <span>({config.currency})</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/20">
              <Phone className="h-3 w-3 text-primary" />
              <span>{config.dialCode}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/20">
              <Landmark className="h-3 w-3 text-primary" />
              <span>{config.centralBank}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/20">
              <Building2 className="h-3 w-3 text-primary" />
              <span>{config.capital}</span>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">
              TVA {config.taxes.vatRate}%
            </Badge>
            <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">
              Pop. {config.populationEstimate}
            </Badge>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">
              {config.interoperabilityScheme}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
