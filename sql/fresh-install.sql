-- EMPTY PROJECT ONLY. Consolidated core catalog reviewed 2026-10-28.
-- Not an upgrade or Supabase migration-history repair script. Contains no records.
-- Optional background push is deliberately unconfigured; see docs/fresh-install.md.
begin;
set local lock_timeout='5s';
do $$ begin
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname like 'gw_%') then
  raise exception 'Fresh install requires an empty project; existing gw_* objects found';
 end if;
end $$;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create table public."gw_ballots" (
 "poll_id" uuid not null,
 "voter_key" text not null,
 "voter_name" text not null,
 "ballot" jsonb not null,
 "submitted_at" timestamp with time zone default now() not null
);
create table public."gw_dinner_events" (
 "id" uuid default gen_random_uuid() not null,
 "family_id" uuid not null,
 "poll_id" uuid not null,
 "phase" text not null,
 "kind" text not null,
 "created_at" timestamp with time zone default now() not null
);
create table public."gw_dinner_presets" (
 "id" uuid default gen_random_uuid() not null,
 "family_id" uuid not null,
 "name" text not null,
 "draft" jsonb not null,
 "active" boolean default true not null,
 "created_at" timestamp with time zone default now() not null
);
create table public."gw_families" (
 "id" uuid default gen_random_uuid() not null,
 "name" text not null,
 "token" text not null,
 "created_at" timestamp with time zone default now() not null
);
create table public."gw_family_settings" (
 "family_id" uuid not null,
 "results_caption" text default ''::text not null
);
create table public."gw_members" (
 "id" uuid default gen_random_uuid() not null,
 "family_id" uuid not null,
 "name" text not null,
 "token" text not null,
 "active" boolean default true not null,
 "created_at" timestamp with time zone default now() not null,
 "avatar" text default '🙂'::text not null,
 "phone" text default ''::text not null
);
create table public."gw_nominations" (
 "id" uuid default gen_random_uuid() not null,
 "family_id" uuid not null,
 "member_id" uuid not null,
 "name" text not null,
 "address" text default ''::text not null,
 "category" text default ''::text not null,
 "note" text default ''::text not null,
 "status" text default 'pending'::text not null,
 "restaurant_id" uuid,
 "created_at" timestamp with time zone default now() not null
);
create table public."gw_poll_members" (
 "poll_id" uuid not null,
 "member_id" uuid not null
);
create table public."gw_poll_options" (
 "poll_id" uuid not null,
 "restaurant_id" uuid not null
);
create table public."gw_polls" (
 "id" uuid default gen_random_uuid() not null,
 "family_id" uuid not null,
 "meal" text not null,
 "method" text not null,
 "expected_voters" integer not null,
 "status" text default 'open'::text not null,
 "created_at" timestamp with time zone default now() not null,
 "roster_enabled" boolean default false not null,
 "allow_member_home" boolean default true not null,
 "group_join_token" text,
 "cuisine" text default ''::text not null,
 "tie_winner_id" uuid,
 "title" text default ''::text not null,
 "auto_tie" boolean default false not null
);
create table public."gw_restaurants" (
 "id" uuid default gen_random_uuid() not null,
 "family_id" uuid not null,
 "name" text not null,
 "category" text default ''::text not null,
 "address" text default ''::text not null,
 "osm_id" text,
 "latitude" double precision,
 "longitude" double precision,
 "active" boolean default true not null,
 "created_at" timestamp with time zone default now() not null,
 "icon_mode" text default 'auto'::text not null,
 "icon_value" text default ''::text not null
);
CREATE OR REPLACE FUNCTION public.gw_restaurant_key(value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
 select translate(btrim(regexp_replace(coalesce(value,''), '[[:space:]]+', ' ', 'g')),
 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')
$function$
;
alter table public."gw_ballots" add constraint "gw_ballots_pkey" PRIMARY KEY (poll_id, voter_key);
alter table public."gw_ballots" add constraint "gw_ballots_voter_key_check" CHECK (((char_length(voter_key) >= 1) AND (char_length(voter_key) <= 60)));
alter table public."gw_ballots" add constraint "gw_ballots_voter_name_check" CHECK (((char_length(voter_name) >= 1) AND (char_length(voter_name) <= 60)));
alter table public."gw_dinner_events" add constraint "gw_dinner_events_kind_check" CHECK ((kind = ANY (ARRAY['decided'::text, 'tie'::text, 'no-choice'::text, 'empty'::text])));
alter table public."gw_dinner_events" add constraint "gw_dinner_events_phase_check" CHECK ((phase = ANY (ARRAY['completion'::text, 'resolved'::text])));
alter table public."gw_dinner_events" add constraint "gw_dinner_events_pkey" PRIMARY KEY (id);
alter table public."gw_dinner_events" add constraint "gw_dinner_events_poll_id_phase_key" UNIQUE (poll_id, phase);
alter table public."gw_dinner_presets" add constraint "gw_dinner_presets_name_check" CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 60)));
alter table public."gw_dinner_presets" add constraint "gw_dinner_presets_pkey" PRIMARY KEY (id);
alter table public."gw_families" add constraint "gw_families_name_check" CHECK (((char_length(name) >= 1) AND (char_length(name) <= 80)));
alter table public."gw_families" add constraint "gw_families_pkey" PRIMARY KEY (id);
alter table public."gw_families" add constraint "gw_families_token_check" CHECK ((token ~ '^[a-f0-9]{48}$'::text));
alter table public."gw_families" add constraint "gw_families_token_key" UNIQUE (token);
alter table public."gw_family_settings" add constraint "gw_family_settings_pkey" PRIMARY KEY (family_id);
alter table public."gw_family_settings" add constraint "gw_family_settings_results_caption_check" CHECK ((char_length(results_caption) <= 100));
alter table public."gw_members" add constraint "gw_members_name_check" CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 60)));
alter table public."gw_members" add constraint "gw_members_pkey" PRIMARY KEY (id);
alter table public."gw_members" add constraint "gw_members_token_check" CHECK ((token ~ '^[a-f0-9]{48}$'::text));
alter table public."gw_members" add constraint "gw_members_token_key" UNIQUE (token);
alter table public."gw_nominations" add constraint "gw_nominations_address_check" CHECK ((char_length(address) <= 240));
alter table public."gw_nominations" add constraint "gw_nominations_category_check" CHECK ((char_length(category) <= 80));
alter table public."gw_nominations" add constraint "gw_nominations_check" CHECK (((status <> 'accepted'::text) OR (restaurant_id IS NOT NULL)));
alter table public."gw_nominations" add constraint "gw_nominations_name_check" CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 120)));
alter table public."gw_nominations" add constraint "gw_nominations_note_check" CHECK ((char_length(note) <= 250));
alter table public."gw_nominations" add constraint "gw_nominations_pkey" PRIMARY KEY (id);
alter table public."gw_nominations" add constraint "gw_nominations_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'dismissed'::text])));
alter table public."gw_poll_members" add constraint "gw_poll_members_pkey" PRIMARY KEY (poll_id, member_id);
alter table public."gw_poll_options" add constraint "gw_poll_options_pkey" PRIMARY KEY (poll_id, restaurant_id);
alter table public."gw_polls" add constraint "gw_polls_expected_voters_check" CHECK (((expected_voters >= 1) AND (expected_voters <= 20)));
alter table public."gw_polls" add constraint "gw_polls_meal_check" CHECK ((meal = ANY (ARRAY['Lunch'::text, 'Dinner'::text])));
alter table public."gw_polls" add constraint "gw_polls_method_check" CHECK ((method = ANY (ARRAY['approval'::text, 'swipe'::text, 'ranked'::text])));
alter table public."gw_polls" add constraint "gw_polls_pkey" PRIMARY KEY (id);
alter table public."gw_polls" add constraint "gw_polls_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])));
alter table public."gw_polls" add constraint "gw_polls_title_check" CHECK ((char_length(title) <= 80));
alter table public."gw_restaurants" add constraint "gw_restaurants_icon_mode_check" CHECK ((icon_mode = ANY (ARRAY['auto'::text, 'logo_url'::text, 'website'::text, 'builtin'::text])));
alter table public."gw_restaurants" add constraint "gw_restaurants_icon_value_length_check" CHECK ((char_length(icon_value) <= 500));
alter table public."gw_restaurants" add constraint "gw_restaurants_name_check" CHECK (((char_length(name) >= 1) AND (char_length(name) <= 120)));
alter table public."gw_restaurants" add constraint "gw_restaurants_pkey" PRIMARY KEY (id);
alter table public."gw_ballots" add constraint "gw_ballots_poll_id_fkey" FOREIGN KEY (poll_id) REFERENCES gw_polls(id) ON DELETE CASCADE;
alter table public."gw_dinner_events" add constraint "gw_dinner_events_family_id_fkey" FOREIGN KEY (family_id) REFERENCES gw_families(id);
alter table public."gw_dinner_events" add constraint "gw_dinner_events_poll_id_fkey" FOREIGN KEY (poll_id) REFERENCES gw_polls(id) ON DELETE CASCADE;
alter table public."gw_dinner_presets" add constraint "gw_dinner_presets_family_id_fkey" FOREIGN KEY (family_id) REFERENCES gw_families(id);
alter table public."gw_family_settings" add constraint "gw_family_settings_family_id_fkey" FOREIGN KEY (family_id) REFERENCES gw_families(id);
alter table public."gw_members" add constraint "gw_members_family_id_fkey" FOREIGN KEY (family_id) REFERENCES gw_families(id) ON DELETE CASCADE;
alter table public."gw_nominations" add constraint "gw_nominations_family_id_fkey" FOREIGN KEY (family_id) REFERENCES gw_families(id);
alter table public."gw_nominations" add constraint "gw_nominations_member_id_fkey" FOREIGN KEY (member_id) REFERENCES gw_members(id);
alter table public."gw_nominations" add constraint "gw_nominations_restaurant_id_fkey" FOREIGN KEY (restaurant_id) REFERENCES gw_restaurants(id);
alter table public."gw_poll_members" add constraint "gw_poll_members_member_id_fkey" FOREIGN KEY (member_id) REFERENCES gw_members(id) ON DELETE CASCADE;
alter table public."gw_poll_members" add constraint "gw_poll_members_poll_id_fkey" FOREIGN KEY (poll_id) REFERENCES gw_polls(id) ON DELETE CASCADE;
alter table public."gw_poll_options" add constraint "gw_poll_options_poll_id_fkey" FOREIGN KEY (poll_id) REFERENCES gw_polls(id) ON DELETE CASCADE;
alter table public."gw_poll_options" add constraint "gw_poll_options_restaurant_id_fkey" FOREIGN KEY (restaurant_id) REFERENCES gw_restaurants(id);
alter table public."gw_polls" add constraint "gw_polls_family_id_fkey" FOREIGN KEY (family_id) REFERENCES gw_families(id) ON DELETE CASCADE;
alter table public."gw_restaurants" add constraint "gw_restaurants_family_id_fkey" FOREIGN KEY (family_id) REFERENCES gw_families(id) ON DELETE CASCADE;
alter table public."gw_ballots" enable row level security;
revoke all on public."gw_ballots" from public,anon,authenticated;
CREATE INDEX gw_dinner_events_family ON public.gw_dinner_events USING btree (family_id, created_at DESC);
alter table public."gw_dinner_events" enable row level security;
revoke all on public."gw_dinner_events" from public,anon,authenticated;
CREATE INDEX gw_dinner_presets_family ON public.gw_dinner_presets USING btree (family_id, created_at) WHERE active;
CREATE UNIQUE INDEX gw_dinner_presets_name ON public.gw_dinner_presets USING btree (family_id, gw_restaurant_key(name)) WHERE active;
alter table public."gw_dinner_presets" enable row level security;
revoke all on public."gw_dinner_presets" from public,anon,authenticated;
CREATE UNIQUE INDEX gw_one_family_only ON public.gw_families USING btree ((1));
alter table public."gw_families" enable row level security;
revoke all on public."gw_families" from public,anon,authenticated;
alter table public."gw_family_settings" enable row level security;
revoke all on public."gw_family_settings" from public,anon,authenticated;
CREATE UNIQUE INDEX gw_members_family_name_unique ON public.gw_members USING btree (family_id, lower(name)) WHERE active;
CREATE INDEX gw_members_family_idx ON public.gw_members USING btree (family_id);
alter table public."gw_members" enable row level security;
revoke all on public."gw_members" from public,anon,authenticated;
CREATE INDEX gw_nominations_family ON public.gw_nominations USING btree (family_id, status, created_at DESC);
CREATE INDEX gw_nominations_member ON public.gw_nominations USING btree (member_id, created_at DESC);
CREATE UNIQUE INDEX gw_nominations_pending_identity ON public.gw_nominations USING btree (member_id, gw_restaurant_key(name), gw_restaurant_key(address)) WHERE (status = 'pending'::text);
alter table public."gw_nominations" enable row level security;
revoke all on public."gw_nominations" from public,anon,authenticated;
CREATE INDEX gw_poll_members_member_idx ON public.gw_poll_members USING btree (member_id);
alter table public."gw_poll_members" enable row level security;
revoke all on public."gw_poll_members" from public,anon,authenticated;
alter table public."gw_poll_options" enable row level security;
revoke all on public."gw_poll_options" from public,anon,authenticated;
CREATE INDEX gw_polls_family ON public.gw_polls USING btree (family_id, created_at DESC);
CREATE INDEX gw_polls_open_family ON public.gw_polls USING btree (family_id, created_at DESC) WHERE (status = 'open'::text);
alter table public."gw_polls" enable row level security;
revoke all on public."gw_polls" from public,anon,authenticated;
CREATE INDEX gw_restaurants_family ON public.gw_restaurants USING btree (family_id);
CREATE UNIQUE INDEX gw_restaurants_osm_identity ON public.gw_restaurants USING btree (family_id, gw_restaurant_key(osm_id)) WHERE (gw_restaurant_key(osm_id) <> ''::text);
CREATE UNIQUE INDEX gw_restaurants_manual_identity ON public.gw_restaurants USING btree (family_id, gw_restaurant_key(name), gw_restaurant_key(address)) WHERE ((gw_restaurant_key(osm_id) = ''::text) AND (gw_restaurant_key(address) <> ''::text));
alter table public."gw_restaurants" enable row level security;
revoke all on public."gw_restaurants" from public,anon,authenticated;
set local check_function_bodies=off;
CREATE OR REPLACE FUNCTION public.gw_add_member(p_token text, p_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare fid uuid; m public.gw_members; clean_name text;
begin
  select id into fid from public.gw_families where token=p_token for update;
  if fid is null then raise exception 'Owner access denied'; end if;
  clean_name := btrim(coalesce(p_name,''));
  if char_length(clean_name) not between 1 and 60 then raise exception 'Enter a name (1–60 characters)'; end if;
  if (select count(*) from public.gw_members where family_id=fid and active)>=20 then
    raise exception 'Maximum of 20 family members'; end if;
  insert into public.gw_members(family_id,name,token)
  values(fid,clean_name,encode(extensions.gen_random_bytes(24),'hex'))
  returning * into m;
  return jsonb_build_object('id',m.id,'name',m.name,'token',m.token);
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_add_restaurant(p_token text, p_name text, p_category text DEFAULT ''::text, p_address text DEFAULT ''::text, p_osm_id text DEFAULT NULL::text, p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare result jsonb;
begin
 result:=public.gw_save_restaurant_location(p_token,p_name,p_category,p_address,p_osm_id,p_latitude,p_longitude);
 if result->>'status'='review' then raise exception 'Possible duplicate or missing address. Review locations using the updated app';end if;
 return (result->>'id')::uuid;
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_archive_dinner_preset(p_token text, p_preset_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare fid uuid;
begin
 select id into fid from public.gw_families where token=p_token;if fid is null then raise exception 'Organizer access denied';end if;
 update public.gw_dinner_presets set active=false where id=p_preset_id and family_id=fid;return found;
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_archive_restaurant(p_token text, p_restaurant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare fid uuid;
begin
  select id into fid from public.gw_families where token=p_token;
  if fid is null then raise exception 'Family access denied'; end if;
  update public.gw_restaurants set active=false where family_id=fid and id=p_restaurant_id;
  return found;
end; $function$
;
CREATE OR REPLACE FUNCTION public.gw_clear_changed_location()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
 if public.gw_restaurant_key(new.address)<>public.gw_restaurant_key(old.address) then
  new.osm_id:=null;new.latitude:=null;new.longitude:=null;
 end if;
 return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_close_poll(p_token text, p_poll_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare fid uuid;
begin
  select id into fid from public.gw_families where token=p_token;
  if fid is null then raise exception 'Family access denied'; end if;
  update public.gw_polls set status='closed' where id=p_poll_id and family_id=fid;
  return found;
end; $function$
;
CREATE OR REPLACE FUNCTION public.gw_create_dinner(p_token text, p_draft jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare d jsonb; places uuid[]; people uuid[]; pid uuid;
begin
 d:=public.gw_validate_dinner_draft(p_token,p_draft);
 select array_agg(value::uuid) into places from jsonb_array_elements_text(d->'place_ids');
 select array_agg(value::uuid) into people from jsonb_array_elements_text(d->'member_ids');
 pid:=public.gw_create_poll_themed(p_token,d->>'meal',d->>'method',places,people,(d->>'allow_member_home')::boolean,(d->>'group_join')::boolean,d->>'cuisine');
 update public.gw_polls set title=d->>'title',auto_tie=(d->>'auto_tie')::boolean where id=pid;
 return pid;
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_create_family(p_name text, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end; $function$
;
CREATE OR REPLACE FUNCTION public.gw_create_poll(p_token text, p_meal text, p_method text, p_expected_voters integer, p_restaurant_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end; $function$
;
CREATE OR REPLACE FUNCTION public.gw_create_poll_configured(p_token text, p_meal text, p_method text, p_restaurant_ids uuid[], p_member_ids uuid[], p_allow_member_home boolean DEFAULT true, p_group_join boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare pid uuid;
begin
 pid:=public.gw_create_poll_for_members(p_token,p_meal,p_method,p_restaurant_ids,p_member_ids);
 perform public.gw_poll_settings(p_token,pid,p_allow_member_home,p_group_join);
 return pid;
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_create_poll_for_members(p_token text, p_meal text, p_method text, p_restaurant_ids uuid[], p_member_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare fid uuid; pid uuid; n integer:=coalesce(cardinality(p_member_ids),0);
begin
 select id into fid from public.gw_families where token=p_token;
 if fid is null then raise exception 'Owner access denied'; end if;
 if n not between 1 and 20 then raise exception 'Choose 1–20 family members'; end if;
 if (select count(distinct id) from unnest(p_member_ids) as x(id))<>n then raise exception 'Choose different members'; end if;
 if (select count(*) from public.gw_members where family_id=fid and active and id=any(p_member_ids))<>n then raise exception 'Choose active members from your family'; end if;
 pid:=public.gw_create_poll(p_token,p_meal,p_method,n,p_restaurant_ids);
 update public.gw_polls set roster_enabled=true where id=pid;
 insert into public.gw_poll_members(poll_id,member_id) select pid,unnest(p_member_ids);
 return pid;
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_create_poll_themed(p_token text, p_meal text, p_method text, p_restaurant_ids uuid[], p_member_ids uuid[], p_allow_member_home boolean DEFAULT false, p_group_join boolean DEFAULT true, p_cuisine text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare pid uuid;
begin
 if p_cuisine is null or not p_cuisine=any(array['','pizza','mexican','burgers','chicken','italian','asian','seafood','steak','cafe']) then raise exception 'Choose a supported cuisine'; end if;
 pid:=public.gw_create_poll_configured(p_token,p_meal,p_method,p_restaurant_ids,p_member_ids,p_allow_member_home,p_group_join);
 update public.gw_polls set cuisine=p_cuisine where id=pid;
 return pid;
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_delete_polls(p_token text, p_poll_ids uuid[] DEFAULT NULL::uuid[], p_finished boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare fid uuid; n integer;
begin
 select id into fid from public.gw_families where token=p_token;
 if fid is null then raise exception 'Organizer access denied'; end if;
 if coalesce(p_finished,false) then
  delete from public.gw_polls p where p.family_id=fid and (p.status='closed' or (select count(*) from public.gw_ballots b where b.poll_id=p.id)>=p.expected_voters);
 else
  if coalesce(cardinality(p_poll_ids),0) not between 1 and 100 then raise exception 'Choose votes to delete'; end if;
  if exists(select 1 from unnest(p_poll_ids) x(id) where not exists(select 1 from public.gw_polls p where p.id=x.id and p.family_id=fid)) then raise exception 'Vote not found in this family'; end if;
  delete from public.gw_polls where family_id=fid and id=any(p_poll_ids);
 end if;
 get diagnostics n=row_count;
 return n;
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_dinner_ballot_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin perform public.gw_process_dinner_poll(new.poll_id);return new;end $function$
;
CREATE OR REPLACE FUNCTION public.gw_dinner_decision(p_poll_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p public.gw_polls; n integer; active uuid[]; leaders uuid[]; lows uuid[]; counts jsonb; highest integer; lowest integer; cast_count integer;
begin
 select * into p from public.gw_polls where id=p_poll_id;if not found then return null;end if;
 select count(*) into n from public.gw_ballots where poll_id=p.id;
 if p.status<>'closed' and n<p.expected_voters then return jsonb_build_object('kind','open');end if;
 if n=0 then return jsonb_build_object('kind','empty','highest',0);end if;
 select array_agg(restaurant_id order by restaurant_id) into active from public.gw_poll_options where poll_id=p.id;
 loop
  select jsonb_object_agg(id::text,votes) into counts from (select id,(select count(*) from public.gw_ballots b where b.poll_id=p.id and case p.method when 'approval' then b.ballot ? id::text when 'swipe' then b.ballot->id::text='true'::jsonb else (select value from jsonb_array_elements_text(b.ballot) with ordinality r(value,ord) where value=any(active::text[]) order by ord limit 1)=id::text end) votes from unnest(active) o(id)) tally;
  select max(value::integer),min(value::integer),sum(value::integer) into highest,lowest,cast_count from jsonb_each_text(counts);
  select array_agg(id) into leaders from unnest(active) o(id) where (counts->>id::text)::integer=highest;
  exit when p.method<>'ranked' or highest>cast_count/2.0 or cardinality(active)=1 or highest=lowest;
  select array_agg(id) into lows from unnest(active) o(id) where (counts->>id::text)::integer=lowest;
  select array_agg(id) into active from unnest(active) o(id) where not id=any(lows);
 end loop;
 return jsonb_build_object('kind',case when p.method='swipe' and coalesce(highest,0)=0 then 'no-choice' when cardinality(leaders)>1 and not coalesce(p.tie_winner_id=any(leaders),false) then 'tie' else 'decided' end,'highest',highest,'leaders',leaders);
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_dinner_poll_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin if new.status is distinct from old.status or new.tie_winner_id is distinct from old.tie_winner_id then perform public.gw_process_dinner_poll(new.id);end if;return new;end $function$
;
CREATE OR REPLACE FUNCTION public.gw_get_dinner_preset(p_token text, p_preset_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare preset public.gw_dinner_presets;
begin
 select x.* into preset from public.gw_dinner_presets x join public.gw_families f on f.id=x.family_id where x.id=p_preset_id and x.active and f.token=p_token;
 if not found then raise exception 'Preset unavailable';end if;
 return jsonb_build_object('id',preset.id,'name',preset.name,'draft',preset.draft,
 'options',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',coalesce(r.name,'Unavailable place'),'active',coalesce(r.active,false)) order by x.ord),'[]') from jsonb_array_elements_text(preset.draft->'place_ids') with ordinality v(id,ord) cross join lateral (select v.id::uuid id,v.ord) x left join public.gw_restaurants r on r.id=x.id and r.family_id=preset.family_id),
 'people',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',coalesce(m.name,'Unavailable person'),'active',coalesce(m.active,false)) order by x.ord),'[]') from jsonb_array_elements_text(preset.draft->'member_ids') with ordinality v(id,ord) cross join lateral (select v.id::uuid id,v.ord) x left join public.gw_members m on m.id=x.id and m.family_id=preset.family_id));
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_get_family(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare f public.gw_families;
begin
  select * into f from public.gw_families where token=p_token;
  if not found then raise exception 'Family invite code not found'; end if;
  return jsonb_build_object(
    'id',f.id,'name',f.name,
    'restaurants',coalesce((
      select jsonb_agg(jsonb_build_object('id',id,'name',name,'category',category,
        'address',address,'latitude',latitude,'longitude',longitude,'osm_id',osm_id,'icon_mode',icon_mode,'icon_value',icon_value)
        order by name) from public.gw_restaurants
      where family_id=f.id and active=true
    ),'[]'::jsonb),
    'polls',coalesce((
      select jsonb_agg(jsonb_build_object('id',q.id,'title',q.title,'auto_tie',q.auto_tie,'meal',q.meal,'method',q.method,
        'expected_voters',q.expected_voters,'status',q.status,
        'created_at',q.created_at,'voted_count',
        (select count(*) from public.gw_ballots b where b.poll_id=q.id))
        order by q.created_at desc)
      from (select * from public.gw_polls where family_id=f.id
            order by created_at desc limit 20) q
    ),'[]'::jsonb)
  );
end; $function$
;
CREATE OR REPLACE FUNCTION public.gw_get_member(p_member_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare m public.gw_members; f public.gw_families;
begin
 select * into m from public.gw_members where token=p_member_token and active;
 if not found then raise exception 'Personal link invalid or reset'; end if;
 select * into f from public.gw_families where id=m.family_id;
 return jsonb_build_object('id',m.id,'name',m.name,'avatar',m.avatar,'family',public.gw_get_family(f.token));
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_get_my_ballot(p_poll_id uuid, p_member_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare m public.gw_members; fid uuid; own_ballot jsonb;
begin
 select * into m from public.gw_members where token=p_member_token and active;
 if not found then raise exception 'Personal link invalid or reset'; end if;
 select family_id into fid from public.gw_polls where id=p_poll_id;
 if fid is distinct from m.family_id then raise exception 'Poll is not in this family'; end if;
 select ballot into own_ballot from public.gw_ballots where poll_id=p_poll_id and voter_key=m.id::text;
 return own_ballot;
end $function$
;
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
 return jsonb_build_object('id',p.id,'title',p.title,'auto_tie',p.auto_tie,'meal',p.meal,'method',p.method,'status',case when ready then 'closed' else 'open' end,'tie_winner_id',p.tie_winner_id,'cuisine',p.cuisine,'allow_member_home',p.allow_member_home,'roster_enabled',p.roster_enabled,'expected_voters',p.expected_voters,'voted_count',n,'created_at',p.created_at,
 'options',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'category',r.category,'address',r.address,'icon_mode',r.icon_mode,'icon_value',r.icon_value) order by r.name) from public.gw_poll_options o join public.gw_restaurants r on r.id=o.restaurant_id where o.poll_id=p.id),'[]'),
 'ballots',case when ready then coalesce((select jsonb_agg(b.ballot) from public.gw_ballots b where b.poll_id=p.id),'[]') else null end);
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_get_poll_people(p_poll_id uuid, p_token text DEFAULT NULL::text, p_member_token text DEFAULT NULL::text, p_include_avatars boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p public.gw_polls; caller uuid; is_owner boolean; people jsonb;
begin
 select * into p from public.gw_polls where id=p_poll_id;
 if not found then raise exception 'Vote link not found'; end if;
 select exists(select 1 from public.gw_families where id=p.family_id and token=p_token) into is_owner;
 if not is_owner then
  select id into caller from public.gw_members where family_id=p.family_id and token=p_member_token and active;
  if caller is null then raise exception 'Family access denied'; end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'avatar',case when p_include_avatars then m.avatar else null end,'active',m.active,'voted',exists(select 1 from public.gw_ballots b where b.poll_id=p.id and b.voter_key=m.id::text)) order by m.created_at,m.name),'[]'::jsonb)
 into people from public.gw_members m where m.family_id=p.family_id and (
  (p.roster_enabled and exists(select 1 from public.gw_poll_members pm where pm.poll_id=p.id and pm.member_id=m.id))
  or (not p.roster_enabled and (m.active or exists(select 1 from public.gw_ballots b where b.poll_id=p.id and b.voter_key=m.id::text)))
 );
 return jsonb_build_object('rostered',p.roster_enabled,'people',people,'eligible',caller is not null and (not p.roster_enabled or exists(select 1 from public.gw_poll_members where poll_id=p.id and member_id=caller)));
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_group_poll(p_poll_id uuid, p_group_token text, p_member_id uuid DEFAULT NULL::uuid, p_action text DEFAULT 'people'::text, p_ballot jsonb DEFAULT NULL::jsonb, p_include_avatars boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p public.gw_polls; m public.gw_members; data jsonb;
begin
 select * into p from public.gw_polls where id=p_poll_id and group_join_token=p_group_token and group_join_token is not null for update;
 if not found then raise exception 'Group invitation unavailable. Ask the organizer for a personal link.'; end if;
 if p_action='people' then
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'avatar',case when p_include_avatars then x.avatar else null end,'active',x.active,'voted',exists(select 1 from public.gw_ballots b where b.poll_id=p.id and b.voter_key=x.id::text)) order by x.created_at,x.name),'[]'::jsonb) into data
  from public.gw_members x join public.gw_poll_members pm on pm.member_id=x.id and pm.poll_id=p.id where x.family_id=p.family_id;
  return jsonb_build_object('family_id',p.family_id,'rostered',true,'people',data,'eligible',exists(select 1 from public.gw_poll_members pm join public.gw_members x on x.id=pm.member_id where pm.poll_id=p.id and x.id=p_member_id and x.active and x.family_id=p.family_id));
 end if;
 select x.* into m from public.gw_members x join public.gw_poll_members pm on pm.member_id=x.id and pm.poll_id=p.id where x.id=p_member_id and x.family_id=p.family_id and x.active;
 if not found then raise exception 'Choose an invited family member'; end if;
 if p_action='identity' then return jsonb_build_object('id',m.id,'name',m.name,'avatar',m.avatar); end if;
 if p_action='has_voted' then return to_jsonb(public.gw_member_has_voted(p.id,m.token)); end if;
 if p_action='vote' then
  if public.gw_member_has_voted(p.id,m.token) then raise exception 'This person has already voted. Use their personal link to edit.'; end if;
  return public.gw_vote_as_member(p.id,m.token,p_ballot);
 end if;
 raise exception 'Unsupported group action';
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_list_members(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare fid uuid;
begin
 select id into fid from public.gw_families where token=p_token;
 if fid is null then raise exception 'Owner access denied'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'token',m.token,'avatar',m.avatar,'phone',m.phone,'created_at',m.created_at) order by m.created_at,m.name) from public.gw_members m where m.family_id=fid and m.active),'[]'::jsonb);
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_member_has_voted(p_poll_id uuid, p_member_token text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare m public.gw_members;
begin
 select * into m from public.gw_members where token=p_member_token and active;
 if not found then raise exception 'Personal link invalid or reset'; end if;
 if not exists(select 1 from public.gw_polls where id=p_poll_id and family_id=m.family_id)
 then raise exception 'Poll is not in this family'; end if;
 return exists(select 1 from public.gw_ballots where poll_id=p_poll_id and voter_key=m.id::text);
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_nominate_restaurant(p_member_token text, p_name text, p_address text DEFAULT ''::text, p_category text DEFAULT ''::text, p_note text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare m public.gw_members; rid uuid;
begin
 select * into m from public.gw_members where token=p_member_token and active;
 if not found then raise exception 'Use your active personal family link to suggest a place';end if;
 perform 1 from public.gw_families where id=m.family_id for update;
 if public.gw_restaurant_key(p_name)='' or char_length(btrim(coalesce(p_name,''))) not between 1 and 120 or char_length(coalesce(p_address,''))>240 or char_length(coalesce(p_category,''))>80 or char_length(coalesce(p_note,''))>250 then raise exception 'Check the suggested name, address, category and note';end if;
 select id into rid from public.gw_nominations where member_id=m.id and status='pending' and public.gw_restaurant_key(name)=public.gw_restaurant_key(p_name) and public.gw_restaurant_key(address)=public.gw_restaurant_key(p_address);
 if rid is not null then return rid;end if;
 if (select count(*) from public.gw_nominations where member_id=m.id and status='pending')>=10 or (select count(*) from public.gw_nominations where family_id=m.family_id and status='pending')>=100 then raise exception 'Please wait for the organizer to review existing suggestions';end if;
 insert into public.gw_nominations(family_id,member_id,name,address,category,note) values(m.family_id,m.id,btrim(p_name),btrim(coalesce(p_address,'')),btrim(coalesce(p_category,'')),btrim(coalesce(p_note,''))) returning id into rid;return rid;
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_planning_home(p_token text DEFAULT NULL::text, p_member_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare fid uuid; mid uuid; owner boolean:=false;
begin
 if p_token is not null then select id into fid from public.gw_families where token=p_token;owner:=true;
 else select family_id,id into fid,mid from public.gw_members where token=p_member_token and active;end if;
 if fid is null then raise exception 'Family access denied';end if;
 return jsonb_build_object('ready',true,'can_nominate',not owner,'caption',case when owner then coalesce((select results_caption from public.gw_family_settings where family_id=fid),'') else '' end,
 'active_polls',case when owner then (select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'title',q.title,'meal',q.meal,'method',q.method,'status','open','created_at',q.created_at,'expected_voters',q.expected_voters,'voted_count',(select count(*) from public.gw_ballots where poll_id=q.id)) order by q.created_at desc),'[]') from (select * from public.gw_polls p where p.family_id=fid and p.status='open' and (select count(*) from public.gw_ballots where poll_id=p.id)<p.expected_voters order by created_at desc limit 20) q) else '[]'::jsonb end,
 'presets',case when owner then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'places',jsonb_array_length(draft->'place_ids'),'people',jsonb_array_length(draft->'member_ids')) order by created_at),'[]') from public.gw_dinner_presets where family_id=fid and active) else '[]'::jsonb end,
 'nominations',(select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'name',n.name,'address',n.address,'category',n.category,'note',n.note,'status',n.status,'by_name',case when owner then m.name else null end,'created_at',n.created_at) order by n.created_at desc),'[]') from (select * from public.gw_nominations where family_id=fid and (owner or member_id=mid) order by created_at desc limit 100) n join public.gw_members m on m.id=n.member_id),
 'events',case when owner then (select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'poll_id',e.poll_id,'kind',e.kind,'title',p.title,'created_at',e.created_at) order by e.created_at desc),'[]') from (select * from public.gw_dinner_events where family_id=fid order by created_at desc limit 10) e join public.gw_polls p on p.id=e.poll_id) else '[]'::jsonb end);
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_poll_settings(p_token text, p_poll_id uuid, p_allow_member_home boolean DEFAULT NULL::boolean, p_group_join boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p public.gw_polls;
begin
 select q.* into p from public.gw_polls q join public.gw_families f on f.id=q.family_id where q.id=p_poll_id and f.token=p_token for update of q;
 if not found then raise exception 'Organizer access denied'; end if;
 if p_group_join is true and not p.roster_enabled then raise exception 'Create a vote with selected members to use group access'; end if;
 update public.gw_polls set allow_member_home=coalesce(p_allow_member_home,allow_member_home),
 group_join_token=case when p_group_join is false then null when p_group_join is true then coalesce(group_join_token,replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','')) else group_join_token end
 where id=p.id returning * into p;
 return jsonb_build_object('allow_member_home',p.allow_member_home,'group_join_token',p.group_join_token);
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_process_dinner_poll(p_poll_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p public.gw_polls; d jsonb; owner_token text; event_phase text;
begin
 select * into p from public.gw_polls where id=p_poll_id for update;if not found then return;end if;
 d:=public.gw_dinner_decision(p.id);if d->>'kind'='open' then return;end if;
 if p.auto_tie and p.tie_winner_id is null and d->>'kind'='tie' and (d->>'highest')::integer>0 then
  select token into owner_token from public.gw_families where id=p.family_id;
  perform public.gw_resolve_tie_random(owner_token,p.id);d:=public.gw_dinner_decision(p.id);
 end if;
 event_phase:=case when d->>'kind'='decided' and exists(select 1 from public.gw_dinner_events where poll_id=p.id and phase='completion' and kind='tie') then 'resolved' else 'completion' end;
 insert into public.gw_dinner_events(family_id,poll_id,phase,kind) values(p.family_id,p.id,event_phase,d->>'kind') on conflict(poll_id,phase) do nothing;
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_remove_member(p_token text, p_member_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare fid uuid; changed integer;
begin
  select id into fid from public.gw_families where token=p_token;
  if fid is null then raise exception 'Owner access denied'; end if;
  update public.gw_members set active=false where id=p_member_id and family_id=fid and active;
  get diagnostics changed=row_count;
  return changed>0;
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_rename_member(p_token text, p_member_id uuid, p_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare fid uuid; m public.gw_members; clean_name text;
begin
  select id into fid from public.gw_families where token=p_token;
  if fid is null then raise exception 'Owner access denied'; end if;
  clean_name:=btrim(coalesce(p_name,''));
  if char_length(clean_name) not between 1 and 60 then raise exception 'Enter a name (1–60 characters)'; end if;
  update public.gw_members set name=clean_name
  where id=p_member_id and family_id=fid and active returning * into m;
  if not found then raise exception 'Member not found'; end if;
  update public.gw_ballots b set voter_name=clean_name where b.voter_key=m.id::text;
  return jsonb_build_object('id',m.id,'name',m.name,'token',m.token);
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_resolve_tie_random(p_token text, p_poll_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p public.gw_polls; n integer; active uuid[]; leaders uuid[]; lows uuid[];
 counts jsonb; highest integer; lowest integer; cast_count integer; chosen uuid;
begin
 select q.* into p from public.gw_polls q join public.gw_families f on f.id=q.family_id
 where q.id=p_poll_id and f.token=p_token for update of q;
 if not found then raise exception 'Organizer access denied'; end if;
 -- A retry, second device or concurrent request must return the original draw.
 if p.tie_winner_id is not null then return p.tie_winner_id; end if;
 select count(*) into n from public.gw_ballots where poll_id=p.id;
 if n=0 or (p.status<>'closed' and n<p.expected_voters) then
  raise exception 'Wait for voting to finish before breaking a tie';
 end if;
 select array_agg(restaurant_id order by restaurant_id) into active from public.gw_poll_options where poll_id=p.id;
 loop
  -- Recompute leaders from stored ballots, never from a client-supplied shortlist.
  select jsonb_object_agg(id::text,votes) into counts from (
   select id,(select count(*) from public.gw_ballots b where b.poll_id=p.id and
    case p.method
     when 'approval' then b.ballot ? id::text
     when 'swipe' then b.ballot->id::text='true'::jsonb
     else (select value from jsonb_array_elements_text(b.ballot) with ordinality as r(value,ord)
           where value=any(active::text[]) order by ord limit 1)=id::text
    end) as votes from unnest(active) as o(id)
  ) tally;
  select max(value::integer),min(value::integer),sum(value::integer)
   into highest,lowest,cast_count from jsonb_each_text(counts);
  select array_agg(id) into leaders from unnest(active) as o(id) where (counts->>id::text)::integer=highest;
  exit when p.method<>'ranked' or highest>cast_count/2.0 or cardinality(active)=1 or highest=lowest;
  -- Match voting.js: eliminate all equally lowest candidates together.
  select array_agg(id) into lows from unnest(active) as o(id) where (counts->>id::text)::integer=lowest;
  select array_agg(id) into active from unnest(active) as o(id) where not id=any(lows);
 end loop;
 -- H1: reject new all-no consensus draws, including calls from older clients.
 -- Keep this AFTER the authenticated saved-pick return above: history is immutable.
 if p.method='swipe' and coalesce(highest,0)=0 then
  raise exception 'No restaurant received a yes vote. Start a new shortlist';
 end if;
 if coalesce(cardinality(leaders),0)<2 then raise exception 'This vote does not need a tiebreaker'; end if;
 chosen:=leaders[1+floor(random()*cardinality(leaders))::integer];
 update public.gw_polls set tie_winner_id=chosen,status='closed' where id=p.id;
 return chosen;
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_restaurant_key(value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
 select translate(btrim(regexp_replace(coalesce(value,''), '[[:space:]]+', ' ', 'g')),
 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')
$function$
;
CREATE OR REPLACE FUNCTION public.gw_review_nomination(p_token text, p_nomination_id uuid, p_restaurant_id uuid DEFAULT NULL::uuid, p_dismiss boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare fid uuid; n public.gw_nominations;
begin
 select id into fid from public.gw_families where token=p_token;if fid is null then raise exception 'Organizer access denied';end if;
 select * into n from public.gw_nominations where id=p_nomination_id and family_id=fid for update;
 if not found then raise exception 'Suggestion unavailable';end if;
 if n.status<>'pending' then
  if (p_dismiss and n.status='dismissed') or (not p_dismiss and n.status='accepted' and n.restaurant_id=p_restaurant_id) then return true;end if;
  raise exception 'This suggestion has already been reviewed. Saved locations remain unchanged';
 end if;
 if p_dismiss then update public.gw_nominations set status='dismissed',restaurant_id=null where id=n.id;
 else
  if not exists(select 1 from public.gw_restaurants where id=p_restaurant_id and family_id=fid and active) then raise exception 'Choose a current saved location';end if;
  update public.gw_nominations set status='accepted',restaurant_id=p_restaurant_id where id=n.id;
 end if;return true;
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_rotate_member(p_token text, p_member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare fid uuid; m public.gw_members;
begin
  select id into fid from public.gw_families where token=p_token;
  if fid is null then raise exception 'Owner access denied'; end if;
  update public.gw_members set token=encode(extensions.gen_random_bytes(24),'hex')
  where id=p_member_id and family_id=fid and active returning * into m;
  if not found then raise exception 'Member not found'; end if;
  return jsonb_build_object('id',m.id,'name',m.name,'token',m.token);
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_save_dinner_preset(p_token text, p_name text, p_draft jsonb, p_preset_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare d jsonb; fid uuid; rid uuid;
begin
 d:=public.gw_validate_dinner_draft(p_token,p_draft);select id into fid from public.gw_families where token=p_token;
 if public.gw_restaurant_key(p_name)='' or char_length(btrim(coalesce(p_name,''))) not between 1 and 60 then raise exception 'Preset name must contain 1–60 characters';end if;
 if exists(select 1 from public.gw_dinner_presets where family_id=fid and active and public.gw_restaurant_key(name)=public.gw_restaurant_key(p_name) and id is distinct from p_preset_id) then raise exception 'A preset already uses that name. Open it to update its choices';end if;
 if p_preset_id is null then
  if (select count(*) from public.gw_dinner_presets where family_id=fid and active)>=20 then raise exception 'Maximum of 20 presets';end if;
  insert into public.gw_dinner_presets(family_id,name,draft) values(fid,btrim(p_name),d) returning id into rid;
 else
  update public.gw_dinner_presets set name=btrim(p_name),draft=d where id=p_preset_id and family_id=fid and active returning id into rid;
  if rid is null then raise exception 'Preset unavailable';end if;
 end if;
 return rid;
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_save_restaurant_location(p_token text, p_name text, p_category text DEFAULT ''::text, p_address text DEFAULT ''::text, p_osm_id text DEFAULT NULL::text, p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_keep_separate boolean DEFAULT false, p_use_restaurant_id uuid DEFAULT NULL::uuid, p_icon_mode text DEFAULT 'auto'::text, p_icon_value text DEFAULT ''::text, p_reviewed_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare fid uuid; rid uuid; existing public.gw_restaurants; matches jsonb; exact_ids uuid[];
 nk text:=public.gw_restaurant_key(p_name); ak text:=public.gw_restaurant_key(p_address); sk text:=public.gw_restaurant_key(p_osm_id);
begin
 -- Serialize same-family save/restore decisions, including cross-source/manual races.
 select id into fid from public.gw_families where token=p_token for update;
 if fid is null then raise exception 'Family access denied'; end if;
 if nk='' or char_length(btrim(coalesce(p_name,''))) not between 1 and 120 then raise exception 'Restaurant name must contain 1–120 characters';end if;
 if char_length(coalesce(p_address,''))>240 or char_length(coalesce(p_category,''))>80 then raise exception 'Restaurant address or category is too long';end if;
 if sk<>'' and (char_length(sk)>100 or sk !~ '^(node|way|relation)/[1-9][0-9]*$') then raise exception 'Invalid OpenStreetMap identity';end if;
 if (p_latitude is null)<>(p_longitude is null) or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'Invalid restaurant coordinates';end if;
 if sk='' and (p_latitude is not null or p_longitude is not null) then raise exception 'Coordinates require an OpenStreetMap identity';end if;
 if p_use_restaurant_id is not null then
  select * into existing from public.gw_restaurants where id=p_use_restaurant_id and family_id=fid;
  if not found then raise exception 'Saved location not found in your family';end if;
 elsif sk<>'' then
  select * into existing from public.gw_restaurants where family_id=fid and public.gw_restaurant_key(osm_id)=sk;
 else
  if ak<>'' then
   select array_agg(id order by id) into exact_ids from public.gw_restaurants where family_id=fid and public.gw_restaurant_key(name)=nk and public.gw_restaurant_key(address)=ak;
   if cardinality(exact_ids)=1 then select * into existing from public.gw_restaurants where id=exact_ids[1];end if;
  end if;
 end if;
 if existing.id is not null then
  if not existing.active and (select count(*) from public.gw_restaurants where family_id=fid and active)>=250 then raise exception 'Maximum of 250 restaurants';end if;
  update public.gw_restaurants set active=true where id=existing.id;
  -- A retry or restore never overwrites saved name/address, coordinates or visuals.
  return jsonb_build_object('status','saved','id',existing.id,'created',false,'restored',not existing.active);
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'category',r.category,'address',r.address,'osm_id',r.osm_id,'active',r.active,'match','possible') order by r.active desc,r.created_at,r.id),'[]'::jsonb)
 into matches from public.gw_restaurants r where r.family_id=fid and (
  public.gw_restaurant_key(r.name)=nk or
  (regexp_replace(nk,'[^a-z0-9]','','g')<>'' and regexp_replace(public.gw_restaurant_key(r.name),'[^a-z0-9]','','g')=regexp_replace(nk,'[^a-z0-9]','','g')) or
  (ak<>'' and public.gw_restaurant_key(r.address)=ak));
 if (coalesce(cardinality(exact_ids),0)>1) or (not coalesce(p_keep_separate,false) and (jsonb_array_length(matches)>0 or ak=''))
 or exists(select 1 from jsonb_array_elements(matches) m where not ((m->>'id')::uuid=any(coalesce(p_reviewed_ids,'{}'::uuid[])))) then
  return jsonb_build_object('status','review','matches',matches,'can_keep_separate',coalesce(cardinality(exact_ids),0)<2,'reason',case when coalesce(cardinality(exact_ids),0)>1 then 'Multiple saved places match this name and address. Choose the intended saved location or edit the address.' when ak='' then 'Location not saved. Review possible matches before keeping a separate place.' else 'Possible duplicate. Compare locations before saving separately.' end);
 end if;
 if (select count(*) from public.gw_restaurants where family_id=fid and active)>=250 then raise exception 'Maximum of 250 restaurants';end if;
 insert into public.gw_restaurants(family_id,name,category,address,osm_id,latitude,longitude)
 values(fid,btrim(p_name),coalesce(p_category,''),btrim(coalesce(p_address,'')),nullif(sk,''),p_latitude,p_longitude) returning id into rid;
 -- Reuse the deployed visual validation inside the same atomic transaction, only on NEW rows.
 perform public.gw_update_restaurant(p_token,rid,btrim(p_name),coalesce(p_category,''),btrim(coalesce(p_address,'')),coalesce(p_icon_mode,'auto'),coalesce(p_icon_value,''));
 return jsonb_build_object('status','saved','id',rid,'created',true,'restored',false);
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_set_results_caption(p_token text, p_caption text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare fid uuid; caption text:=btrim(coalesce(p_caption,''));
begin
 select id into fid from public.gw_families where token=p_token;if fid is null then raise exception 'Organizer access denied';end if;
 if char_length(caption)>100 then raise exception 'Caption must contain at most 100 characters';end if;
 insert into public.gw_family_settings(family_id,results_caption) values(fid,caption) on conflict(family_id) do update set results_caption=excluded.results_caption;return caption;
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_update_member_profile(p_token text, p_member_id uuid, p_name text, p_avatar text, p_phone text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare fid uuid; clean_name text:=btrim(coalesce(p_name,'')); a text:=coalesce(p_avatar,'🙂'); ph text:=btrim(coalesce(p_phone,''));
begin
 select id into fid from public.gw_families where token=p_token;
 if fid is null then raise exception 'Owner access denied'; end if;
 if char_length(clean_name) not between 1 and 60 then raise exception 'Enter a name (1–60 characters)'; end if;
 if not (a=any(array['🙂','😀','😎','🥰','🧑‍🍳','👩','👨','👧','👦','👶','🐶','🐱','🦊','🐻','🦄','🏀']) or (length(a)<=120000 and a ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$')) then raise exception 'Choose an emoji or upload a photo'; end if;
 if length(ph)>254 or (ph<>'' and ph !~ '^\+?[0-9]{7,15}$' and ph !~ '^[A-Za-z0-9._+-]+@[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$') then raise exception 'Enter a phone number or iMessage email'; end if;
 update public.gw_members set name=clean_name,avatar=a,phone=ph where id=p_member_id and family_id=fid and active;
 if not found then raise exception 'Member not found'; end if;
 return true;
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_update_restaurant(p_token text, p_restaurant_id uuid, p_name text, p_category text, p_address text, p_icon_mode text, p_icon_value text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare fid uuid; rid uuid; vmode text; vtext text;
begin
 select id into fid from public.gw_families where token=p_token;
 if fid is null then raise exception 'Owner access denied'; end if;
 if char_length(btrim(coalesce(p_name,''))) not between 1 and 120 then
  raise exception 'Restaurant name must be 1–120 characters'; end if;
 vmode:=coalesce(p_icon_mode,'auto');
 vtext:=btrim(coalesce(p_icon_value,''));
 if vmode not in ('auto','logo_url','website','builtin') then
  raise exception 'Unknown icon type'; end if;
 if char_length(vtext)>500 then raise exception 'Logo input is too long'; end if;
 if vmode='logo_url' and (vtext !~* '^https://[^[:space:]]+$' or vtext ~ '@') then
  raise exception 'Logo URL must be a public https:// image address'; end if;
 if vmode='website' and vtext !~* '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$' then
  raise exception 'Enter a valid website domain such as culvers.com'; end if;
 if vmode='builtin' and vtext not in ('restaurant','pizza','burger','taco','sandwich','pasta','steak','chicken','breakfast','coffee','dessert','icecream','sushi','seafood','healthy') then
  raise exception 'Choose an icon from the list'; end if;
 if vmode='auto' then vtext:=''; end if;
 update public.gw_restaurants set name=btrim(p_name),category=left(coalesce(p_category,''),80),
  address=left(coalesce(p_address,''),240),icon_mode=vmode,icon_value=vtext
 where id=p_restaurant_id and family_id=fid and active=true
 returning id into rid;
 if rid is null then raise exception 'Restaurant not found'; end if;
 return rid;
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_validate_dinner_draft(p_token text, p_draft jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare fid uuid; places uuid[]; people uuid[]; meal text; method text; cuisine text; title text; k text;
begin
 select id into fid from public.gw_families where token=p_token for update;
 if fid is null then raise exception 'Organizer access denied';end if;
 if jsonb_typeof(p_draft) is distinct from 'object' or p_draft-array['place_ids','member_ids','meal','method','cuisine','title','auto_tie','allow_member_home','group_join']<>'{}'::jsonb then raise exception 'Invalid dinner draft fields';end if;
 if jsonb_typeof(p_draft->'place_ids') is distinct from 'array' or jsonb_typeof(p_draft->'member_ids') is distinct from 'array' then raise exception 'Choose places and people';end if;
 select array_agg(value::uuid) into places from jsonb_array_elements_text(p_draft->'place_ids');
 select array_agg(value::uuid) into people from jsonb_array_elements_text(p_draft->'member_ids');
 if coalesce(cardinality(places),0) not between 2 and 20 or coalesce(cardinality(people),0) not between 1 and 20 then raise exception 'Choose 2–20 places and 1–20 people';end if;
 if (select count(distinct x) from unnest(places) x)<>cardinality(places) or (select count(distinct x) from unnest(people) x)<>cardinality(people) then raise exception 'Duplicate draft selections';end if;
 if (select count(*) from public.gw_restaurants where family_id=fid and active and id=any(places))<>cardinality(places) or (select count(*) from public.gw_members where family_id=fid and active and id=any(people))<>cardinality(people) then raise exception 'Places or people changed. Review the draft again';end if;
 meal:=p_draft->>'meal';method:=p_draft->>'method';cuisine:=coalesce(p_draft->>'cuisine','');title:=btrim(coalesce(p_draft->>'title',''));
 if meal is null or meal not in ('Lunch','Dinner') or method is null or method not in ('approval','swipe','ranked') or cuisine not in ('','pizza','mexican','burgers','chicken','italian','asian','seafood','steak','cafe') or char_length(title)>80 then raise exception 'Invalid dinner choices';end if;
 foreach k in array array['auto_tie','allow_member_home','group_join'] loop
  if p_draft?k and jsonb_typeof(p_draft->k) is distinct from 'boolean' then raise exception 'Invalid voting option';end if;
 end loop;
 return jsonb_build_object('place_ids',places,'member_ids',people,'meal',meal,'method',method,'cuisine',cuisine,'title',title,'auto_tie',coalesce((p_draft->>'auto_tie')::boolean,false),'allow_member_home',coalesce((p_draft->>'allow_member_home')::boolean,false),'group_join',coalesce((p_draft->>'group_join')::boolean,true));
end $function$
;
CREATE OR REPLACE FUNCTION public.gw_vote(p_poll_id uuid, p_voter_name text, p_ballot jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end; $function$
;
CREATE OR REPLACE FUNCTION public.gw_vote_as_member(p_poll_id uuid, p_member_token text, p_ballot jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare m public.gw_members; p public.gw_polls; outcome jsonb;
begin
 select * into m from public.gw_members where token=p_member_token and active;
 if not found then raise exception 'Personal link invalid or reset'; end if;
 select * into p from public.gw_polls where id=p_poll_id;
 if p.family_id is distinct from m.family_id then raise exception 'This poll belongs to another family'; end if;
 if p.roster_enabled and not exists(select 1 from public.gw_poll_members where poll_id=p.id and member_id=m.id) then raise exception 'You are not invited to this vote. Ask the organizer.'; end if;
 outcome:=public.gw_vote(p_poll_id,m.id::text,p_ballot);
 update public.gw_ballots set voter_name=m.name where poll_id=p.id and voter_key=m.id::text;
 return outcome;
end $function$
;
create function public.gw_push_status(p_token text,p_endpoint text default null) returns jsonb
 language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if not exists(select 1 from public.gw_families where token=p_token) then raise exception 'Organizer access denied';end if;
 return jsonb_build_object('configured',false,'enabled',false,'public_key',null);
end $$;
revoke all on function public.gw_push_status(text,text) from public,anon,authenticated;
grant execute on function public.gw_push_status(text,text) to anon,authenticated;
set local check_function_bodies=on;
revoke all on function public."gw_add_member"(p_token text, p_name text) from public,anon,authenticated;
grant execute on function public."gw_add_member"(p_token text, p_name text) to anon;
grant execute on function public."gw_add_member"(p_token text, p_name text) to authenticated;
revoke all on function public."gw_add_restaurant"(p_token text, p_name text, p_category text, p_address text, p_osm_id text, p_latitude double precision, p_longitude double precision) from public,anon,authenticated;
grant execute on function public."gw_add_restaurant"(p_token text, p_name text, p_category text, p_address text, p_osm_id text, p_latitude double precision, p_longitude double precision) to anon;
grant execute on function public."gw_add_restaurant"(p_token text, p_name text, p_category text, p_address text, p_osm_id text, p_latitude double precision, p_longitude double precision) to authenticated;
revoke all on function public."gw_archive_dinner_preset"(p_token text, p_preset_id uuid) from public,anon,authenticated;
grant execute on function public."gw_archive_dinner_preset"(p_token text, p_preset_id uuid) to anon;
grant execute on function public."gw_archive_dinner_preset"(p_token text, p_preset_id uuid) to authenticated;
revoke all on function public."gw_archive_restaurant"(p_token text, p_restaurant_id uuid) from public,anon,authenticated;
grant execute on function public."gw_archive_restaurant"(p_token text, p_restaurant_id uuid) to anon;
grant execute on function public."gw_archive_restaurant"(p_token text, p_restaurant_id uuid) to authenticated;
revoke all on function public."gw_clear_changed_location"() from public,anon,authenticated;
revoke all on function public."gw_close_poll"(p_token text, p_poll_id uuid) from public,anon,authenticated;
grant execute on function public."gw_close_poll"(p_token text, p_poll_id uuid) to anon;
grant execute on function public."gw_close_poll"(p_token text, p_poll_id uuid) to authenticated;
revoke all on function public."gw_create_dinner"(p_token text, p_draft jsonb) from public,anon,authenticated;
grant execute on function public."gw_create_dinner"(p_token text, p_draft jsonb) to anon;
grant execute on function public."gw_create_dinner"(p_token text, p_draft jsonb) to authenticated;
revoke all on function public."gw_create_family"(p_name text, p_token text) from public,anon,authenticated;
grant execute on function public."gw_create_family"(p_name text, p_token text) to anon;
grant execute on function public."gw_create_family"(p_name text, p_token text) to authenticated;
revoke all on function public."gw_create_poll"(p_token text, p_meal text, p_method text, p_expected_voters integer, p_restaurant_ids uuid[]) from public,anon,authenticated;
grant execute on function public."gw_create_poll"(p_token text, p_meal text, p_method text, p_expected_voters integer, p_restaurant_ids uuid[]) to anon;
grant execute on function public."gw_create_poll"(p_token text, p_meal text, p_method text, p_expected_voters integer, p_restaurant_ids uuid[]) to authenticated;
revoke all on function public."gw_create_poll_configured"(p_token text, p_meal text, p_method text, p_restaurant_ids uuid[], p_member_ids uuid[], p_allow_member_home boolean, p_group_join boolean) from public,anon,authenticated;
grant execute on function public."gw_create_poll_configured"(p_token text, p_meal text, p_method text, p_restaurant_ids uuid[], p_member_ids uuid[], p_allow_member_home boolean, p_group_join boolean) to anon;
grant execute on function public."gw_create_poll_configured"(p_token text, p_meal text, p_method text, p_restaurant_ids uuid[], p_member_ids uuid[], p_allow_member_home boolean, p_group_join boolean) to authenticated;
revoke all on function public."gw_create_poll_for_members"(p_token text, p_meal text, p_method text, p_restaurant_ids uuid[], p_member_ids uuid[]) from public,anon,authenticated;
grant execute on function public."gw_create_poll_for_members"(p_token text, p_meal text, p_method text, p_restaurant_ids uuid[], p_member_ids uuid[]) to anon;
grant execute on function public."gw_create_poll_for_members"(p_token text, p_meal text, p_method text, p_restaurant_ids uuid[], p_member_ids uuid[]) to authenticated;
revoke all on function public."gw_create_poll_themed"(p_token text, p_meal text, p_method text, p_restaurant_ids uuid[], p_member_ids uuid[], p_allow_member_home boolean, p_group_join boolean, p_cuisine text) from public,anon,authenticated;
grant execute on function public."gw_create_poll_themed"(p_token text, p_meal text, p_method text, p_restaurant_ids uuid[], p_member_ids uuid[], p_allow_member_home boolean, p_group_join boolean, p_cuisine text) to anon;
grant execute on function public."gw_create_poll_themed"(p_token text, p_meal text, p_method text, p_restaurant_ids uuid[], p_member_ids uuid[], p_allow_member_home boolean, p_group_join boolean, p_cuisine text) to authenticated;
revoke all on function public."gw_delete_polls"(p_token text, p_poll_ids uuid[], p_finished boolean) from public,anon,authenticated;
grant execute on function public."gw_delete_polls"(p_token text, p_poll_ids uuid[], p_finished boolean) to anon;
grant execute on function public."gw_delete_polls"(p_token text, p_poll_ids uuid[], p_finished boolean) to authenticated;
revoke all on function public."gw_dinner_ballot_changed"() from public,anon,authenticated;
revoke all on function public."gw_dinner_decision"(p_poll_id uuid) from public,anon,authenticated;
revoke all on function public."gw_dinner_poll_changed"() from public,anon,authenticated;
revoke all on function public."gw_get_dinner_preset"(p_token text, p_preset_id uuid) from public,anon,authenticated;
grant execute on function public."gw_get_dinner_preset"(p_token text, p_preset_id uuid) to anon;
grant execute on function public."gw_get_dinner_preset"(p_token text, p_preset_id uuid) to authenticated;
revoke all on function public."gw_get_family"(p_token text) from public,anon,authenticated;
grant execute on function public."gw_get_family"(p_token text) to anon;
grant execute on function public."gw_get_family"(p_token text) to authenticated;
revoke all on function public."gw_get_member"(p_member_token text) from public,anon,authenticated;
grant execute on function public."gw_get_member"(p_member_token text) to anon;
grant execute on function public."gw_get_member"(p_member_token text) to authenticated;
revoke all on function public."gw_get_my_ballot"(p_poll_id uuid, p_member_token text) from public,anon,authenticated;
grant execute on function public."gw_get_my_ballot"(p_poll_id uuid, p_member_token text) to anon;
grant execute on function public."gw_get_my_ballot"(p_poll_id uuid, p_member_token text) to authenticated;
revoke all on function public."gw_get_poll"(p_poll_id uuid) from public,anon,authenticated;
grant execute on function public."gw_get_poll"(p_poll_id uuid) to anon;
grant execute on function public."gw_get_poll"(p_poll_id uuid) to authenticated;
revoke all on function public."gw_get_poll_people"(p_poll_id uuid, p_token text, p_member_token text, p_include_avatars boolean) from public,anon,authenticated;
grant execute on function public."gw_get_poll_people"(p_poll_id uuid, p_token text, p_member_token text, p_include_avatars boolean) to anon;
grant execute on function public."gw_get_poll_people"(p_poll_id uuid, p_token text, p_member_token text, p_include_avatars boolean) to authenticated;
revoke all on function public."gw_group_poll"(p_poll_id uuid, p_group_token text, p_member_id uuid, p_action text, p_ballot jsonb, p_include_avatars boolean) from public,anon,authenticated;
grant execute on function public."gw_group_poll"(p_poll_id uuid, p_group_token text, p_member_id uuid, p_action text, p_ballot jsonb, p_include_avatars boolean) to anon;
grant execute on function public."gw_group_poll"(p_poll_id uuid, p_group_token text, p_member_id uuid, p_action text, p_ballot jsonb, p_include_avatars boolean) to authenticated;
revoke all on function public."gw_list_members"(p_token text) from public,anon,authenticated;
grant execute on function public."gw_list_members"(p_token text) to anon;
grant execute on function public."gw_list_members"(p_token text) to authenticated;
revoke all on function public."gw_member_has_voted"(p_poll_id uuid, p_member_token text) from public,anon,authenticated;
grant execute on function public."gw_member_has_voted"(p_poll_id uuid, p_member_token text) to anon;
grant execute on function public."gw_member_has_voted"(p_poll_id uuid, p_member_token text) to authenticated;
revoke all on function public."gw_nominate_restaurant"(p_member_token text, p_name text, p_address text, p_category text, p_note text) from public,anon,authenticated;
grant execute on function public."gw_nominate_restaurant"(p_member_token text, p_name text, p_address text, p_category text, p_note text) to anon;
grant execute on function public."gw_nominate_restaurant"(p_member_token text, p_name text, p_address text, p_category text, p_note text) to authenticated;
revoke all on function public."gw_planning_home"(p_token text, p_member_token text) from public,anon,authenticated;
grant execute on function public."gw_planning_home"(p_token text, p_member_token text) to anon;
grant execute on function public."gw_planning_home"(p_token text, p_member_token text) to authenticated;
revoke all on function public."gw_poll_settings"(p_token text, p_poll_id uuid, p_allow_member_home boolean, p_group_join boolean) from public,anon,authenticated;
grant execute on function public."gw_poll_settings"(p_token text, p_poll_id uuid, p_allow_member_home boolean, p_group_join boolean) to anon;
grant execute on function public."gw_poll_settings"(p_token text, p_poll_id uuid, p_allow_member_home boolean, p_group_join boolean) to authenticated;
revoke all on function public."gw_process_dinner_poll"(p_poll_id uuid) from public,anon,authenticated;
revoke all on function public."gw_remove_member"(p_token text, p_member_id uuid) from public,anon,authenticated;
grant execute on function public."gw_remove_member"(p_token text, p_member_id uuid) to anon;
grant execute on function public."gw_remove_member"(p_token text, p_member_id uuid) to authenticated;
revoke all on function public."gw_rename_member"(p_token text, p_member_id uuid, p_name text) from public,anon,authenticated;
grant execute on function public."gw_rename_member"(p_token text, p_member_id uuid, p_name text) to anon;
grant execute on function public."gw_rename_member"(p_token text, p_member_id uuid, p_name text) to authenticated;
revoke all on function public."gw_resolve_tie_random"(p_token text, p_poll_id uuid) from public,anon,authenticated;
grant execute on function public."gw_resolve_tie_random"(p_token text, p_poll_id uuid) to anon;
grant execute on function public."gw_resolve_tie_random"(p_token text, p_poll_id uuid) to authenticated;
revoke all on function public."gw_restaurant_key"(value text) from public,anon,authenticated;
revoke all on function public."gw_review_nomination"(p_token text, p_nomination_id uuid, p_restaurant_id uuid, p_dismiss boolean) from public,anon,authenticated;
grant execute on function public."gw_review_nomination"(p_token text, p_nomination_id uuid, p_restaurant_id uuid, p_dismiss boolean) to anon;
grant execute on function public."gw_review_nomination"(p_token text, p_nomination_id uuid, p_restaurant_id uuid, p_dismiss boolean) to authenticated;
revoke all on function public."gw_rotate_member"(p_token text, p_member_id uuid) from public,anon,authenticated;
grant execute on function public."gw_rotate_member"(p_token text, p_member_id uuid) to anon;
grant execute on function public."gw_rotate_member"(p_token text, p_member_id uuid) to authenticated;
revoke all on function public."gw_save_dinner_preset"(p_token text, p_name text, p_draft jsonb, p_preset_id uuid) from public,anon,authenticated;
grant execute on function public."gw_save_dinner_preset"(p_token text, p_name text, p_draft jsonb, p_preset_id uuid) to anon;
grant execute on function public."gw_save_dinner_preset"(p_token text, p_name text, p_draft jsonb, p_preset_id uuid) to authenticated;
revoke all on function public."gw_save_restaurant_location"(p_token text, p_name text, p_category text, p_address text, p_osm_id text, p_latitude double precision, p_longitude double precision, p_keep_separate boolean, p_use_restaurant_id uuid, p_icon_mode text, p_icon_value text, p_reviewed_ids uuid[]) from public,anon,authenticated;
grant execute on function public."gw_save_restaurant_location"(p_token text, p_name text, p_category text, p_address text, p_osm_id text, p_latitude double precision, p_longitude double precision, p_keep_separate boolean, p_use_restaurant_id uuid, p_icon_mode text, p_icon_value text, p_reviewed_ids uuid[]) to anon;
grant execute on function public."gw_save_restaurant_location"(p_token text, p_name text, p_category text, p_address text, p_osm_id text, p_latitude double precision, p_longitude double precision, p_keep_separate boolean, p_use_restaurant_id uuid, p_icon_mode text, p_icon_value text, p_reviewed_ids uuid[]) to authenticated;
revoke all on function public."gw_set_results_caption"(p_token text, p_caption text) from public,anon,authenticated;
grant execute on function public."gw_set_results_caption"(p_token text, p_caption text) to anon;
grant execute on function public."gw_set_results_caption"(p_token text, p_caption text) to authenticated;
revoke all on function public."gw_update_member_profile"(p_token text, p_member_id uuid, p_name text, p_avatar text, p_phone text) from public,anon,authenticated;
grant execute on function public."gw_update_member_profile"(p_token text, p_member_id uuid, p_name text, p_avatar text, p_phone text) to anon;
grant execute on function public."gw_update_member_profile"(p_token text, p_member_id uuid, p_name text, p_avatar text, p_phone text) to authenticated;
revoke all on function public."gw_update_restaurant"(p_token text, p_restaurant_id uuid, p_name text, p_category text, p_address text, p_icon_mode text, p_icon_value text) from public,anon,authenticated;
grant execute on function public."gw_update_restaurant"(p_token text, p_restaurant_id uuid, p_name text, p_category text, p_address text, p_icon_mode text, p_icon_value text) to anon;
grant execute on function public."gw_update_restaurant"(p_token text, p_restaurant_id uuid, p_name text, p_category text, p_address text, p_icon_mode text, p_icon_value text) to authenticated;
revoke all on function public."gw_validate_dinner_draft"(p_token text, p_draft jsonb) from public,anon,authenticated;
revoke all on function public."gw_vote"(p_poll_id uuid, p_voter_name text, p_ballot jsonb) from public,anon,authenticated;
revoke all on function public."gw_vote_as_member"(p_poll_id uuid, p_member_token text, p_ballot jsonb) from public,anon,authenticated;
grant execute on function public."gw_vote_as_member"(p_poll_id uuid, p_member_token text, p_ballot jsonb) to anon;
grant execute on function public."gw_vote_as_member"(p_poll_id uuid, p_member_token text, p_ballot jsonb) to authenticated;
CREATE TRIGGER gw_restaurant_address_identity BEFORE UPDATE OF address ON public.gw_restaurants FOR EACH ROW EXECUTE FUNCTION gw_clear_changed_location();
CREATE TRIGGER gw_dinner_ballot_changed AFTER INSERT OR UPDATE OF ballot ON public.gw_ballots FOR EACH ROW EXECUTE FUNCTION gw_dinner_ballot_changed();
CREATE TRIGGER gw_dinner_poll_changed AFTER UPDATE OF status, tie_winner_id ON public.gw_polls FOR EACH ROW EXECUTE FUNCTION gw_dinner_poll_changed();
notify pgrst,'reload schema';
commit;
