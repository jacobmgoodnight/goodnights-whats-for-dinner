-- REVIEW ONLY: additive confirmed meals; approval required before production.
begin;
set local lock_timeout='5s';
do $$ begin
 if to_regclass('public.gw_meals') is not null or to_regprocedure('public.gw_meal_history(text,text)') is not null then
  raise exception 'Meal objects already exist; inspect deployed definitions before proceeding';
 end if;
 if to_regclass('public.gw_families') is null or to_regclass('public.gw_restaurants') is null
    or to_regclass('public.gw_members') is null or to_regclass('public.gw_polls') is null then
  raise exception 'Existing family, restaurant, member and poll schema required';
 end if;
end $$;
create table public.gw_meals (
 id uuid primary key,
 family_id uuid not null references public.gw_families(id),
 restaurant_id uuid not null references public.gw_restaurants(id),
 eaten_on date not null,
 poll_id uuid references public.gw_polls(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(family_id,restaurant_id,eaten_on)
);
create index gw_meals_family_date on public.gw_meals(family_id,eaten_on desc,id);
create index gw_meals_restaurant on public.gw_meals(restaurant_id);
create index gw_meals_poll on public.gw_meals(poll_id) where poll_id is not null;
alter table public.gw_meals enable row level security;
revoke all on public.gw_meals from public,anon,authenticated;

create function public.gw_meal_history(p_token text default null,p_member_token text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare fid uuid;
begin
 if p_token is not null then select id into fid from public.gw_families where token=p_token;
 else select family_id into fid from public.gw_members where token=p_member_token and active;end if;
 if fid is null then raise exception 'Family access denied';end if;
 return jsonb_build_object(
  'meals',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'restaurant_id',m.restaurant_id,'eaten_on',m.eaten_on,'poll_id',m.poll_id,
   'name',r.name,'category',r.category,'address',r.address,'active',r.active,'icon_mode',r.icon_mode,'icon_value',r.icon_value) order by m.eaten_on desc,m.created_at desc,m.id),'[]')
   from (select * from public.gw_meals where family_id=fid order by eaten_on desc,created_at desc,id limit 50) m
   join public.gw_restaurants r on r.id=m.restaurant_id and r.family_id=fid),
  'last_eaten',(select coalesce(jsonb_object_agg(restaurant_id,last_date),'{}') from
   (select restaurant_id,max(eaten_on) as last_date from public.gw_meals where family_id=fid group by restaurant_id) latest));
end $$;

create function public.gw_save_meal(p_token text,p_meal_id uuid,p_restaurant_id uuid,p_eaten_on date,p_poll_id uuid default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare fid uuid;
begin
 select id into fid from public.gw_families where token=p_token for update;
 if fid is null then raise exception 'Organizer access denied';end if;
 if p_meal_id is null or p_eaten_on is null or not isfinite(p_eaten_on)
    or p_eaten_on<date '1900-01-01' or p_eaten_on>(now() at time zone 'UTC')::date+1 then
  raise exception 'Choose the local date of an actual meal';end if;
 -- Date is a calendar value, not midnight UTC. UTC+1 day allows all local zones.
 if not exists(select 1 from public.gw_restaurants where id=p_restaurant_id and family_id=fid) then
  raise exception 'Choose a saved restaurant in your family';end if;
 if p_poll_id is not null and not exists(select 1 from public.gw_polls where id=p_poll_id and family_id=fid) then
  raise exception 'Vote is not in your family';end if;
 if exists(select 1 from public.gw_meals where id=p_meal_id and family_id<>fid) then raise exception 'Meal unavailable';end if;
 if not exists(select 1 from public.gw_meals where id=p_meal_id) and (select count(*) from public.gw_meals where family_id=fid)>=10000 then
  raise exception 'Meal history is full';end if;
 insert into public.gw_meals(id,family_id,restaurant_id,eaten_on,poll_id)
 values(p_meal_id,fid,p_restaurant_id,p_eaten_on,p_poll_id)
 on conflict(id) do update set restaurant_id=excluded.restaurant_id,eaten_on=excluded.eaten_on,poll_id=excluded.poll_id
 where gw_meals.family_id=fid;
 return p_meal_id;
exception when unique_violation then raise exception 'This place is already recorded on that date. Edit the existing meal.';
end $$;

create function public.gw_delete_meal(p_token text,p_meal_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare fid uuid;
begin
 select id into fid from public.gw_families where token=p_token;
 if fid is null then raise exception 'Organizer access denied';end if;
 delete from public.gw_meals where id=p_meal_id and family_id=fid;
 return found;
end $$;
revoke all on function public.gw_meal_history(text,text),public.gw_save_meal(text,uuid,uuid,date,uuid),public.gw_delete_meal(text,uuid) from public,anon,authenticated;
grant execute on function public.gw_meal_history(text,text),public.gw_save_meal(text,uuid,uuid,date,uuid),public.gw_delete_meal(text,uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
