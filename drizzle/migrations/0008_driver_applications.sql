-- Run in Supabase SQL Editor before deploying the driver application workflow.
create table if not exists public.driver_applications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);
create index if not exists driver_applications_status_idx on public.driver_applications(status,created_at desc);
alter table public.driver_applications enable row level security;
revoke all on public.driver_applications from anon, authenticated;
grant all on public.driver_applications to service_role;

-- Atomic approval: keep the user's passenger account, add a driver role, and
-- create an unapproved driver profile for the existing vehicle/document workflow.
-- Never mark is_approved=true here: documents must be verified separately.
create or replace function public.accept_driver_application(p_user_id uuid, p_admin_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required';
  end if;
  if not exists (select 1 from public.user_roles where user_id=p_admin_id and role='admin') then
    raise exception 'Administrator required';
  end if;
  if not exists (select 1 from public.driver_applications where user_id=p_user_id and status='pending') then
    raise exception 'Candidature introuvable ou déjà traitée';
  end if;
  insert into public.drivers (user_id, is_approved, is_online)
  values (p_user_id, false, false)
  on conflict (user_id) do nothing;
  insert into public.user_roles (user_id, role)
  values (p_user_id, 'driver')
  on conflict (user_id, role) do nothing;
  update public.driver_applications
  set status='accepted', reviewed_at=now(), reviewed_by=p_admin_id
  where user_id=p_user_id and status='pending';
end $$;
revoke all on function public.accept_driver_application(uuid,uuid) from public, anon, authenticated;
grant execute on function public.accept_driver_application(uuid,uuid) to service_role;
