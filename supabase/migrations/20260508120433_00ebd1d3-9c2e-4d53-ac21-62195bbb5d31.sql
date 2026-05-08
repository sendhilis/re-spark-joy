
-- Enable extensions for scheduled cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Mock email advice notes sent to banks at EOD/midnight
CREATE TABLE IF NOT EXISTS public.settlement_advice_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_date DATE NOT NULL,
  cycle_run_id UUID,
  bank_name TEXT NOT NULL,
  bank_email TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('LIPAFO_PAYS_BANK','BANK_PAYS_LIPAFO','FLAT')),
  net_amount NUMERIC NOT NULL DEFAULT 0,
  inbound_volume NUMERIC NOT NULL DEFAULT 0,
  outbound_volume NUMERIC NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','acknowledged','rtgs_completed','squared_off','failed')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  rtgs_reference TEXT,
  rtgs_completed_at TIMESTAMPTZ,
  squared_off_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.settlement_advice_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage settlement advice"
ON public.settlement_advice_emails FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER set_advice_updated
BEFORE UPDATE ON public.settlement_advice_emails
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_advice_cycle_date ON public.settlement_advice_emails(cycle_date DESC);
CREATE INDEX IF NOT EXISTS idx_advice_status ON public.settlement_advice_emails(status);

-- Schedule the midnight settlement run (00:05 every day - just after midnight)
-- Idempotent: drop existing job if present
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'lipafo-midnight-settlement';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'lipafo-midnight-settlement',
  '5 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ejrttghgscfhbezvobhv.supabase.co/functions/v1/settlement-midnight-run',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcnR0Z2hnc2NmaGJlenZvYmh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMjY2MDMsImV4cCI6MjA4NjkwMjYwM30.R-3Kx618263F6PmtHgEHhT633XmY4gKCMaqB-DagOIY"}'::jsonb,
    body := jsonb_build_object('trigger','cron','at', now())
  );
  $$
);
