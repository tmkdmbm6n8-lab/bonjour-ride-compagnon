ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS vehicle_class text NOT NULL DEFAULT 'economy';
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS accepts_classes text[] NOT NULL DEFAULT '{}';
UPDATE public.drivers SET vehicle_class = vehicle->>'type' WHERE vehicle->>'type' IN ('economy','comfort','premium','xl');
ALTER TABLE public.drivers ADD CONSTRAINT drivers_vehicle_class_check CHECK (vehicle_class IN ('economy','comfort','premium','xl'));
ALTER TABLE public.drivers ADD CONSTRAINT drivers_accepts_classes_check CHECK (accepts_classes <@ ARRAY['economy','comfort']::text[]);
COMMENT ON COLUMN public.drivers.vehicle_class IS 'Set by admins only: the service class the driver is approved for. Replaces vehicle->>type for dispatch.';
COMMENT ON COLUMN public.drivers.accepts_classes IS 'Lower classes the driver opted into (written by the server, validated against vehicle_class); rides of those classes pay that class fare.';