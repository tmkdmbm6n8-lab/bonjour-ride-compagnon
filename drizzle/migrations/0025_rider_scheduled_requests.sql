-- Passenger transport and recurring ride requests. No booking or automatic charge is made by inserting a request.
create table if not exists public.rider_scheduled_requests (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('transport','recurring')),
  pickup_address text not null,
  dropoff_address text not null,
  transport_type text check (transport_type in ('flight','train')),
  transport_number text,
  scheduled_at timestamptz,
  weekday smallint check (weekday between 0 and 6),
  local_time time,
  timezone text not null default 'Europe/Paris',
  favorite_driver_id uuid references auth.users(id) on delete set null,
  adjustment_consent boolean not null default false,
  status text not null default 'pending' check (status in ('pending','confirmed','canceled')),
  created_at timestamptz not null default now(),
  constraint scheduled_request_kind check (
    (kind='transport' and transport_type is not null and transport_number is not null and scheduled_at is not null and weekday is null and local_time is null)
    or
    (kind='recurring' and weekday is not null and local_time is not null and transport_type is null and transport_number is null and scheduled_at is null)
  )
);
create index if not exists rider_scheduled_requests_owner_idx on public.rider_scheduled_requests (rider_id,created_at desc);
alter table public.rider_scheduled_requests enable row level security;
create policy "scheduled_requests_select_own" on public.rider_scheduled_requests for select to authenticated using (rider_id=auth.uid());
create policy "scheduled_requests_insert_own" on public.rider_scheduled_requests for insert to authenticated with check (rider_id=auth.uid());
create policy "scheduled_requests_update_own" on public.rider_scheduled_requests for update to authenticated using (rider_id=auth.uid()) with check (rider_id=auth.uid());
