ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
DROP INDEX IF EXISTS public.one_active_rider;
CREATE UNIQUE INDEX one_active_rider ON public.rides USING btree (rider_id) WHERE (status = ANY (ARRAY['searching'::text, 'accepted'::text, 'arrived'::text, 'in_progress'::text]) AND NOT is_test);