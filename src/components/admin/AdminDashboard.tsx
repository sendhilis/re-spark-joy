import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Users, DollarSign, Settings } from "lucide-react";

export function AdminDashboard() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground">Rukisha Wallet Administration</p>
          </div>
          <Button variant="outline" className="glass-card" onClick={() => window.location.href = '/dashboard'}>
            Back to Wallet
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">50,234</div>
              <p className="text-xs text-success">+12% from last month</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Transactions</CardTitle>
              <BarChart3 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">KES 2.1B</div>
              <p className="text-xs text-success">+8% from last month</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Loans</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">3,421</div>
              <p className="text-xs text-warning">+3% from last month</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">System Health</CardTitle>
              <Settings className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">99.9%</div>
              <p className="text-xs text-muted-foreground">All systems operational</p>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card p-6">
          <h2 className="text-xl font-bold text-foreground mb-4">Admin Features</h2>
          <p className="text-muted-foreground">
            Full admin dashboard with customer management, loan portfolio, compliance center, 
            analytics, and more is available. Continue building to add these features.
          </p>
        </Card>
      </div>
    </div>
  );
}
