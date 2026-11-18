CREATE OR REPLACE FUNCTION public.ride_archive_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.accounting IS DISTINCT FROM OLD.accounting OR NEW.accounting_sha256 IS DISTINCT FROM OLD.accounting_sha256
     OR NEW.ride_id <> OLD.ride_id OR NEW.booking_day <> OLD.booking_day OR NEW.sealed_at <> OLD.sealed_at
     OR NEW.ride_created_at <> OLD.ride_created_at
     OR NEW.version <> OLD.version OR NEW.final_status <> OLD.final_status OR NEW.accounting_expires_at <> OLD.accounting_expires_at THEN
    RAISE EXCEPTION 'Archive scellée : modification interdite';
  END IF;
  IF (NEW.contacts IS NOT NULL AND NEW.contacts IS DISTINCT FROM OLD.contacts)
     OR (NEW.booking IS NOT NULL AND NEW.booking IS DISTINCT FROM OLD.booking) THEN
    RAISE EXCEPTION 'Archive scellée : seules les données personnelles expirées peuvent être effacées';
  END IF;
  IF NEW.personal_expires_at > OLD.personal_expires_at THEN
    RAISE EXCEPTION 'Archive scellée : la durée de conservation des données personnelles ne peut pas être prolongée';
  END IF;
  IF OLD.personal_erased_at IS NOT NULL AND NEW.personal_erased_at IS DISTINCT FROM OLD.personal_erased_at THEN
    RAISE EXCEPTION 'Archive scellée : effacement irréversible';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.seal_ride_archive() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r rides; acc jsonb; rider profiles; drv profiles; car jsonb; docs jsonb; closed timestamptz;
BEGIN
  SELECT * INTO r FROM rides WHERE id = NEW.id;
  IF r.id IS NULL OR r.is_test OR r.status NOT IN ('completed','cancelled') THEN RETURN NULL; END IF;
  SELECT * INTO rider FROM profiles WHERE id = r.rider_id;
  IF r.driver_id IS NOT NULL THEN
    SELECT * INTO drv FROM profiles WHERE id = r.driver_id;
    SELECT vehicle INTO car FROM drivers WHERE user_id = r.driver_id;
    SELECT coalesce(jsonb_agg(jsonb_build_object('doc_type',d.doc_type,'document_number',d.document_number,'status',d.status) ORDER BY d.doc_type), '[]'::jsonb)
      INTO docs FROM driver_documents d
     WHERE d.user_id = r.driver_id AND d.status = 'approved' AND d.doc_type IN ('company','vtc_register');
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
    jsonb_build_object('pickup', r.pickup, 'dropoff', r.dropoff, 'route', jsonb_build_object('distanceMeters', r.route->'distanceMeters', 'durationSeconds', r.route->'durationSeconds'),
                       'vehicle', car, 'rating', r.rating, 'documents', coalesce(docs, '[]'::jsonb), 'waybillSealed', true),
    r.created_at + interval '3 years',
    (date_trunc('year', closed AT TIME ZONE 'Europe/Paris') + interval '11 years') AT TIME ZONE 'Europe/Paris')
  ON CONFLICT (ride_id) DO NOTHING;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.seal_ride_archive() FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS ride_archives_created_idx ON public.ride_archives (ride_created_at DESC, ride_id DESC);

-- Liste admin unifiée : courses actuelles + archives dont la course n'existe plus, sans doublon, ordre stable.
CREATE OR REPLACE FUNCTION public.admin_ride_index(_actor uuid, _from timestamptz, _to timestamptz, _status text, _limit integer, _offset integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE out jsonb; lim integer := least(greatest(coalesce(_limit, 15), 1), 100); off integer := greatest(coalesce(_offset, 0), 0);
BEGIN
  IF NOT has_role(_actor, 'admin') THEN RAISE EXCEPTION 'Accès administrateur requis'; END IF;
  WITH idx AS (
    SELECT r.id, r.created_at AS at, 'ride'::text AS source, (a.ride_id IS NOT NULL) AS archived
      FROM rides r LEFT JOIN ride_archives a ON a.ride_id = r.id
     WHERE (_from IS NULL OR r.created_at >= _from) AND (_to IS NULL OR r.created_at < _to)
       AND (_status IS NULL OR r.status = _status)
    UNION ALL
    SELECT a.ride_id, a.ride_created_at, 'archive', true
      FROM ride_archives a
     WHERE NOT EXISTS (SELECT 1 FROM rides r WHERE r.id = a.ride_id)
       AND (_from IS NULL OR a.ride_created_at >= _from) AND (_to IS NULL OR a.ride_created_at < _to)
       AND (_status IS NULL OR a.final_status = _status)
  ), page AS (
    SELECT * FROM idx ORDER BY at DESC, id DESC LIMIT lim OFFSET off
  )
  SELECT jsonb_build_object('total', (SELECT count(*) FROM idx),
    'rows', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'source', source, 'archived', archived) ORDER BY at DESC, id DESC) FROM page), '[]'::jsonb))
    INTO out;
  RETURN out;
END $$;
REVOKE ALL ON FUNCTION public.admin_ride_index(uuid, timestamptz, timestamptz, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ride_index(uuid, timestamptz, timestamptz, text, integer, integer) TO service_role;