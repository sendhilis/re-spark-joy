-- =========================================================
-- LipafoPay Reference Switch — schema for the 8 patterns
-- =========================================================

-- 1. Exactly-once state machine
CREATE TABLE public.transaction_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  trace_id TEXT NOT NULL,
  user_id UUID,
  payer_identifier TEXT NOT NULL,
  payee_identifier TEXT NOT NULL,
  payee_bank TEXT,
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  state TEXT NOT NULL DEFAULT 'NEW'
    CHECK (state IN ('NEW','IN_FLIGHT','DEBITED','CREDITED','COMPLETED','FAILED','REVERSED')),
  rail TEXT NOT NULL DEFAULT 'bank_rail',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_intents_state ON public.transaction_intents(state);
CREATE INDEX idx_intents_trace ON public.transaction_intents(trace_id);
CREATE INDEX idx_intents_created ON public.transaction_intents(created_at DESC);

ALTER TABLE public.transaction_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage intents" ON public.transaction_intents
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_intents_updated_at
  BEFORE UPDATE ON public.transaction_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Append-only event log (single source of truth)
CREATE TABLE public.switch_events (
  id BIGSERIAL PRIMARY KEY,
  intent_id UUID,
  trace_id TEXT NOT NULL,
  span_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_intent ON public.switch_events(intent_id);
CREATE INDEX idx_events_trace ON public.switch_events(trace_id);
CREATE INDEX idx_events_created ON public.switch_events(created_at DESC);
CREATE INDEX idx_events_type ON public.switch_events(event_type);

ALTER TABLE public.switch_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read events" ON public.switch_events
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert events" ON public.switch_events
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
-- intentionally no UPDATE / DELETE policies — log is immutable

-- 3. Hot-account sharding (16 shards per merchant)
CREATE TABLE public.position_ledger_shards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_identifier TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'merchant',
  shard_no SMALLINT NOT NULL CHECK (shard_no BETWEEN 0 AND 15),
  balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  credit_count BIGINT NOT NULL DEFAULT 0,
  debit_count BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_identifier, shard_no)
);
CREATE INDEX idx_shards_account ON public.position_ledger_shards(account_identifier);

ALTER TABLE public.position_ledger_shards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage shards" ON public.position_ledger_shards
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- 5. Bank connectors with circuit breaker state
CREATE TABLE public.bank_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_code TEXT NOT NULL UNIQUE,
  bank_name TEXT NOT NULL,
  endpoint_url TEXT,
  timeout_ms INTEGER NOT NULL DEFAULT 2000,
  p50_latency_ms INTEGER NOT NULL DEFAULT 120,
  p99_latency_ms INTEGER NOT NULL DEFAULT 800,
  circuit_state TEXT NOT NULL DEFAULT 'CLOSED'
    CHECK (circuit_state IN ('CLOSED','OPEN','HALF_OPEN')),
  failure_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_connectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage connectors" ON public.bank_connectors
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_connectors_updated_at
  BEFORE UPDATE ON public.bank_connectors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Resumable settlement runs
CREATE TABLE public.settlement_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','checkpointed','completed','failed')),
  last_processed_event_id BIGINT NOT NULL DEFAULT 0,
  events_processed BIGINT NOT NULL DEFAULT 0,
  banks_settled INTEGER NOT NULL DEFAULT 0,
  total_volume NUMERIC(18,2) NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  checkpoint_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_runs_date ON public.settlement_runs(run_date DESC);

ALTER TABLE public.settlement_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage runs" ON public.settlement_runs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- 7. Fraud rules + velocity counters
CREATE TABLE public.fraud_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  threshold NUMERIC(18,2) NOT NULL,
  window_seconds INTEGER NOT NULL DEFAULT 60,
  action TEXT NOT NULL DEFAULT 'flag' CHECK (action IN ('allow','flag','block')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fraud_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage rules" ON public.fraud_rules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.velocity_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  bucket TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  UNIQUE(subject, bucket, window_start)
);
CREATE INDEX idx_velocity_lookup ON public.velocity_counters(subject, bucket, window_start DESC);

ALTER TABLE public.velocity_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage velocity" ON public.velocity_counters
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- 8. Distributed trace spans
CREATE TABLE public.trace_spans (
  id BIGSERIAL PRIMARY KEY,
  trace_id TEXT NOT NULL,
  span_id TEXT NOT NULL,
  parent_span_id TEXT,
  service TEXT NOT NULL,
  operation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok',
  duration_ms INTEGER,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_spans_trace ON public.trace_spans(trace_id);
CREATE INDEX idx_spans_started ON public.trace_spans(started_at DESC);
CREATE INDEX idx_spans_service ON public.trace_spans(service);

ALTER TABLE public.trace_spans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read spans" ON public.trace_spans
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert spans" ON public.trace_spans
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));

-- Seed bank connectors and fraud rules
INSERT INTO public.bank_connectors (bank_code,bank_name,p50_latency_ms,p99_latency_ms,timeout_ms) VALUES
  ('KCB','KCB Bank Kenya',80,250,2000),
  ('EQUITY','Equity Bank',95,300,2000),
  ('COOP','Co-operative Bank',180,650,3000),
  ('NCBA','NCBA Bank',110,400,2000),
  ('STANBIC','Stanbic Bank',140,520,2500),
  ('FAMILY','Family Bank',220,900,4000),
  ('ABSA','Absa Bank',105,380,2000),
  ('IM','I&M Bank',130,470,2500);

INSERT INTO public.fraud_rules (rule_code,description,rule_type,threshold,window_seconds,action) VALUES
  ('VEL_TXN_1M','More than 10 txns from same payer in 60s','velocity_count',10,60,'flag'),
  ('VEL_AMT_1H','Total >KES 500k from same payer in 1h','velocity_amount',500000,3600,'flag'),
  ('AMT_SINGLE','Single txn above KES 1M','amount_threshold',1000000,0,'flag'),
  ('NEW_PAYEE','Payment to brand-new payee >KES 100k','new_payee',100000,0,'flag');