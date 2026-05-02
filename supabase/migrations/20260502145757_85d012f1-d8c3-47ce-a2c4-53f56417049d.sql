-- 1) Idempotency: enforce uniqueness so concurrent retries cannot double-insert
CREATE UNIQUE INDEX IF NOT EXISTS ux_transaction_intents_idem
  ON public.transaction_intents (idempotency_key);

-- 2) Velocity counters: required by the upsert in switch-process-intent
CREATE UNIQUE INDEX IF NOT EXISTS ux_velocity_counters_subject_bucket_window
  ON public.velocity_counters (subject, bucket, window_start);

-- 3) Hot-path indexes for observability and settlement
CREATE INDEX IF NOT EXISTS ix_switch_events_intent_id
  ON public.switch_events (intent_id);

CREATE INDEX IF NOT EXISTS ix_switch_events_type_id
  ON public.switch_events (event_type, id);

CREATE INDEX IF NOT EXISTS ix_transaction_intents_created_desc
  ON public.transaction_intents (created_at DESC);

CREATE INDEX IF NOT EXISTS ix_transaction_intents_bank_created
  ON public.transaction_intents (payee_bank, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_trace_spans_trace
  ON public.trace_spans (trace_id);

CREATE INDEX IF NOT EXISTS ix_trace_spans_started_desc
  ON public.trace_spans (started_at DESC);

CREATE INDEX IF NOT EXISTS ix_bank_integration_profiles_bank_env
  ON public.bank_integration_profiles (bank_id, environment);
