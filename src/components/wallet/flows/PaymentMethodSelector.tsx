import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Wallet, CreditCard, Smartphone } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";

interface PaymentMethod {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  description: string;
  available: number;
  fee: number;
  feeType: 'fixed' | 'percentage';
}

interface PaymentMethodSelectorProps {
  selectedMethod: string;
  onMethodChange: (method: string) => void;
  amount: number;
  availableMethods?: string[];
}

export function PaymentMethodSelector({
  selectedMethod,
  onMethodChange,
  amount,
  availableMethods = ['wallet', 'virtual-card', 'mpesa']
}: PaymentMethodSelectorProps) {
  const { balances } = useWallet();

  const paymentMethods: PaymentMethod[] = [
    {
      id: 'wallet',
      name: 'Lipafo Wallet',
      icon: Wallet,
      description: 'Pay from your main wallet balance',
      available: balances.main,
      fee: 0,
      feeType: 'fixed' as const
    },
    {
      id: 'virtual-card',
      name: 'Virtual Card',
      icon: CreditCard,
      description: 'Pay using your virtual VISA card (linked to main wallet)',
      available: balances.main,
      fee: 0,
      feeType: 'fixed' as const
    },
    {
      id: 'mpesa',
      name: 'M-Pesa',
      icon: Smartphone,
      description: 'Pay via M-Pesa mobile money',
      available: 50000,
      fee: 1.5,
      feeType: 'percentage' as const
    }
  ].filter(method => availableMethods.includes(method.id));

  const calculateFee = (method: PaymentMethod) => {
    if (method.feeType === 'percentage') {
      return amount * (method.fee / 100);
    }
    return method.fee;
  };

  const calculateTotal = (method: PaymentMethod) => {
    return amount + calculateFee(method);
  };

  return (
    <div>
      <Label className="text-sm font-medium text-foreground">Payment Method</Label>
      <RadioGroup value={selectedMethod} onValueChange={onMethodChange} className="mt-2 space-y-3">
        {paymentMethods.map((method) => {
          const IconComponent = method.icon;
          const fee = calculateFee(method);
          const total = calculateTotal(method);
          const canAfford = method.available >= total;

          return (
            <div key={method.id} className={`glass-card p-4 border ${
              selectedMethod === method.id ? 'border-primary/40 bg-primary/5' : 'border-muted/20'
            } ${!canAfford ? 'opacity-50' : ''}`}>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value={method.id} id={method.id} disabled={!canAfford} />
                <div className="flex items-center space-x-3 flex-1">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <IconComponent className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor={method.id} className="font-medium text-foreground cursor-pointer">
                      {method.name}
                    </Label>
                    <p className="text-xs text-muted-foreground">{method.description}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">
                        Available: KES {method.available.toLocaleString()}
                      </span>
                      {fee > 0 && (
                        <span className="text-xs text-orange-600">
                          Fee: KES {fee.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {!canAfford && (
                <p className="text-xs text-red-500 mt-2 ml-9">Insufficient balance</p>
              )}
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
}
