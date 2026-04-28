import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users, DollarSign, Shield, AlertTriangle, TrendingUp, LogOut, Globe, Store, Calculator, FileCheck, Banknote, Receipt, Sigma, Repeat, Briefcase, Crown, Network, Target } from "lucide-react";
import { StrategicGapsDashboard } from "./StrategicGapsDashboard";
import { TariffsPanel } from "./TariffsPanel";
import { SwitchFeeExplainer } from "./SwitchFeeExplainer";
import { SettlementEngine } from "./SettlementEngine";
import { MerchantPortal } from "./MerchantPortal";
import { KCBBenefitsDashboard } from "./KCBBenefitsDashboard";
import { CorridorRoutingTable } from "./CorridorRoutingTable";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { UserManagement } from "./UserManagement";
import { TransactionMonitoring } from "./TransactionMonitoring";
import { LoanPortfolio } from "./LoanPortfolio";
import { ComplianceCenter } from "./ComplianceCenter";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { DiasporaDashboard } from "./DiasporaDashboard";
import { AgentNetworkDashboard } from "./AgentNetworkDashboard";
import { AccountingManagement } from "./accounting/AccountingManagement";
import { TenantSelector } from "./TenantSelector";
import { CountryCompliancePanel } from "./CountryCompliancePanel";
import { CountryFeePanel } from "./CountryFeePanel";
import { useTenant } from "@/contexts/TenantContext";
import { useI18n } from "@/contexts/I18nContext";
import { LanguageToggle } from "@/components/LanguageToggle";

export function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [stats, setStats] = useState({ users: 0, transactions: 0, loans: 0, flagged: 0 });
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { config } = useTenant();
  const { t } = useI18n();

  useEffect(() => {
    checkAdmin();
    fetchStats();
  }, [user]);

  const checkAdmin = async () => {
    if (!user) { setIsAdmin(false); return; }
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");
    setIsAdmin(data && data.length > 0);
  };

  const fetchStats = async () => {
    const [profilesRes, txRes, loansRes, flaggedRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("transactions").select("id", { count: "exact", head: true }),
      supabase.from("loan_applications").select("id", { count: "exact", head: true }),
      supabase.from("flagged_transactions").select("id", { count: "exact", head: true }),
    ]);
    setStats({
      users: profilesRes.count || 0,
      transactions: txRes.count || 0,
      loans: loansRes.count || 0,
      flagged: flaggedRes.count || 0,
    });
  };

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t('admin.checkingAccess')}</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="glass-card p-8 max-w-md text-center space-y-4">
          <Shield className="h-16 w-16 text-destructive mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">{t('admin.accessDenied')}</h2>
          <p className="text-muted-foreground">{t('admin.noPrivileges')}</p>
          <Button onClick={() => navigate("/dashboard")} className="button-3d">{t('admin.backToWallet')}</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('admin.title')}</h1>
            <p className="text-muted-foreground">{t('admin.subtitle')}</p>
          </div>
          <div className="flex gap-3 items-center">
            <LanguageToggle />
            <Button variant="outline" className="glass-card" onClick={() => navigate("/dashboard")}>
              {t('admin.backToWallet')}
            </Button>
            <Button variant="outline" className="glass-card" onClick={async () => { await signOut(); navigate("/auth"); }}>
              <LogOut className="h-4 w-4 mr-2" /> {t('common.logout')}
            </Button>
          </div>
        </div>

        {/* Tenant Selector */}
        <TenantSelector />

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('admin.totalUsers')}</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-foreground">{stats.users.toLocaleString()}</div></CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('admin.transactions')}</CardTitle>
              <BarChart3 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-foreground">{stats.transactions.toLocaleString()}</div></CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('admin.loanApplications')}</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-foreground">{stats.loans.toLocaleString()}</div></CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('admin.flaggedItems')}</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-warning">{stats.flagged.toLocaleString()}</div></CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="agents" className="space-y-6">
          <TabsList className="grid w-full glass-card" style={{ gridTemplateColumns: "repeat(17, minmax(0, 1fr))" }}>
            <TabsTrigger value="agents" className="flex items-center gap-2"><Store className="h-4 w-4" /><span className="hidden md:inline">{t('admin.agents')}</span></TabsTrigger>
            <TabsTrigger value="strategic-gaps" className="flex items-center gap-2"><Target className="h-4 w-4" /><span className="hidden md:inline">Strategic Gaps</span></TabsTrigger>
            <TabsTrigger value="diaspora" className="flex items-center gap-2"><Globe className="h-4 w-4" /><span className="hidden md:inline">{t('admin.diaspora')}</span></TabsTrigger>
            <TabsTrigger value="accounting" className="flex items-center gap-2"><Calculator className="h-4 w-4" /><span className="hidden md:inline">{t('admin.accounting')}</span></TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2"><Users className="h-4 w-4" /><span className="hidden md:inline">{t('admin.users')}</span></TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /><span className="hidden md:inline">{t('admin.transactions')}</span></TabsTrigger>
            <TabsTrigger value="loans" className="flex items-center gap-2"><DollarSign className="h-4 w-4" /><span className="hidden md:inline">{t('admin.loans')}</span></TabsTrigger>
            <TabsTrigger value="compliance" className="flex items-center gap-2"><Shield className="h-4 w-4" /><span className="hidden md:inline">{t('admin.compliance')}</span></TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /><span className="hidden md:inline">{t('admin.analytics')}</span></TabsTrigger>
            <TabsTrigger value="country-compliance" className="flex items-center gap-2"><FileCheck className="h-4 w-4" /><span className="hidden md:inline">{config.flag} {t('admin.regulatory')}</span></TabsTrigger>
            <TabsTrigger value="country-fees" className="flex items-center gap-2"><Banknote className="h-4 w-4" /><span className="hidden md:inline">{config.flag} {t('admin.fees')}</span></TabsTrigger>
            <TabsTrigger value="tariffs" className="flex items-center gap-2"><Receipt className="h-4 w-4" /><span className="hidden md:inline">Tariffs</span></TabsTrigger>
            <TabsTrigger value="switch-fee" className="flex items-center gap-2"><Sigma className="h-4 w-4" /><span className="hidden md:inline">Switch Fee</span></TabsTrigger>
            <TabsTrigger value="settlement" className="flex items-center gap-2"><Repeat className="h-4 w-4" /><span className="hidden md:inline">Settlement</span></TabsTrigger>
            <TabsTrigger value="merchants" className="flex items-center gap-2"><Briefcase className="h-4 w-4" /><span className="hidden md:inline">Merchants</span></TabsTrigger>
            <TabsTrigger value="routing" className="flex items-center gap-2"><Network className="h-4 w-4" /><span className="hidden md:inline">Routing</span></TabsTrigger>
            <TabsTrigger value="kcb-benefits" className="flex items-center gap-2"><Crown className="h-4 w-4" /><span className="hidden md:inline">KCB ROI</span></TabsTrigger>
          </TabsList>

          <TabsContent value="agents"><AgentNetworkDashboard /></TabsContent>
          <TabsContent value="diaspora"><DiasporaDashboard /></TabsContent>
          <TabsContent value="accounting"><AccountingManagement /></TabsContent>
          <TabsContent value="users"><UserManagement /></TabsContent>
          <TabsContent value="transactions"><TransactionMonitoring /></TabsContent>
          <TabsContent value="loans"><LoanPortfolio /></TabsContent>
          <TabsContent value="compliance"><ComplianceCenter /></TabsContent>
          <TabsContent value="analytics"><AnalyticsDashboard /></TabsContent>
          <TabsContent value="country-compliance"><CountryCompliancePanel /></TabsContent>
          <TabsContent value="country-fees"><CountryFeePanel /></TabsContent>
          <TabsContent value="tariffs"><TariffsPanel /></TabsContent>
          <TabsContent value="switch-fee"><SwitchFeeExplainer /></TabsContent>
          <TabsContent value="settlement"><SettlementEngine /></TabsContent>
          <TabsContent value="merchants"><MerchantPortal /></TabsContent>
          <TabsContent value="routing"><CorridorRoutingTable /></TabsContent>
          <TabsContent value="kcb-benefits"><KCBBenefitsDashboard /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
