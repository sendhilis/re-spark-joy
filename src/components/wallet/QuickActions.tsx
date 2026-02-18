import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Send, Receipt, PiggyBank, CreditCard, Smartphone, Building, GraduationCap, QrCode, Globe, ArrowRightLeft, Banknote, Plane } from "lucide-react";
import { TransferFlow } from "./flows/TransferFlow";
import { PayBillsFlow } from "./flows/PayBillsFlow";
import { SaveFlow } from "./flows/SaveFlow";
import { QRPaymentFlow } from "./flows/QRPaymentFlow";
import { VirtualCardFlow } from "./flows/VirtualCardFlow";
import { LinkCardFlow } from "./flows/LinkCardFlow";
import { WalletTransferFlow } from "./flows/WalletTransferFlow";
import { MPESAFlow } from "./flows/MPESAFlow";
import { SchoolFeesFlow } from "./flows/SchoolFeesFlow";
import { BankTransferFlow } from "./flows/BankTransferFlow";
import { DiasporaServicesFlow } from "./flows/DiasporaServicesFlow";
import { LoanDiscovery } from "./LoanDiscovery";

interface QuickActionsProps {
  onVirtualCardClick?: () => void;
  virtualCardOpen?: boolean;
  onVirtualCardOpenChange?: (open: boolean) => void;
}

export function QuickActions({ onVirtualCardClick, virtualCardOpen: externalVirtualCardOpen, onVirtualCardOpenChange }: QuickActionsProps) {
  const [transferOpen, setTransferOpen] = useState(false);
  const [payBillsOpen, setPayBillsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [qrPaymentOpen, setQRPaymentOpen] = useState(false);
  const [internalVirtualCardOpen, setInternalVirtualCardOpen] = useState(false);
  const virtualCardOpen = externalVirtualCardOpen !== undefined ? externalVirtualCardOpen : internalVirtualCardOpen;
  const setVirtualCardOpen = onVirtualCardOpenChange ?? setInternalVirtualCardOpen;
  const [linkCardOpen, setLinkCardOpen] = useState(false);
  const [walletTransferOpen, setWalletTransferOpen] = useState(false);
  const [loanDiscoveryOpen, setLoanDiscoveryOpen] = useState(false);
  const [mpesaOpen, setMpesaOpen] = useState(false);
  const [schoolFeesOpen, setSchoolFeesOpen] = useState(false);
  const [bankTransferOpen, setBankTransferOpen] = useState(false);
  const [diasporaServicesOpen, setDiasporaServicesOpen] = useState(false);

  const actions = [
    { id: 'loan-discovery', title: 'Get Loan', icon: Banknote, description: 'Apply for loans', onClick: () => setLoanDiscoveryOpen(true) },
    { id: 'wallet-transfer', title: 'Move Money', icon: ArrowRightLeft, description: 'Between wallets', onClick: () => setWalletTransferOpen(true) },
    { id: 'transfer', title: 'Send Money', icon: Send, description: 'To others', onClick: () => setTransferOpen(true) },
    { id: 'pay-bills', title: 'Pay Bills', icon: Receipt, description: 'Utilities & services', onClick: () => setPayBillsOpen(true) },
    { id: 'qr-payment', title: 'QR Pay', icon: QrCode, description: 'Scan & pay', onClick: () => setQRPaymentOpen(true) },
    { id: 'save', title: 'Save', icon: PiggyBank, description: 'Add to savings', onClick: () => setSaveOpen(true) },
    { id: 'virtual-card', title: 'Virtual Card', icon: CreditCard, description: 'Manage cards', onClick: () => { if (onVirtualCardClick) onVirtualCardClick(); else setVirtualCardOpen(true); } },
    { id: 'link-card', title: 'Link Card', icon: Globe, description: 'Diaspora cards', onClick: () => setLinkCardOpen(true) },
    { id: 'mobile-money', title: 'M-Pesa', icon: Smartphone, description: 'Top up mobile money', onClick: () => setMpesaOpen(true) },
    { id: 'bank', title: 'Bank Transfer', icon: Building, description: 'Send to bank account', onClick: () => setBankTransferOpen(true) },
    { id: 'school-fees', title: 'School Fees', icon: GraduationCap, description: 'Pay tuition fees', onClick: () => setSchoolFeesOpen(true) },
    { id: 'diaspora-services', title: 'Diaspora', icon: Plane, description: 'UAE Worker Services', onClick: () => setDiasporaServicesOpen(true) },
  ];

  return (
    <Card className="glass-card p-6">
      <h3 className="font-semibold text-lg text-foreground mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {actions.map((action) => {
          const IconComponent = action.icon;
          const isDiaspora = action.id === 'diaspora-services';
          return (
            <button key={action.id} onClick={action.onClick}
              className={`glass-card button-3d p-4 rounded-xl border transition-all duration-300 group ${
                isDiaspora ? 'border-primary/50 bg-primary/10 hover:border-primary/70' : 'border-glass-border/20 hover:border-primary/30'
              }`}>
              <div className="flex flex-col items-center space-y-2">
                <div className={`p-3 rounded-full transition-colors ${isDiaspora ? 'bg-primary/30 group-hover:bg-primary/40' : 'bg-primary/20 group-hover:bg-primary/30'}`}>
                  <IconComponent className={`h-6 w-6 ${isDiaspora ? 'text-primary animate-pulse' : 'text-primary'}`} />
                </div>
                <div className="text-center">
                  <p className={`font-medium text-sm ${isDiaspora ? 'text-primary font-bold' : 'text-foreground'}`}>{action.title}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Flow Dialogs */}
      <TransferFlow open={transferOpen} onOpenChange={setTransferOpen} />
      <PayBillsFlow open={payBillsOpen} onOpenChange={setPayBillsOpen} />
      <SaveFlow open={saveOpen} onOpenChange={setSaveOpen} />
      <QRPaymentFlow open={qrPaymentOpen} onOpenChange={setQRPaymentOpen} />
      <VirtualCardFlow open={virtualCardOpen} onOpenChange={setVirtualCardOpen} />
      <LinkCardFlow open={linkCardOpen} onOpenChange={setLinkCardOpen} />
      <WalletTransferFlow open={walletTransferOpen} onOpenChange={setWalletTransferOpen} />
      <MPESAFlow open={mpesaOpen} onOpenChange={setMpesaOpen} />
      <SchoolFeesFlow open={schoolFeesOpen} onOpenChange={setSchoolFeesOpen} />
      <BankTransferFlow open={bankTransferOpen} onOpenChange={setBankTransferOpen} />
      <DiasporaServicesFlow open={diasporaServicesOpen} onOpenChange={setDiasporaServicesOpen} />

      {/* Loan Discovery Full Screen */}
      {loanDiscoveryOpen && (
        <div className="fixed inset-0 bg-background z-50 overflow-auto">
          <div className="min-h-screen p-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-foreground">Loan Products</h1>
                <button onClick={() => setLoanDiscoveryOpen(false)} className="glass-card p-2 rounded-lg hover:bg-muted/20 transition-colors">✕</button>
              </div>
              <LoanDiscovery />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
