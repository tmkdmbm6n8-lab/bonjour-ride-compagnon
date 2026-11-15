CREATE TABLE public.card_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_type text NOT NULL,
  pickup jsonb NOT NULL,
  dropoff jsonb NOT NULL,
  route jsonb NOT NULL,
  fare jsonb NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  stripe_session_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','booking','booked','expired')),
  ride_id uuid REFERENCES public.rides(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX card_bookings_rider_idx ON public.card_bookings(rider_id, created_at DESC);
GRANT ALL ON public.card_bookings TO service_role;
ALTER TABLE public.card_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY card_bookings_service ON public.card_bookings FOR ALL TO service_role USING (true) WITH CHECK (true);