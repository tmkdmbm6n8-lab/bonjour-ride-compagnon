ALTER TABLE public.uber_benchmark_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uber_benchmark_measurements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.uber_benchmark_routes, public.uber_benchmark_measurements FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.uber_benchmark_routes, public.uber_benchmark_measurements TO service_role;