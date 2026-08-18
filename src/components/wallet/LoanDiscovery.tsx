import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Banknote, Clock, Percent, Shield, Zap, GraduationCap, Building, Car, Home, TrendingUp, CheckCircle } from "lucide-react";
import { LoanApplicationFlow } from "./flows/LoanApplicationFlow";

interface LoanProduct {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  minAmount: number;
  maxAmount: number;
  interestRate: number;
  maxTerm: number;
  processingTime: string;
  features: string[];
  description: string;
  category: 'instant' | 'personal' | 'business' | 'asset';
  eligibility: string[];
  color: string;
}

const loanProducts: LoanProduct[] = [
  { id: 'instant-cash', name: 'Instant Cash', icon: Zap, minAmount: 100, maxAmount: 10000, interestRate: 8.5, maxTerm: 30, processingTime: '5 minutes',
    features: ['No collateral required', 'Instant approval', 'Flexible repayment'], description: 'Quick cash for emergencies and short-term needs',
    category: 'instant', eligibility: ['Active Rukisha user', 'Credit score ≥ 600'], color: 'bg-gradient-to-br from-green-500 to-emerald-600' },
  { id: 'salary-advance', name: 'Salary Advance', icon: Banknote, minAmount: 1000, maxAmount: 50000, interestRate: 12, maxTerm: 30, processingTime: '1 hour',
    features: ['Salary-backed', 'Auto-deduction', 'No guarantor needed'], description: 'Get your salary early when you need it most',
    category: 'instant', eligibility: ['Employed with payslip', 'Bank statement'], color: 'bg-gradient-to-br from-blue-500 to-cyan-600' },
  { id: 'education-loan', name: 'Education Loan', icon: GraduationCap, minAmount: 10000, maxAmount: 500000, interestRate: 15, maxTerm: 365, processingTime: '24 hours',
    features: ['Low interest rates', 'Flexible terms', 'Grace period available'], description: 'Invest in your future with affordable education financing',
    category: 'personal', eligibility: ['Admission letter', 'Guarantor required', 'Income proof'], color: 'bg-gradient-to-br from-purple-500 to-pink-600' },
  { id: 'business-boost', name: 'Business Boost', icon: TrendingUp, minAmount: 25000, maxAmount: 1000000, interestRate: 18, maxTerm: 365, processingTime: '2 hours',
    features: ['Business growth focused', 'Mentorship included', 'Performance bonuses'], description: 'Grow your business with capital and expert guidance',
    category: 'business', eligibility: ['Business registration', 'Financial statements', 'Business plan'], color: 'bg-gradient-to-br from-orange-500 to-red-600' },
  { id: 'asset-financing', name: 'Asset Financing', icon: Car, minAmount: 50000, maxAmount: 2000000, interestRate: 14, maxTerm: 730, processingTime: '3 hours',
    features: ['Asset as collateral', 'Competitive rates', 'Quick approval'], description: 'Finance cars, motorcycles, and other valuable assets',
    category: 'asset', eligibility: ['Asset valuation', 'Insurance cover', 'Guarantor'], color: 'bg-gradient-to-br from-indigo-500 to-purple-600' },
  { id: 'housing-loan', name: 'Housing Loan', icon: Home, minAmount: 100000, maxAmount: 5000000, interestRate: 16, maxTerm: 1095, processingTime: '5 hours',
    features: ['Property backed', 'Long-term financing', 'Construction support'], description: 'Own your dream home with flexible housing finance',
    category: 'asset', eligibility: ['Property documents', 'Income verification', 'Down payment'], color: 'bg-gradient-to-br from-teal-500 to-green-600' },
];

export function LoanDiscovery() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLoan, setSelectedLoan] = useState<LoanProduct | null>(null);
  const [showApplication, setShowApplication] = useState(false);

  const filteredLoans = selectedCategory === 'all' ? loanProducts : loanProducts.filter(loan => loan.category === selectedCategory);

  const categories = [
    { id: 'all', name: 'All Loans', icon: Banknote },
    { id: 'instant', name: 'Instant', icon: Zap },
    { id: 'personal', name: 'Personal', icon: GraduationCap },
    { id: 'business', name: 'Business', icon: Building },
    { id: 'asset', name: 'Asset', icon: Car },
  ];

  return (
    <div className="space-y-6">
      <Card className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div><h2 className="text-2xl font-bold text-foreground">Loan Discovery</h2><p className="text-muted-foreground">Find the perfect loan for your needs</p></div>
          <div className="text-right"><div className="text-sm text-muted-foreground">Your Credit Score</div><div className="text-2xl font-bold text-success">750</div><div className="text-xs text-success">Excellent</div></div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Credit Health</span><span className="text-success font-medium">Excellent (750/850)</span></div>
          <Progress value={88} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground"><span>Poor</span><span>Excellent</span></div>
        </div>
      </Card>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
        <TabsList className="grid w-full grid-cols-5 glass-card">
          {categories.map((cat) => {
            const IconComponent = cat.icon;
            return <TabsTrigger key={cat.id} value={cat.id} className="flex items-center gap-2"><IconComponent className="h-4 w-4" /><span className="hidden sm:inline">{cat.name}</span></TabsTrigger>;
          })}
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredLoans.map((loan) => {
              const IconComponent = loan.icon;
              return (
                <Card key={loan.id} className="glass-card p-6 hover:border-primary/30 transition-all duration-300">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl ${loan.color}`}><IconComponent className="h-6 w-6 text-white" /></div>
                      <div><h3 className="font-bold text-lg text-foreground">{loan.name}</h3><p className="text-sm text-muted-foreground">{loan.description}</p></div>
                    </div>
                    <Badge variant="secondary" className="text-xs">{loan.processingTime}</Badge>
                  </div>
                  <div className="space-y-3 mb-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><div className="text-muted-foreground">Amount Range</div><div className="font-semibold text-foreground">KES {loan.minAmount.toLocaleString()} - {loan.maxAmount.toLocaleString()}</div></div>
                      <div><div className="text-muted-foreground">Interest Rate</div><div className="font-semibold text-foreground flex items-center gap-1"><Percent className="h-3 w-3" />{loan.interestRate}% p.a.</div></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><div className="text-muted-foreground">Max Term</div><div className="font-semibold text-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{loan.maxTerm} days</div></div>
                      <div><div className="text-muted-foreground">Processing</div><div className="font-semibold text-success flex items-center gap-1"><Zap className="h-3 w-3" />{loan.processingTime}</div></div>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="text-sm font-medium text-foreground">Key Features</div>
                    <div className="space-y-1">{loan.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle className="h-3 w-3 text-success" />{f}</div>
                    ))}</div>
                  </div>
                  <div className="space-y-2 mb-6">
                    <div className="text-sm font-medium text-foreground">Requirements</div>
                    <div className="flex flex-wrap gap-1">{loan.eligibility.map((r, i) => <Badge key={i} variant="outline" className="text-xs">{r}</Badge>)}</div>
                  </div>
                  <Button onClick={() => { setSelectedLoan(loan); setShowApplication(true); }} className="w-full button-3d">Apply for {loan.name}</Button>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {selectedLoan && <LoanApplicationFlow open={showApplication} onOpenChange={setShowApplication} loanProduct={selectedLoan} />}
    </div>
  );
}
