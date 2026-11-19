ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_dispatch_phase_check;
ALTER TABLE public.rides ADD CONSTRAINT rides_dispatch_phase_check
  CHECK (dispatch_phase IS NULL OR dispatch_phase = ANY (ARRAY['private'::text, 'priority'::text, 'nearest'::text, 'broadcast'::text]));

ALTER TABLE public.card_bookings ADD COLUMN IF NOT EXISTS favorite_driver_id uuid;

CREATE OR REPLACE FUNCTION public.manage_favorite_driver(p_driver_id uuid, p_action text, p_confirm_replacement boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rider_id uuid := auth.uid();
  v_current uuid;
  v_notify uuid;
  v_text text;
BEGIN
  IF v_rider_id IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF p_action NOT IN ('set','remove') THEN RAISE EXCEPTION 'Action invalide'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('favorite:' || v_rider_id::text, 0));
  SELECT driver_id INTO v_current FROM rider_favorite_drivers WHERE rider_id = v_rider_id FOR UPDATE;

  IF p_action = 'remove' THEN
    IF v_current IS NULL THEN RETURN jsonb_build_object('ok', true, 'action', 'removed', 'notified', false); END IF;
    DELETE FROM rider_favorite_drivers WHERE rider_id = v_rider_id;
    v_notify := v_current;
    v_text := 'Un client vous a retiré de ses chauffeurs favoris.';
  ELSE
    IF p_driver_id IS NULL OR p_driver_id = v_rider_id THEN RAISE EXCEPTION 'Chauffeur invalide'; END IF;
    IF NOT EXISTS (SELECT 1 FROM drivers d JOIN user_roles ur ON ur.user_id = d.user_id AND ur.role = 'driver' WHERE d.user_id = p_driver_id) THEN
      RAISE EXCEPTION 'Le profil sélectionné n''est pas un chauffeur';
    END IF;
    IF v_current = p_driver_id THEN RETURN jsonb_build_object('ok', true, 'action', 'unchanged', 'driverId', p_driver_id); END IF;
    -- Consent proof: a completed real ride together, or a still-valid invitation scanned by this rider.
    IF NOT EXISTS (SELECT 1 FROM rides WHERE rider_id = v_rider_id AND driver_id = p_driver_id AND status = 'completed' AND is_test = false)
       AND NOT EXISTS (SELECT 1 FROM driver_invitation_claims WHERE rider_id = v_rider_id AND driver_id = p_driver_id AND claim_expires_at > now()) THEN
      RAISE EXCEPTION 'Vous pouvez choisir ce chauffeur après une course avec lui ou en scannant son QR code';
    END IF;
    IF v_current IS NOT NULL THEN
      IF p_confirm_replacement IS NOT TRUE THEN
        RETURN jsonb_build_object('ok', false, 'requiresConfirmation', true, 'previousDriverId', v_current);
      END IF;
      v_notify := v_current;
      v_text := 'Un client a choisi un autre chauffeur favori.';
    END IF;
    INSERT INTO rider_favorite_drivers (rider_id, driver_id, updated_at) VALUES (v_rider_id, p_driver_id, now())
    ON CONFLICT (rider_id) DO UPDATE SET driver_id = EXCLUDED.driver_id, updated_at = now();
  END IF;

  IF v_notify IS NOT NULL THEN
    INSERT INTO contact_messages (topic, name, email, message, status)
    SELECT 'driver_conversation', coalesce(nullif(p.name, ''), 'Chauffeur'), lower(coalesce(u.email, '')),
      format('{"format":"strasdrive_support_v1","userId":"%s","subject":"Clients privés","messages":[{"id":"%s","from":"admin","text":%s,"createdAt":"%s"}]}',
        v_notify, gen_random_uuid(), to_json(v_text)::text, to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      'open'
    FROM profiles p LEFT JOIN auth.users u ON u.id = p.id WHERE p.id = v_notify;
  END IF;

  RETURN jsonb_build_object('ok', true, 'action', CASE WHEN p_action = 'remove' THEN 'removed' ELSE 'saved' END,
    'driverId', CASE WHEN p_action = 'remove' THEN NULL ELSE p_driver_id END, 'notified', v_notify IS NOT NULL);
END;
$function$;

CREATE OR REPLACE FUNCTION public.purge_expired_personal_data()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  UPDATE ride_archives SET contacts = NULL, booking = NULL, personal_erased_at = now()
   WHERE personal_erased_at IS NULL AND NOT legal_hold AND personal_expires_at <= now();
  DELETE FROM ride_archive_access WHERE ride_id IN (SELECT ride_id FROM ride_archives WHERE NOT legal_hold AND accounting_expires_at <= now());
  DELETE FROM ride_archives WHERE NOT legal_hold AND accounting_expires_at <= now();
  DELETE FROM ride_archive_access WHERE created_at < now() - interval '10 years';

  DELETE FROM contact_messages WHERE created_at < now() - interval '3 years';

  UPDATE drivers SET location = NULL
   WHERE is_online = false AND location IS NOT NULL AND updated_at < now() - interval '24 hours';

  DELETE FROM road_alerts WHERE kind = 'police' AND last_confirmed_at < now() - interval '2 hours';

  -- Private-client invitations: QR codes one day after expiry, unused or finished claims two days after expiry.
  DELETE FROM driver_invitation_claims WHERE claim_expires_at < now() - interval '1 day';
  DELETE FROM driver_private_invitations WHERE expires_at < now() - interval '1 day'
    AND NOT EXISTS (SELECT 1 FROM driver_invitation_claims c WHERE c.invitation_id = driver_private_invitations.id);
END $function$;