
ALTER TABLE public.participating_banks
  ADD COLUMN IF NOT EXISTS msisdn_masking_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS masking_secret_ref text;

ALTER TABLE public.transaction_intents
  ADD COLUMN IF NOT EXISTS payer_bank text,
  ADD COLUMN IF NOT EXISTS payer_token text,
  ADD COLUMN IF NOT EXISTS payer_msisdn_encrypted text,
  ADD COLUMN IF NOT EXISTS payer_msisdn_visible text;

CREATE TABLE IF NOT EXISTS public.bank_payload_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id uuid,
  trace_id text NOT NULL,
  originating_bank text NOT NULL,
  terminating_bank text NOT NULL,
  masking_applied boolean NOT NULL DEFAULT false,
  originating_payload jsonb NOT NULL,
  switch_stored_payload jsonb NOT NULL,
  terminating_payload jsonb NOT NULL,
  merchant_receipt_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_payload_audit TO authenticated;
GRANT ALL ON public.bank_payload_audit TO service_role;

ALTER TABLE public.bank_payload_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage bank payload audit"
  ON public.bank_payload_audit
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS bank_payload_audit_created_idx
  ON public.bank_payload_audit(created_at DESC);

INSERT INTO public.participating_banks
  (bank_code, bank_name, legal_entity_name, kyb_status, msisdn_masking_enabled, masking_secret_ref)
SELECT 'GAB', 'Gulf African Bank Kenya', 'Gulf African Bank Ltd', 'approved', true, 'hsm:gab:msisdn:v1'
WHERE NOT EXISTS (SELECT 1 FROM public.participating_banks WHERE bank_code = 'GAB');

UPDATE public.participating_banks
   SET msisdn_masking_enabled = true,
       masking_secret_ref = COALESCE(masking_secret_ref, 'hsm:gab:msisdn:v1')
 WHERE bank_code = 'GAB';
