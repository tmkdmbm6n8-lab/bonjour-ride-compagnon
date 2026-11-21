-- ARPE: registre de compléments horaires validés, sans activation de paiement automatique.
-- Appliquer dans Supabase après revue du schéma et test en environnement de préproduction.
CREATE TABLE IF NOT EXISTS public.arpe_hourly_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.profiles(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  provider_id text GENERATED ALWAYS AS ('arpe-hourly:' || driver_id::text || ':' || period_start::text || ':' || period_end::text) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  CHECK (period_end > period_start),
  UNIQUE (driver_id, period_start, period_end),
  UNIQUE (provider_id)
);
ALTER TABLE public.arpe_hourly_adjustments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.arpe_hourly_adjustments FROM PUBLIC, anon, authenticated;
-- La fonction exige une validation préalable du montant et un appel backend service_role.
CREATE OR REPLACE FUNCTION public.pay_approved_arpe_adjustment(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.arpe_hourly_adjustments%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Accès interdit';
  END IF;
  SELECT * INTO a FROM public.arpe_hourly_adjustments WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Régularisation introuvable'; END IF;
  IF a.status = 'paid' THEN RETURN jsonb_build_object('ok',true,'alreadyPaid',true); END IF;
  -- Le verrou de ligne sérialise les demandes concurrentes pour cette période.
  -- wallet_entry écrit solde et transaction dans la même transaction PostgreSQL.
  PERFORM public.wallet_entry(a.driver_id, a.amount, 'arpe_hourly_adjustment', NULL::uuid, a.provider_id);
  UPDATE public.arpe_hourly_adjustments SET status='paid',paid_at=now() WHERE id=a.id;
  RETURN jsonb_build_object('ok',true,'alreadyPaid',false,'amount',a.amount);
END $$;
REVOKE ALL ON FUNCTION public.pay_approved_arpe_adjustment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_approved_arpe_adjustment(uuid) TO service_role;
-- Ne pas programmer de cron tant que les calculs, les périodes et les versements
-- n'ont pas été validés sur les données réelles.