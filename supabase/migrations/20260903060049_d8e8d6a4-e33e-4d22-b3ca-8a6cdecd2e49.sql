-- Loan accounts (outstanding obligation the sweep collects against)
CREATE TABLE IF NOT EXISTS public.loan_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  loan_reference TEXT NOT NULL DEFAULT concat('EQ-LN-', substr(md5(random()::text), 1, 8)),
  principal NUMERIC(14,2) NOT NULL DEFAULT 0,
  outstanding_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  emi_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'KES',
  due_day INT NOT NULL DEFAULT 25,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.loan_accounts TO authenticated;
GRANT ALL ON public.loan_accounts TO service_role;
ALTER TABLE public.loan_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own loans read" ON public.loan_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own loans write" ON public.loan_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own loans update" ON public.loan_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Linked Mastercard tokens (NEVER stores PAN or CVV — only gateway token refs + masked PAN)
CREATE TABLE IF NOT EXISTS public.linked_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  mc_token_ref TEXT NOT NULL,
  mdes_token_id TEXT,
  mpgs_agreement_id TEXT,
  scheme TEXT NOT NULL DEFAULT 'MASTERCARD',
  masked_pan TEXT NOT NULL,
  cardholder_name TEXT,
  expiry_month INT,
  expiry_year INT,
  issuer_country TEXT,
  three_ds_status TEXT,
  verify_gateway_code TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.linked_cards TO authenticated;
GRANT ALL ON public.linked_cards TO service_role;
ALTER TABLE public.linked_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cards read" ON public.linked_cards FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own cards update" ON public.linked_cards FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Standing-instruction sweep mandates
CREATE TABLE IF NOT EXISTS public.sweep_mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  linked_card_id UUID NOT NULL REFERENCES public.linked_cards(id) ON DELETE CASCADE,
  loan_account_id UUID REFERENCES public.loan_accounts(id) ON DELETE SET NULL,
  policy TEXT NOT NULL DEFAULT 'EMI_ONLY',
  percentage NUMERIC(5,2) NOT NULL DEFAULT 20,
  cap_amount NUMERIC(14,2) NOT NULL DEFAULT 50000,
  currency TEXT NOT NULL DEFAULT 'KES',
  debit_window TEXT NOT NULL DEFAULT 'SAME_DAY',
  consent_text TEXT,
  consented_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sweep_policy_chk CHECK (policy IN ('FULL_SALARY','EMI_ONLY','PERCENTAGE')),
  CONSTRAINT sweep_status_chk CHECK (status IN ('ACTIVE','PAUSED','CANCELLED'))
);
GRANT SELECT, INSERT, UPDATE ON public.sweep_mandates TO authenticated;
GRANT ALL ON public.sweep_mandates TO service_role;
ALTER TABLE public.sweep_mandates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mandates read" ON public.sweep_mandates FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own mandates insert" ON public.sweep_mandates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own mandates update" ON public.sweep_mandates FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Detected payroll credits
CREATE TABLE IF NOT EXISTS public.salary_credit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AED',
  amount_kes NUMERIC(14,2),
  value_date DATE NOT NULL DEFAULT (now())::date,
  source TEXT NOT NULL DEFAULT 'MANUAL',
  raw_reference TEXT,
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT salary_source_chk CHECK (source IN ('WEBHOOK','BATCH','MANUAL'))
);
GRANT SELECT, INSERT ON public.salary_credit_events TO authenticated;
GRANT ALL ON public.salary_credit_events TO service_role;
ALTER TABLE public.salary_credit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own salary events read" ON public.salary_credit_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own salary events insert" ON public.salary_credit_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Every attempted MPGS pull (idempotency + audit)
CREATE TABLE IF NOT EXISTS public.sweep_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  salary_credit_event_id UUID NOT NULL REFERENCES public.salary_credit_events(id) ON DELETE CASCADE,
  mandate_id UUID NOT NULL REFERENCES public.sweep_mandates(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL UNIQUE,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  mpgs_order_id TEXT,
  mpgs_transaction_id TEXT,
  mc_response_code TEXT,
  gateway_code TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempt_number INT NOT NULL DEFAULT 1,
  failure_reason TEXT,
  wallet_credit_txn_id UUID,
  loan_debit_txn_id UUID,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sweep_exec_status_chk CHECK (status IN ('PENDING','SUCCESS','FAILED','REVERSED'))
);
GRANT SELECT ON public.sweep_executions TO authenticated;
GRANT ALL ON public.sweep_executions TO service_role;
ALTER TABLE public.sweep_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own executions read" ON public.sweep_executions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Proactive nudges
CREATE TABLE IF NOT EXISTS public.nudge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'IN_APP',
  message TEXT NOT NULL,
  payload JSONB,
  read BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.nudge_log TO authenticated;
GRANT ALL ON public.nudge_log TO service_role;
ALTER TABLE public.nudge_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own nudges read" ON public.nudge_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own nudges update" ON public.nudge_log FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Atomic posting: wallet credit + loan repayment in one transaction
CREATE OR REPLACE FUNCTION public.apply_sweep_posting(
  _execution_id UUID,
  _user_id UUID,
  _amount NUMERIC,
  _loan_account_id UUID,
  _description TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _credit_id UUID;
  _debit_id UUID;
  _repay NUMERIC := 0;
  _new_balance NUMERIC := 0;
BEGIN
  INSERT INTO public.transactions (user_id, type, amount, description, status, wallet_type)
  VALUES (_user_id, 'salary_credit', _amount, _description, 'completed', 'main')
  RETURNING id INTO _credit_id;

  UPDATE public.wallets SET balance = balance + _amount
  WHERE user_id = _user_id AND type = 'main';

  IF _loan_account_id IS NOT NULL THEN
    SELECT LEAST(outstanding_balance, _amount) INTO _repay
    FROM public.loan_accounts WHERE id = _loan_account_id AND user_id = _user_id;

    IF _repay > 0 THEN
      INSERT INTO public.transactions (user_id, type, amount, description, status, wallet_type)
      VALUES (_user_id, 'loan_repayment', -_repay, 'Loan repayment applied on salary day (Mastercard sweep)', 'completed', 'main')
      RETURNING id INTO _debit_id;

      UPDATE public.wallets SET balance = balance - _repay
      WHERE user_id = _user_id AND type = 'main';

      UPDATE public.loan_accounts
      SET outstanding_balance = outstanding_balance - _repay,
          status = CASE WHEN outstanding_balance - _repay <= 0 THEN 'CLOSED' ELSE status END,
          updated_at = now()
      WHERE id = _loan_account_id
      RETURNING outstanding_balance INTO _new_balance;
    END IF;
  END IF;

  UPDATE public.sweep_executions
  SET wallet_credit_txn_id = _credit_id, loan_debit_txn_id = _debit_id
  WHERE id = _execution_id;

  RETURN jsonb_build_object('wallet_credit_txn_id', _credit_id, 'loan_debit_txn_id', _debit_id, 'repaid', _repay, 'new_loan_balance', _new_balance);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_sweep_posting(UUID, UUID, NUMERIC, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_sweep_posting(UUID, UUID, NUMERIC, UUID, TEXT) TO service_role;