
DROP POLICY IF EXISTS "Anyone can view active agents" ON public.bank_agents;
CREATE POLICY "Authenticated can view active agents"
  ON public.bank_agents FOR SELECT TO authenticated
  USING (status = 'active');

DROP POLICY IF EXISTS "Authenticated can read aliases" ON public.lipafo_alias_registry;

DROP POLICY IF EXISTS "Auth read listing revenue" ON public.merchant_listing_revenue;
