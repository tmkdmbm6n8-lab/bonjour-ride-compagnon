ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS trip_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS rider_rating numeric(3,2);