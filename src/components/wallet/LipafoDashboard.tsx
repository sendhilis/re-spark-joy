import { useState } from "react";
import { WalletHeader } from "./WalletHeader";
import { WalletCard } from "./WalletCard";
import { QuickActions } from "./QuickActions";
import { SubWallets } from "./SubWallets";
import { TransactionHistory } from "./TransactionHistory";
import { SaveAsYouSpendFlow } from "./flows/SaveAsYouSpendFlow";
import { FXRateWidget } from "./FXRateWidget";
import { useWallet } from "@/contexts/WalletContext";
import { useI18n } from "@/contexts/I18nContext";

export function LipafoDashboard() {
  const [showVirtualCard, setShowVirtualCard] = useState(false);
  const [saveFlowOpen, setSaveFlowOpen] = useState(false);
  const { balances, transactions } = useWallet();
  const { t } = useI18n();

  const thisMonthSavings = transactions
    .filter(t => t.type === 'save' &&
      new Date(t.timestamp).getMonth() === new Date().getMonth() &&
      new Date(t.timestamp).getFullYear() === new Date().getFullYear())
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      <WalletHeader />
      <WalletCard balance={balances.main} title={t('wallet.mainWallet')} type="main" hideBalance={false} />
      <QuickActions onVirtualCardClick={() => setShowVirtualCard(true)} virtualCardOpen={showVirtualCard} onVirtualCardOpenChange={setShowVirtualCard} />
      <FXRateWidget />
      <SubWallets />
      <TransactionHistory />

      {/* Save-As-You-Spend Banner */}
      <div className="glass-card p-6 rounded-3xl border-2 border-success/30 bg-gradient-to-r from-success/10 to-success/5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-foreground mb-2">{t('says.title')}</h3>
            <p className="text-sm text-muted-foreground mb-3">{t('says.description')}</p>
            <p className="text-xs text-success font-medium">
              {t('says.saved')} KES {new Intl.NumberFormat('en-KE').format(Math.round(thisMonthSavings))} {t('says.thisMonth')} 🎉
            </p>
          </div>
          <button
            onClick={() => setSaveFlowOpen(true)}
            className="glass-card button-3d px-6 py-3 rounded-2xl border border-success/30 bg-success/20 text-success font-semibold hover:bg-success/30 transition-all"
          >
            {t('common.configure')}
          </button>
        </div>
      </div>

      <SaveAsYouSpendFlow open={saveFlowOpen} onOpenChange={setSaveFlowOpen} />
    </div>
  );
}
