-- Fixed benchmark routes and hourly checkpoints, independent of random sampling.
CREATE TABLE IF NOT EXISTS public.uber_benchmark_routes (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 pickup_name text NOT NULL, dropoff_name text NOT NULL,
 pickup_lat double precision NOT NULL, pickup_lng double precision NOT NULL,
 dropoff_lat double precision NOT NULL, dropoff_lng double precision NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(pickup_lat,pickup_lng,dropoff_lat,dropoff_lng)
);
CREATE TABLE IF NOT EXISTS public.uber_benchmark_prices (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 route_id bigint NOT NULL REFERENCES public.uber_benchmark_routes(id),
 hour_bucket timestamptz NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT now(),
 product_name text NOT NULL,
 price_eur numeric(12,2) NOT NULL CHECK(price_eur>0),
 trip_seconds integer,
 UNIQUE(route_id,hour_bucket,product_name)
);
CREATE INDEX IF NOT EXISTS uber_benchmark_prices_hour ON public.uber_benchmark_prices(hour_bucket DESC);
ALTER TABLE public.uber_benchmark_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uber_benchmark_prices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.uber_benchmark_routes, public.uber_benchmark_prices FROM anon,authenticated;
NOTIFY pgrst, 'reload schema';

-- Return one JSON object so PostgREST's default 1,000-row limit cannot truncate a year's chart.
CREATE OR REPLACE FUNCTION public.uber_benchmark_hourly_summary()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'hour', hour_bucket, 'product', product_name,
  'average', average_price, 'count', route_count
 ) ORDER BY hour_bucket), '[]'::jsonb)
 FROM (
  SELECT hour_bucket, product_name,
   AVG(price_eur)::numeric(12,2) AS average_price,
   COUNT(DISTINCT route_id) AS route_count
  FROM public.uber_benchmark_prices
  WHERE hour_bucket >= now() - interval '365 days'
  GROUP BY hour_bucket, product_name
 ) summary;
$$;
REVOKE ALL ON FUNCTION public.uber_benchmark_hourly_summary() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.uber_benchmark_hourly_summary() TO service_role;
