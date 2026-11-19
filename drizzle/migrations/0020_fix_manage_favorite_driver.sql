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

  -- Sérialise tous les changements d'un même client, même quand aucune ligne n'existe encore.
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
    IF v_current IS NOT NULL THEN
      IF p_confirm_replacement IS NOT TRUE THEN
        RETURN jsonb_build_object('ok', false, 'requiresConfirmation', true);
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
      jsonb_build_object('format', 'strasdrive_support_v1', 'userId', v_notify, 'subject', 'Clients privés',
        'messages', jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'from', 'admin', 'text', v_text,
          'createdAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))))::text,
      'open'
    FROM profiles p LEFT JOIN auth.users u ON u.id = p.id WHERE p.id = v_notify;
  END IF;

  RETURN jsonb_build_object('ok', true, 'action', CASE WHEN p_action = 'remove' THEN 'removed' ELSE 'saved' END,
    'driverId', CASE WHEN p_action = 'remove' THEN NULL ELSE p_driver_id END, 'notified', v_notify IS NOT NULL);
END;
$function$;

REVOKE ALL ON FUNCTION public.manage_favorite_driver(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_favorite_driver(uuid, text, boolean) TO authenticated, service_role;