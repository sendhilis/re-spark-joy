import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Send, Receipt, PiggyBank, CreditCard, Smartphone, Building, GraduationCap, QrCode, Globe, ArrowRightLeft, Banknote, Plane, ArrowDownToLine, ArrowUpFromLine, MapPin, ShoppingBag, Network, Globe2 } from "lucide-react";
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
import { AgentDiscoveryFlow } from "./flows/AgentDiscoveryFlow";
import { DebitCardWithdrawalFlow } from "./flows/DebitCardWithdrawalFlow";
import { BankDebitCardLinkFlow } from "./flows/BankDebitCardLinkFlow";
import { LipafoBNPLFlow } from "./flows/LipafoBNPLFlow";
import { InteropPaybillFlow } from "./flows/InteropPaybillFlow";
import { CrossBorderMerchantFlow } from "./flows/CrossBorderMerchantFlow";
import { LoanDiscovery } from "./LoanDiscovery";
import { useI18n } from "@/contexts/I18nContext";

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
  const [agentCashInOpen, setAgentCashInOpen] = useState(false);
  const [agentCashOutOpen, setAgentCashOutOpen] = useState(false);
  const [debitWithdrawalOpen, setDebitWithdrawalOpen] = useState(false);
  const [bankDebitLinkOpen, setBankDebitLinkOpen] = useState(false);
  const [bnplOpen, setBnplOpen] = useState(false);
  const [interopPaybillOpen, setInteropPaybillOpen] = useState(false);
  const [xBorderOpen, setXBorderOpen] = useState(false);
  const { t } = useI18n();

  const actions = [
    { id: 'loan-discovery', title: t('quickActions.getLoan'), icon: Banknote, description: t('quickActions.getLoanDesc'), onClick: () => setLoanDiscoveryOpen(true) },
    { id: 'lipafo-bnpl', title: 'Lipafo BNPL', icon: ShoppingBag, description: 'Buy now, pay on next inflow', onClick: () => setBnplOpen(true), highlight: 'success' },
    { id: 'interop-paybill', title: 'Interop Paybill', icon: Network, description: 'Pay any bank, M-PESA, Airtel, T-Kash', onClick: () => setInteropPaybillOpen(true), highlight: 'primary' },
    { id: 'x-border-merchant', title: 'X-Border Merchant', icon: Globe2, description: 'Pay merchants across Africa via Lipafo switch', onClick: () => setXBorderOpen(true), highlight: 'primary' },
    { id: 'wallet-transfer', title: t('quickActions.moveMoney'), icon: ArrowRightLeft, description: t('quickActions.moveMoneyDesc'), onClick: () => setWalletTransferOpen(true) },
    { id: 'transfer', title: t('quickActions.sendMoney'), icon: Send, description: t('quickActions.sendMoneyDesc'), onClick: () => setTransferOpen(true) },
    { id: 'cash-in', title: t('quickActions.cashIn'), icon: ArrowDownToLine, description: t('quickActions.cashInDesc'), onClick: () => setAgentCashInOpen(true), highlight: 'success' },
    { id: 'cash-out', title: t('quickActions.cashOut'), icon: ArrowUpFromLine, description: t('quickActions.cashOutDesc'), onClick: () => setAgentCashOutOpen(true), highlight: 'warning' },
    { id: 'pay-bills', title: t('quickActions.payBills'), icon: Receipt, description: t('quickActions.payBillsDesc'), onClick: () => setPayBillsOpen(true) },
    { id: 'qr-payment', title: t('quickActions.qrPay'), icon: QrCode, description: t('quickActions.qrPayDesc'), onClick: () => setQRPaymentOpen(true) },
    { id: 'save', title: t('quickActions.save'), icon: PiggyBank, description: t('quickActions.saveDesc'), onClick: () => setSaveOpen(true) },
    { id: 'virtual-card', title: t('quickActions.virtualCard'), icon: CreditCard, description: t('quickActions.virtualCardDesc'), onClick: () => { if (onVirtualCardClick) onVirtualCardClick(); else setVirtualCardOpen(true); } },
    { id: 'link-debit', title: t('quickActions.linkDebit'), icon: Building, description: t('quickActions.linkDebitDesc'), onClick: () => setBankDebitLinkOpen(true) },
    { id: 'link-card', title: t('quickActions.intlCard'), icon: Globe, description: t('quickActions.intlCardDesc'), onClick: () => setLinkCardOpen(true) },
    { id: 'mobile-money', title: t('quickActions.mobileMoney'), icon: Smartphone, description: t('quickActions.mobileMoneyDesc'), onClick: () => setMpesaOpen(true) },
    { id: 'bank', title: t('quickActions.bankTransfer'), icon: Building, description: t('quickActions.bankTransferDesc'), onClick: () => setBankTransferOpen(true) },
    { id: 'school-fees', title: t('quickActions.schoolFees'), icon: GraduationCap, description: t('quickActions.schoolFeesDesc'), onClick: () => setSchoolFeesOpen(true) },
    { id: 'agents', title: t('quickActions.findAgents'), icon: MapPin, description: t('quickActions.findAgentsDesc'), onClick: () => setAgentCashInOpen(true) },
    { id: 'diaspora-services', title: t('quickActions.diaspora'), icon: Plane, description: t('quickActions.diasporaDesc'), onClick: () => setDiasporaServicesOpen(true) },
  ];

  return (
    <Card className="glass-card p-6">
      <h3 className="font-semibold text-lg text-foreground mb-4">{t('quickActions.title')}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {actions.map((action) => {
          const IconComponent = action.icon;
          const isDiaspora = action.id === 'diaspora-services';
          return (
          <button key={action.id} onClick={action.onClick}
            className={`glass-card button-3d p-4 rounded-xl border transition-all duration-300 group ${
              isDiaspora ? 'border-primary/50 bg-primary/10 hover:border-primary/70'
              : (action as any).highlight === 'success' ? 'border-success/40 bg-success/10 hover:border-success/60'
              : (action as any).highlight === 'warning' ? 'border-warning/40 bg-warning/10 hover:border-warning/60'
              : 'border-glass-border/20 hover:border-primary/30'
            }`}>
            <div className="flex flex-col items-center space-y-2">
              <div className={`p-3 rounded-full transition-colors ${
                isDiaspora ? 'bg-primary/30 group-hover:bg-primary/40'
                : (action as any).highlight === 'success' ? 'bg-success/20 group-hover:bg-success/30'
                : (action as any).highlight === 'warning' ? 'bg-warning/20 group-hover:bg-warning/30'
                : 'bg-primary/20 group-hover:bg-primary/30'
              }`}>
                <IconComponent className={`h-6 w-6 ${
                  isDiaspora ? 'text-primary animate-pulse'
                  : (action as any).highlight === 'success' ? 'text-success'
                  : (action as any).highlight === 'warning' ? 'text-warning'
                  : 'text-primary'
                }`} />
              </div>
              <div className="text-center">
                <p className={`font-medium text-sm ${
                  isDiaspora ? 'text-primary font-bold'
                  : (action as any).highlight === 'success' ? 'text-success font-semibold'
                  : (action as any).highlight === 'warning' ? 'text-warning font-semibold'
                  : 'text-foreground'
                }`}>{action.title}</p>
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
      <AgentDiscoveryFlow open={agentCashInOpen} onOpenChange={setAgentCashInOpen} mode="cash_in" />
      <AgentDiscoveryFlow open={agentCashOutOpen} onOpenChange={setAgentCashOutOpen} mode="cash_out" />
      <DebitCardWithdrawalFlow open={debitWithdrawalOpen} onOpenChange={setDebitWithdrawalOpen} />
      <BankDebitCardLinkFlow open={bankDebitLinkOpen} onOpenChange={setBankDebitLinkOpen} />
      <LipafoBNPLFlow open={bnplOpen} onOpenChange={setBnplOpen} />
      <InteropPaybillFlow open={interopPaybillOpen} onOpenChange={setInteropPaybillOpen} />
      <CrossBorderMerchantFlow open={xBorderOpen} onOpenChange={setXBorderOpen} />

      {/* Loan Discovery Full Screen */}
      {loanDiscoveryOpen && (
        <div className="fixed inset-0 bg-background z-50 overflow-auto">
          <div className="min-h-screen p-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-foreground">{t('quickActions.loanProducts')}</h1>
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
