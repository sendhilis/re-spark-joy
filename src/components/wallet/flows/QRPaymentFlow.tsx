import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Camera, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { PaymentMethodSelector } from "./PaymentMethodSelector";

interface QRPaymentFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QRPaymentFlow({ open, onOpenChange }: QRPaymentFlowProps) {
  const [step, setStep] = useState(1);
  const [paymentData, setPaymentData] = useState({ merchantName: "", amount: "", reference: "", paymentMethod: "wallet" });
  const { toast } = useToast();
  const { addTransaction } = useWallet();

  const simulateQRScan = () => {
    setPaymentData({ merchantName: "Java House - Westlands", amount: "850", reference: "JH-WST-001", paymentMethod: "wallet" });
    setStep(2);
  };

  const handleComplete = () => {
    const transactionType = paymentData.paymentMethod === 'virtual-card' ? 'virtual_card' : 'qr_payment';
    addTransaction({
      type: transactionType,
      amount: -parseFloat(paymentData.amount),
      description: `${paymentData.paymentMethod === 'virtual-card' ? 'Virtual Card' : 'QR'} Payment - ${paymentData.merchantName}`,
      recipient: paymentData.merchantName,
      status: 'completed',
      walletType: 'main'
    });
    toast({ title: "Payment Successful", description: `KES ${paymentData.amount} paid to ${paymentData.merchantName}` });
    onOpenChange(false);
    setStep(1);
    setPaymentData({ merchantName: "", amount: "", reference: "", paymentMethod: "wallet" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-glass-border max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle className="text-foreground">QR Payment</DialogTitle></DialogHeader>
        <div className="space-y-4 touch-pan-y max-h-[75vh] overflow-y-auto pr-2">
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <QrCode className="h-20 w-20 mx-auto text-primary mb-4" />
                <p className="text-muted-foreground mb-6">Scan merchant QR code to pay</p>
              </div>
              <div className="space-y-3">
                <Button onClick={simulateQRScan} className="w-full button-3d"><Camera className="h-4 w-4 mr-2" />Scan QR Code</Button>
                <Button variant="outline" className="w-full"><Upload className="h-4 w-4 mr-2" />Upload QR Image</Button>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-glass-border" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div>
              </div>
              <div>
                <Label>Enter Payment Code Manually</Label>
                <Input placeholder="Merchant payment code" className="glass-card" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="glass-card p-4 space-y-3">
                <h3 className="font-semibold text-foreground">Payment Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Merchant:</span><span className="text-foreground font-medium">{paymentData.merchantName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Amount:</span><span className="text-foreground font-semibold text-lg">KES {paymentData.amount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Reference:</span><span className="text-foreground">{paymentData.reference}</span></div>
                </div>
              </div>
              <PaymentMethodSelector selectedMethod={paymentData.paymentMethod}
                onMethodChange={(method) => setPaymentData({...paymentData, paymentMethod: method})}
                amount={parseFloat(paymentData.amount) || 0} availableMethods={['wallet', 'virtual-card']} />
              <div>
                <Label>Enter PIN to Confirm</Label>
                <Input type="password" placeholder="••••" maxLength={4} className="glass-card text-center text-lg tracking-widest" />
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setStep(1)} variant="outline" className="flex-1">Cancel</Button>
                <Button onClick={handleComplete} className="flex-1 button-3d">Pay Now</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
