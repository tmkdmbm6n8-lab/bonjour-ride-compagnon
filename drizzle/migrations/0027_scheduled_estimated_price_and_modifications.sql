-- Run this migration in Supabase SQL Editor before deploying the updated reservation endpoints.
alter table public.rider_scheduled_requests
  add column if not exists estimated_price numeric(10,2)
  check (estimated_price >= 0);

alter table public.rider_scheduled_requests
  drop constraint if exists rider_scheduled_requests_status_check;
alter table public.rider_scheduled_requests
  add constraint rider_scheduled_requests_status_check
  check (status in ('pending','confirmed','modified_pending','canceled'));

notify pgrst, 'reload schema';
