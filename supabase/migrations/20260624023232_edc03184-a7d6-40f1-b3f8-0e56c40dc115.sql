
CREATE TABLE public.kcb_buni_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment IN ('UAT','PROD')),
  base_url TEXT NOT NULL DEFAULT '',
  client_id TEXT NOT NULL DEFAULT '',
  client_secret TEXT NOT NULL DEFAULT '',
  callback_url TEXT NOT NULL DEFAULT '',
  egress_ips TEXT[] NOT NULL DEFAULT '{}',
  technical_contact TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(environment)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kcb_buni_settings TO authenticated;
GRANT ALL ON public.kcb_buni_settings TO service_role;

ALTER TABLE public.kcb_buni_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view kcb_buni_settings"
  ON public.kcb_buni_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert kcb_buni_settings"
  ON public.kcb_buni_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update kcb_buni_settings"
  ON public.kcb_buni_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete kcb_buni_settings"
  ON public.kcb_buni_settings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER kcb_buni_settings_updated_at
  BEFORE UPDATE ON public.kcb_buni_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.kcb_buni_settings (environment, base_url, callback_url)
VALUES
  ('UAT',  'https://uat.buni.kcbgroup.com',  'https://switch-uat.lipafo.africa/webhooks/kcb-buni'),
  ('PROD', 'https://buni.kcbgroup.com',      'https://switch.lipafo.africa/webhooks/kcb-buni');
