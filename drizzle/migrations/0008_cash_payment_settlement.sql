CREATE OR REPLACE FUNCTION public.settle_ride(_id uuid,_actor uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r public.rides; total numeric; earn numeric; BEGIN
SELECT * INTO r FROM rides WHERE id=_id FOR UPDATE;
IF r.driver_id IS DISTINCT FROM _actor OR r.status<>'in_progress' THEN RAISE EXCEPTION 'Course non autorisée'; END IF;
total := (r.fare->>'total')::numeric; earn := (r.fare->>'driverEarnings')::numeric;
IF coalesce(r.payment->>'method','wallet')='cash' THEN
  -- The rider hands the full price to the driver in cash; the driver's wallet carries the platform share (or the minimum-pay top-up when positive).
  IF earn-total<>0 THEN PERFORM wallet_entry(r.driver_id,earn-total,'cash_commission',r.id); END IF;
ELSE
  PERFORM wallet_entry(r.rider_id,-total,'ride_payment',r.id);
  PERFORM wallet_entry(r.driver_id,earn,'ride_earning',r.id);
END IF;
UPDATE rides SET status='completed',completed_at=now() WHERE id=r.id;
UPDATE drivers SET stats=jsonb_set(jsonb_set(stats,'{totalTrips}',to_jsonb(coalesce((stats->>'totalTrips')::int,0)+1)),'{totalEarnings}',to_jsonb(coalesce((stats->>'totalEarnings')::numeric,0)+earn)) WHERE user_id=r.driver_id;
RETURN jsonb_build_object('ok',true); END $$;
REVOKE ALL ON FUNCTION public.settle_ride(uuid,uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.settle_ride(uuid,uuid) TO service_role;