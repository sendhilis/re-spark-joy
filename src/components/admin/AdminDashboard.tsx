import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users, DollarSign, Settings, Shield, AlertTriangle, TrendingUp, LogOut, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { UserManagement } from "./UserManagement";
import { TransactionMonitoring } from "./TransactionMonitoring";
import { LoanPortfolio } from "./LoanPortfolio";
import { ComplianceCenter } from "./ComplianceCenter";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { DiasporaDashboard } from "./DiasporaDashboard";

export function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [stats, setStats] = useState({ users: 0, transactions: 0, loans: 0, flagged: 0 });
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

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
        <div className="animate-pulse text-muted-foreground">Checking admin access...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="glass-card p-8 max-w-md text-center space-y-4">
          <Shield className="h-16 w-16 text-destructive mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
          <p className="text-muted-foreground">You do not have admin privileges to access this dashboard.</p>
          <Button onClick={() => navigate("/dashboard")} className="button-3d">Back to Wallet</Button>
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
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground">Rukisha Wallet Administration</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="glass-card" onClick={() => navigate("/dashboard")}>
              Back to Wallet
            </Button>
            <Button variant="outline" className="glass-card" onClick={async () => { await signOut(); navigate("/auth"); }}>
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-foreground">{stats.users.toLocaleString()}</div></CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
              <BarChart3 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-foreground">{stats.transactions.toLocaleString()}</div></CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Loan Applications</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-foreground">{stats.loans.toLocaleString()}</div></CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Flagged Items</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-warning">{stats.flagged.toLocaleString()}</div></CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="diaspora" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 glass-card">
            <TabsTrigger value="diaspora" className="flex items-center gap-2"><Globe className="h-4 w-4" /><span className="hidden md:inline">Diaspora</span></TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2"><Users className="h-4 w-4" /><span className="hidden md:inline">Users</span></TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /><span className="hidden md:inline">Transactions</span></TabsTrigger>
            <TabsTrigger value="loans" className="flex items-center gap-2"><DollarSign className="h-4 w-4" /><span className="hidden md:inline">Loans</span></TabsTrigger>
            <TabsTrigger value="compliance" className="flex items-center gap-2"><Shield className="h-4 w-4" /><span className="hidden md:inline">Compliance</span></TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /><span className="hidden md:inline">Analytics</span></TabsTrigger>
          </TabsList>

          <TabsContent value="diaspora"><DiasporaDashboard /></TabsContent>
          <TabsContent value="users"><UserManagement /></TabsContent>
          <TabsContent value="transactions"><TransactionMonitoring /></TabsContent>
          <TabsContent value="loans"><LoanPortfolio /></TabsContent>
          <TabsContent value="compliance"><ComplianceCenter /></TabsContent>
          <TabsContent value="analytics"><AnalyticsDashboard /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
