-- Apply through Lovable's database migration workflow before enabling the UI.
CREATE OR REPLACE FUNCTION public.cancel_ride_no_show(_ride uuid, _driver uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  trip public.rides;
  charge numeric := 7.27;
  commission numeric;
  earnings numeric;
BEGIN
  SELECT * INTO trip FROM public.rides WHERE id = _ride FOR UPDATE;
  IF NOT FOUND OR trip.driver_id IS DISTINCT FROM _driver THEN
    RAISE EXCEPTION 'Course non autorisée';
  END IF;

  IF trip.status = 'cancelled' AND trip.fare->>'cancellationReason' = 'rider_no_show' THEN
    RETURN;
  END IF;
  IF trip.status IS DISTINCT FROM 'arrived' OR trip.is_test
    OR coalesce(trip.payment->>'method', 'wallet') = 'cash'
    OR trip.arrived_at IS NULL OR clock_timestamp() < trip.arrived_at + interval '7 minutes'
  THEN
    RAISE EXCEPTION 'Compensation indisponible pour cette course';
  END IF;

  IF NOT coalesce(trip.payment ? 'intent_id', false)
    AND coalesce((trip.fare->'approachTracking'->>'meters')::numeric, 0) > 10000
    AND (trip.fare->>'total')::numeric >= 14.55
  THEN
    charge := round((trip.fare->>'total')::numeric / 2, 2);
  END IF;

  -- The fare records the commission granted to this driver at acceptance.
  commission := CASE trip.fare->>'platformCommission'
    WHEN '0' THEN 0 WHEN '5' THEN 5 ELSE 10 END;
  earnings := charge - round(charge * commission / 100, 2);
  PERFORM public.wallet_entry(trip.rider_id, -charge, 'cancellation_fee', trip.id, 'no-show:charge:' || trip.id);
  PERFORM public.wallet_entry(_driver, earnings, 'ride_earning', trip.id, 'no-show:earning:' || trip.id);
  UPDATE public.rides
    SET status = 'cancelled', offer_driver_id = NULL, offer_expires_at = NULL,
        fare = fare || jsonb_build_object('cancellationReason', 'rider_no_show',
          'cancellationFee', charge, 'cancellationDriverEarnings', earnings,
          'cancellationCommission', charge - earnings)
    WHERE id = trip.id;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_ride_no_show(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_ride_no_show(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_ride_long_approach(_ride uuid, _rider uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  trip public.rides;
  charge numeric;
  commission numeric;
  earnings numeric;
BEGIN
  SELECT * INTO trip FROM public.rides WHERE id = _ride FOR UPDATE;
  IF NOT FOUND OR trip.rider_id IS DISTINCT FROM _rider THEN
    RAISE EXCEPTION 'Course non autorisée';
  END IF;
  IF trip.status = 'cancelled' AND trip.fare->>'cancellationReason' = 'rider_long_approach' THEN
    RETURN;
  END IF;
  IF trip.status NOT IN ('accepted', 'arrived') OR trip.driver_id IS NULL OR trip.is_test
    OR coalesce(trip.payment->>'method', 'wallet') = 'cash'
    OR coalesce(trip.payment ? 'intent_id', false)
    OR coalesce((trip.fare->'approachTracking'->>'meters')::numeric, 0) <= 10000
    OR coalesce((trip.fare->>'total')::numeric, 0) < 14.55
  THEN
    RAISE EXCEPTION 'Compensation indisponible pour cette course';
  END IF;
  charge := round((trip.fare->>'total')::numeric / 2, 2);
  commission := CASE trip.fare->>'platformCommission' WHEN '0' THEN 0 WHEN '5' THEN 5 ELSE 10 END;
  earnings := charge - round(charge * commission / 100, 2);
  PERFORM public.wallet_entry(_rider, -charge, 'cancellation_fee', trip.id, 'no-show:charge:' || trip.id);
  PERFORM public.wallet_entry(trip.driver_id, earnings, 'ride_earning', trip.id, 'no-show:earning:' || trip.id);
  UPDATE public.rides SET status = 'cancelled', offer_driver_id = NULL, offer_expires_at = NULL,
    fare = fare || jsonb_build_object('cancellationReason', 'rider_long_approach', 'cancellationFee', charge,
      'cancellationDriverEarnings', earnings, 'cancellationCommission', charge - earnings)
    WHERE id = trip.id;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_ride_long_approach(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_ride_long_approach(uuid, uuid) TO service_role;
