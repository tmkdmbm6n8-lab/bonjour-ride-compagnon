-- Road-distance stratified pool for the two admin AI tools.
-- Apply this migration in Supabase before starting collection.
CREATE TABLE IF NOT EXISTS public.uber_ai_road_routes (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 pickup_key text NOT NULL,
 dropoff_key text NOT NULL,
 pickup_name text NOT NULL,
 dropoff_name text NOT NULL,
 pickup_lat double precision NOT NULL,
 pickup_lng double precision NOT NULL,
 dropoff_lat double precision NOT NULL,
 dropoff_lng double precision NOT NULL,
 road_distance_km numeric(8,3) NOT NULL CHECK (road_distance_km >= 0.5 AND road_distance_km < 9),
 distance_band text NOT NULL CHECK (distance_band IN ('0.5-1','1-2','2-3','3-4','4-5','5-6','6-7','7-8','8-9')),
 compared_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (pickup_key,dropoff_key)
);
CREATE INDEX IF NOT EXISTS uber_ai_road_routes_band_idx ON public.uber_ai_road_routes(distance_band,compared_at,id);
ALTER TABLE public.uber_ai_road_routes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.uber_ai_road_routes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.uber_ai_road_routes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.uber_ai_road_routes_id_seq TO service_role;
-- Atomically reserve a new pair for comparison. No duplicate comparisons across workers.
CREATE OR REPLACE FUNCTION public.claim_uber_ai_road_route()
RETURNS SETOF public.uber_ai_road_routes
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 RETURN QUERY
 WITH selected AS (
  SELECT id FROM public.uber_ai_road_routes
  WHERE compared_at IS NULL ORDER BY created_at,id
  LIMIT 1 FOR UPDATE SKIP LOCKED
 )
 UPDATE public.uber_ai_road_routes r
 SET compared_at=now()
 FROM selected s WHERE r.id=s.id
 RETURNING r.*;
END; $$;
REVOKE ALL ON FUNCTION public.claim_uber_ai_road_route() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_uber_ai_road_route() TO service_role;
NOTIFY pgrst, 'reload schema';
