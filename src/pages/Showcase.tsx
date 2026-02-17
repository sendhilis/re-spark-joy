import { ArrowRight, Shield, Smartphone, Zap, TrendingUp, Users, Building, Banknote, PiggyBank, CreditCard, Send, Globe, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Showcase() {
  const features = [
    { icon: Smartphone, title: "Digital Wallet", description: "Seamless mobile money management with instant transactions", benefit: "Complete financial control in your pocket" },
    { icon: PiggyBank, title: "Smart Savings", description: "Automated saving goals with competitive interest rates", benefit: "Build wealth effortlessly with AI-powered insights" },
    { icon: CreditCard, title: "Virtual Cards", description: "Secure virtual cards for online and contactless payments", benefit: "Enhanced security with real-time spending controls" },
    { icon: Banknote, title: "Instant Loans", description: "Quick loan approvals with flexible repayment options", benefit: "Access credit when you need it most" },
    { icon: Send, title: "MPESA Integration", description: "Seamless integration with Kenya's leading payment platform", benefit: "Unified financial ecosystem for all transactions" },
    { icon: Shield, title: "Bank-Grade Security", description: "Advanced encryption and multi-factor authentication", benefit: "Your money is always safe and secure" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero */}
      <section className="container mx-auto px-6 py-20 text-center">
        <Badge className="mb-6 bg-primary/20 text-primary border-primary/30">
          🇰🇪 Built for Kenya
        </Badge>
        <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight">
          The Future of
          <span className="block bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
            Digital Finance
          </span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Rukisha combines cutting-edge fintech with deep understanding of Kenya's financial landscape to deliver a wallet that truly works for you.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="button-3d" onClick={() => window.location.href = '/auth'}>
            Get Started <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button size="lg" variant="outline" className="glass-card" onClick={() => window.location.href = '/dashboard'}>
            View Demo
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-foreground mb-12">
          Everything You Need
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <Card key={index} className="glass-card button-3d border-2 border-glass-border/20 hover:border-primary/30 transition-all">
                <CardContent className="p-6 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                    <IconComponent className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                  <div className="flex items-center space-x-2">
                    <Star className="h-4 w-4 text-warning" />
                    <p className="text-sm text-foreground font-medium">{feature.benefit}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Stats */}
      <section className="container mx-auto px-6 py-20">
        <div className="glass-card rounded-3xl p-12 border-2 border-primary/20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-4xl font-bold text-primary">50K+</p>
              <p className="text-muted-foreground">Active Users</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-success">KES 2B+</p>
              <p className="text-muted-foreground">Processed</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-warning">99.9%</p>
              <p className="text-muted-foreground">Uptime</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-foreground">24/7</p>
              <p className="text-muted-foreground">Support</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-12 text-center border-t border-border">
        <div className="flex items-center justify-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
            <Banknote className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
            Rukisha
          </span>
        </div>
        <p className="text-muted-foreground">Equity Bank - Diaspora Connect • Kenya's Smart Digital Wallet</p>
      </footer>
    </div>
  );
}
