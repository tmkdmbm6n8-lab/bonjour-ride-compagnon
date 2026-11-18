CREATE TABLE public.ride_archives (
  ride_id uuid PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  booking_day date NOT NULL,
  ride_created_at timestamptz NOT NULL,
  sealed_at timestamptz NOT NULL DEFAULT now(),
  final_status text NOT NULL,
  accounting jsonb NOT NULL,
  accounting_sha256 text NOT NULL,
  contacts jsonb,
  booking jsonb,
  personal_expires_at timestamptz NOT NULL,
  accounting_expires_at timestamptz NOT NULL,
  personal_erased_at timestamptz,
  legal_hold boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.ride_archives TO service_role;
ALTER TABLE public.ride_archives ENABLE ROW LEVEL SECURITY;
CREATE POLICY ride_archives_service ON public.ride_archives FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX ride_archives_day_idx ON public.ride_archives (booking_day, ride_id);

CREATE TABLE public.ride_archive_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL,
  actor uuid NOT NULL,
  action text NOT NULL DEFAULT 'view',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ride_archive_access TO service_role;
ALTER TABLE public.ride_archive_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY ride_archive_access_service ON public.ride_archive_access FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Scellé : la partie comptable ne change jamais ; les données personnelles ne peuvent qu'être effacées.
CREATE OR REPLACE FUNCTION public.ride_archive_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.accounting IS DISTINCT FROM OLD.accounting OR NEW.accounting_sha256 IS DISTINCT FROM OLD.accounting_sha256
     OR NEW.ride_id <> OLD.ride_id OR NEW.booking_day <> OLD.booking_day OR NEW.sealed_at <> OLD.sealed_at
     OR NEW.version <> OLD.version OR NEW.final_status <> OLD.final_status OR NEW.accounting_expires_at <> OLD.accounting_expires_at THEN
    RAISE EXCEPTION 'Archive scellée : modification interdite';
  END IF;
  IF (NEW.contacts IS NOT NULL AND NEW.contacts IS DISTINCT FROM OLD.contacts)
     OR (NEW.booking IS NOT NULL AND NEW.booking IS DISTINCT FROM OLD.booking) THEN
    RAISE EXCEPTION 'Archive scellée : seules les données personnelles expirées peuvent être effacées';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ride_archive_guard BEFORE UPDATE ON public.ride_archives FOR EACH ROW EXECUTE FUNCTION public.ride_archive_guard();

CREATE OR REPLACE FUNCTION public.seal_ride_archive() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r rides; acc jsonb; rider profiles; drv profiles; car jsonb; closed timestamptz;
BEGIN
  SELECT * INTO r FROM rides WHERE id = NEW.id;
  IF r.id IS NULL OR r.is_test OR r.status NOT IN ('completed','cancelled') THEN RETURN NULL; END IF;
  SELECT * INTO rider FROM profiles WHERE id = r.rider_id;
  IF r.driver_id IS NOT NULL THEN
    SELECT * INTO drv FROM profiles WHERE id = r.driver_id;
    SELECT vehicle INTO car FROM drivers WHERE user_id = r.driver_id;
  END IF;
  closed := coalesce(r.completed_at, now());
  acc := jsonb_build_object('status', r.status, 'vehicleType', r.vehicle_type, 'fare', r.fare, 'payment', r.payment,
    'createdAt', r.created_at, 'acceptedAt', r.accepted_at, 'arrivedAt', r.arrived_at, 'completedAt', r.completed_at,
    'riderId', r.rider_id, 'driverId', r.driver_id,
    'walletTransactions', coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'userId',t.user_id,'type',t.type,'amount',t.amount,'note',t.note,'providerId',t.provider_id,'createdAt',t.created_at) ORDER BY t.created_at, t.id) FROM wallet_transactions t WHERE t.ride_id = r.id), '[]'::jsonb));
  INSERT INTO ride_archives (ride_id, booking_day, ride_created_at, final_status, accounting, accounting_sha256, contacts, booking, personal_expires_at, accounting_expires_at)
  VALUES (r.id, (r.created_at AT TIME ZONE 'Europe/Paris')::date, r.created_at, r.status, acc,
    encode(sha256(convert_to(acc::text, 'UTF8')), 'hex'),
    jsonb_build_object('rider', CASE WHEN rider.id IS NULL THEN NULL ELSE jsonb_build_object('id',rider.id,'name',rider.name,'phone',rider.phone,'username',rider.username) END,
                       'driver', CASE WHEN drv.id IS NULL THEN NULL ELSE jsonb_build_object('id',drv.id,'name',drv.name,'phone',drv.phone,'username',drv.username) END),
    jsonb_build_object('pickup', r.pickup, 'dropoff', r.dropoff, 'route', jsonb_build_object('distanceMeters', r.route->'distanceMeters', 'durationSeconds', r.route->'durationSeconds'), 'vehicle', car, 'rating', r.rating),
    r.created_at + interval '3 years',
    (date_trunc('year', closed AT TIME ZONE 'Europe/Paris') + interval '11 years') AT TIME ZONE 'Europe/Paris')
  ON CONFLICT (ride_id) DO NOTHING;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.seal_ride_archive() FROM PUBLIC, anon, authenticated;

-- Différé à la validation de la transaction : les écritures du portefeuille de la clôture sont incluses.
CREATE CONSTRAINT TRIGGER seal_ride_archive AFTER UPDATE OF status ON public.rides
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  WHEN (NEW.status IN ('completed','cancelled') AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.seal_ride_archive();

CREATE OR REPLACE FUNCTION public.admin_ride_archive(_ride uuid, _actor uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a ride_archives;
BEGIN
  IF NOT has_role(_actor, 'admin') THEN RAISE EXCEPTION 'Accès administrateur requis'; END IF;
  SELECT * INTO a FROM ride_archives WHERE ride_id = _ride;
  IF a.ride_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO ride_archive_access (ride_id, actor) VALUES (_ride, _actor);
  RETURN to_jsonb(a) || jsonb_build_object('hashValid', a.accounting_sha256 = encode(sha256(convert_to(a.accounting::text,'UTF8')),'hex'));
END $$;
REVOKE ALL ON FUNCTION public.admin_ride_archive(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ride_archive(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.purge_expired_personal_data()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE rides SET messages = '[]'::jsonb
   WHERE messages <> '[]'::jsonb AND created_at < now() - interval '1 year';

  UPDATE rides SET
    pickup = jsonb_build_object('address','Adresse supprimée','lat',round((pickup->>'lat')::numeric,2),'lng',round((pickup->>'lng')::numeric,2),'anonymized',true),
    dropoff = jsonb_build_object('address','Adresse supprimée','lat',round((dropoff->>'lat')::numeric,2),'lng',round((dropoff->>'lng')::numeric,2),'anonymized',true),
    route = jsonb_build_object('distanceMeters',route->'distanceMeters','durationSeconds',route->'durationSeconds','geometry',
      jsonb_build_array(jsonb_build_array(round((pickup->>'lng')::numeric,2),round((pickup->>'lat')::numeric,2)),
                        jsonb_build_array(round((dropoff->>'lng')::numeric,2),round((dropoff->>'lat')::numeric,2)))),
    pin = ''
   WHERE created_at < now() - interval '3 years' AND NOT (pickup ? 'anonymized');

  DELETE FROM wallet_transactions WHERE created_at < now() - interval '10 years';
  DELETE FROM wallet_transactions WHERE ride_id IN (SELECT id FROM rides WHERE created_at < now() - interval '10 years');
  DELETE FROM rides WHERE created_at < now() - interval '10 years';

  -- Archives : coordonnées et adresses effacées après 3 ans, pièces comptables supprimées après 10 ans civils.
  UPDATE ride_archives SET contacts = NULL, booking = NULL, personal_erased_at = now()
   WHERE personal_erased_at IS NULL AND NOT legal_hold AND personal_expires_at <= now();
  DELETE FROM ride_archive_access WHERE ride_id IN (SELECT ride_id FROM ride_archives WHERE NOT legal_hold AND accounting_expires_at <= now());
  DELETE FROM ride_archives WHERE NOT legal_hold AND accounting_expires_at <= now();
  DELETE FROM ride_archive_access WHERE created_at < now() - interval '10 years';

  DELETE FROM contact_messages WHERE created_at < now() - interval '3 years';

  UPDATE drivers SET location = NULL
   WHERE is_online = false AND location IS NOT NULL AND updated_at < now() - interval '24 hours';

  DELETE FROM road_alerts WHERE kind = 'police' AND last_confirmed_at < now() - interval '2 hours';
END $function$;