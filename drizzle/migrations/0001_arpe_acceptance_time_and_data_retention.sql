ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

CREATE OR REPLACE FUNCTION public.purge_expired_personal_data() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Messages échangés pendant la course : effacés 1 an après la course.
  UPDATE rides SET messages = '[]'::jsonb
   WHERE messages <> '[]'::jsonb AND created_at < now() - interval '1 year';

  -- Adresses précises et tracé : anonymisés 3 ans après la course (position arrondie à ~1 km).
  UPDATE rides SET
    pickup = jsonb_build_object('address','Adresse supprimée','lat',round((pickup->>'lat')::numeric,2),'lng',round((pickup->>'lng')::numeric,2),'anonymized',true),
    dropoff = jsonb_build_object('address','Adresse supprimée','lat',round((dropoff->>'lat')::numeric,2),'lng',round((dropoff->>'lng')::numeric,2),'anonymized',true),
    route = jsonb_build_object('distanceMeters',route->'distanceMeters','durationSeconds',route->'durationSeconds','geometry',
      jsonb_build_array(jsonb_build_array(round((pickup->>'lng')::numeric,2),round((pickup->>'lat')::numeric,2)),
                        jsonb_build_array(round((dropoff->>'lng')::numeric,2),round((dropoff->>'lat')::numeric,2)))),
    pin = ''
   WHERE created_at < now() - interval '3 years' AND NOT (pickup ? 'anonymized');

  -- Courses et opérations du portefeuille : supprimées après 10 ans (obligation comptable).
  DELETE FROM wallet_transactions WHERE created_at < now() - interval '10 years';
  DELETE FROM wallet_transactions WHERE ride_id IN (SELECT id FROM rides WHERE created_at < now() - interval '10 years');
  DELETE FROM rides WHERE created_at < now() - interval '10 years';

  -- Demandes envoyées via le formulaire de contact : supprimées 3 ans après leur envoi.
  DELETE FROM contact_messages WHERE created_at < now() - interval '3 years';

  -- Dernière position d'un chauffeur hors ligne : effacée après 24 h.
  UPDATE drivers SET location = NULL
   WHERE is_online = false AND location IS NOT NULL AND updated_at < now() - interval '24 hours';
END $$;

REVOKE ALL ON FUNCTION public.purge_expired_personal_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_personal_data() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('purge-donnees-personnelles', '15 3 * * *', 'SELECT public.purge_expired_personal_data()');