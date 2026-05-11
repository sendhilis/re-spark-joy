
DO $$ BEGIN
  CREATE TYPE merchant_listing_tier AS ENUM ('standard','category_boost','discovery_prime','anchor_partner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.bank_merchants
  ADD COLUMN IF NOT EXISTS listing_tier merchant_listing_tier NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS monthly_listing_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS boost_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS boost_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS txn_velocity_30d numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preference_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proximity_lat numeric,
  ADD COLUMN IF NOT EXISTS proximity_lng numeric,
  ADD COLUMN IF NOT EXISTS paid_boost_amount numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.merchant_listing_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  bank_id uuid NOT NULL,
  tier merchant_listing_tier NOT NULL,
  period_month date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'invoiced',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, period_month)
);

ALTER TABLE public.merchant_listing_revenue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage listing revenue" ON public.merchant_listing_revenue;
CREATE POLICY "Admins manage listing revenue" ON public.merchant_listing_revenue
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "Auth read listing revenue" ON public.merchant_listing_revenue;
CREATE POLICY "Auth read listing revenue" ON public.merchant_listing_revenue
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_listing_revenue_period ON public.merchant_listing_revenue(period_month);
CREATE INDEX IF NOT EXISTS idx_listing_revenue_bank ON public.merchant_listing_revenue(bank_id);
CREATE INDEX IF NOT EXISTS idx_bank_merchants_tier ON public.bank_merchants(listing_tier);
