import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, TrendingUp, Shield, DollarSign, Calendar, FileText, Vote, Clock,
  CheckCircle, AlertCircle, Bell, Settings
} from "lucide-react";

const ChamaMerchant = () => {
  const [activeRole, setActiveRole] = useState<'member' | 'treasurer' | 'chairperson'>('member');

  const contributionStats = {
    paid: 18,
    total: 25,
    late: 3,
    missing: 4,
    penalty: 200
  };

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header */}
      <div className="glass-card p-6 rounded-3xl border-2 border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Chama Portal</h1>
            <p className="text-sm text-muted-foreground">Upendo Investment Group</p>
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-2 rounded-full glass-card">
              <Bell className="h-5 w-5 text-foreground" />
            </button>
            <button className="p-2 rounded-full glass-card">
              <Settings className="h-5 w-5 text-foreground" />
            </button>
          </div>
        </div>

        {/* Role Selector */}
        <div className="flex space-x-2">
          {(['member', 'treasurer', 'chairperson'] as const).map((role) => (
            <Button
              key={role}
              variant={activeRole === role ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveRole(role)}
              className={activeRole === role ? 'button-3d' : 'glass-card'}
            >
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Group Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">KES 450,000</p>
            <p className="text-xs text-success">+15% this month</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">25</p>
            <p className="text-xs text-muted-foreground">Active members</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Contributions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{contributionStats.paid}/{contributionStats.total}</p>
            <Progress value={(contributionStats.paid / contributionStats.total) * 100} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Next Meeting</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-foreground">Feb 25</p>
            <p className="text-xs text-muted-foreground">2:00 PM</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="glass-card p-6">
        <h3 className="font-semibold text-lg text-foreground mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-4">
          <Button className="glass-card button-3d h-20 flex flex-col space-y-2" variant="outline">
            <DollarSign className="h-6 w-6 text-primary" />
            <span className="text-sm">Make Contribution</span>
          </Button>
          <Button className="glass-card button-3d h-20 flex flex-col space-y-2" variant="outline">
            <FileText className="h-6 w-6 text-primary" />
            <span className="text-sm">View History</span>
          </Button>
          <Button className="glass-card button-3d h-20 flex flex-col space-y-2" variant="outline">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="text-sm">Loan Request</span>
          </Button>
          <Button className="glass-card button-3d h-20 flex flex-col space-y-2" variant="outline">
            <Vote className="h-6 w-6 text-primary" />
            <span className="text-sm">Leaderboard</span>
          </Button>
        </div>
      </Card>

      {/* Recent Activity */}
      <Card className="glass-card p-6">
        <h3 className="font-semibold text-lg text-foreground mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {[
            { name: "Sarah Wanjiku", action: "Contribution", amount: "KES 5,000", status: "completed" },
            { name: "David Ochieng", action: "Loan Request", amount: "KES 50,000", status: "pending" },
            { name: "Mary Akinyi", action: "Contribution", amount: "KES 5,000", status: "completed" },
          ].map((activity, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg glass-card border border-glass-border/10">
              <div>
                <p className="font-medium text-foreground text-sm">{activity.name}</p>
                <p className="text-xs text-muted-foreground">{activity.action}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm text-foreground">{activity.amount}</p>
                <Badge variant={activity.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                  {activity.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Back to Dashboard */}
      <div className="text-center pb-6">
        <Button variant="ghost" onClick={() => window.location.href = '/dashboard'} className="text-muted-foreground">
          ← Back to Wallet
        </Button>
      </div>
    </div>
  );
};

export default ChamaMerchant;
