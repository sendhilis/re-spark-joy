import { createContext, useContext, useState, ReactNode } from 'react';

export interface Transaction {
  id: string;
  type: 'sent' | 'received' | 'bill' | 'school' | 'save' | 'qr_payment' | 'virtual_card' | 'card_linking' | 'mpesa' | 'pension_contribution';
  amount: number;
  description: string;
  recipient?: string;
  timestamp: Date;
  status: 'completed' | 'pending' | 'failed';
  walletType?: 'main' | 'education' | 'medical' | 'holiday' | 'retirement' | 'pension';
  pensionMetadata?: {
    triggerType: 'user' | 'cpf';
    originalTransaction?: string;
    mpesaFee?: number;
    rukishaFee?: number;
    feeSaved?: number;
    userSavePercent?: number;
  };
}

export interface WalletBalances {
  main: number;
  education: number;
  medical: number;
  holiday: number;
  retirement: number;
  pension: number;
}

export interface PensionRedemption {
  id: string;
  amount: number;
  reason: string;
  requestDate: Date;
  status: 'pending' | 'approved' | 'rejected';
  processedDate?: Date;
  approvedBy?: string;
}

interface WalletContextType {
  balances: WalletBalances;
  transactions: Transaction[];
  pensionRedemptions: PensionRedemption[];
  updateBalance: (walletType: keyof WalletBalances, amount: number) => void;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'timestamp'>) => void;
  addPensionRedemption: (redemption: Omit<PensionRedemption, 'id' | 'requestDate'>) => void;
  getPensionBalance: () => number;
  getPensionEligibility: () => { eligible: boolean; monthsAccumulated: number; minMonthsRequired: number };
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [balances, setBalances] = useState<WalletBalances>({
    main: 187500,
    education: 45000,
    medical: 18500,
    holiday: 32000,
    retirement: 125000,
    pension: 8750,
  });

  const [pensionRedemptions, setPensionRedemptions] = useState<PensionRedemption[]>([]);

  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: '1',
      type: 'sent',
      amount: -2500,
      description: 'Money Transfer',
      recipient: 'John Mwangi',
      timestamp: new Date(2025, 0, 20, 14, 30),
      status: 'completed',
      walletType: 'main'
    },
    {
      id: '2',
      type: 'received',
      amount: 15000,
      description: 'Salary Payment',
      recipient: 'CPF Group',
      timestamp: new Date(2025, 0, 20, 9, 0),
      status: 'completed',
      walletType: 'main'
    },
    {
      id: '3',
      type: 'bill',
      amount: -1200,
      description: 'KPLC Electricity',
      timestamp: new Date(2025, 0, 19, 16, 45),
      status: 'completed',
      walletType: 'main'
    },
    {
      id: '4',
      type: 'school',
      amount: -25000,
      description: "School Fees - St. Mary's",
      timestamp: new Date(2025, 0, 18, 11, 20),
      status: 'completed',
      walletType: 'education'
    },
    {
      id: '5',
      type: 'sent',
      amount: -500,
      description: 'M-Pesa Top Up',
      timestamp: new Date(2025, 0, 17, 8, 15),
      status: 'pending',
      walletType: 'main'
    }
  ]);

  const updateBalance = (walletType: keyof WalletBalances, amount: number) => {
    setBalances(prev => ({
      ...prev,
      [walletType]: prev[walletType] + amount
    }));
  };

  const addTransaction = (transaction: Omit<Transaction, 'id' | 'timestamp'>) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: Date.now().toString(),
      timestamp: new Date(),
    };

    setTransactions(prev => [newTransaction, ...prev]);

    const walletType = transaction.walletType || 'main';
    updateBalance(walletType, transaction.amount);

    if (transaction.amount < 0 && transaction.type !== 'save' && transaction.type !== 'pension_contribution') {
      const saveAmount = Math.abs(transaction.amount) * 0.05;
      const mpesaFee = Math.abs(transaction.amount) * 0.03;
      const rukishaFee = Math.abs(transaction.amount) * 0.024;
      const feeSaved = mpesaFee - rukishaFee;
      const userPensionAmount = saveAmount * 0.3;
      const retirementAmount = saveAmount * 0.5;
      const educationAmount = saveAmount * 0.2;

      updateBalance('pension', feeSaved);
      setTransactions(prev => [{
        id: (Date.now() + 1).toString(),
        type: 'pension_contribution',
        amount: feeSaved,
        description: 'Taifa Pension - CPF Fee Savings',
        timestamp: new Date(),
        status: 'completed',
        walletType: 'pension',
        pensionMetadata: {
          triggerType: 'cpf',
          originalTransaction: newTransaction.id,
          mpesaFee,
          rukishaFee,
          feeSaved,
        }
      }, ...prev]);

      updateBalance('pension', userPensionAmount);
      setTransactions(prev => [{
        id: (Date.now() + 2).toString(),
        type: 'pension_contribution',
        amount: userPensionAmount,
        description: 'Taifa Pension - User Savings',
        timestamp: new Date(),
        status: 'completed',
        walletType: 'pension',
        pensionMetadata: {
          triggerType: 'user',
          originalTransaction: newTransaction.id,
          userSavePercent: 5,
        }
      }, ...prev]);

      updateBalance('retirement', retirementAmount);
      setTransactions(prev => [{
        id: (Date.now() + 3).toString(),
        type: 'save',
        amount: retirementAmount,
        description: 'Save-As-You-Spend (Retirement)',
        timestamp: new Date(),
        status: 'completed',
        walletType: 'retirement'
      }, ...prev]);

      updateBalance('education', educationAmount);
      setTransactions(prev => [{
        id: (Date.now() + 4).toString(),
        type: 'save',
        amount: educationAmount,
        description: 'Save-As-You-Spend (Education)',
        timestamp: new Date(),
        status: 'completed',
        walletType: 'education'
      }, ...prev]);
    }
  };

  const addPensionRedemption = (redemption: Omit<PensionRedemption, 'id' | 'requestDate'>) => {
    const newRedemption: PensionRedemption = {
      ...redemption,
      id: Date.now().toString(),
      requestDate: new Date(),
    };
    setPensionRedemptions(prev => [newRedemption, ...prev]);
  };

  const getPensionBalance = () => balances.pension;

  const getPensionEligibility = () => {
    const firstPensionTransaction = transactions
      .filter(t => t.type === 'pension_contribution')
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];

    if (!firstPensionTransaction) {
      return { eligible: false, monthsAccumulated: 0, minMonthsRequired: 3 };
    }

    const monthsAccumulated = Math.floor(
      (new Date().getTime() - firstPensionTransaction.timestamp.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    return {
      eligible: monthsAccumulated >= 3 && balances.pension >= 1000,
      monthsAccumulated,
      minMonthsRequired: 3,
    };
  };

  return (
    <WalletContext.Provider value={{
      balances,
      transactions,
      pensionRedemptions,
      updateBalance,
      addTransaction,
      addPensionRedemption,
      getPensionBalance,
      getPensionEligibility,
    }}>
      {children}
    </WalletContext.Provider>
  );
}
