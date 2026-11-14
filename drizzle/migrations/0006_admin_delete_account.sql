CREATE OR REPLACE FUNCTION public.admin_delete_account(_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _email text;
  _rides int;
  _tx int;
  _docs int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = _user) THEN
    RAISE EXCEPTION 'Compte introuvable';
  END IF;
  IF EXISTS (SELECT 1 FROM rides WHERE (rider_id = _user OR driver_id = _user) AND status IN ('accepted','arrived','in_progress') AND NOT is_test) THEN
    RAISE EXCEPTION 'Ce compte a une course en cours : attendez la fin de la course avant de le supprimer';
  END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _user;

  -- Other people keep their own payment lines; only the link to the deleted rides is removed.
  UPDATE wallet_transactions SET ride_id = NULL
   WHERE user_id <> _user AND ride_id IN (SELECT id FROM rides WHERE rider_id = _user OR driver_id = _user);
  DELETE FROM wallet_transactions WHERE user_id = _user;
  GET DIAGNOSTICS _tx = ROW_COUNT;

  UPDATE rides SET offer_driver_id = NULL, offer_expires_at = NULL WHERE offer_driver_id = _user;
  DELETE FROM rides WHERE rider_id = _user OR driver_id = _user;
  GET DIAGNOSTICS _rides = ROW_COUNT;

  DELETE FROM driver_documents WHERE user_id = _user;
  GET DIAGNOSTICS _docs = ROW_COUNT;
  DELETE FROM drivers WHERE user_id = _user;
  DELETE FROM imported_identities WHERE mapped_user_id = _user;
  IF _email IS NOT NULL THEN
    DELETE FROM contact_messages WHERE lower(email) = lower(_email);
  END IF;
  DELETE FROM user_roles WHERE user_id = _user;
  DELETE FROM profiles WHERE id = _user;

  RETURN jsonb_build_object('rides', _rides, 'transactions', _tx, 'documents', _docs);
END $$;

REVOKE ALL ON FUNCTION public.admin_delete_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_account(uuid) TO service_role;