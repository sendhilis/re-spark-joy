
-- Merchants table
CREATE TABLE public.merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_name text NOT NULL,
  till_code text NOT NULL UNIQUE,
  lipafo_code text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'retail',
  mcc text,
  country_code text NOT NULL DEFAULT 'KE',
  settlement_bank text NOT NULL DEFAULT 'KCB Bank Kenya',
  settlement_account text,
  status text NOT NULL DEFAULT 'active',
  contact_email text,
  contact_phone text,
  monthly_volume numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage merchants" ON public.merchants
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_merchants_updated_at
  BEFORE UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Settlement positions (EOD net per participating bank)
CREATE TABLE public.settlement_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_date date NOT NULL,
  participating_bank text NOT NULL,
  inbound_volume numeric NOT NULL DEFAULT 0,
  outbound_volume numeric NOT NULL DEFAULT 0,
  net_position numeric NOT NULL DEFAULT 0,
  transaction_count integer NOT NULL DEFAULT 0,
  cutoff_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.settlement_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage settlement positions" ON public.settlement_positions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_settlement_positions_updated_at
  BEFORE UPDATE ON public.settlement_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Dispatch ledger (T+1)
CREATE TABLE public.settlement_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid REFERENCES public.settlement_positions(id) ON DELETE CASCADE,
  beneficiary_bank text NOT NULL,
  amount numeric NOT NULL,
  scheduled_at timestamptz NOT NULL,
  dispatched_at timestamptz,
  reference text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  float_revenue numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.settlement_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage settlement dispatches" ON public.settlement_dispatches
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_settlement_dispatches_updated_at
  BEFORE UPDATE ON public.settlement_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Merchant settlements
CREATE TABLE public.merchant_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  settlement_date date NOT NULL,
  gross_amount numeric NOT NULL DEFAULT 0,
  fee_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  transaction_count integer NOT NULL DEFAULT 0,
  scheduled_payout_at timestamptz NOT NULL,
  paid_out_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage merchant settlements" ON public.merchant_settlements
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_merchant_settlements_updated_at
  BEFORE UPDATE ON public.merchant_settlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_settlement_positions_date ON public.settlement_positions(position_date DESC);
CREATE INDEX idx_settlement_dispatches_position ON public.settlement_dispatches(position_id);
CREATE INDEX idx_merchant_settlements_merchant ON public.merchant_settlements(merchant_id);
CREATE INDEX idx_merchant_settlements_date ON public.merchant_settlements(settlement_date DESC);
