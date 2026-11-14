CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('weekly','early')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  fee numeric(14,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
  week_of date,
  provider_id text,
  failure text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE UNIQUE INDEX payouts_weekly_once ON public.payouts(driver_id, week_of) WHERE kind = 'weekly';
CREATE INDEX payouts_driver_created ON public.payouts(driver_id, created_at DESC);
GRANT SELECT ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY payouts_read ON public.payouts FOR SELECT TO authenticated USING (driver_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Debits the driver's wallet and records a payout atomically. Weekly payouts are once per driver per Paris Monday.
CREATE OR REPLACE FUNCTION public.create_payout(_driver uuid, _kind text, _amount numeric, _fee numeric, _week date DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b numeric; pid uuid;
BEGIN
  IF _kind NOT IN ('weekly','early') OR _amount <= 0 OR _fee < 0 THEN RAISE EXCEPTION 'Versement invalide'; END IF;
  SELECT balance INTO b FROM profiles WHERE id = _driver FOR UPDATE;
  IF b IS NULL THEN RAISE EXCEPTION 'Compte introuvable'; END IF;
  IF _kind = 'weekly' AND EXISTS (SELECT 1 FROM payouts WHERE driver_id = _driver AND kind = 'weekly' AND week_of = _week) THEN RETURN NULL; END IF;
  IF b < _amount + _fee THEN RAISE EXCEPTION 'Solde insuffisant pour ce versement'; END IF;
  INSERT INTO payouts(driver_id, kind, amount, fee, week_of) VALUES (_driver, _kind, _amount, _fee, _week) RETURNING id INTO pid;
  PERFORM wallet_entry(_driver, -_amount, 'payout', NULL, 'payout:' || pid);
  IF _fee > 0 THEN PERFORM wallet_entry(_driver, -_fee, 'payout_fee', NULL, 'payout-fee:' || pid); END IF;
  RETURN pid;
END $$;
REVOKE ALL ON FUNCTION public.create_payout(uuid,text,numeric,numeric,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_payout(uuid,text,numeric,numeric,date) TO service_role;

-- Marks a pending payout as paid, or failed (the amount and fee go back to the wallet).
CREATE OR REPLACE FUNCTION public.finish_payout(_id uuid, _ok boolean, _provider text DEFAULT NULL, _failure text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE po payouts;
BEGIN
  SELECT * INTO po FROM payouts WHERE id = _id FOR UPDATE;
  IF po.id IS NULL OR po.status <> 'pending' THEN RETURN; END IF;
  IF _ok THEN
    UPDATE payouts SET status = 'paid', provider_id = _provider, paid_at = now() WHERE id = _id;
  ELSE
    UPDATE payouts SET status = 'failed', failure = left(coalesce(_failure,''), 500) WHERE id = _id;
    PERFORM wallet_entry(po.driver_id, po.amount + po.fee, 'payout_reversal', NULL, 'payout-reversal:' || po.id);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.finish_payout(uuid,boolean,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_payout(uuid,boolean,text,text) TO service_role;