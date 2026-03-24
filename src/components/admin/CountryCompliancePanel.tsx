import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Shield, AlertTriangle, FileText, Users, Landmark, Smartphone } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

export function CountryCompliancePanel() {
  const { config, formatCurrency } = useTenant();
  const { t } = useI18n();
  const { compliance, taxes, mobileMoneyProviders, settlementBanks } = config;

  return (
    <div className="space-y-6">
      {/* Country Header */}
      <div className="flex items-center gap-3">
        <span className="text-4xl">{config.flag}</span>
        <div>
          <h3 className="text-xl font-bold text-foreground">{config.nameLocal} — {t('admin.compliance')} & {t('admin.regulatory')}</h3>
          <p className="text-sm text-muted-foreground">{compliance.regulator} • {config.financialIntelligenceUnit}</p>
        </div>
      </div>

      {/* Regulatory Framework */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-primary" />{t('compliance.regulatoryFramework')}</CardTitle>
          <CardDescription>{compliance.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-muted/10">
              <div className="text-xs text-muted-foreground mb-1">{t('compliance.governingRule')}</div>
              <div className="text-sm font-medium text-foreground">{compliance.rule}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/10">
              <div className="text-xs text-muted-foreground mb-1">{t('compliance.sanctionsBody')}</div>
              <div className="text-sm font-medium text-foreground">{compliance.sanctionsBody}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/10">
              <div className="text-xs text-muted-foreground mb-1">{t('compliance.reportingFrequency')}</div>
              <div className="text-sm font-medium text-foreground">{compliance.reportingFrequency}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KYC Tiers */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-primary" />{t('compliance.kycTierLimits')}</CardTitle>
          <CardDescription>{t('compliance.kycTierDesc')} ({config.currencySymbol})</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[
              { tier: t('compliance.tier1'), limit: compliance.kycTier1Limit, desc: t('compliance.tier1Desc'), color: 'text-yellow-400' },
              { tier: t('compliance.tier2'), limit: compliance.kycTier2Limit, desc: config.nationalIdName, color: 'text-blue-400' },
              { tier: t('compliance.tier3'), limit: compliance.kycTier3Limit, desc: t('compliance.tier3Desc'), color: 'text-emerald-400' },
            ].map(t => (
              <Card key={t.tier} className="glass-card">
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-1">{t.tier}</div>
                  <div className={`text-xl font-bold ${t.color}`}>{formatCurrency(t.limit)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t.desc}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">{t('compliance.amlThreshold')}: {formatCurrency(compliance.amlThreshold)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('compliance.amlDesc')} {config.financialIntelligenceUnit}</p>
          </div>
        </CardContent>
      </Card>

      {/* Tax Configuration */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" />{t('compliance.taxConfig')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                 <TableHead>{t('compliance.taxType')}</TableHead>
                 <TableHead>{t('compliance.rate')}</TableHead>
                 <TableHead>{t('common.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">{taxes.vatName}</TableCell>
                <TableCell className="font-mono">{taxes.vatRate}%</TableCell>
                <TableCell><Badge variant="outline" className="border-emerald-500/30 text-emerald-400">{t('common.active')}</Badge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">{t('countryFees.exciseDuty')}</TableCell>
                <TableCell className="font-mono">{taxes.exciseDutyRate}%</TableCell>
                <TableCell>
                  {taxes.exciseDutyApplicable
                    ? <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">{t('compliance.applicable')}</Badge>
                    : <Badge variant="outline" className="border-muted text-muted-foreground">N/A</Badge>}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">{t('countryFees.withholdingTax')}</TableCell>
                <TableCell className="font-mono">{taxes.withholdingTaxRate}%</TableCell>
                <TableCell><Badge variant="outline" className="border-emerald-500/30 text-emerald-400">{t('common.active')}</Badge></TableCell>
              </TableRow>
              {taxes.stampDuty > 0 && (
                <TableRow>
                  <TableCell className="font-medium">Stamp Duty</TableCell>
                  <TableCell className="font-mono">{taxes.stampDuty}%</TableCell>
                  <TableCell><Badge variant="outline" className="border-emerald-500/30 text-emerald-400">Active</Badge></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile Money Providers */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Smartphone className="h-4 w-4 text-primary" />Mobile Money Providers</CardTitle>
          <CardDescription>Licensed mobile money operators in {config.nameLocal}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>USSD</TableHead>
                <TableHead>Settlement Bank</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mobileMoneyProviders.map(p => (
                <TableRow key={p.code}>
                  <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                  <TableCell className="font-mono text-xs text-primary">{p.code}</TableCell>
                  <TableCell className="font-mono text-xs">{p.ussdPrefix}</TableCell>
                  <TableCell className="text-sm">{p.settlementBank}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Settlement Banks */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Landmark className="h-4 w-4 text-primary" />Settlement Banks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {settlementBanks.map(bank => (
              <Badge key={bank} variant="outline" className="px-3 py-1.5 text-sm">{bank}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
