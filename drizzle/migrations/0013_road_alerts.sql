CREATE TABLE public.road_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('police','radar')),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  reported_by uuid NOT NULL,
  confirmations integer NOT NULL DEFAULT 1,
  denials integer NOT NULL DEFAULT 0,
  is_permanent boolean NOT NULL DEFAULT false,
  validated_by_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_confirmed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.road_alerts TO service_role;
ALTER TABLE public.road_alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX road_alerts_geo_idx ON public.road_alerts (lat, lng);

CREATE TABLE public.road_alert_votes (
  alert_id uuid NOT NULL REFERENCES public.road_alerts(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL,
  present boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alert_id, driver_id)
);
GRANT ALL ON public.road_alert_votes TO service_role;
ALTER TABLE public.road_alert_votes ENABLE ROW LEVEL SECURITY;