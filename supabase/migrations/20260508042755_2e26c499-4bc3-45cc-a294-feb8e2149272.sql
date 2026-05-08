-- Phase 1: Banks push merchant lists into Lipafo (paybill + till, no MSISDN)

-- Extend participating_banks with sync fields
ALTER TABLE public.participating_banks
  ADD COLUMN IF NOT EXISTS paybill_prefix text,
  ADD COLUMN IF NOT EXISTS sync_api_key text NOT NULL DEFAULT replace(gen_random_uuid()::text,'-',''),
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_participating_banks_sync_key ON public.participating_banks(sync_api_key);

-- Bank-pushed merchants registry (separate from internally onboarded merchants)
CREATE TABLE IF NOT EXISTS public.bank_merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id uuid NOT NULL REFERENCES public.participating_banks(id) ON DELETE CASCADE,
  merchant_name text NOT NULL,
  category text NOT NULL DEFAULT 'retail',
  paybill_number text NOT NULL,
  till_number text,
  status text NOT NULL DEFAULT 'active',
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bank_id, paybill_number, till_number)
);

CREATE INDEX IF NOT EXISTS idx_bank_merchants_bank ON public.bank_merchants(bank_id);
CREATE INDEX IF NOT EXISTS idx_bank_merchants_category ON public.bank_merchants(category);
CREATE INDEX IF NOT EXISTS idx_bank_merchants_paybill ON public.bank_merchants(paybill_number);

ALTER TABLE public.bank_merchants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage bank merchants"
  ON public.bank_merchants FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Authenticated can read bank merchants"
  ON public.bank_merchants FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER trg_bank_merchants_updated
  BEFORE UPDATE ON public.bank_merchants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sync log for traceability
CREATE TABLE IF NOT EXISTS public.bank_merchant_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id uuid REFERENCES public.participating_banks(id) ON DELETE SET NULL,
  received_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  source_ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_merchant_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read sync logs"
  ON public.bank_merchant_sync_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));