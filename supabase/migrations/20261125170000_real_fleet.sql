-- Every fleet operation runs as one transaction. No direct client table access.
create table public.sd_fleets (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 owner_id uuid not null unique references auth.users on delete cascade
);
create table public.sd_fleet_drivers (
 driver_id uuid primary key references auth.users on delete cascade,
 fleet_id uuid not null references public.sd_fleets on delete cascade,
 accepted boolean not null default false,
 previous_vehicle jsonb,
 unique(fleet_id,driver_id)
);
create table public.sd_fleet_vehicles (
 id uuid primary key default gen_random_uuid(),
 fleet_id uuid not null references public.sd_fleets on delete cascade,
 model text not null, plate text unique not null,
 driver_id uuid unique,
 foreign key(fleet_id,driver_id) references public.sd_fleet_drivers(fleet_id,driver_id)
);
alter table public.sd_fleets enable row level security;
alter table public.sd_fleet_drivers enable row level security;
alter table public.sd_fleet_vehicles enable row level security;
revoke all on public.sd_fleets, public.sd_fleet_drivers, public.sd_fleet_vehicles from anon, authenticated;

create table public.sd_fleet_trips (
 ride_id uuid primary key references public.rides on delete cascade,
 fleet_id uuid not null references public.sd_fleets on delete cascade
);
alter table public.sd_fleet_trips enable row level security;
revoke all on public.sd_fleet_trips from anon, authenticated;
create function public.sd_attribute_fleet_trip() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
   if old.driver_id is not distinct from new.driver_id then return new; end if;
 end if;
 delete from public.sd_fleet_trips where ride_id=new.id;
 insert into public.sd_fleet_trips(ride_id,fleet_id)
 select new.id,fleet_id from public.sd_fleet_vehicles where driver_id=new.driver_id and not coalesce(new.is_test,false);
 return new;
end $$;
revoke all on function public.sd_attribute_fleet_trip() from public,anon,authenticated;
create trigger sd_attribute_fleet_trip after insert or update of driver_id on public.rides
for each row execute function public.sd_attribute_fleet_trip();

create function public.sd_fleet(action text default 'view', payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 me uuid := auth.uid();
 fleet uuid;
 target uuid;
 manager boolean;
 member public.sd_fleet_drivers%rowtype;
begin
 if me is null then raise exception 'Connexion requise'; end if;
 if action='activate' then
   if not exists(select 1 from public.user_roles where user_id=me and role='admin') then raise exception 'Accès administrateur requis'; end if;
   select id into target from auth.users where lower(email)=lower(trim(payload->>'email')) and email_confirmed_at is not null;
   if target is null then raise exception 'Le gérant doit avoir un compte avec un e-mail confirmé'; end if;
   if coalesce(length(trim(payload->>'name')),0) not between 2 and 150 then raise exception 'Nom de société invalide'; end if;
   perform pg_advisory_xact_lock(hashtextextended(target::text,0));
   if exists(select 1 from public.sd_fleet_drivers where driver_id=target) then raise exception 'Ce compte est déjà rattaché'; end if;
   insert into public.sd_fleets(name,owner_id) values(trim(payload->>'name'),target);
   return jsonb_build_object('ok',true);
 end if;
 select id into fleet from public.sd_fleets where owner_id=me;
 manager := fleet is not null;
 if action='owner' then return to_jsonb(manager); end if;
 if not manager then
   select * into member from public.sd_fleet_drivers where driver_id=me for update;
   if member.driver_id is null then return jsonb_build_object('role','none'); end if;
   if not exists(select 1 from public.user_roles where user_id=me and role='driver') then raise exception 'Accès chauffeur requis'; end if;
   fleet := member.fleet_id;
   if not member.accepted then
     if action='accept' then update public.sd_fleet_drivers set accepted=true where driver_id=me;
     elsif action='decline' then delete from public.sd_fleet_drivers where driver_id=me; return jsonb_build_object('role','none');
     else return jsonb_build_object('role','invited','name',(select name from public.sd_fleets where id=fleet)); end if;
   end if;
 end if;
 if action='invite' and manager then
   select u.id into target from auth.users u join public.user_roles r on r.user_id=u.id and r.role='driver'
     where lower(u.email)=lower(trim(payload->>'email')) and u.email_confirmed_at is not null;
   if target is null then raise exception 'Aucun compte chauffeur confirmé pour cet e-mail'; end if;
   perform pg_advisory_xact_lock(hashtextextended(target::text,0));
   if exists(select 1 from public.sd_fleets where owner_id=target) then raise exception 'Ce compte gère déjà une flotte'; end if;
   insert into public.sd_fleet_drivers(driver_id,fleet_id) values(target,fleet);
 elsif action='vehicle' and manager then
   if coalesce(length(trim(payload->>'model')),0) not between 1 and 100 or coalesce(regexp_replace(upper(payload->>'plate'),'[ -]','','g'),'') !~ '^[A-Z0-9]{2,15}$' then raise exception 'Véhicule ou plaque invalide'; end if;
   insert into public.sd_fleet_vehicles(fleet_id,model,plate) values(fleet,trim(payload->>'model'),regexp_replace(upper(payload->>'plate'),'[ -]','','g'));
 elsif action='remove' and manager then
   target := (payload->>'driver')::uuid;
   perform 1 from public.sd_fleet_drivers where driver_id=target and fleet_id=fleet for update;
   update public.sd_fleet_vehicles set driver_id=null where driver_id=target and fleet_id=fleet;
   delete from public.sd_fleet_drivers where driver_id=target and fleet_id=fleet;
 elsif action='claim' and not manager then
   update public.sd_fleet_vehicles set driver_id=me where id=(payload->>'id')::uuid and fleet_id=fleet and driver_id is null;
   if not found then raise exception 'Ce véhicule est déjà pris ou indisponible'; end if;
 elsif action='release' then
   update public.sd_fleet_vehicles set driver_id=null where id=(payload->>'id')::uuid and fleet_id=fleet and driver_id=(payload->>'driver')::uuid and (manager or driver_id=me);
   if not found then raise exception 'Cette affectation a changé'; end if;
 elsif action not in ('view','accept') then raise exception 'Action non autorisée';
 end if;
 return jsonb_build_object('role',case when manager then 'manager' else 'driver' end,'me',me,
 'name',(select name from public.sd_fleets where id=fleet),
 'today',case when manager then (select jsonb_build_object('count',count(*),'gross',coalesce(sum((r.fare->>'total')::numeric),0),'net',coalesce(sum((r.fare->>'driverEarnings')::numeric),0)) from public.sd_fleet_trips ft join public.rides r on r.id=ft.ride_id where ft.fleet_id=fleet and r.status='completed' and timezone('Europe/Paris',r.completed_at)::date=timezone('Europe/Paris',now())::date) end,
 'drivers',(select coalesce(jsonb_agg(jsonb_build_object('id',d.driver_id,'name',coalesce(p.name,'Chauffeur'),'accepted',d.accepted,'online',d.accepted and coalesce(dr.is_online,false),'location',case when d.accepted and dr.is_online then dr.location end) order by p.name),'[]') from public.sd_fleet_drivers d left join public.profiles p on p.id=d.driver_id left join public.drivers dr on dr.user_id=d.driver_id where d.fleet_id=fleet and (manager or d.driver_id=me)),
 'vehicles',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'model',v.model,'plate',v.plate,'taken',v.driver_id is not null,'driver',case when manager or v.driver_id=me then v.driver_id end) order by v.model,v.plate),'[]') from public.sd_fleet_vehicles v where v.fleet_id=fleet));
exception when unique_violation then raise exception 'Ce véhicule, chauffeur ou gérant est déjà affecté.';
end $$;
revoke all on function public.sd_fleet(text,jsonb) from public, anon;
grant execute on function public.sd_fleet(text,jsonb) to authenticated;

-- Reflect the active assignment in the vehicle already used by the ride screens.
create function public.sd_sync_fleet_vehicle() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous jsonb;
begin
 if old.driver_id is not distinct from new.driver_id then return new; end if;
 if old.driver_id is not null then
   select previous_vehicle into previous from public.sd_fleet_drivers where driver_id=old.driver_id for update;
   update public.drivers set vehicle=(coalesce(vehicle,'{}') - 'model' - 'make' - 'plate' - 'color') || coalesce(previous,'{}')
   where user_id=old.driver_id;
   update public.sd_fleet_drivers set previous_vehicle=null where driver_id=old.driver_id;
 end if;
 if new.driver_id is not null then
   select vehicle into previous from public.drivers where user_id=new.driver_id for update;
   if not found then raise exception 'Profil chauffeur introuvable'; end if;
   update public.sd_fleet_drivers set previous_vehicle=(select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(coalesce(previous,'{}')) where key in ('model','make','plate','color')) where driver_id=new.driver_id;
   update public.drivers set vehicle=(coalesce(vehicle,'{}') - 'make' - 'color') || jsonb_build_object('model',new.model,'plate',new.plate)
   where user_id=new.driver_id;
 end if;
 return new;
end $$;
revoke all on function public.sd_sync_fleet_vehicle() from public,anon,authenticated;
create trigger sd_vehicle_assignment after update of driver_id on public.sd_fleet_vehicles
for each row execute function public.sd_sync_fleet_vehicle();
