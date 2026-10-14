-- Goodnights, What's for Dinner?  |  Supabase SQL Editor, run once.
-- This project deliberately uses unguessable family/poll links instead of accounts.
-- Possession of the family invite link allows adding/archiving restaurants and closing polls.
-- Possession of a poll link allows voting. Do not post these links publicly.

create table if not exists public.gw_families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  token text not null unique check (token ~ '^[a-f0-9]{48}$'),
  created_at timestamptz not null default now()
);
-- This deployment is intentionally ONE FAMILY per Supabase project.
-- A constant-expression unique index prevents anonymous callers from creating others.
create unique index if not exists gw_one_family_only on public.gw_families ((1));

create table if not exists public.gw_restaurants (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.gw_families(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text not null default '',
  address text not null default '',
  osm_id text,
  latitude double precision,
  longitude double precision,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.gw_polls (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.gw_families(id) on delete cascade,
  meal text not null check (meal in ('Lunch','Dinner')),
  method text not null check (method in ('approval','swipe','ranked')),
  expected_voters integer not null check (expected_voters between 1 and 20),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);
create table if not exists public.gw_poll_options (
  poll_id uuid not null references public.gw_polls(id) on delete cascade,
  restaurant_id uuid not null references public.gw_restaurants(id),
  primary key(poll_id,restaurant_id)
);
create table if not exists public.gw_ballots (
  poll_id uuid not null references public.gw_polls(id) on delete cascade,
  voter_key text not null check (char_length(voter_key) between 1 and 60),
  voter_name text not null check (char_length(voter_name) between 1 and 60),
  ballot jsonb not null,
  submitted_at timestamptz not null default now(),
  primary key(poll_id,voter_key)
);
create index if not exists gw_restaurants_family on public.gw_restaurants(family_id);
create index if not exists gw_polls_family on public.gw_polls(family_id,created_at desc);

-- No direct table access via the publishable API key. All operations run through
-- narrowly scoped SECURITY DEFINER functions below, guarded by long random tokens.
alter table public.gw_families enable row level security;
alter table public.gw_restaurants enable row level security;
alter table public.gw_polls enable row level security;
alter table public.gw_poll_options enable row level security;
alter table public.gw_ballots enable row level security;
revoke all on public.gw_families, public.gw_restaurants, public.gw_polls,
  public.gw_poll_options, public.gw_ballots from public, anon, authenticated;

create or replace function public.gw_create_family(p_name text,p_token text)
returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
declare f public.gw_families;
begin
  if exists(select 1 from public.gw_families) then
    raise exception 'This app already has a family';
  end if;
  if p_token is null or p_token !~ '^[a-f0-9]{48}$' then
    raise exception 'Invalid family token';
  end if;
  insert into public.gw_families(name,token)
    values(left(coalesce(nullif(btrim(p_name),''),'Goodnight Family'),80),p_token)
    returning * into f;
  return jsonb_build_object('id',f.id,'name',f.name,'token',f.token);
end; $$;

create or replace function public.gw_get_family(p_token text)
returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
declare f public.gw_families;
begin
  select * into f from public.gw_families where token=p_token;
  if not found then raise exception 'Family invite code not found'; end if;
  return jsonb_build_object(
    'id',f.id,'name',f.name,
    'restaurants',coalesce((
      select jsonb_agg(jsonb_build_object('id',id,'name',name,'category',category,
        'address',address,'latitude',latitude,'longitude',longitude,'osm_id',osm_id)
        order by name) from public.gw_restaurants
      where family_id=f.id and active=true
    ),'[]'::jsonb),
    'polls',coalesce((
      select jsonb_agg(jsonb_build_object('id',q.id,'meal',q.meal,'method',q.method,
        'expected_voters',q.expected_voters,'status',q.status,
        'created_at',q.created_at,'voted_count',
        (select count(*) from public.gw_ballots b where b.poll_id=q.id))
        order by q.created_at desc)
      from (select * from public.gw_polls where family_id=f.id
            order by created_at desc limit 20) q
    ),'[]'::jsonb)
  );
end; $$;

create or replace function public.gw_add_restaurant(
  p_token text,p_name text,p_category text default '',p_address text default '',
  p_osm_id text default null,p_latitude double precision default null,
  p_longitude double precision default null)
returns uuid language plpgsql security definer set search_path = public,pg_temp as $$
declare fid uuid; rid uuid;
begin
  select id into fid from public.gw_families where token=p_token;
  if fid is null then raise exception 'Family access denied'; end if;
  if char_length(btrim(coalesce(p_name,''))) not between 1 and 120 then
    raise exception 'Restaurant name must contain 1–120 characters';
  end if;
  if (select count(*) from public.gw_restaurants where family_id=fid and active) >= 250 then
    raise exception 'Maximum of 250 restaurants';
  end if;
  -- Restore an archived exact match, if present.
  select id into rid from public.gw_restaurants
    where family_id=fid and lower(name)=lower(btrim(p_name))
    order by active desc limit 1;
  if rid is not null then
    update public.gw_restaurants set active=true where id=rid;
    return rid;
  end if;
  insert into public.gw_restaurants(family_id,name,category,address,osm_id,latitude,longitude)
  values(fid,btrim(p_name),left(coalesce(p_category,''),80),left(coalesce(p_address,''),240),
         left(p_osm_id,100),p_latitude,p_longitude) returning id into rid;
  return rid;
end; $$;

create or replace function public.gw_archive_restaurant(p_token text,p_restaurant_id uuid)
returns boolean language plpgsql security definer set search_path = public,pg_temp as $$
declare fid uuid;
begin
  select id into fid from public.gw_families where token=p_token;
  if fid is null then raise exception 'Family access denied'; end if;
  update public.gw_restaurants set active=false where family_id=fid and id=p_restaurant_id;
  return found;
end; $$;

create or replace function public.gw_create_poll(
  p_token text,p_meal text,p_method text,p_expected_voters integer,p_restaurant_ids uuid[])
returns uuid language plpgsql security definer set search_path = public,pg_temp as $$
declare fid uuid; pid uuid; n integer;
begin
  select id into fid from public.gw_families where token=p_token;
  if fid is null then raise exception 'Family access denied'; end if;
  if p_meal not in ('Lunch','Dinner') or p_method not in ('approval','swipe','ranked')
     or p_expected_voters not between 1 and 20 then
    raise exception 'Invalid poll settings';
  end if;
  n := coalesce(array_length(p_restaurant_ids,1),0);
  if n not between 2 and 20 then raise exception 'Choose between 2 and 20 restaurants'; end if;
  if (select count(distinct id) from unnest(p_restaurant_ids) as a(id)) <> n then
    raise exception 'Duplicate restaurant choice'; end if;
  if (select count(*) from public.gw_restaurants where family_id=fid and active
      and id=any(p_restaurant_ids)) <> n then
    raise exception 'Restaurant is not in your family list'; end if;
  insert into public.gw_polls(family_id,meal,method,expected_voters)
    values(fid,p_meal,p_method,p_expected_voters) returning id into pid;
  insert into public.gw_poll_options(poll_id,restaurant_id)
    select pid, unnest(p_restaurant_ids);
  return pid;
end; $$;

create or replace function public.gw_get_poll(p_poll_id uuid)
returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
declare p public.gw_polls; n integer; ready boolean;
begin
  select * into p from public.gw_polls where id=p_poll_id;
  if not found then raise exception 'Vote link not found'; end if;
  select count(*) into n from public.gw_ballots where poll_id=p.id;
  ready := (p.status='closed' or n>=p.expected_voters);
  return jsonb_build_object(
    'id',p.id,'meal',p.meal,'method',p.method,
    'status',case when ready then 'closed' else 'open' end,
    'expected_voters',p.expected_voters,'voted_count',n,
    'created_at',p.created_at,
    'options',coalesce((select jsonb_agg(jsonb_build_object(
      'id',r.id,'name',r.name,'category',r.category,'address',r.address)
      order by r.name)
      from public.gw_poll_options o join public.gw_restaurants r on r.id=o.restaurant_id
      where o.poll_id=p.id),'[]'::jsonb),
    -- Results stay hidden until all expected voters have voted or a family member closes poll.
    'ballots',case when ready then
      coalesce((select jsonb_agg(b.ballot) from public.gw_ballots b
                where b.poll_id=p.id),'[]'::jsonb)
      else null end
  );
end; $$;

create or replace function public.gw_vote(p_poll_id uuid,p_voter_name text,p_ballot jsonb)
returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
declare p public.gw_polls; vk text; vc integer; n integer; expected integer;
begin
  -- Serialize submissions for this poll, avoiding races in the voter cap.
  select * into p from public.gw_polls where id=p_poll_id for update;
  if not found or p.status<>'open' then raise exception 'Voting is closed'; end if;
  vk := lower(btrim(coalesce(p_voter_name,'')));
  if char_length(vk) not between 1 and 60 then raise exception 'Enter your first name'; end if;
  select count(*) into vc from public.gw_ballots where poll_id=p.id;
  if vc>=p.expected_voters then raise exception 'All family votes are in'; end if;
  select count(*) into n from public.gw_poll_options where poll_id=p.id;
  if p_ballot is null or jsonb_typeof(p_ballot) not in ('array','object') then
    raise exception 'Invalid ballot';
  end if;
  if p.method='approval' then
    if jsonb_typeof(p_ballot)<>'array' or jsonb_array_length(p_ballot) not between 1 and 2 then
      raise exception 'Pick one or two approved restaurants'; end if;
    if (select count(distinct x.value) from jsonb_array_elements_text(p_ballot) x) <> jsonb_array_length(p_ballot)
       or (select count(*) from jsonb_array_elements_text(p_ballot) x
           join public.gw_poll_options o on o.poll_id=p.id and o.restaurant_id::text=x.value)
          <> jsonb_array_length(p_ballot) then
      raise exception 'Invalid approval ballot'; end if;
  elsif p.method='ranked' then
    expected := least(n,3);
    if jsonb_typeof(p_ballot)<>'array' or jsonb_array_length(p_ballot)<>expected then
      raise exception 'Rank your top choices'; end if;
    if (select count(distinct x.value) from jsonb_array_elements_text(p_ballot) x)<>expected
       or (select count(*) from jsonb_array_elements_text(p_ballot) x
           join public.gw_poll_options o on o.poll_id=p.id and o.restaurant_id::text=x.value)
          <>expected then raise exception 'Choose different restaurants for each rank'; end if;
  elsif p.method='swipe' then
    if jsonb_typeof(p_ballot)<>'object' or (select count(*) from jsonb_object_keys(p_ballot))<>n
      or (select count(*) from jsonb_each(p_ballot) e
          join public.gw_poll_options o on o.poll_id=p.id and o.restaurant_id::text=e.key
          where jsonb_typeof(e.value)='boolean')<>n then
      raise exception 'Vote yes or no on every restaurant'; end if;
  end if;
  insert into public.gw_ballots(poll_id,voter_key,voter_name,ballot)
    values(p.id,vk,btrim(p_voter_name),p_ballot)
    on conflict(poll_id,voter_key) do update set ballot=excluded.ballot,
       voter_name=excluded.voter_name,submitted_at=now();
  return jsonb_build_object('ok',true);
end; $$;

create or replace function public.gw_close_poll(p_token text,p_poll_id uuid)
returns boolean language plpgsql security definer set search_path = public,pg_temp as $$
declare fid uuid;
begin
  select id into fid from public.gw_families where token=p_token;
  if fid is null then raise exception 'Family access denied'; end if;
  update public.gw_polls set status='closed' where id=p_poll_id and family_id=fid;
  return found;
end; $$;

-- Execution rights only; anonymous clients cannot list/edit tables directly.
revoke all on function public.gw_create_family(text,text), public.gw_get_family(text),
  public.gw_add_restaurant(text,text,text,text,text,double precision,double precision),
  public.gw_archive_restaurant(text,uuid),
  public.gw_create_poll(text,text,text,integer,uuid[]),
  public.gw_get_poll(uuid), public.gw_vote(uuid,text,jsonb),
  public.gw_close_poll(text,uuid) from public, anon, authenticated;
grant execute on function public.gw_create_family(text,text), public.gw_get_family(text),
  public.gw_add_restaurant(text,text,text,text,text,double precision,double precision),
  public.gw_archive_restaurant(text,uuid),
  public.gw_create_poll(text,text,text,integer,uuid[]),
  public.gw_get_poll(uuid), public.gw_vote(uuid,text,jsonb),
  public.gw_close_poll(text,uuid) to anon, authenticated;
