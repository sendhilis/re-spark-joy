
-- 1. Corridor routes lookup table
CREATE TABLE public.corridor_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL UNIQUE,
  country_name TEXT NOT NULL,
  corridor_type TEXT NOT NULL CHECK (corridor_type IN ('on_us', 'papss', 'correspondent')),
  partner_bank TEXT,
  settlement_currency TEXT NOT NULL,
  extra_fee_bps NUMERIC NOT NULL DEFAULT 0,
  settlement_time TEXT NOT NULL DEFAULT 'T+1',
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.corridor_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage corridor routes"
  ON public.corridor_routes FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view corridor routes"
  ON public.corridor_routes FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER trg_corridor_routes_updated_at
  BEFORE UPDATE ON public.corridor_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add corridor_type to merchants (denormalised for fast lookup; defaults from route)
ALTER TABLE public.merchants
  ADD COLUMN corridor_type TEXT NOT NULL DEFAULT 'on_us'
    CHECK (corridor_type IN ('on_us', 'papss', 'correspondent'));

-- 3. Seed routes
INSERT INTO public.corridor_routes
  (country_code, country_name, corridor_type, partner_bank, settlement_currency, extra_fee_bps, settlement_time, notes)
VALUES
  ('KE', 'Kenya',         'on_us',          'KCB Bank Kenya',     'KES',  0,  'T+0', 'Domestic / origin'),
  ('UG', 'Uganda',        'on_us',          'KCB Bank Uganda',    'UGX',  0,  'T+1', 'KCB Group subsidiary'),
  ('TZ', 'Tanzania',      'on_us',          'KCB Bank Tanzania',  'TZS',  0,  'T+1', 'KCB Group subsidiary'),
  ('RW', 'Rwanda',        'on_us',          'KCB Bank Rwanda',    'RWF',  0,  'T+1', 'KCB Group subsidiary (BPR)'),
  ('BI', 'Burundi',       'on_us',          'KCB Bank Burundi',   'BIF',  0,  'T+1', 'KCB Group subsidiary'),
  ('SS', 'South Sudan',   'on_us',          'KCB Bank South Sudan','SSP', 0,  'T+1', 'KCB Group subsidiary'),
  ('CD', 'DRC',           'on_us',          'KCB Bank DRC (TMB)', 'CDF',  0,  'T+1', 'KCB Group subsidiary (TMB)'),
  ('ET', 'Ethiopia',      'papss',          'PAPSS Network',      'ETB',  15, 'T+1', 'KCB rep office only — routed via PAPSS'),
  ('NG', 'Nigeria',       'papss',          'PAPSS Network',      'NGN',  15, 'T+1', 'PAPSS via CBN'),
  ('GH', 'Ghana',         'papss',          'PAPSS Network',      'GHS',  15, 'T+1', 'PAPSS via BoG'),
  ('EG', 'Egypt',         'papss',          'PAPSS Network',      'EGP',  20, 'T+1', 'PAPSS — newer corridor'),
  ('ZA', 'South Africa',  'correspondent',  'Standard Bank',      'ZAR',  35, 'T+2', 'Correspondent — no KCB sub, not on PAPSS yet'),
  ('GB', 'United Kingdom','correspondent',  'NatWest',            'GBP',  40, 'T+2', 'Correspondent banking'),
  ('US', 'United States', 'correspondent',  'Citibank N.A.',      'USD',  40, 'T+2', 'Correspondent banking via USD nostro');
