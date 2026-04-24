import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plane, Send, CreditCard, PiggyBank, TrendingUp, Users, ArrowRight, CheckCircle, Globe, Wallet, Link2, ArrowRightLeft, Calendar, Shield, HelpCircle, Zap, DollarSign, Clock, AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";

interface DiasporaServicesFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DiasporaServicesFlow({ open, onOpenChange }: DiasporaServicesFlowProps) {
  const [activeTab, setActiveTab] = useState("uae-worker");
  const [step, setStep] = useState(1);
  const [showFAQ, setShowFAQ] = useState(false);
  const [showQuickRepay, setShowQuickRepay] = useState(false);
  const [quickRepayStep, setQuickRepayStep] = useState(1);
  const [cardLinked, setCardLinked] = useState(false);
  const [autoDebitEnabled, setAutoDebitEnabled] = useState(false);
  const [formData, setFormData] = useState({
    recipient: "", amount: "", purpose: "", cardNumber: "", expiryDate: "", cvv: "",
    savingsGoal: "", savingsPercentage: "5", chamaName: "", contributionAmount: "",
    transferAmount: "", loanRepaymentAmount: "", debitDay: "25"
  });

  // Remittance flow state
  const FX_USD_KES = 150;
  const [remitStep, setRemitStep] = useState<1 | 2 | 3 | 4>(1);
  const [remitSource, setRemitSource] = useState<'intl_card' | 'kcb_diaspora' | 'lipafo_usd'>('intl_card');
  const [remitRail, setRemitRail] = useState<'mpesa' | 'kcb_account' | 'pesalink' | 'lipafo_wallet'>('mpesa');
  const [remitUSD, setRemitUSD] = useState("");
  const [remitRecipientName, setRemitRecipientName] = useState("");
  const [remitRecipientAccount, setRemitRecipientAccount] = useState("");
  const [remitBankName, setRemitBankName] = useState("");
  const [remitProcessing, setRemitProcessing] = useState(false);

  const sourceLabel: Record<typeof remitSource, string> = {
    intl_card: "Linked International Card (VISA/MC/AMEX)",
    kcb_diaspora: "KCB Diaspora Account (ACH/SWIFT)",
    lipafo_usd: "Lipafo USD Wallet",
  };
  const railLabel: Record<typeof remitRail, string> = {
    mpesa: "M-PESA",
    kcb_account: "KCB Kenya Account (PesaLink)",
    pesalink: "Other Kenyan Bank (PesaLink)",
    lipafo_wallet: "Recipient's Lipafo Wallet",
  };
  const railFeeKES: Record<typeof remitRail, number> = {
    mpesa: 0,
    kcb_account: 0,
    pesalink: 25,
    lipafo_wallet: 0,
  };
  const railPlaceholder: Record<typeof remitRail, string> = {
    mpesa: "+254 712 345 678",
    kcb_account: "KCB account number",
    pesalink: "Bank account number",
    lipafo_wallet: "Recipient phone or email",
  };

  const usdNum = parseFloat(remitUSD) || 0;
  const grossKES = usdNum * FX_USD_KES;
  const feeKES = grossKES > 0 ? railFeeKES[remitRail] : 0;
  const recipientReceivesKES = Math.max(0, grossKES - feeKES);

  const resetRemit = () => {
    setRemitStep(1); setRemitUSD(""); setRemitRecipientName("");
    setRemitRecipientAccount(""); setRemitBankName(""); setRemitProcessing(false);
  };

  const handleRemittanceSubmit = async () => {
    if (!remitRecipientName || !remitRecipientAccount || usdNum <= 0) {
      toast({ title: "Missing information", description: "Please complete recipient and amount details", variant: "destructive" });
      return;
    }
    setRemitProcessing(true);
    // Simulate rail handshake
    await new Promise(r => setTimeout(r, 1200));

    // Source-side debit (recorded in sender's wallet ledger)
    if (remitSource === 'lipafo_usd') {
      if (balances.main < grossKES) {
        setRemitProcessing(false);
        toast({ title: "Insufficient Lipafo balance", description: `You need KES ${grossKES.toLocaleString()} in your wallet`, variant: "destructive" });
        return;
      }
      await addTransaction({
        type: 'sent', amount: -grossKES, status: 'completed',
        description: `Diaspora remittance via ${railLabel[remitRail]} → ${remitRecipientName}`,
        recipient: remitRecipientAccount, walletType: 'main',
      });
    } else {
      // Card / KCB pull — record as informational outbound (no wallet debit since funds come from external source)
      await addTransaction({
        type: 'sent', amount: 0, status: 'completed',
        description: `Diaspora remittance from ${sourceLabel[remitSource]} → ${remitRecipientName} via ${railLabel[remitRail]} ($${usdNum} USD)`,
        recipient: remitRecipientAccount, walletType: 'main',
      });
    }

    // Recipient-side credit simulation: if recipient is the same Lipafo user's wallet
    // (lipafo_wallet rail), credit their main wallet in KES
    if (remitRail === 'lipafo_wallet') {
      await addTransaction({
        type: 'received', amount: recipientReceivesKES, status: 'completed',
        description: `Remittance received from diaspora ($${usdNum} USD @ ${FX_USD_KES})`,
        recipient: remitRecipientName, walletType: 'main',
      });
    }

    setRemitProcessing(false);
    setRemitStep(4);
  };
  const { toast } = useToast();
  const { balances, addTransaction } = useWallet();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let message = "";
    switch (activeTab) {
      case "remittance": message = `International remittance of $${formData.amount} sent to ${formData.recipient}`; break;
      case "cards": message = "International card linked successfully to Lipafo wallet"; break;
      case "savings": message = `Pension contribution setup completed. Saving ${formData.savingsPercentage}% per transaction`; break;
      case "chama": message = `Chama contribution of $${formData.contributionAmount} sent to ${formData.chamaName}`; break;
    }
    toast({ title: "Success!", description: message });
    onOpenChange(false);
    setStep(1);
  };

  const handleLinkCard = () => {
    if (!formData.cardNumber || !formData.expiryDate || !formData.cvv) {
      toast({ title: "Missing Information", description: "Please fill in all card details", variant: "destructive" });
      return;
    }
    setCardLinked(true);
    toast({ title: "Card Linked Successfully! 🎉", description: "Your UAE salary card is now connected to your Lipafo wallet" });
  };

  const handleSalaryTransfer = async (): Promise<boolean> => {
    const amount = parseFloat(formData.transferAmount);
    if (!amount || amount <= 0) { toast({ title: "Invalid Amount", description: "Please enter a valid transfer amount", variant: "destructive" }); return false; }
    await addTransaction({ type: 'received', amount, description: 'Salary transfer from UAE card', status: 'completed' });
    toast({ title: "Transfer Successful! 💰", description: `KES ${amount.toLocaleString()} transferred from your salary card to your Lipafo wallet` });
    setFormData(prev => ({ ...prev, transferAmount: "" }));
    return true;
  };

  const handleLoanRepayment = async (): Promise<boolean> => {
    const amount = parseFloat(formData.loanRepaymentAmount);
    if (!amount || amount <= 0) { toast({ title: "Invalid Amount", description: "Please enter a valid repayment amount", variant: "destructive" }); return false; }
    if (balances.main < amount) { toast({ title: "Insufficient Balance", description: "Please transfer salary to your wallet first", variant: "destructive" }); return false; }
    await addTransaction({ type: 'sent', amount: -amount, description: 'Loan repayment to Lipafo', status: 'completed' });
    toast({ title: "Repayment Successful! ✅", description: `KES ${amount.toLocaleString()} paid towards your loan` });
    setFormData(prev => ({ ...prev, loanRepaymentAmount: "" }));
    return true;
  };

  const handleSetupAutoDebit = () => {
    setAutoDebitEnabled(true);
    toast({ title: "Auto-Debit Activated! 🔄", description: `Automatic loan deduction will occur on day ${formData.debitDay} of each month` });
  };

  const serviceCards = [
    { id: "uae-worker", title: "UAE Worker Services", description: "For Kenyan diaspora workers in UAE", icon: Plane, features: ["Link salary card", "Auto loan repayment", "Easy money transfer"], highlight: true },
    { id: "remittance", title: "International Remittance", description: "Send money to loved ones in Kenya", icon: Send, features: ["No transfer fees", "Direct to M-Pesa or bank", "Real-time transfers"] },
    { id: "cards", title: "International Card Access", description: "Fund wallet with international cards", icon: CreditCard, features: ["VISA, MasterCard, AMEX", "Secure payments", "Instant funding"] },
    { id: "savings", title: "Pension & Savings", description: "Contribute to M-pension from abroad", icon: PiggyBank, features: ["M-pension contributions", "Sub-wallets for goals", "Save as you spend"] },
    { id: "chama", title: "Chama & Merchant Payments", description: "Participate in group savings remotely", icon: Users, features: ["Group contributions", "Merchant payments", "Remote participation"] },
  ];

  const faqItems = [
    { question: "How do I link my UAE salary card?", answer: "Simply enter your prepaid card details in the 'Link Salary Card' section." },
    { question: "How does auto-debit work?", answer: "Once enabled, Lipafo will automatically deduct your monthly loan repayment from your wallet on your chosen date." },
    { question: "Is my salary card information secure?", answer: "Yes! We use bank-level encryption to protect all your card details." },
    { question: "Can I change my auto-debit date?", answer: "Yes, you can modify your auto-debit date anytime in the settings." },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-glass-border max-w-4xl max-h-[90vh] overflow-hidden p-0 flex flex-col">
        <DialogHeader className="p-6 pb-0 shrink-0">
          <DialogTitle className="text-foreground flex items-center gap-2"><Plane className="h-5 w-5 text-primary" />Lipafo Diaspora Services</DialogTitle>
          <div className="text-sm text-muted-foreground">Financial services for Kenyans living abroad</div>
        </DialogHeader>

        <div className="flex-1 overflow-auto px-6 touch-pan-y">
          <div className="pb-6 space-y-6">
            {step === 1 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {serviceCards.map((service) => {
                    const IconComponent = service.icon;
                    return (
                      <Card key={service.id} className="glass-card p-6 cursor-pointer hover:border-primary/30 transition-all duration-300"
                        onClick={() => { setActiveTab(service.id); setStep(2); }}>
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-lg bg-primary/20"><IconComponent className="h-6 w-6 text-primary" /></div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground mb-2">{service.title}</h3>
                            <p className="text-sm text-muted-foreground mb-3">{service.description}</p>
                            <div className="space-y-1">
                              {service.features.map((f, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle className="h-3 w-3 text-primary" />{f}</div>
                              ))}
                            </div>
                          </div>
                          <ArrowRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </Card>
                    );
                  })}
                </div>
                <div className="glass-card p-6 rounded-xl">
                  <div className="flex items-center gap-3 mb-4"><Globe className="h-5 w-5 text-primary" /><h3 className="font-semibold text-foreground">Why Choose Lipafo Diaspora?</h3></div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center"><div className="text-2xl font-bold text-primary">0%</div><div className="text-sm text-muted-foreground">Transfer Fees</div></div>
                    <div className="text-center"><div className="text-2xl font-bold text-primary">24/7</div><div className="text-sm text-muted-foreground">Service Available</div></div>
                    <div className="text-center"><div className="text-2xl font-bold text-primary">150+</div><div className="text-sm text-muted-foreground">Countries Supported</div></div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-muted-foreground">← Back to services</Button>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="uae-worker" className="text-xs">UAE Worker</TabsTrigger>
                    <TabsTrigger value="remittance" className="text-xs">Remittance</TabsTrigger>
                    <TabsTrigger value="cards" className="text-xs">Cards</TabsTrigger>
                    <TabsTrigger value="savings" className="text-xs">Savings</TabsTrigger>
                    <TabsTrigger value="chama" className="text-xs">Chama</TabsTrigger>
                  </TabsList>

                  <TabsContent value="uae-worker" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 border-primary/30 hover:bg-primary/10" onClick={() => setShowFAQ(!showFAQ)}>
                        <HelpCircle className="h-6 w-6 text-primary" /><span className="text-sm font-semibold">FAQs</span>
                      </Button>
                      <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 border-primary/30 hover:bg-primary/10"
                        onClick={() => { if (cardLinked) { setShowQuickRepay(true); setQuickRepayStep(1); } else { toast({ title: "Card Not Linked", description: "Please link your salary card first", variant: "destructive" }); }}}
                        disabled={!cardLinked}>
                        <Zap className="h-6 w-6 text-primary" /><span className="text-sm font-semibold">Quick Repay</span>
                      </Button>
                    </div>

                    {showFAQ && (
                      <Card className="glass-card p-6 mb-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-foreground flex items-center gap-2"><HelpCircle className="h-5 w-5 text-primary" />Frequently Asked Questions</h3>
                          <Button variant="ghost" size="sm" onClick={() => setShowFAQ(false)}>✕</Button>
                        </div>
                        <ScrollArea className="h-[300px] pr-4">
                          <div className="space-y-4">
                            {faqItems.map((faq, i) => (
                              <div key={i} className="glass-card p-4 rounded-lg">
                                <h4 className="font-semibold text-sm text-foreground mb-2">{faq.question}</h4>
                                <p className="text-sm text-muted-foreground">{faq.answer}</p>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </Card>
                    )}

                    {showQuickRepay && (
                      <Card className="glass-card p-6 mb-4 border-2 border-primary/30">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-foreground flex items-center gap-2"><Zap className="h-5 w-5 text-primary" />Quick Loan Repayment Flow</h3>
                          <Button variant="ghost" size="sm" onClick={() => { setShowQuickRepay(false); setQuickRepayStep(1); }}>✕</Button>
                        </div>

                        <div className="flex items-center justify-between mb-6">
                          {[1, 2, 3].map((s) => (
                            <div key={s} className="flex items-center gap-2">
                              <div className={`flex items-center gap-2 ${quickRepayStep >= s ? 'text-primary' : 'text-muted-foreground'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${quickRepayStep >= s ? 'bg-primary text-white' : 'bg-muted'}`}>{s}</div>
                                <span className="text-xs font-medium">{s === 1 ? 'Transfer' : s === 2 ? 'Repay' : 'Auto-Debit'}</span>
                              </div>
                              {s < 3 && <div className={`flex-1 h-0.5 mx-2 ${quickRepayStep > s ? 'bg-primary' : 'bg-muted'}`} />}
                            </div>
                          ))}
                        </div>

                        {quickRepayStep === 1 && (
                          <div className="space-y-4">
                            <div className="glass-card p-4 rounded-lg bg-primary/5">
                              <p className="text-sm font-medium text-foreground mb-2">Step 1: Transfer Salary to Wallet</p>
                              <p className="text-xs text-muted-foreground">Transfer funds from your UAE salary card to your Lipafo wallet</p>
                            </div>
                            <div><Label>Transfer Amount (KES)</Label><Input type="number" placeholder="Enter amount to transfer" value={formData.transferAmount}
                              onChange={(e) => setFormData({...formData, transferAmount: e.target.value})} /></div>
                            <Button onClick={async () => { if (await handleSalaryTransfer()) setQuickRepayStep(2); }} className="w-full">
                              <ArrowRightLeft className="h-4 w-4 mr-2" />Transfer to Wallet & Continue
                            </Button>
                          </div>
                        )}

                        {quickRepayStep === 2 && (
                          <div className="space-y-4">
                            <div className="glass-card p-4 rounded-lg bg-green-500/10">
                              <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-sm font-medium text-foreground">Transfer Complete!</span></div>
                            </div>
                            <div><Label>Loan Repayment Amount (KES)</Label><Input type="number" placeholder="Enter repayment amount" value={formData.loanRepaymentAmount}
                              onChange={(e) => setFormData({...formData, loanRepaymentAmount: e.target.value})} /></div>
                            <div className="flex gap-2">
                              <Button variant="outline" onClick={() => setQuickRepayStep(1)} className="flex-1">Back</Button>
                              <Button onClick={async () => { if (await handleLoanRepayment()) setQuickRepayStep(3); }} className="flex-1">
                                <DollarSign className="h-4 w-4 mr-2" />Pay Loan & Continue
                              </Button>
                            </div>
                          </div>
                        )}

                        {quickRepayStep === 3 && (
                          <div className="space-y-4">
                            <div className="glass-card p-4 rounded-lg bg-green-500/10">
                              <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-sm font-medium text-foreground">Payment Successful!</span></div>
                            </div>
                            {!autoDebitEnabled ? (
                              <>
                                <div>
                                  <Label>Monthly Auto-Debit Date</Label>
                                  <Select value={formData.debitDay} onValueChange={(value) => setFormData({...formData, debitDay: value})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{Array.from({length: 28}, (_, i) => i + 1).map(day => (
                                      <SelectItem key={day} value={day.toString()}>Day {day} of each month</SelectItem>
                                    ))}</SelectContent>
                                  </Select>
                                </div>
                                <div className="flex gap-2">
                                  <Button variant="outline" onClick={() => { setShowQuickRepay(false); setQuickRepayStep(1); }} className="flex-1">Skip for Now</Button>
                                  <Button onClick={() => { handleSetupAutoDebit(); setTimeout(() => { setShowQuickRepay(false); setQuickRepayStep(1); }, 2000); }} className="flex-1">
                                    <Shield className="h-4 w-4 mr-2" />Enable Auto-Debit
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <div className="glass-card p-4 rounded-lg bg-green-500/10">
                                <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /><div>
                                  <p className="text-sm font-medium text-foreground">All Set! 🎉</p>
                                  <p className="text-xs text-muted-foreground mt-1">Auto-debit is now active for day {formData.debitDay} of each month</p>
                                </div></div>
                              </div>
                            )}
                          </div>
                        )}
                      </Card>
                    )}

                    {/* Card Status */}
                    <Card className="glass-card p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-foreground">UAE Salary Card Status</h3>
                        <Badge variant={cardLinked ? "default" : "secondary"}>{cardLinked ? "Linked" : "Not Linked"}</Badge>
                      </div>
                      {!cardLinked ? (
                        <div className="space-y-4">
                          <div className="glass-card p-4 rounded-lg bg-primary/5">
                            <div className="flex items-start gap-3"><AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                              <div><p className="text-sm font-medium text-foreground">Link your UAE prepaid salary card</p>
                              <p className="text-xs text-muted-foreground mt-1">Connect your salary card to easily transfer funds</p></div>
                            </div>
                          </div>
                          <div><Label>Card Number</Label><Input placeholder="1234 5678 9012 3456" value={formData.cardNumber}
                            onChange={(e) => setFormData({...formData, cardNumber: e.target.value})} /></div>
                          <div className="grid grid-cols-2 gap-4">
                            <div><Label>Expiry Date</Label><Input placeholder="MM/YY" value={formData.expiryDate}
                              onChange={(e) => setFormData({...formData, expiryDate: e.target.value})} /></div>
                            <div><Label>CVV</Label><Input placeholder="123" type="password" value={formData.cvv}
                              onChange={(e) => setFormData({...formData, cvv: e.target.value})} /></div>
                          </div>
                          <Button onClick={handleLinkCard} className="w-full"><Link2 className="h-4 w-4 mr-2" />Link Salary Card</Button>
                        </div>
                      ) : (
                        <div className="glass-card p-4 rounded-lg">
                          <div className="flex items-center gap-2 text-sm"><CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-muted-foreground">Card ending in {formData.cardNumber.slice(-4)} is linked</span>
                          </div>
                        </div>
                      )}
                    </Card>

                    {cardLinked && (
                      <>
                        <Card className="glass-card p-6">
                          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-primary" />Transfer Salary to Wallet</h3>
                          <div className="space-y-4">
                            <div className="glass-card p-4 rounded-lg">
                              <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Current Wallet Balance</span>
                                <span className="font-semibold text-lg">KES {balances.main.toLocaleString()}</span></div>
                            </div>
                            <div><Label>Amount to Transfer (KES)</Label><Input type="number" placeholder="Enter amount" value={formData.transferAmount}
                              onChange={(e) => setFormData({...formData, transferAmount: e.target.value})} /></div>
                            <Button onClick={() => handleSalaryTransfer()} className="w-full"><Wallet className="h-4 w-4 mr-2" />Transfer to Wallet</Button>
                          </div>
                        </Card>
                        <Card className="glass-card p-6">
                          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" />Loan Repayment</h3>
                          <div className="space-y-4">
                            <div><Label>Repayment Amount (KES)</Label><Input type="number" placeholder="Enter repayment amount" value={formData.loanRepaymentAmount}
                              onChange={(e) => setFormData({...formData, loanRepaymentAmount: e.target.value})} /></div>
                            <Button onClick={() => handleLoanRepayment()} className="w-full">Pay Loan Now</Button>
                          </div>
                        </Card>
                        <Card className="glass-card p-6">
                          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" />Auto-Debit Setup</h3>
                          {!autoDebitEnabled ? (
                            <div className="space-y-4">
                              <div><Label>Monthly Debit Date</Label>
                                <Select value={formData.debitDay} onValueChange={(value) => setFormData({...formData, debitDay: value})}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>{Array.from({length: 28}, (_, i) => i + 1).map(day => (
                                    <SelectItem key={day} value={day.toString()}>Day {day} of each month</SelectItem>
                                  ))}</SelectContent>
                                </Select>
                              </div>
                              <Button onClick={handleSetupAutoDebit} className="w-full"><Shield className="h-4 w-4 mr-2" />Enable Auto-Debit</Button>
                            </div>
                          ) : (
                            <div className="glass-card p-4 rounded-lg bg-green-500/10">
                              <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /><div>
                                <p className="text-sm font-medium text-foreground">Auto-Debit Active</p>
                                <p className="text-xs text-muted-foreground mt-1">Automatic deduction on day {formData.debitDay} of each month</p>
                              </div></div>
                            </div>
                          )}
                        </Card>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="remittance" className="space-y-4">
                    <Card className="glass-card p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-foreground flex items-center gap-2"><Send className="h-5 w-5 text-primary" />Send Money to Kenya</h3>
                        <Badge variant="secondary">Step {remitStep} of 4</Badge>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center justify-between mb-6">
                        {(['Source','Destination','Amount','Done'] as const).map((label, i) => {
                          const s = (i + 1) as 1|2|3|4;
                          return (
                            <div key={label} className="flex items-center gap-2 flex-1">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${remitStep >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{s}</div>
                              <span className={`text-xs ${remitStep >= s ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
                              {i < 3 && <div className={`flex-1 h-0.5 mx-1 ${remitStep > s ? 'bg-primary' : 'bg-muted'}`} />}
                            </div>
                          );
                        })}
                      </div>

                      {/* Step 1: Source of funds */}
                      {remitStep === 1 && (
                        <div className="space-y-3">
                          <Label>Pay from</Label>
                          {(Object.keys(sourceLabel) as Array<keyof typeof sourceLabel>).map(key => (
                            <button key={key} type="button" onClick={() => setRemitSource(key)}
                              className={`w-full text-left p-4 rounded-lg border transition-all ${remitSource === key ? 'border-primary bg-primary/10' : 'border-glass-border/30 hover:border-primary/30'}`}>
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/20">
                                  {key === 'intl_card' ? <CreditCard className="h-4 w-4 text-primary" /> : key === 'kcb_diaspora' ? <Wallet className="h-4 w-4 text-primary" /> : <DollarSign className="h-4 w-4 text-primary" />}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-foreground">{sourceLabel[key]}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {key === 'intl_card' && 'Charge your linked international card in USD'}
                                    {key === 'kcb_diaspora' && 'Pull from your KCB diaspora USD account'}
                                    {key === 'lipafo_usd' && `Use Lipafo wallet • Available KES ${balances.main.toLocaleString()}`}
                                  </p>
                                </div>
                                {remitSource === key && <CheckCircle className="h-5 w-5 text-primary" />}
                              </div>
                            </button>
                          ))}
                          <Button onClick={() => setRemitStep(2)} className="w-full">Continue</Button>
                        </div>
                      )}

                      {/* Step 2: Destination rail + recipient */}
                      {remitStep === 2 && (
                        <div className="space-y-3">
                          <Label>Send to</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {(Object.keys(railLabel) as Array<keyof typeof railLabel>).map(key => (
                              <button key={key} type="button" onClick={() => setRemitRail(key)}
                                className={`p-3 rounded-lg border text-left transition-all ${remitRail === key ? 'border-primary bg-primary/10' : 'border-glass-border/30 hover:border-primary/30'}`}>
                                <p className="text-xs font-medium text-foreground">{railLabel[key]}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">Fee: {railFeeKES[key] === 0 ? 'FREE' : `KES ${railFeeKES[key]}`}</p>
                              </button>
                            ))}
                          </div>
                          <div><Label>Recipient full name</Label><Input placeholder="Jane Mwangi" value={remitRecipientName} onChange={e => setRemitRecipientName(e.target.value)} /></div>
                          <div><Label>{remitRail === 'mpesa' ? 'M-PESA phone number' : remitRail === 'lipafo_wallet' ? 'Lipafo phone/email' : 'Account number'}</Label>
                            <Input placeholder={railPlaceholder[remitRail]} value={remitRecipientAccount} onChange={e => setRemitRecipientAccount(e.target.value)} /></div>
                          {remitRail === 'pesalink' && (
                            <div><Label>Recipient Bank</Label><Input placeholder="Equity, Co-op, Absa, etc." value={remitBankName} onChange={e => setRemitBankName(e.target.value)} /></div>
                          )}
                          <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setRemitStep(1)} className="flex-1">Back</Button>
                            <Button onClick={() => {
                              if (!remitRecipientName || !remitRecipientAccount) {
                                toast({ title: "Missing details", description: "Enter recipient name and account", variant: "destructive" });
                                return;
                              }
                              setRemitStep(3);
                            }} className="flex-1">Continue</Button>
                          </div>
                        </div>
                      )}

                      {/* Step 3: Amount + live FX + review */}
                      {remitStep === 3 && (
                        <div className="space-y-4">
                          <div>
                            <Label>You send (USD)</Label>
                            <Input type="number" placeholder="100" value={remitUSD} onChange={e => setRemitUSD(e.target.value)} />
                          </div>

                          <Card className="glass-card p-4 space-y-2 bg-primary/5 border-primary/20">
                            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Exchange rate</span><span className="font-medium text-foreground">1 USD = {FX_USD_KES} KES</span></div>
                            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Gross (KES)</span><span className="font-medium text-foreground">KES {grossKES.toLocaleString()}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Rail fee</span><span className="font-medium text-foreground">{feeKES === 0 ? 'FREE' : `KES ${feeKES}`}</span></div>
                            <div className="border-t border-glass-border/30 pt-2 flex justify-between">
                              <span className="text-sm font-semibold text-foreground">Recipient receives</span>
                              <span className="text-base font-bold text-primary">KES {recipientReceivesKES.toLocaleString()}</span>
                            </div>
                          </Card>

                          <Card className="glass-card p-4 space-y-1 text-xs">
                            <div className="flex justify-between"><span className="text-muted-foreground">From</span><span className="text-foreground">{sourceLabel[remitSource]}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">To</span><span className="text-foreground">{remitRecipientName} • {railLabel[remitRail]}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Account</span><span className="text-foreground">{remitRecipientAccount}{remitBankName && ` • ${remitBankName}`}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Settlement</span><span className="text-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Instant</span></div>
                          </Card>

                          <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setRemitStep(2)} className="flex-1" disabled={remitProcessing}>Back</Button>
                            <Button onClick={handleRemittanceSubmit} className="flex-1" disabled={remitProcessing || usdNum <= 0}>
                              {remitProcessing ? 'Processing…' : `Send $${usdNum || 0}`}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Step 4: Receipt */}
                      {remitStep === 4 && (
                        <div className="space-y-4 text-center py-4">
                          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                            <CheckCircle className="h-8 w-8 text-primary" />
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-foreground">Remittance sent! 🎉</h4>
                            <p className="text-sm text-muted-foreground mt-1">{remitRecipientName} will receive KES {recipientReceivesKES.toLocaleString()} via {railLabel[remitRail]}</p>
                          </div>
                          <Card className="glass-card p-4 text-left space-y-1 text-xs">
                            <div className="flex justify-between"><span className="text-muted-foreground">Sent</span><span className="text-foreground">${usdNum} USD</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Received</span><span className="text-foreground">KES {recipientReceivesKES.toLocaleString()}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Rail</span><span className="text-foreground">{railLabel[remitRail]}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="text-foreground font-mono">LPF{Date.now().toString().slice(-8)}</span></div>
                          </Card>
                          <div className="flex gap-2">
                            <Button variant="outline" onClick={() => { resetRemit(); onOpenChange(false); }} className="flex-1">Done</Button>
                            <Button onClick={resetRemit} className="flex-1">Send another</Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  </TabsContent>

                  <TabsContent value="cards" className="space-y-4">
                    <Card className="glass-card p-6">
                      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" />Link International Card</h3>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div><Label>Card Number</Label><Input placeholder="1234 5678 9012 3456" value={formData.cardNumber}
                          onChange={(e) => setFormData({...formData, cardNumber: e.target.value})} required /></div>
                        <div className="grid grid-cols-2 gap-4">
                          <div><Label>Expiry Date</Label><Input placeholder="MM/YY" value={formData.expiryDate}
                            onChange={(e) => setFormData({...formData, expiryDate: e.target.value})} required /></div>
                          <div><Label>CVV</Label><Input placeholder="123" value={formData.cvv}
                            onChange={(e) => setFormData({...formData, cvv: e.target.value})} required /></div>
                        </div>
                        <Button type="submit" className="w-full">Link Card to Wallet</Button>
                      </form>
                    </Card>
                  </TabsContent>

                  <TabsContent value="savings" className="space-y-4">
                    <Card className="glass-card p-6">
                      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><PiggyBank className="h-5 w-5 text-primary" />Pension & Savings Management</h3>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div><Label>Savings Goal</Label>
                          <Select value={formData.savingsGoal} onValueChange={(value) => setFormData({...formData, savingsGoal: value})}>
                            <SelectTrigger><SelectValue placeholder="Select savings goal" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pension">M-Pension</SelectItem><SelectItem value="education">Education Fund</SelectItem>
                              <SelectItem value="medical">Medical Fund</SelectItem><SelectItem value="retirement">Retirement Savings</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div><Label>Save As You Spend Percentage</Label>
                          <Select value={formData.savingsPercentage} onValueChange={(value) => setFormData({...formData, savingsPercentage: value})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1%</SelectItem><SelectItem value="3">3%</SelectItem>
                              <SelectItem value="5">5%</SelectItem><SelectItem value="10">10%</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="glass-card p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-primary" /><span className="font-medium text-sm">Save As You Spend</span></div>
                          <p className="text-sm text-muted-foreground">Automatically save {formData.savingsPercentage}% of every transaction towards your selected goal.</p>
                        </div>
                        <Button type="submit" className="w-full">Setup Savings Plan</Button>
                      </form>
                    </Card>
                  </TabsContent>

                  <TabsContent value="chama" className="space-y-4">
                    <Card className="glass-card p-6">
                      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Chama & Merchant Payments</h3>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div><Label>Chama/Group Name</Label><Input placeholder="Nairobi Diaspora Investment Group" value={formData.chamaName}
                          onChange={(e) => setFormData({...formData, chamaName: e.target.value})} required /></div>
                        <div><Label>Contribution Amount (USD)</Label><Input type="number" placeholder="50" value={formData.contributionAmount}
                          onChange={(e) => setFormData({...formData, contributionAmount: e.target.value})} required /></div>
                        <Button type="submit" className="w-full">Send Contribution</Button>
                      </form>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
