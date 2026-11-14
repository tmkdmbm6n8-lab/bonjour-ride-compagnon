ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS is_priority boolean NOT NULL DEFAULT false;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS dispatch_phase text;
ALTER TABLE public.rides ADD CONSTRAINT rides_dispatch_phase_check CHECK (dispatch_phase IS NULL OR dispatch_phase IN ('priority','nearest','broadcast'));
COMMENT ON COLUMN public.drivers.is_priority IS 'Set by admins only: priority drivers receive every new ride first.';
COMMENT ON COLUMN public.rides.dispatch_phase IS 'priority = all priority drivers at once, nearest = offer_driver_id alone, broadcast = every available driver; offer_expires_at ends the phase.';

CREATE OR REPLACE FUNCTION public.decline_ride_offer(_ride uuid, _driver uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.rides
     SET declined = CASE WHEN _driver = ANY(declined) THEN declined ELSE array_append(declined, _driver) END,
         offer_driver_id = CASE WHEN offer_driver_id = _driver THEN NULL ELSE offer_driver_id END
   WHERE id = _ride AND status = 'searching';
$$;
REVOKE ALL ON FUNCTION public.decline_ride_offer(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decline_ride_offer(uuid,uuid) TO service_role;