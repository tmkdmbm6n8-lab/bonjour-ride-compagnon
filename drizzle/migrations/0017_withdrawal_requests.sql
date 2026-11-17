CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.profiles(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  fee numeric(12,2) NOT NULL CHECK (fee >= 0),
  debit numeric(12,2) NOT NULL CHECK (debit >= 10 AND debit = amount + fee),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','rejected','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  payout_id uuid UNIQUE REFERENCES public.payouts(id),
  notification_push_sent boolean NOT NULL DEFAULT false,
  notification_email_sent boolean NOT NULL DEFAULT false,
  notify_attempts integer NOT NULL DEFAULT 0,
  notify_next_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX withdrawal_requests_one_active ON public.withdrawal_requests(driver_id) WHERE status IN ('pending','processing');
CREATE INDEX withdrawal_requests_created ON public.withdrawal_requests(created_at DESC);

GRANT SELECT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY withdrawal_requests_read ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (driver_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.withdrawal_json(w public.withdrawal_requests)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object('id',w.id,'driver_id',w.driver_id,'driver_name',(SELECT name FROM profiles WHERE id=w.driver_id),
    'amount',w.amount,'fee',w.fee,'debit',w.debit,'status',w.status,'created_at',w.created_at,
    'reviewed_at',w.reviewed_at,'payout_id',w.payout_id,
    'notification_push_sent',w.notification_push_sent,'notification_email_sent',w.notification_email_sent)
$$;

CREATE OR REPLACE FUNCTION public.withdrawal_request_state(_driver uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object('version',1,'requests',coalesce(jsonb_agg(j ORDER BY active DESC, created_at DESC),'[]'::jsonb))
  FROM (SELECT withdrawal_json(w) j, w.status IN ('pending','processing') active, w.created_at
        FROM withdrawal_requests w WHERE _driver IS NULL OR w.driver_id=_driver
        ORDER BY (w.status IN ('pending','processing')) DESC, w.created_at DESC LIMIT 100) s
$$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(_driver uuid, _debit numeric, _fee numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE b numeric; w withdrawal_requests;
BEGIN
  IF NOT has_role(_driver,'driver') THEN RAISE EXCEPTION 'Réservé aux chauffeurs'; END IF;
  IF _debit IS NULL OR _fee IS NULL OR _debit <> round(_debit,2) OR _fee <> 0.50 OR _debit < 10 OR _debit <= _fee THEN
    RAISE EXCEPTION 'Montant de retrait invalide'; END IF;
  SELECT balance INTO b FROM profiles WHERE id=_driver FOR UPDATE;
  IF b IS NULL THEN RAISE EXCEPTION 'Compte introuvable'; END IF;
  SELECT * INTO w FROM withdrawal_requests WHERE driver_id=_driver AND status IN ('pending','processing');
  IF w.id IS NOT NULL THEN
    IF w.status='pending' AND w.debit=_debit AND w.fee=_fee THEN RETURN withdrawal_json(w); END IF;
    RAISE EXCEPTION 'Une demande de retrait est déjà en cours';
  END IF;
  IF b < _debit THEN RAISE EXCEPTION 'Le montant dépasse votre solde disponible.'; END IF;
  IF coalesce((SELECT payout->>'stripeAccountId' FROM drivers WHERE user_id=_driver),'')='' THEN
    RAISE EXCEPTION 'Configurez vos coordonnées bancaires avant de demander un retrait.'; END IF;
  INSERT INTO withdrawal_requests(driver_id,amount,fee,debit) VALUES(_driver,_debit-_fee,_fee,_debit) RETURNING * INTO w;
  RETURN withdrawal_json(w);
END $$;

CREATE OR REPLACE FUNCTION public.approve_withdrawal(_request uuid, _actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w withdrawal_requests; drv uuid; b numeric; pid uuid;
BEGIN
  IF NOT has_role(_actor,'admin') THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  SELECT driver_id INTO drv FROM withdrawal_requests WHERE id=_request;
  IF drv IS NULL THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  SELECT balance INTO b FROM profiles WHERE id=drv FOR UPDATE;
  SELECT * INTO w FROM withdrawal_requests WHERE id=_request FOR UPDATE;
  IF w.status IN ('processing','paid') THEN
    RETURN jsonb_build_object('id',w.id,'driver_id',w.driver_id,'status',w.status,'payout_id',w.payout_id,'amount',w.amount,'fee',w.fee,'debit',w.debit);
  END IF;
  IF w.status <> 'pending' THEN RAISE EXCEPTION 'Demande déjà traitée'; END IF;
  IF b < w.debit THEN RAISE EXCEPTION 'Solde du chauffeur insuffisant : demande laissée en attente'; END IF;
  pid := create_payout(w.driver_id,'early',w.amount,w.fee,NULL);
  UPDATE withdrawal_requests SET status='processing',payout_id=pid,reviewed_by=_actor,reviewed_at=now() WHERE id=w.id RETURNING * INTO w;
  RETURN jsonb_build_object('id',w.id,'driver_id',w.driver_id,'status',w.status,'payout_id',w.payout_id,'amount',w.amount,'fee',w.fee,'debit',w.debit);
END $$;

CREATE OR REPLACE FUNCTION public.reject_withdrawal(_request uuid, _actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w withdrawal_requests;
BEGIN
  IF NOT has_role(_actor,'admin') THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  SELECT * INTO w FROM withdrawal_requests WHERE id=_request FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF w.status='rejected' THEN RETURN withdrawal_json(w); END IF;
  IF w.status <> 'pending' THEN RAISE EXCEPTION 'Seule une demande en attente peut être refusée'; END IF;
  UPDATE withdrawal_requests SET status='rejected',reviewed_by=_actor,reviewed_at=now() WHERE id=w.id RETURNING * INTO w;
  RETURN withdrawal_json(w);
END $$;

CREATE OR REPLACE FUNCTION public.finish_withdrawal_request(_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w withdrawal_requests; ps text;
BEGIN
  SELECT * INTO w FROM withdrawal_requests WHERE id=_request FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF w.status='processing' AND w.payout_id IS NOT NULL THEN
    SELECT status INTO ps FROM payouts WHERE id=w.payout_id;
    IF ps IN ('paid','failed') THEN
      UPDATE withdrawal_requests SET status=ps WHERE id=w.id RETURNING * INTO w;
    END IF;
  END IF;
  RETURN withdrawal_json(w);
END $$;

CREATE OR REPLACE FUNCTION public.record_withdrawal_notifications(_request uuid, _push_ok boolean, _email_ok boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE withdrawal_requests SET notification_push_sent = notification_push_sent OR coalesce(_push_ok,false),
    notification_email_sent = notification_email_sent OR coalesce(_email_ok,false) WHERE id=_request;
$$;

-- Lease + backoff: each claimed row is pushed forward, so two workers never take it together; stops after 12 attempts.
CREATE OR REPLACE FUNCTION public.pending_withdrawal_notifications(_limit integer)
RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id FROM withdrawal_requests
    WHERE status='pending' AND NOT notification_push_sent AND notify_attempts < 12 AND notify_next_at <= now()
    ORDER BY created_at LIMIT least(greatest(coalesce(_limit,25),1),25) FOR UPDATE SKIP LOCKED),
  upd AS (
    UPDATE withdrawal_requests w SET notify_attempts=w.notify_attempts+1,
      notify_next_at=now() + make_interval(secs => least(3600, 60 * power(2, w.notify_attempts)))
    FROM picked WHERE w.id=picked.id RETURNING w.*)
  SELECT withdrawal_json(upd::withdrawal_requests) FROM upd;
END $$;

CREATE OR REPLACE FUNCTION public.create_payout(_driver uuid, _kind text, _amount numeric, _fee numeric, _week date DEFAULT NULL::date)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE b numeric; pid uuid;
BEGIN
  IF _kind NOT IN ('weekly','early') OR _amount <= 0 OR _fee < 0 THEN RAISE EXCEPTION 'Versement invalide'; END IF;
  SELECT balance INTO b FROM profiles WHERE id = _driver FOR UPDATE;
  IF b IS NULL THEN RAISE EXCEPTION 'Compte introuvable'; END IF;
  IF _kind = 'weekly' AND EXISTS (SELECT 1 FROM payouts WHERE driver_id = _driver AND kind = 'weekly' AND week_of = _week) THEN RETURN NULL; END IF;
  -- A driver with an active withdrawal request is skipped by the weekly payout (checked under the same profile lock).
  IF _kind = 'weekly' AND EXISTS (SELECT 1 FROM withdrawal_requests WHERE driver_id = _driver AND status IN ('pending','processing')) THEN RETURN NULL; END IF;
  IF b < _amount + _fee THEN RAISE EXCEPTION 'Solde insuffisant pour ce versement'; END IF;
  INSERT INTO payouts(driver_id, kind, amount, fee, week_of) VALUES (_driver, _kind, _amount, _fee, _week) RETURNING id INTO pid;
  PERFORM wallet_entry(_driver, -_amount, 'payout', NULL, 'payout:' || pid);
  IF _fee > 0 THEN PERFORM wallet_entry(_driver, -_fee, 'payout_fee', NULL, 'payout-fee:' || pid); END IF;
  RETURN pid;
END $function$;

REVOKE ALL ON FUNCTION public.withdrawal_json(public.withdrawal_requests), public.withdrawal_request_state(uuid),
  public.request_withdrawal(uuid,numeric,numeric), public.approve_withdrawal(uuid,uuid), public.reject_withdrawal(uuid,uuid),
  public.finish_withdrawal_request(uuid), public.record_withdrawal_notifications(uuid,boolean,boolean),
  public.pending_withdrawal_notifications(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_json(public.withdrawal_requests), public.withdrawal_request_state(uuid),
  public.request_withdrawal(uuid,numeric,numeric), public.approve_withdrawal(uuid,uuid), public.reject_withdrawal(uuid,uuid),
  public.finish_withdrawal_request(uuid), public.record_withdrawal_notifications(uuid,boolean,boolean),
  public.pending_withdrawal_notifications(integer) TO service_role;