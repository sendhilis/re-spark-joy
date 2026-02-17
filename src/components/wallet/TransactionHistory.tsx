import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Receipt, GraduationCap, PiggyBank } from "lucide-react";
import { format } from "date-fns";
import { useWallet } from "@/contexts/WalletContext";

export function TransactionHistory() {
  const { transactions } = useWallet();

  const formatCurrency = (amount: number) => {
    const absolute = Math.abs(amount);
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      currencyDisplay: 'code',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(absolute);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'sent': return ArrowUpRight;
      case 'received': return ArrowDownRight;
      case 'bill': return Receipt;
      case 'school': return GraduationCap;
      case 'save': return PiggyBank;
      default: return ArrowUpRight;
    }
  };

  const getTransactionColor = (type: string, amount: number) => {
    if (amount > 0) return 'text-success';
    if (type === 'bill' || type === 'school') return 'text-warning';
    return 'text-error';
  };

  return (
    <Card className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg text-foreground">Recent Transactions</h3>
        <button className="text-primary text-sm font-medium hover:text-primary-light transition-colors">
          View All
        </button>
      </div>

      <div className="space-y-4">
        {transactions.map((transaction) => {
          const IconComponent = getTransactionIcon(transaction.type);
          const colorClass = getTransactionColor(transaction.type, transaction.amount);

          return (
            <div
              key={transaction.id}
              className="flex items-center justify-between p-3 rounded-lg glass-card border border-glass-border/10 hover:border-glass-border/20 transition-all duration-200"
            >
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-full ${
                  transaction.amount > 0 ? 'bg-success/20' : 'bg-primary/20'
                }`}>
                  <IconComponent className={`h-4 w-4 ${
                    transaction.amount > 0 ? 'text-success' : 'text-primary'
                  }`} />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">
                    {transaction.description}
                  </p>
                  {transaction.recipient && (
                    <p className="text-xs text-muted-foreground">
                      {transaction.recipient}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {format(transaction.timestamp, 'MMM dd, HH:mm')}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className={`font-semibold text-sm ${colorClass}`}>
                  {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                </p>
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${
                    transaction.status === 'completed' ? 'bg-success' :
                    transaction.status === 'pending' ? 'bg-warning' : 'bg-error'
                  }`} />
                  <p className={`text-xs capitalize ${
                    transaction.status === 'completed' ? 'text-success' :
                    transaction.status === 'pending' ? 'text-warning' : 'text-error'
                  }`}>
                    {transaction.status}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
