-- Keep Uber session cookies invisible to public and authenticated Supabase clients.
-- Server-side service-role access continues to work (service_role bypasses RLS).
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pricing_rules_hide_uber_cookie" ON public.pricing_rules;
CREATE POLICY "pricing_rules_hide_uber_cookie"
ON public.pricing_rules
AS RESTRICTIVE
FOR SELECT
TO anon, authenticated
USING (vehicle_type <> 'uber_cookie');
