ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS merchant_segment text NOT NULL DEFAULT 'bank_linked';
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS lmid text;
CREATE INDEX IF NOT EXISTS idx_merchants_lmid ON public.merchants(lmid);
CREATE INDEX IF NOT EXISTS idx_merchants_phone ON public.merchants(contact_phone);