-- Settlement Agent registry (KCB Kenya is the agent for the Lipafo pilot)
CREATE TABLE public.settlement_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL UNIQUE,
  agent_code TEXT NOT NULL UNIQUE,
  agent_type TEXT NOT NULL DEFAULT 'commercial_bank', -- commercial_bank | central_bank
  bic TEXT,
  settlement_account TEXT NOT NULL,
  contact_email TEXT,
  cutoff_local TIME NOT NULL DEFAULT '13:00',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.settlement_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage settlement agents" ON public.settlement_agents
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated read settlement agents" ON public.settlement_agents
  FOR SELECT TO authenticated USING (true);

-- Member-bank collateral / pre-funding ledger held at the Settlement Agent
CREATE TABLE public.member_collateral (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_bank TEXT NOT NULL UNIQUE,
  agent_id UUID NOT NULL REFERENCES public.settlement_agents(id),
  collateral_account TEXT NOT NULL,
  posted_balance NUMERIC NOT NULL DEFAULT 0,         -- cash held at agent
  utilised_amount NUMERIC NOT NULL DEFAULT 0,        -- amount earmarked vs current cycle
  available_balance NUMERIC GENERATED ALWAYS AS (posted_balance - utilised_amount) STORED,
  cap_amount NUMERIC NOT NULL DEFAULT 50000000,      -- Lipafo will not clear beyond this
  currency TEXT NOT NULL DEFAULT 'KES',
  status TEXT NOT NULL DEFAULT 'active',
  last_topup_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.member_collateral ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage member collateral" ON public.member_collateral
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Settlement instructions Lipafo sends to the Agent (one per debtor→creditor leg)
CREATE TABLE public.settlement_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instruction_ref TEXT NOT NULL UNIQUE,             -- e.g. LPF-INSTR-20260430-001
  cycle_date DATE NOT NULL,
  agent_id UUID NOT NULL REFERENCES public.settlement_agents(id),
  debtor_bank TEXT NOT NULL,                        -- bank that owes (debited at agent)
  creditor_bank TEXT NOT NULL,                      -- bank that receives (credited at agent)
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  message_type TEXT NOT NULL DEFAULT 'pacs.009',    -- bank-to-bank credit transfer
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,       -- full ISO 20022 / CSV row
  status TEXT NOT NULL DEFAULT 'generated',         -- generated | dispatched | confirmed | rejected
  dispatched_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  agent_reference TEXT,                             -- agent's confirmation id
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.settlement_instructions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage settlement instructions" ON public.settlement_instructions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Confirmations from the Settlement Agent (one row per leg confirmed/rejected)
CREATE TABLE public.settlement_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instruction_id UUID NOT NULL REFERENCES public.settlement_instructions(id) ON DELETE CASCADE,
  agent_reference TEXT NOT NULL,
  outcome TEXT NOT NULL,                            -- settled | rejected
  settled_amount NUMERIC,
  reason TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.settlement_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage settlement confirmations" ON public.settlement_confirmations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Update triggers
CREATE TRIGGER trg_settlement_agents_updated BEFORE UPDATE ON public.settlement_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_member_collateral_updated BEFORE UPDATE ON public.member_collateral
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_settlement_instructions_updated BEFORE UPDATE ON public.settlement_instructions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: KCB Kenya as the Settlement Agent for the Lipafo pilot
INSERT INTO public.settlement_agents (agent_name, agent_code, agent_type, bic, settlement_account, contact_email, cutoff_local)
VALUES ('KCB Bank Kenya', 'KCB_KE_AGENT', 'commercial_bank', 'KCBLKENX', '1100000-LIPAFO-AGENT', 'settlement-agent@kcbgroup.com', '13:00');

-- Seed member collateral for the 8 participating banks against the KCB agent
INSERT INTO public.member_collateral (member_bank, agent_id, collateral_account, posted_balance, cap_amount)
SELECT b.bank, a.id,
       'KCB-COL-' || replace(upper(split_part(b.bank,' ',1)),' ','') || '-' || lpad((row_number() over ())::text, 4, '0'),
       (15000000 + (random()*35000000))::numeric(18,2),
       80000000
FROM (VALUES
  ('KCB Bank Kenya'),('Equity Bank'),('Co-operative Bank'),('NCBA Bank'),
  ('Stanbic Bank'),('Family Bank'),('Absa Bank'),('I&M Bank')
) AS b(bank)
CROSS JOIN public.settlement_agents a
WHERE a.agent_code = 'KCB_KE_AGENT';