-- Apply through Lovable's database migration workflow before enabling the UI.
CREATE OR REPLACE FUNCTION public.cancel_ride_no_show(_ride uuid, _driver uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  trip public.rides;
  charge constant numeric := 7.27;
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
