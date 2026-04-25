
CREATE TABLE public.mpesa_global_tariffs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  corridor_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  band_min_kes NUMERIC NOT NULL,
  band_max_kes NUMERIC NOT NULL,
  fee_kes NUMERIC NOT NULL,
  fx_margin_bps NUMERIC,
  source_url TEXT NOT NULL,
  snapshot_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_mpesa_tariffs_corridor ON public.mpesa_global_tariffs(corridor_code);
CREATE INDEX idx_mpesa_tariffs_snapshot ON public.mpesa_global_tariffs(snapshot_at DESC);

ALTER TABLE public.mpesa_global_tariffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tariffs"
ON public.mpesa_global_tariffs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage tariffs"
ON public.mpesa_global_tariffs FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.mpesa_global_tariff_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_by UUID,
  status TEXT NOT NULL,
  message TEXT,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  source_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mpesa_global_tariff_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view tariff runs"
ON public.mpesa_global_tariff_runs FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert tariff runs"
ON public.mpesa_global_tariff_runs FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
