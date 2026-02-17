import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Plus } from "lucide-react";
import { useState } from "react";

interface WalletCardProps {
  balance: number;
  title: string;
  type?: 'main' | 'education' | 'medical' | 'holiday' | 'retirement';
  hideBalance?: boolean;
}

export function WalletCard({ balance, title, type = 'main', hideBalance = false }: WalletCardProps) {
  const [showBalance, setShowBalance] = useState(!hideBalance);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      currencyDisplay: 'code',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getWalletStyles = () => {
    switch (type) {
      case 'education': return 'wallet-education';
      case 'medical': return 'wallet-medical';
      case 'holiday': return 'wallet-holiday';
      case 'retirement': return 'wallet-retirement';
      default: return 'glass-card';
    }
  };

  return (
    <Card className={`glass-card ${getWalletStyles()} p-6 button-3d border-2`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg text-foreground">{title}</h3>
        <button
          onClick={() => setShowBalance(!showBalance)}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          {showBalance ? (
            <EyeOff className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Eye className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Available Balance</p>
        <p className="text-3xl font-bold text-foreground">
          {showBalance ? formatCurrency(balance) : "••••••"}
        </p>
      </div>

      {type === 'main' && (
        <div className="mt-4">
          <Button
            className="w-full glass-card button-3d border border-primary/30 hover:border-primary/50 transition-all duration-300"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-2" />
            Quick Deposit
          </Button>
        </div>
      )}
    </Card>
  );
}
