import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, Smartphone, TrendingUp, Users, Banknote } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="p-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
            <Banknote className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              Rukisha
            </h1>
            <p className="text-xs text-muted-foreground">Equity Bank - Diaspora Connect</p>
          </div>
        </div>
        <Button variant="outline" className="glass-card">
          Help
        </Button>
      </header>

      <div className="container mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Hero Content */}
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-5xl font-bold text-foreground leading-tight">
                  Your Digital Wallet,
                  <span className="block bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
                    Your Financial Future
                  </span>
                </h2>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  Rukisha empowers Kenyans with smart financial tools. Save, spend, and grow your money with confidence.
                </p>
              </div>

              {/* Key Value Props */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-success" />
                  </div>
                  <span className="text-foreground">Bank-level security for all your transactions</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Smartphone className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-foreground">Pay bills, send money, and save effortlessly</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-warning" />
                  </div>
                  <span className="text-foreground">Automatic savings that grow your future</span>
                </div>
              </div>
            </div>

            {/* Sign In Card */}
            <Card className="glass-card p-8 border-2 border-primary/20 button-3d">
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-bold text-foreground">Join Rukisha Today</h3>
                  <p className="text-muted-foreground">
                    Start your journey to financial freedom
                  </p>
                </div>

                <Button
                  onClick={() => navigate("/auth")}
                  className="w-full h-12 button-3d"
                >
                  Get Started
                </Button>

                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    By continuing, you agree to Rukisha's Terms of Service and Privacy Policy
                  </p>
                </div>
              </div>
            </Card>

            {/* Trust Indicators */}
            <div className="flex items-center justify-center space-x-8 opacity-60">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">50K+</p>
                <p className="text-xs text-muted-foreground">Active Users</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">KES 2B+</p>
                <p className="text-xs text-muted-foreground">Transactions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">99.9%</p>
                <p className="text-xs text-muted-foreground">Uptime</p>
              </div>
            </div>
          </div>

          {/* Right Column - Features */}
          <div className="space-y-8">
            <div className="relative">
              <div className="glass-card p-8 rounded-3xl border-2 border-primary/20 text-center">
                <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center mb-6">
                  <Banknote className="h-12 w-12 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Rukisha Wallet</h3>
                <p className="text-muted-foreground">Kenya's Smart Digital Wallet</p>
              </div>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="glass-card p-6 space-y-3 button-3d">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Multi-Wallets</h4>
                  <p className="text-sm text-muted-foreground">Education, Medical, Holiday & Retirement savings</p>
                </div>
              </Card>

              <Card className="glass-card p-6 space-y-3 button-3d">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-success/20 to-success/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-success" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Auto-Save</h4>
                  <p className="text-sm text-muted-foreground">Save 5% on every transaction automatically</p>
                </div>
              </Card>
            </div>
          </div>
        </div>

        {/* Bottom Section - Partnership */}
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground mb-4">Proudly powered by</p>
          <div className="flex items-center justify-center space-x-2">
            <div className="text-2xl font-bold text-primary">Equity Bank</div>
            <div className="text-sm text-muted-foreground">| Diaspora Connect</div>
          </div>
        </div>
      </div>
    </div>
  );
}
