-- Persistent observations for admin-only fare-learning prototype.
CREATE TABLE IF NOT EXISTS public.uber_price_observations (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 observed_at timestamptz NOT NULL DEFAULT now(),
 pickup_name text NOT NULL, dropoff_name text NOT NULL,
 pickup_lat double precision NOT NULL, pickup_lng double precision NOT NULL,
 dropoff_lat double precision NOT NULL, dropoff_lng double precision NOT NULL,
 distance_km double precision NOT NULL CHECK(distance_km>=0),
 product_name text NOT NULL, price_eur numeric(12,2) NOT NULL CHECK(price_eur>0),
 trip_seconds integer, context jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS uber_price_observations_time_idx ON public.uber_price_observations(observed_at DESC);
CREATE INDEX IF NOT EXISTS uber_price_observations_product_idx ON public.uber_price_observations(product_name,observed_at DESC);
ALTER TABLE public.uber_price_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.uber_price_observations FROM anon, authenticated;
-- Service-role API accesses observations; no public policies.
