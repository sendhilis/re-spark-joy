import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { CheckCircle, Clock, FileText, Banknote, Calculator, AlertCircle } from "lucide-react";

interface LoanProduct {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number;
  interestRate: number;
  maxTerm: number;
  processingTime: string;
}

interface LoanApplicationFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanProduct: LoanProduct;
}

export function LoanApplicationFlow({ open, onOpenChange, loanProduct }: LoanApplicationFlowProps) {
  const [step, setStep] = useState(1);
  const [application, setApplication] = useState({
    amount: '', purpose: '', term: '', monthlyIncome: '', employment: '', experience: '', guarantorName: '', guarantorPhone: '', documents: [] as string[]
  });
  const { toast } = useToast();
  const { updateBalance, addTransaction } = useWallet();

  const totalSteps = 4;
  const stepProgress = (step / totalSteps) * 100;

  const calculateMonthlyPayment = () => {
    if (!application.amount || !application.term) return 0;
    const principal = parseFloat(application.amount);
    const months = parseInt(application.term);
    const monthlyRate = loanProduct.interestRate / 100 / 12;
    if (monthlyRate === 0) return principal / months;
    return principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
  };

  const handleNext = () => { if (step < totalSteps) setStep(step + 1); };
  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const handleSubmit = () => {
    const loanAmount = parseFloat(application.amount);
    updateBalance('main', loanAmount);
    addTransaction({ type: 'received', amount: loanAmount, description: `${loanProduct.name} - Loan Disbursement`, status: 'completed', walletType: 'main' });
    toast({ title: "Loan Approved! 🎉", description: `KES ${loanAmount.toLocaleString()} has been disbursed to your main wallet` });
    onOpenChange(false);
    setStep(1);
    setApplication({ amount: '', purpose: '', term: '', monthlyIncome: '', employment: '', experience: '', guarantorName: '', guarantorPhone: '', documents: [] });
  };

  const loanPurposes = ['Business expansion', 'Education fees', 'Medical expenses', 'Home improvement', 'Debt consolidation', 'Emergency expenses', 'Vehicle purchase', 'Working capital', 'Other'];
  const employmentTypes = ['Employed (Permanent)', 'Employed (Contract)', 'Self-employed', 'Business owner', 'Freelancer', 'Student', 'Other'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-glass-border max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2"><FileText className="h-5 w-5" />Apply for {loanProduct.name}</DialogTitle>
          <div className="space-y-2">
            <Progress value={stepProgress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground"><span>Step {step} of {totalSteps}</span><span>{Math.round(stepProgress)}% Complete</span></div>
          </div>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="glass-card p-4">
              <h3 className="font-semibold text-foreground mb-2">Loan Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Product:</span><span className="ml-2 font-medium">{loanProduct.name}</span></div>
                <div><span className="text-muted-foreground">Interest Rate:</span><span className="ml-2 font-medium">{loanProduct.interestRate}% p.a.</span></div>
                <div><span className="text-muted-foreground">Range:</span><span className="ml-2 font-medium">KES {loanProduct.minAmount.toLocaleString()} - {loanProduct.maxAmount.toLocaleString()}</span></div>
                <div><span className="text-muted-foreground">Processing:</span><span className="ml-2 font-medium text-success">{loanProduct.processingTime}</span></div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Loan Amount (KES)</Label><Input type="number" placeholder={`${loanProduct.minAmount} - ${loanProduct.maxAmount}`} value={application.amount}
                onChange={(e) => setApplication({...application, amount: e.target.value})} className="glass-card" min={loanProduct.minAmount} max={loanProduct.maxAmount} /></div>
              <div><Label>Repayment Term (Months)</Label>
                <Select value={application.term} onValueChange={(value) => setApplication({...application, term: value})}>
                  <SelectTrigger className="glass-card"><SelectValue placeholder="Select term" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 months</SelectItem><SelectItem value="6">6 months</SelectItem>
                    <SelectItem value="12">12 months</SelectItem><SelectItem value="24">24 months</SelectItem><SelectItem value="36">36 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Purpose of Loan</Label>
              <Select value={application.purpose} onValueChange={(value) => setApplication({...application, purpose: value})}>
                <SelectTrigger className="glass-card"><SelectValue placeholder="Select purpose" /></SelectTrigger>
                <SelectContent>{loanPurposes.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {application.amount && application.term && (
              <div className="glass-card p-4 bg-primary/5 border-primary/20">
                <div className="flex items-center gap-2 mb-2"><Calculator className="h-4 w-4 text-primary" /><span className="font-semibold text-foreground">Payment Calculator</span></div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Monthly Payment:</span><div className="font-bold text-lg text-primary">KES {calculateMonthlyPayment().toLocaleString('en-KE', { maximumFractionDigits: 0 })}</div></div>
                  <div><span className="text-muted-foreground">Total Interest:</span><div className="font-bold text-lg text-foreground">KES {((calculateMonthlyPayment() * parseInt(application.term || '0')) - parseFloat(application.amount || '0')).toLocaleString('en-KE', { maximumFractionDigits: 0 })}</div></div>
                </div>
              </div>
            )}
            <Button onClick={handleNext} className="w-full button-3d" disabled={!application.amount || !application.term || !application.purpose}>Continue to Personal Information</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Personal & Employment Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Monthly Income (KES)</Label><Input type="number" placeholder="e.g. 50000" value={application.monthlyIncome}
                onChange={(e) => setApplication({...application, monthlyIncome: e.target.value})} className="glass-card" /></div>
              <div><Label>Employment Type</Label>
                <Select value={application.employment} onValueChange={(value) => setApplication({...application, employment: value})}>
                  <SelectTrigger className="glass-card"><SelectValue placeholder="Select employment type" /></SelectTrigger>
                  <SelectContent>{employmentTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Work Experience (Years)</Label>
              <Select value={application.experience} onValueChange={(value) => setApplication({...application, experience: value})}>
                <SelectTrigger className="glass-card"><SelectValue placeholder="Select experience" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0-1">0-1 years</SelectItem><SelectItem value="1-3">1-3 years</SelectItem>
                  <SelectItem value="3-5">3-5 years</SelectItem><SelectItem value="5-10">5-10 years</SelectItem><SelectItem value="10+">10+ years</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleBack} variant="outline" className="flex-1">Back</Button>
              <Button onClick={handleNext} className="flex-1 button-3d" disabled={!application.monthlyIncome || !application.employment || !application.experience}>Continue to Guarantor</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div><h3 className="font-semibold text-foreground">Guarantor Information</h3><p className="text-sm text-muted-foreground">Provide details of someone who can guarantee your loan</p></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Guarantor Full Name</Label><Input placeholder="e.g. John Doe" value={application.guarantorName}
                onChange={(e) => setApplication({...application, guarantorName: e.target.value})} className="glass-card" /></div>
              <div><Label>Guarantor Phone Number</Label><Input placeholder="e.g. +254712345678" value={application.guarantorPhone}
                onChange={(e) => setApplication({...application, guarantorPhone: e.target.value})} className="glass-card" /></div>
            </div>
            <div className="glass-card p-4 border border-orange-200 bg-orange-50 dark:bg-orange-950/20">
              <div className="flex items-start gap-2"><AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
                <div className="text-sm"><div className="font-medium text-orange-800 dark:text-orange-200">Guarantor Requirements</div>
                  <ul className="mt-1 text-orange-700 dark:text-orange-300 space-y-1">
                    <li>• Must be a Kenyan citizen above 21 years</li><li>• Should have a stable income source</li><li>• Will receive SMS notification about guarantee</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleBack} variant="outline" className="flex-1">Back</Button>
              <Button onClick={handleNext} className="flex-1 button-3d" disabled={!application.guarantorName || !application.guarantorPhone}>Review Application</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Review Your Application</h3>
            <div className="glass-card p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><div className="text-sm text-muted-foreground">Loan Product</div><div className="font-semibold">{loanProduct.name}</div></div>
                <div><div className="text-sm text-muted-foreground">Amount</div><div className="font-semibold">KES {parseFloat(application.amount).toLocaleString()}</div></div>
                <div><div className="text-sm text-muted-foreground">Term</div><div className="font-semibold">{application.term} months</div></div>
                <div><div className="text-sm text-muted-foreground">Monthly Payment</div><div className="font-semibold text-primary">KES {calculateMonthlyPayment().toLocaleString('en-KE', { maximumFractionDigits: 0 })}</div></div>
                <div><div className="text-sm text-muted-foreground">Purpose</div><div className="font-semibold">{application.purpose}</div></div>
                <div><div className="text-sm text-muted-foreground">Monthly Income</div><div className="font-semibold">KES {parseFloat(application.monthlyIncome).toLocaleString()}</div></div>
              </div>
            </div>
            <div className="glass-card p-4 bg-success/5 border-success/20">
              <div className="flex items-center gap-2 mb-2"><CheckCircle className="h-4 w-4 text-success" /><span className="font-semibold text-success">Pre-Approval Status</span></div>
              <p className="text-sm text-muted-foreground mb-3">Based on your credit score and application, you are pre-approved for this loan.</p>
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="outline" className="text-success border-success"><Clock className="h-3 w-3 mr-1" />{loanProduct.processingTime} processing</Badge>
                <Badge variant="outline" className="text-success border-success"><Banknote className="h-3 w-3 mr-1" />Instant disbursement</Badge>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleBack} variant="outline" className="flex-1">Back</Button>
              <Button onClick={handleSubmit} className="flex-1 button-3d">Submit Application</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
