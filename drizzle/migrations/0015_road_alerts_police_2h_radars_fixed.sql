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

  DELETE FROM contact_messages WHERE created_at < now() - interval '3 years';

  UPDATE drivers SET location = NULL
   WHERE is_online = false AND location IS NOT NULL AND updated_at < now() - interval '24 hours';

  -- Contrôles de police : effacés 2 h après le dernier signalement. Les radars restent jusqu'à suppression par l'admin.
  DELETE FROM road_alerts WHERE kind = 'police' AND last_confirmed_at < now() - interval '2 hours';
END $function$;