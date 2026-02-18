
-- Create bank_agents table to store agent registry
CREATE TABLE public.bank_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_code TEXT NOT NULL UNIQUE,
  agent_name TEXT NOT NULL,
  location TEXT NOT NULL,
  county TEXT NOT NULL DEFAULT 'Nairobi',
  latitude NUMERIC,
  longitude NUMERIC,
  phone TEXT,
  bank_partner TEXT NOT NULL DEFAULT 'Equity Bank',
  status TEXT NOT NULL DEFAULT 'active', -- active, suspended, inactive
  float_balance NUMERIC NOT NULL DEFAULT 0,
  max_float NUMERIC NOT NULL DEFAULT 500000,
  daily_transaction_limit NUMERIC NOT NULL DEFAULT 200000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create agent_transactions table to track all cash-in/cash-out through agents
CREATE TABLE public.agent_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.bank_agents(id) ON DELETE CASCADE,
  user_id UUID,
  transaction_type TEXT NOT NULL, -- cash_in, cash_out, atm_withdrawal
  amount NUMERIC NOT NULL,
  transaction_code TEXT,
  status TEXT NOT NULL DEFAULT 'completed', -- completed, pending, failed, flagged
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS: Admins can do everything on bank_agents
ALTER TABLE public.bank_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage agents" ON public.bank_agents FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view active agents" ON public.bank_agents FOR SELECT USING (status = 'active');

-- RLS: agent_transactions
ALTER TABLE public.agent_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all agent transactions" ON public.agent_transactions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert agent transactions" ON public.agent_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own agent transactions" ON public.agent_transactions FOR SELECT USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_bank_agents_updated_at
  BEFORE UPDATE ON public.bank_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_agents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_transactions;
