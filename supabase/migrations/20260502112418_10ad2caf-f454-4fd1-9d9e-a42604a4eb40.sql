-- Lifecycle stage enum
DO $$ BEGIN
  CREATE TYPE public.bank_lifecycle_stage AS ENUM (
    'application',
    'kyb_legal',
    'technical_setup',
    'sandbox_certification',
    'production_live',
    'suspended',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bank_environment AS ENUM ('sandbox', 'production');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Participating banks
CREATE TABLE IF NOT EXISTS public.participating_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_code text NOT NULL UNIQUE,
  bank_name text NOT NULL,
  bic text,
  legal_entity_name text,
  registration_number text,
  cbk_license_number text,
  contact_name text,
  contact_email text,
  contact_phone text,
  tech_contact_name text,
  tech_contact_email text,
  lifecycle_stage public.bank_lifecycle_stage NOT NULL DEFAULT 'application',
  kyb_status text NOT NULL DEFAULT 'pending', -- pending | submitted | approved | rejected
  kyb_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  sandbox_certified_at timestamptz,
  go_live_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.participating_banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage participating banks"
  ON public.participating_banks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_participating_banks_updated
  BEFORE UPDATE ON public.participating_banks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Integration profiles (one per environment per bank)
CREATE TABLE IF NOT EXISTS public.bank_integration_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id uuid NOT NULL REFERENCES public.participating_banks(id) ON DELETE CASCADE,
  environment public.bank_environment NOT NULL DEFAULT 'sandbox',
  pacs008_endpoint text,
  pacs009_endpoint text,
  pacs002_endpoint text,
  webhook_callback_url text,
  ip_allowlist text[] NOT NULL DEFAULT ARRAY[]::text[],
  mtls_client_cert_ref text,
  mtls_server_ca_ref text,
  hmac_key_ref text,
  hmac_algorithm text NOT NULL DEFAULT 'HMAC-SHA256',
  timeout_ms integer NOT NULL DEFAULT 2000,
  rate_limit_tps integer NOT NULL DEFAULT 50,
  breaker_failure_threshold integer NOT NULL DEFAULT 5,
  breaker_recovery_ms integer NOT NULL DEFAULT 30000,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bank_id, environment)
);

ALTER TABLE public.bank_integration_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage integration profiles"
  ON public.bank_integration_profiles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_bank_integration_profiles_updated
  BEFORE UPDATE ON public.bank_integration_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Certification test results
CREATE TABLE IF NOT EXISTS public.bank_certification_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id uuid NOT NULL REFERENCES public.participating_banks(id) ON DELETE CASCADE,
  environment public.bank_environment NOT NULL DEFAULT 'sandbox',
  test_suite_run_id uuid NOT NULL,
  test_code text NOT NULL,            -- e.g. PING, AUTH, PACS008_ECHO, PACS002_RESP, SETTLEMENT_RT, FAILURE_SIM
  test_name text NOT NULL,
  status text NOT NULL,               -- pass | fail | skipped
  latency_ms integer,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_certification_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage certification tests"
  ON public.bank_certification_tests
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_certtests_bank ON public.bank_certification_tests(bank_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_certtests_run ON public.bank_certification_tests(test_suite_run_id);

-- Lifecycle audit trail
CREATE TABLE IF NOT EXISTS public.bank_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id uuid NOT NULL REFERENCES public.participating_banks(id) ON DELETE CASCADE,
  from_stage public.bank_lifecycle_stage,
  to_stage public.bank_lifecycle_stage NOT NULL,
  actor_user_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_lifecycle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage lifecycle events"
  ON public.bank_lifecycle_events
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_lifecycle_bank ON public.bank_lifecycle_events(bank_id, created_at DESC);

-- Link bank_connectors to participating bank (optional)
ALTER TABLE public.bank_connectors
  ADD COLUMN IF NOT EXISTS participating_bank_id uuid REFERENCES public.participating_banks(id) ON DELETE SET NULL;