import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, CheckCircle, School } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";

interface SchoolFeesFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const schoolCategories = [
  { id: "primary", name: "Primary School", description: "Classes 1-8" },
  { id: "secondary", name: "Secondary School", description: "Forms 1-4" },
  { id: "university", name: "University", description: "Higher education" },
  { id: "college", name: "College/TVET", description: "Technical education" },
];

const popularSchools = [
  { id: "custom", name: "Other School", category: "all" },
  { id: "uon", name: "University of Nairobi", category: "university" },
  { id: "kenyatta", name: "Kenyatta University", category: "university" },
  { id: "strathmore", name: "Strathmore University", category: "university" },
  { id: "alliance", name: "Alliance High School", category: "secondary" },
  { id: "starehe", name: "Starehe Boys Centre", category: "secondary" },
  { id: "loreto", name: "Loreto High School", category: "secondary" },
];

export function SchoolFeesFlow({ open, onOpenChange }: SchoolFeesFlowProps) {
  const [step, setStep] = useState(1);
  const [feesData, setFeesData] = useState({
    category: "", school: "", customSchoolName: "", studentName: "", admissionNumber: "", amount: "", term: "", paymentMethod: "education"
  });
  const { toast } = useToast();
  const { addTransaction } = useWallet();

  const selectedSchool = popularSchools.find(s => s.id === feesData.school);
  const availableSchools = popularSchools.filter(s => s.category === "all" || s.category === feesData.category);
  const handleNext = () => { if (step < 3) setStep(step + 1); };
  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const handleComplete = () => {
    const schoolName = feesData.school === 'custom' ? feesData.customSchoolName : selectedSchool?.name;
    addTransaction({
      type: 'school',
      amount: -parseFloat(feesData.amount),
      description: `School Fees - ${schoolName}${feesData.studentName ? ` (${feesData.studentName})` : ''}`,
      recipient: schoolName,
      status: 'completed',
      walletType: feesData.paymentMethod === 'education' ? 'education' : 'main'
    });
    toast({ title: "School Fees Payment Successful! 🎓", description: `KES ${feesData.amount} paid to ${schoolName}` });
    onOpenChange(false);
    setStep(1);
    setFeesData({ category: "", school: "", customSchoolName: "", studentName: "", admissionNumber: "", amount: "", term: "", paymentMethod: "education" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-glass-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2"><GraduationCap className="h-5 w-5" />Pay School Fees</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>School Category</Label>
              <Select value={feesData.category} onValueChange={(value) => setFeesData({...feesData, category: value, school: ""})}>
                <SelectTrigger className="glass-card"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {schoolCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}><div><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.description}</div></div></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {feesData.category && (
              <div>
                <Label>School/Institution</Label>
                <Select value={feesData.school} onValueChange={(value) => setFeesData({...feesData, school: value})}>
                  <SelectTrigger className="glass-card"><SelectValue placeholder="Select school" /></SelectTrigger>
                  <SelectContent>
                    {availableSchools.map((s) => (
                      <SelectItem key={s.id} value={s.id}><div className="flex items-center gap-2"><School className="h-4 w-4" />{s.name}</div></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {feesData.school === 'custom' && (
              <div><Label>School Name</Label><Input placeholder="Enter school name" value={feesData.customSchoolName}
                onChange={(e) => setFeesData({...feesData, customSchoolName: e.target.value})} className="glass-card" /></div>
            )}
            <Button onClick={handleNext} className="w-full button-3d"
              disabled={!feesData.category || !feesData.school || (feesData.school === 'custom' && !feesData.customSchoolName)}>Next</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div><Label>Student Name</Label><Input placeholder="Enter student's full name" value={feesData.studentName}
              onChange={(e) => setFeesData({...feesData, studentName: e.target.value})} className="glass-card" /></div>
            <div><Label>Admission/Registration Number</Label><Input placeholder="Enter admission number" value={feesData.admissionNumber}
              onChange={(e) => setFeesData({...feesData, admissionNumber: e.target.value})} className="glass-card" /></div>
            <div>
              <Label>Term/Semester (Optional)</Label>
              <Select value={feesData.term} onValueChange={(value) => setFeesData({...feesData, term: value})}>
                <SelectTrigger className="glass-card"><SelectValue placeholder="Select term/semester" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="term1">Term 1</SelectItem><SelectItem value="term2">Term 2</SelectItem>
                  <SelectItem value="term3">Term 3</SelectItem><SelectItem value="semester1">Semester 1</SelectItem>
                  <SelectItem value="semester2">Semester 2</SelectItem><SelectItem value="year">Full Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Amount (KES)</Label><Input type="number" placeholder="0.00" value={feesData.amount}
              onChange={(e) => setFeesData({...feesData, amount: e.target.value})} className="glass-card" min="100" /></div>
            <div className="flex gap-3">
              <Button onClick={handleBack} variant="outline" className="flex-1">Back</Button>
              <Button onClick={handleNext} className="flex-1 button-3d" disabled={!feesData.studentName || !feesData.amount || parseFloat(feesData.amount) < 100}>Review</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <Label className="text-sm font-medium text-foreground">Pay From</Label>
              <Select value={feesData.paymentMethod} onValueChange={(value) => setFeesData({...feesData, paymentMethod: value})}>
                <SelectTrigger className="glass-card mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="education">Education Wallet</SelectItem>
                  <SelectItem value="main">Main Wallet</SelectItem>
                  <SelectItem value="virtual-card">Virtual Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="glass-card p-4 space-y-3">
              <h3 className="font-semibold text-foreground flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" />Payment Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">School:</span><span className="text-foreground font-medium">{feesData.school === 'custom' ? feesData.customSchoolName : selectedSchool?.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Student:</span><span className="text-foreground">{feesData.studentName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount:</span><span className="text-foreground font-semibold text-lg">KES {feesData.amount}</span></div>
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-300">🎓 You'll receive a payment confirmation receipt via SMS/Email</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleBack} variant="outline" className="flex-1">Back</Button>
              <Button onClick={handleComplete} className="flex-1 button-3d">Pay Fees</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
