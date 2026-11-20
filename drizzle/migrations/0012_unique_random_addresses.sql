-- Run once in Supabase SQL Editor before enabling numbered-address random sampling.
-- Each random address can appear only once, regardless of pickup/dropoff role.
create table if not exists public.uber_random_used_addresses (
  address_key text primary key,
  address_name text not null,
  latitude double precision not null,
  longitude double precision not null,
  claimed_at timestamptz not null default now()
);
alter table public.uber_random_used_addresses enable row level security;
revoke all on public.uber_random_used_addresses from anon, authenticated;
create or replace function public.claim_uber_random_addresses(
  p_pickup_key text, p_dropoff_key text,
  p_pickup_name text, p_dropoff_name text,
  p_pickup_lat double precision, p_pickup_lng double precision,
  p_dropoff_lat double precision, p_dropoff_lng double precision
) returns boolean language plpgsql security definer
set search_path = public
as $$
begin
  if p_pickup_key is null or p_dropoff_key is null or p_pickup_key=p_dropoff_key then return false; end if;
  -- Exclude addresses already present in the fixed hourly cohort.
  if to_regclass('public.uber_benchmark_routes') is not null then
    if exists (
      select 1 from public.uber_benchmark_routes b
      where (abs(b.pickup_lat-p_pickup_lat)<0.00001 and abs(b.pickup_lng-p_pickup_lng)<0.00001)
         or (abs(b.dropoff_lat-p_pickup_lat)<0.00001 and abs(b.dropoff_lng-p_pickup_lng)<0.00001)
         or (abs(b.pickup_lat-p_dropoff_lat)<0.00001 and abs(b.pickup_lng-p_dropoff_lng)<0.00001)
         or (abs(b.dropoff_lat-p_dropoff_lat)<0.00001 and abs(b.dropoff_lng-p_dropoff_lng)<0.00001)
    ) then return false; end if;
  end if;
  -- An exception block rolls back BOTH inserts on conflict, including races.
  begin
    insert into public.uber_random_used_addresses(address_key,address_name,latitude,longitude)
    values(p_pickup_key,p_pickup_name,p_pickup_lat,p_pickup_lng);
    insert into public.uber_random_used_addresses(address_key,address_name,latitude,longitude)
    values(p_dropoff_key,p_dropoff_name,p_dropoff_lat,p_dropoff_lng);
  exception when unique_violation then
    return false;
  end;
  return true;
end $$;
revoke all on function public.claim_uber_random_addresses(text,text,text,text,double precision,double precision,double precision,double precision) from public, anon, authenticated;
grant execute on function public.claim_uber_random_addresses(text,text,text,text,double precision,double precision,double precision,double precision) to service_role;
