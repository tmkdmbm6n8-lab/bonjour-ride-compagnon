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
