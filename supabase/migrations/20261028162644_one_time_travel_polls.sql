-- Proposed additive upgrade. DO NOT apply to production without approval.
-- Reviewed against deployed definitions on 2026-10-28. No records are altered.
begin;
set local lock_timeout='5s';
do $preflight$ begin
 if to_regprocedure('public.gw_vote(uuid,text,jsonb)') is null
 or to_regprocedure('public.gw_poll_settings(text,uuid,boolean,boolean)') is null
 or to_regprocedure('public.gw_process_dinner_poll(uuid)') is null then
  raise exception 'Apply and verify the existing voting/planning dependencies first';
 end if;
 if has_function_privilege('anon','public.gw_vote(uuid,text,jsonb)','execute')
 or has_function_privilege('authenticated','public.gw_vote(uuid,text,jsonb)','execute') then
  raise exception 'Internal gw_vote must remain private';
 end if;
 if regexp_replace(pg_get_functiondef('public.gw_get_poll(uuid)'::regprocedure),'[[:space:]]+',' ','g')
 <> regexp_replace($expected$CREATE OR REPLACE FUNCTION public.gw_get_poll(p_poll_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p public.gw_polls; n integer; ready boolean;
begin
 select * into p from public.gw_polls where id=p_poll_id;if not found then raise exception 'Vote link not found';end if;
 select count(*) into n from public.gw_ballots where poll_id=p.id;ready:=(p.status='closed' or n>=p.expected_voters);
 return jsonb_build_object('id',p.id,'title',p.title,'auto_tie',p.auto_tie,'meal',p.meal,'method',p.method,'status',case when ready then 'closed' else 'open' end,'tie_winner_id',p.tie_winner_id,'cuisine',p.cuisine,'allow_member_home',p.allow_member_home,'roster_enabled',p.roster_enabled,'expected_voters',p.expected_voters,'voted_count',n,'created_at',p.created_at,
 'options',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'category',r.category,'address',r.address,'icon_mode',r.icon_mode,'icon_value',r.icon_value) order by r.name) from public.gw_poll_options o join public.gw_restaurants r on r.id=o.restaurant_id where o.poll_id=p.id),'[]'),
 'ballots',case when ready then coalesce((select jsonb_agg(b.ballot) from public.gw_ballots b where b.poll_id=p.id),'[]') else null end);
end $function$
$expected$,'[[:space:]]+',' ','g') then
  raise exception 'gw_get_poll differs from the reviewed definition; reconcile before proceeding';
 end if;
end $preflight$;

alter table public.gw_polls add column one_time boolean not null default false;
create table public.gw_poll_guests (
 id uuid primary key default gen_random_uuid(),
 poll_id uuid not null references public.gw_polls(id) on delete cascade,
 name text not null check(char_length(name) between 1 and 60),
 name_key text not null check(char_length(name_key) between 1 and 60),
 created_at timestamptz not null default now(),
 unique(poll_id,name_key)
);
alter table public.gw_poll_guests enable row level security;
revoke all on table public.gw_poll_guests from public,anon,authenticated;
comment on table public.gw_poll_guests is 'Poll-only names; accessible only through guarded one-time invitation RPC. No permanent family membership.';

create function public.gw_create_one_time_poll(
 p_token text,p_place_names text[],p_expected_voters integer,
 p_meal text default 'Dinner',p_method text default 'approval',p_title text default '',p_request_id uuid default null
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare fid uuid; pid uuid; rid uuid; place text; names text[];
begin
 select id into fid from public.gw_families where token=p_token for update;
 if fid is null then raise exception 'Organizer access denied'; end if;
 if p_request_id is not null and exists(select 1 from public.gw_polls where id=p_request_id) then
  if exists(select 1 from public.gw_polls where id=p_request_id and family_id=fid and one_time) then return p_request_id; end if;
  raise exception 'Creation request already used. Start a fresh one-time vote';
 end if;
 if p_meal is null or p_meal not in ('Lunch','Dinner')
 or p_method is null or p_method not in ('approval','swipe','ranked')
 or p_expected_voters is null or p_expected_voters not between 1 and 20
 or char_length(coalesce(p_title,''))>80 then raise exception 'Invalid one-time vote settings'; end if;
 if p_place_names is null or array_ndims(p_place_names)<>1
 or cardinality(p_place_names) not between 2 and 20 then
  raise exception 'Enter between 2 and 20 restaurant names'; end if;
 select array_agg(btrim(regexp_replace(x,'[[:space:]]+',' ','g')) order by pos)
 into names from unnest(p_place_names) with ordinality a(x,pos);
 if exists(select 1 from unnest(names) a(x) where x is null or char_length(x) not between 1 and 120)
 or (select count(distinct lower(x)) from unnest(names) a(x))<>cardinality(names) then
  raise exception 'Use different restaurant names, each 1 to 120 characters'; end if;
 insert into public.gw_polls(id,family_id,meal,method,expected_voters,title,one_time,
  roster_enabled,allow_member_home,group_join_token)
 values(coalesce(p_request_id,gen_random_uuid()),fid,p_meal,p_method,p_expected_voters,btrim(coalesce(p_title,'')),true,true,false,
  replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''))
 returning id into pid;
 -- Archived backing rows preserve stable option IDs/history without adding to the saved library.
 foreach place in array names loop
  insert into public.gw_restaurants(family_id,name,active,icon_mode,icon_value)
  values(fid,place,false,'builtin','restaurant') returning id into rid;
  insert into public.gw_poll_options(poll_id,restaurant_id) values(pid,rid);
 end loop;
 return pid;
end $function$;

create function public.gw_one_time_access(
 p_poll_id uuid,p_group_token text default null,p_token text default null,
 p_guest_id uuid default null,p_action text default 'people',p_name text default null,
 p_ballot jsonb default null,p_include_avatars boolean default true
) returns jsonb language plpgsql security definer set search_path=''
as $function$
declare p public.gw_polls; g public.gw_poll_guests; existing public.gw_poll_guests;
 invited boolean; owner boolean; clean text; data jsonb;
begin
 -- Serialize joins, renames and votes with the existing ballot writer's poll lock.
 select * into p from public.gw_polls where id=p_poll_id and one_time for update;
 if not found then raise exception 'One-time invitation unavailable'; end if;
 invited:=p.group_join_token is not null and p_group_token is not null and p.group_join_token=p_group_token;
 select exists(select 1 from public.gw_families where id=p.family_id and token=p_token) into owner;
 if not coalesce(invited,false) and not owner then raise exception 'One-time invitation unavailable'; end if;
 if p_action='people' then
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'avatar','🙂',
   'active',true,'voted',exists(select 1 from public.gw_ballots b where b.poll_id=p.id and b.voter_key=x.id::text))
   order by x.created_at,x.name),'[]'::jsonb) into data from public.gw_poll_guests x where x.poll_id=p.id;
  return jsonb_build_object('rostered',true,'people',data,'eligible',coalesce(invited,false)
   and exists(select 1 from public.gw_poll_guests where id=p_guest_id and poll_id=p.id));
 end if;
 if not coalesce(invited,false) then raise exception 'Use this vote’s shared invitation to join'; end if;
 if p_action='join' then
  if p.status<>'open' or (select count(*) from public.gw_ballots where poll_id=p.id)>=p.expected_voters then
   raise exception 'Voting is closed'; end if;
  clean:=btrim(regexp_replace(coalesce(p_name,''),'[[:space:]]+',' ','g'));
  if char_length(clean) not between 1 and 60 then raise exception 'Enter your name (up to 60 characters)'; end if;
  if p_guest_id is not null then
   select * into g from public.gw_poll_guests where poll_id=p.id and id=p_guest_id;
   if not found then raise exception 'Guest is not part of this vote'; end if;
   if exists(select 1 from public.gw_ballots where poll_id=p.id and voter_key=g.id::text) then
    raise exception 'This guest has already voted'; end if;
  end if;
  select * into existing from public.gw_poll_guests where poll_id=p.id and name_key=lower(clean);
  if found then
   if exists(select 1 from public.gw_ballots where poll_id=p.id and voter_key=existing.id::text) then
    raise exception 'That name has already voted. Use your own name; add an initial if needed'; end if;
   if g.id is not null and g.id<>existing.id then
    raise exception 'That name is in use. Add an initial to your name'; end if;
   g:=existing; -- Recover an unsubmitted join if the response was lost.
  elsif g.id is not null then
   update public.gw_poll_guests set name=clean,name_key=lower(clean) where id=g.id returning * into g;
  else
   if (select count(*) from public.gw_poll_guests where poll_id=p.id)>=p.expected_voters then
    raise exception 'All guest places are taken. Ask the organizer for help'; end if;
   insert into public.gw_poll_guests(poll_id,name,name_key) values(p.id,clean,lower(clean)) returning * into g;
  end if;
  return jsonb_build_object('id',g.id,'name',g.name,'avatar','🙂');
 end if;
 select * into g from public.gw_poll_guests where poll_id=p.id and id=p_guest_id;
 if not found then raise exception 'Enter your name to join this vote'; end if;
 if p_action='identity' then return jsonb_build_object('id',g.id,'name',g.name,'avatar','🙂'); end if;
 if p_action='has_voted' then
  return to_jsonb(exists(select 1 from public.gw_ballots where poll_id=p.id and voter_key=g.id::text));
 end if;
 if p_action='vote' then
  if exists(select 1 from public.gw_ballots where poll_id=p.id and voter_key=g.id::text) then
   -- An identical retry acknowledges a saved ballot, but can never edit it.
   if exists(select 1 from public.gw_ballots where poll_id=p.id and voter_key=g.id::text and ballot=p_ballot) then
    return jsonb_build_object('ok',true); end if;
   raise exception 'This guest has already voted'; end if;
  perform public.gw_vote(p.id,g.id::text,p_ballot);
  update public.gw_ballots set voter_name=g.name where poll_id=p.id and voter_key=g.id::text;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Unsupported one-time action';
end $function$;

-- Preserve the public reader whitelist; expose only a mode flag, never guest names or invite credentials.
CREATE OR REPLACE FUNCTION public.gw_get_poll(p_poll_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p public.gw_polls; n integer; ready boolean;
begin
 select * into p from public.gw_polls where id=p_poll_id;if not found then raise exception 'Vote link not found';end if;
 select count(*) into n from public.gw_ballots where poll_id=p.id;ready:=(p.status='closed' or n>=p.expected_voters);
 return jsonb_build_object('id',p.id,'one_time',p.one_time,'title',p.title,'auto_tie',p.auto_tie,'meal',p.meal,'method',p.method,'status',case when ready then 'closed' else 'open' end,'tie_winner_id',p.tie_winner_id,'cuisine',p.cuisine,'allow_member_home',p.allow_member_home,'roster_enabled',p.roster_enabled,'expected_voters',p.expected_voters,'voted_count',n,'created_at',p.created_at,
 'options',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'category',r.category,'address',r.address,'icon_mode',r.icon_mode,'icon_value',r.icon_value) order by r.name) from public.gw_poll_options o join public.gw_restaurants r on r.id=o.restaurant_id where o.poll_id=p.id),'[]'),
 'ballots',case when ready then coalesce((select jsonb_agg(b.ballot) from public.gw_ballots b where b.poll_id=p.id),'[]') else null end);
end $function$
;
revoke all on function public.gw_create_one_time_poll(text,text[],integer,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.gw_one_time_access(uuid,text,text,uuid,text,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.gw_create_one_time_poll(text,text[],integer,text,text,text,uuid) to anon,authenticated;
grant execute on function public.gw_one_time_access(uuid,text,text,uuid,text,text,jsonb,boolean) to anon,authenticated;
notify pgrst,'reload schema';
commit;
