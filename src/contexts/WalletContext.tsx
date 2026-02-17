import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import type { Database } from '@/integrations/supabase/types';

type DbWalletType = Database['public']['Enums']['wallet_type'];
type DbTransactionType = Database['public']['Enums']['transaction_type'];
type DbTransactionStatus = Database['public']['Enums']['transaction_status'];

export interface Transaction {
  id: string;
  type: DbTransactionType;
  amount: number;
  description: string;
  recipient?: string;
  timestamp: Date;
  status: DbTransactionStatus;
  walletType?: DbWalletType;
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
  loading: boolean;
  updateBalance: (walletType: keyof WalletBalances, amount: number) => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'timestamp'>) => Promise<void>;
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

const defaultBalances: WalletBalances = { main: 0, education: 0, medical: 0, holiday: 0, retirement: 0, pension: 0 };

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [balances, setBalances] = useState<WalletBalances>(defaultBalances);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pensionRedemptions, setPensionRedemptions] = useState<PensionRedemption[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWallets = useCallback(async () => {
    if (!user) { setBalances(defaultBalances); return; }
    const { data } = await supabase.from('wallets').select('type, balance').eq('user_id', user.id);
    if (data) {
      const b = { ...defaultBalances };
      data.forEach(w => { b[w.type as keyof WalletBalances] = Number(w.balance); });
      setBalances(b);
    }
  }, [user]);

  const fetchTransactions = useCallback(async () => {
    if (!user) { setTransactions([]); return; }
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) {
      setTransactions(data.map(t => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        description: t.description,
        recipient: t.recipient ?? undefined,
        timestamp: new Date(t.created_at),
        status: t.status,
        walletType: t.wallet_type,
        pensionMetadata: t.pension_metadata as Transaction['pensionMetadata'],
      })));
    }
  }, [user]);

  // Initial data fetch
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    Promise.all([fetchWallets(), fetchTransactions()]).finally(() => setLoading(false));
  }, [user, fetchWallets, fetchTransactions]);

  // Realtime subscriptions for live sync
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('wallet-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${user.id}` },
        () => { fetchWallets(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` },
        () => { fetchTransactions(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchWallets, fetchTransactions]);

  const updateBalance = useCallback(async (walletType: keyof WalletBalances, amount: number) => {
    if (!user) return;
    // Optimistic update
    setBalances(prev => ({ ...prev, [walletType]: prev[walletType] + amount }));
    // Get current balance then update
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id, balance')
      .eq('user_id', user.id)
      .eq('type', walletType)
      .maybeSingle();
    if (wallet) {
      await supabase
        .from('wallets')
        .update({ balance: Number(wallet.balance) + amount })
        .eq('id', wallet.id);
    }
  }, [user]);

  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id' | 'timestamp'>) => {
    if (!user) return;

    const walletType = transaction.walletType || 'main';

    // Insert the main transaction
    const { data: inserted } = await supabase.from('transactions').insert({
      user_id: user.id,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      recipient: transaction.recipient ?? null,
      status: transaction.status,
      wallet_type: walletType,
      pension_metadata: transaction.pensionMetadata as any ?? null,
    }).select().single();

    if (!inserted) return;

    // Update the wallet balance and wait for it
    await updateBalance(walletType, transaction.amount);

    // Save-As-You-Spend logic for outgoing non-save transactions
    if (transaction.amount < 0 && transaction.type !== 'save' && transaction.type !== 'pension_contribution') {
      const saveAmount = Math.abs(transaction.amount) * 0.05;
      const mpesaFee = Math.abs(transaction.amount) * 0.03;
      const rukishaFee = Math.abs(transaction.amount) * 0.024;
      const feeSaved = mpesaFee - rukishaFee;
      const userPensionAmount = saveAmount * 0.3;
      const retirementAmount = saveAmount * 0.5;
      const educationAmount = saveAmount * 0.2;

      // CPF fee savings → pension
      await supabase.from('transactions').insert({
        user_id: user.id, type: 'pension_contribution', amount: feeSaved,
        description: 'Taifa Pension - CPF Fee Savings', status: 'completed', wallet_type: 'pension',
        pension_metadata: { triggerType: 'cpf', originalTransaction: inserted.id, mpesaFee, rukishaFee, feeSaved },
      });
      await updateBalance('pension', feeSaved);

      // User savings → pension
      await supabase.from('transactions').insert({
        user_id: user.id, type: 'pension_contribution', amount: userPensionAmount,
        description: 'Taifa Pension - User Savings', status: 'completed', wallet_type: 'pension',
        pension_metadata: { triggerType: 'user', originalTransaction: inserted.id, userSavePercent: 5 },
      });
      await updateBalance('pension', userPensionAmount);

      // Retirement savings
      await supabase.from('transactions').insert({
        user_id: user.id, type: 'save', amount: retirementAmount,
        description: 'Save-As-You-Spend (Retirement)', status: 'completed', wallet_type: 'retirement',
      });
      await updateBalance('retirement', retirementAmount);

      // Education savings
      await supabase.from('transactions').insert({
        user_id: user.id, type: 'save', amount: educationAmount,
        description: 'Save-As-You-Spend (Education)', status: 'completed', wallet_type: 'education',
      });
      await updateBalance('education', educationAmount);
    }

    // Final refresh to ensure full sync
    await Promise.all([fetchWallets(), fetchTransactions()]);
  }, [user, updateBalance, fetchWallets, fetchTransactions]);

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
      loading,
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
