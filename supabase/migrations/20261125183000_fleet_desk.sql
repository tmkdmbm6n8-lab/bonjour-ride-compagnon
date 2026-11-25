create table public.sd_fleet_shifts (
 id bigint generated always as identity primary key,
 fleet_id uuid not null references public.sd_fleets on delete cascade,
 driver_id uuid not null, vehicle text not null, started_at timestamptz not null default now(), ended_at timestamptz
);
create unique index sd_open_shift on public.sd_fleet_shifts(driver_id) where ended_at is null;
alter table public.sd_fleet_shifts enable row level security;
revoke all on public.sd_fleet_shifts from anon,authenticated;
create function public.sd_refresh_shift(who uuid) returns void language plpgsql security definer set search_path='' as $$
declare fid uuid; label text;
begin
 if who is null then return; end if;
 perform pg_advisory_xact_lock(hashtextextended(who::text,1));
 select d.fleet_id,coalesce(v.model||' · '||v.plate,'Sans véhicule') into fid,label
 from public.sd_fleet_drivers d join public.drivers dr on dr.user_id=d.driver_id
 left join public.sd_fleet_vehicles v on v.driver_id=d.driver_id
 where d.driver_id=who and d.accepted and dr.is_online;
 update public.sd_fleet_shifts set ended_at=now() where driver_id=who and ended_at is null and (fleet_id is distinct from fid or vehicle is distinct from label);
 if fid is not null then insert into public.sd_fleet_shifts(fleet_id,driver_id,vehicle) values(fid,who,label) on conflict(driver_id) where ended_at is null do nothing; end if;
end $$;
revoke all on function public.sd_refresh_shift(uuid) from public,anon,authenticated;
create function public.sd_shift_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='drivers' then perform public.sd_refresh_shift(new.user_id);
 else
 if tg_op<>'INSERT' then perform public.sd_refresh_shift(old.driver_id); end if;
 if tg_op<>'DELETE' then perform public.sd_refresh_shift(new.driver_id); end if;
 end if;
 return null;
end $$;
create trigger sd_fleet_online after update of is_online on public.drivers for each row when(old.is_online is distinct from new.is_online) execute function public.sd_shift_event();
create trigger sd_fleet_membership after insert or update of accepted or delete on public.sd_fleet_drivers for each row execute function public.sd_shift_event();
create trigger sd_fleet_vehicle_shift after update of driver_id on public.sd_fleet_vehicles for each row execute function public.sd_shift_event();
select public.sd_refresh_shift(driver_id) from public.sd_fleet_drivers where accepted;
alter table public.sd_fleets add column cash_max_per_ride numeric(10,2) check(cash_max_per_ride>=0);
create function public.sd_check_fleet_cash() returns trigger language plpgsql security definer set search_path='' as $$
declare cap numeric;
begin
 if new.driver_id is null or new.payment->>'method' is distinct from 'cash' then return new; end if;
 if tg_op='UPDATE' then if old.driver_id is not distinct from new.driver_id and old.payment->>'method'='cash' then return new; end if; end if;
 select f.cash_max_per_ride into cap from public.sd_fleets f join public.sd_fleet_drivers d on d.fleet_id=f.id where d.driver_id=new.driver_id and d.accepted;
 if cap is not null and (cap=0 or coalesce((new.fare->>'total')::numeric,cap+1)>cap) then raise exception 'Cette course dépasse la limite espèces de la flotte'; end if;
 return new;
end $$;
create trigger sd_check_fleet_cash before insert or update of driver_id,payment on public.rides for each row execute function public.sd_check_fleet_cash();
create table public.sd_fleet_files (
 fleet_id uuid references public.sd_fleets on delete cascade,
 kind text not null check(kind in ('Assurance professionnelle','Registre VTC','Justificatif d’entreprise')),
 review text not null default 'En examen', reason text, filename text not null, content bytea not null, expiry date, submitted_at timestamptz not null default now(),
 primary key(fleet_id,kind)
);
create table public.sd_fleet_news (
 id bigint generated always as identity primary key, fleet_id uuid references public.sd_fleets on delete cascade,
 message text not null, created_at timestamptz not null default now(), read_at timestamptz
);
alter table public.sd_fleet_files enable row level security;
alter table public.sd_fleet_news enable row level security;
revoke all on public.sd_fleet_files,public.sd_fleet_news from authenticated,anon;
create function public.sd_fleet_news_event() returns trigger language plpgsql security definer set search_path='' as $$
declare msg text;
begin
 if tg_table_name='sd_fleet_drivers' then
   if tg_op='INSERT' then msg:='Invitation chauffeur enregistrée';
   elsif new.accepted and not old.accepted then msg:='Un chauffeur a rejoint votre flotte'; end if;
 else
   if tg_op='INSERT' then msg:='Véhicule ajouté · ' || new.plate;
   elsif new.driver_id is distinct from old.driver_id then msg:=new.plate || case when new.driver_id is null then ' · véhicule libéré' else ' · véhicule attribué' end; end if;
 end if;
 if msg is not null then insert into public.sd_fleet_news(fleet_id,message) values(new.fleet_id,msg); end if;
 return new;
end $$;
create trigger sd_driver_news after insert or update of accepted on public.sd_fleet_drivers for each row execute function public.sd_fleet_news_event();
create trigger sd_vehicle_news after insert or update of driver_id on public.sd_fleet_vehicles for each row execute function public.sd_fleet_news_event();

alter table public.sd_fleet_trips add column vehicle_label text;
create function public.sd_stamp_fleet_vehicle() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select v.model || ' · ' || v.plate into new.vehicle_label from public.sd_fleet_vehicles v join public.rides r on r.driver_id=v.driver_id where r.id=new.ride_id and v.fleet_id=new.fleet_id;
 return new;
end $$;
create trigger sd_stamp_vehicle before insert on public.sd_fleet_trips for each row execute function public.sd_stamp_fleet_vehicle();

create function public.sd_fleet_desk(action text,p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare fid uuid; bytes bytea; first_day date; last_day date;
begin
 select id into fid from public.sd_fleets where owner_id=auth.uid();
 if fid is null then raise exception 'Accès gérant requis'; end if;
 if action='upload' then
   if length(p->>'file')>2800000 then raise exception 'PDF trop volumineux'; end if;
   bytes:=decode(p->>'file','base64');
   if substring(bytes from 1 for 5)<>decode('255044462d','hex') then raise exception 'PDF requis'; end if;
   insert into public.sd_fleet_files(fleet_id,kind,filename,content,expiry) values(fid,p->>'kind',left(p->>'name',160),bytes,nullif(p->>'expiry','')::date)
   on conflict(fleet_id,kind) do update set filename=excluded.filename,content=excluded.content,expiry=excluded.expiry,submitted_at=now(),review='En examen',reason=null;
   insert into public.sd_fleet_news(fleet_id,message) values(fid,'Document déposé · '||(p->>'kind'));
 elsif action='cash' then
   update public.sd_fleets set cash_max_per_ride=nullif(p->>'limit','')::numeric where id=fid;
 elsif action='download' then
   return (select jsonb_build_object('name',filename,'file',encode(content,'base64')) from public.sd_fleet_files where fleet_id=fid and kind=p->>'kind');
 elsif action='read' then update public.sd_fleet_news set read_at=coalesce(read_at,now()) where fleet_id=fid and id=(p->>'id')::bigint;
 elsif action='report' then
   first_day:=(p->>'from')::date;last_day:=(p->>'to')::date;
   if first_day is null or last_day is null or last_day<first_day then raise exception 'Période invalide'; end if;
   return (select coalesce(jsonb_agg(to_jsonb(row_data)),'[]') from (
    select r.driver_id, coalesce(pr.name,'Chauffeur') as driver,coalesce(ft.vehicle_label,'Véhicule non enregistré') as vehicle,count(*) as trips,
    sum((r.fare->>'total')::numeric) as gross,sum((r.fare->>'driverEarnings')::numeric) as net,0::numeric as hours
    from public.sd_fleet_trips ft join public.rides r on r.id=ft.ride_id left join public.profiles pr on pr.id=r.driver_id
    where ft.fleet_id=fid and r.status='completed' and r.completed_at >= (first_day::timestamp at time zone 'Europe/Paris') and r.completed_at < ((last_day+1)::timestamp at time zone 'Europe/Paris')
    group by r.driver_id,pr.name,ft.vehicle_label
    union all select sh.driver_id,coalesce(pr.name,'Chauffeur'),sh.vehicle,0,0,0,
    sum(extract(epoch from least(coalesce(sh.ended_at,now()),(last_day+1)::timestamp at time zone 'Europe/Paris')-greatest(sh.started_at,first_day::timestamp at time zone 'Europe/Paris')))/3600
    from public.sd_fleet_shifts sh left join public.profiles pr on pr.id=sh.driver_id where sh.fleet_id=fid and sh.started_at<((last_day+1)::timestamp at time zone 'Europe/Paris') and coalesce(sh.ended_at,now())>(first_day::timestamp at time zone 'Europe/Paris') group by sh.driver_id,pr.name,sh.vehicle) row_data);
 elsif action<>'view' then raise exception 'Action inconnue'; end if;
 return jsonb_build_object('cashLimit',(select cash_max_per_ride from public.sd_fleets where id=fid),'files',(select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'name',filename,'expiry',expiry,'review',review,'reason',reason)),'[]') from public.sd_fleet_files where fleet_id=fid),
 'news',(select coalesce(jsonb_agg(to_jsonb(n) order by n.id desc),'[]') from (select id,message,created_at,read_at from public.sd_fleet_news where fleet_id=fid order by id desc limit 200)n));
end $$;
revoke all on function public.sd_fleet_desk(text,jsonb) from public,anon;
grant execute on function public.sd_fleet_desk(text,jsonb) to authenticated;
create function public.sd_review_fleet_file(action text,p jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin') then raise exception 'Accès administrateur requis'; end if;
 if action='download' then return (select jsonb_build_object('file',encode(content,'base64'),'name',filename) from public.sd_fleet_files where fleet_id=(p->>'fleet')::uuid and kind=p->>'kind' and submitted_at=(p->>'version')::timestamptz); end if;
 if action in ('Valider','Refuser') then
 if action='Refuser' and coalesce(length(trim(p->>'reason')),0)=0 then raise exception 'Motif requis'; end if;
 update public.sd_fleet_files set review=case when action='Valider' then 'Validé' else 'Refusé' end,reason=case when action='Refuser' then left(trim(p->>'reason'),500) end
 where fleet_id=(p->>'fleet')::uuid and kind=p->>'kind' and submitted_at=(p->>'version')::timestamptz and review='En examen';
 if not found then raise exception 'Le document a changé'; end if;
 insert into public.sd_fleet_news(fleet_id,message) values((p->>'fleet')::uuid,(p->>'kind')||case when action='Valider' then ' · validé' else ' · refusé · '||left(trim(p->>'reason'),500) end);
 elsif action<>'list' then raise exception 'Action inconnue'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('fleet',f.id,'name',f.name,'kind',d.kind,'version',d.submitted_at) order by d.submitted_at),'[]') from public.sd_fleet_files d join public.sd_fleets f on f.id=d.fleet_id where d.review='En examen');
end $$;
revoke all on function public.sd_review_fleet_file(text,jsonb) from public,anon;
grant execute on function public.sd_review_fleet_file(text,jsonb) to authenticated;