import { Card } from "@/components/ui/card";
import { GraduationCap, Heart, Plane, Banknote, Plus, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useWallet } from "@/contexts/WalletContext";
import { useI18n } from "@/contexts/I18nContext";

interface SubWallet {
  id: string;
  nameKey: string;
  type: 'education' | 'medical' | 'holiday' | 'retirement';
  balance: number;
  goal?: number;
  icon: React.ComponentType<any>;
}

export function SubWallets() {
  const { balances } = useWallet();
  const { t } = useI18n();

  const subWallets: SubWallet[] = [
    { id: '1', nameKey: 'subWallets.education', type: 'education', balance: balances.education, goal: 100000, icon: GraduationCap },
    { id: '2', nameKey: 'subWallets.medical', type: 'medical', balance: balances.medical, goal: 50000, icon: Heart },
    { id: '3', nameKey: 'subWallets.holiday', type: 'holiday', balance: balances.holiday, goal: 80000, icon: Plane },
    { id: '4', nameKey: 'subWallets.retirement', type: 'retirement', balance: balances.retirement, icon: Banknote },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency', currency: 'KES', currencyDisplay: 'code',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount);
  };

  const getProgress = (balance: number, goal?: number) => {
    if (!goal) return 0;
    return Math.min((balance / goal) * 100, 100);
  };

  const getWalletStyles = (type: string) => {
    const baseStyles = "glass-card button-3d p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-105";
    switch (type) {
      case 'education': return `${baseStyles} wallet-education`;
      case 'medical': return `${baseStyles} wallet-medical`;
      case 'holiday': return `${baseStyles} wallet-holiday`;
      case 'retirement': return `${baseStyles} wallet-retirement`;
      default: return baseStyles;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg text-foreground">{t('subWallets.title')}</h3>
        <button className="flex items-center space-x-2 text-primary text-sm font-medium hover:text-primary-light transition-colors">
          <Plus className="h-4 w-4" />
          <span>{t('subWallets.addWallet')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {subWallets.map((wallet) => {
          const IconComponent = wallet.icon;
          const progress = getProgress(wallet.balance, wallet.goal);

          return (
            <Card key={wallet.id} className={getWalletStyles(wallet.type)}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-full bg-white/20">
                    <IconComponent className="h-5 w-5 text-white" />
                  </div>
                  <h4 className="font-semibold text-white">{t(wallet.nameKey)}</h4>
                </div>
                <button className="p-1 rounded-full hover:bg-white/10 transition-colors">
                  <Target className="h-4 w-4 text-white/70" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(wallet.balance)}
                  </p>
                  {wallet.goal && (
                    <p className="text-sm text-white/70">
                      {t('subWallets.goal')}: {formatCurrency(wallet.goal)}
                    </p>
                  )}
                </div>

                {wallet.goal && (
                  <div className="space-y-1">
                    <Progress value={progress} className="h-2 bg-white/20" />
                    <p className="text-xs text-white/70">
                      {Math.round(progress)}% {t('subWallets.goalReached')}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
