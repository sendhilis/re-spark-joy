import { Card } from "@/components/ui/card";
import { Send, Receipt, PiggyBank, CreditCard, Smartphone, Building, GraduationCap, QrCode, Globe, ArrowRightLeft, Banknote, Plane } from "lucide-react";

interface QuickAction {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  description: string;
  onClick: () => void;
}

interface QuickActionsProps {
  onVirtualCardClick?: () => void;
}

export function QuickActions({ onVirtualCardClick }: QuickActionsProps) {
  const actions: QuickAction[] = [
    { id: 'loan-discovery', title: 'Get Loan', icon: Banknote, description: 'Apply for loans', onClick: () => {} },
    { id: 'wallet-transfer', title: 'Move Money', icon: ArrowRightLeft, description: 'Between wallets', onClick: () => {} },
    { id: 'transfer', title: 'Send Money', icon: Send, description: 'To others', onClick: () => {} },
    { id: 'pay-bills', title: 'Pay Bills', icon: Receipt, description: 'Utilities & services', onClick: () => {} },
    { id: 'qr-payment', title: 'QR Pay', icon: QrCode, description: 'Scan & pay', onClick: () => {} },
    { id: 'save', title: 'Save', icon: PiggyBank, description: 'Add to savings', onClick: () => {} },
    { id: 'virtual-card', title: 'Virtual Card', icon: CreditCard, description: 'Manage cards', onClick: () => onVirtualCardClick?.() },
    { id: 'link-card', title: 'Link Card', icon: Globe, description: 'Diaspora cards', onClick: () => {} },
    { id: 'mobile-money', title: 'M-Pesa', icon: Smartphone, description: 'Top up mobile money', onClick: () => {} },
    { id: 'bank', title: 'Bank Transfer', icon: Building, description: 'Send to bank account', onClick: () => {} },
    { id: 'school-fees', title: 'School Fees', icon: GraduationCap, description: 'Pay tuition fees', onClick: () => {} },
    { id: 'diaspora-services', title: 'Diaspora', icon: Plane, description: 'UAE Worker Services', onClick: () => {} },
  ];

  return (
    <Card className="glass-card p-6">
      <h3 className="font-semibold text-lg text-foreground mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {actions.map((action) => {
          const IconComponent = action.icon;
          const isDiaspora = action.id === 'diaspora-services';
          return (
            <button
              key={action.id}
              onClick={action.onClick}
              className={`glass-card button-3d p-4 rounded-xl border transition-all duration-300 group ${
                isDiaspora
                  ? 'border-primary/50 bg-primary/10 hover:border-primary/70'
                  : 'border-glass-border/20 hover:border-primary/30'
              }`}
            >
              <div className="flex flex-col items-center space-y-2">
                <div className={`p-3 rounded-full transition-colors ${
                  isDiaspora
                    ? 'bg-primary/30 group-hover:bg-primary/40'
                    : 'bg-primary/20 group-hover:bg-primary/30'
                }`}>
                  <IconComponent className={`h-6 w-6 ${isDiaspora ? 'text-primary animate-pulse' : 'text-primary'}`} />
                </div>
                <div className="text-center">
                  <p className={`font-medium text-sm ${isDiaspora ? 'text-primary font-bold' : 'text-foreground'}`}>
                    {action.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
