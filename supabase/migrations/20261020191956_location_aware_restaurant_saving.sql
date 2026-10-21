-- H4 additive upgrade; prepare/rehearse before separately approved deployment.
-- Requires sql/restaurant_visuals.sql. No existing rows or historical IDs are rewritten.
begin;
lock table public.gw_restaurants in share row exclusive mode;
create or replace function public.gw_restaurant_key(value text)
returns text language sql immutable set search_path=pg_catalog,public,pg_temp as $$
 select translate(btrim(regexp_replace(coalesce(value,''), '[[:space:]]+', ' ', 'g')),
 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')
$$;
revoke all on function public.gw_restaurant_key(text) from public,anon,authenticated;

do $$ begin
 if exists(select 1 from public.gw_restaurants where public.gw_restaurant_key(osm_id)<>'' group by family_id,public.gw_restaurant_key(osm_id) having count(*)>1)
 or exists(select 1 from public.gw_restaurants where public.gw_restaurant_key(osm_id)='' and public.gw_restaurant_key(address)<>'' group by family_id,public.gw_restaurant_key(name),public.gw_restaurant_key(address) having count(*)>1) then
  raise exception 'Existing location duplicates need owner review. Run sql/location_identity_audit.sql; no rows have been merged or deleted';
 end if;
end $$;
create unique index if not exists gw_restaurants_osm_identity on public.gw_restaurants(family_id,public.gw_restaurant_key(osm_id)) where public.gw_restaurant_key(osm_id)<>'';
create unique index if not exists gw_restaurants_manual_identity on public.gw_restaurants(family_id,public.gw_restaurant_key(name),public.gw_restaurant_key(address)) where public.gw_restaurant_key(osm_id)='' and public.gw_restaurant_key(address)<>'';

create or replace function public.gw_save_restaurant_location(
 p_token text,p_name text,p_category text default '',p_address text default '',p_osm_id text default null,
 p_latitude double precision default null,p_longitude double precision default null,
 p_keep_separate boolean default false,p_use_restaurant_id uuid default null,
 p_icon_mode text default 'auto',p_icon_value text default '',p_reviewed_ids uuid[] default '{}')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
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
end $$;
revoke all on function public.gw_save_restaurant_location(text,text,text,text,text,double precision,double precision,boolean,uuid,text,text,uuid[]) from public;
grant execute on function public.gw_save_restaurant_location(text,text,text,text,text,double precision,double precision,boolean,uuid,text,text,uuid[]) to anon,authenticated;

-- Preserve the old signature while removing its unsafe name-only behavior.
create or replace function public.gw_add_restaurant(p_token text,p_name text,p_category text default '',p_address text default '',p_osm_id text default null,p_latitude double precision default null,p_longitude double precision default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 result:=public.gw_save_restaurant_location(p_token,p_name,p_category,p_address,p_osm_id,p_latitude,p_longitude);
 if result->>'status'='review' then raise exception 'Possible duplicate or missing address. Review locations using the updated app';end if;
 return (result->>'id')::uuid;
end $$;
revoke all on function public.gw_add_restaurant(text,text,text,text,text,double precision,double precision) from public;
grant execute on function public.gw_add_restaurant(text,text,text,text,text,double precision,double precision) to anon,authenticated;

create or replace function public.gw_clear_changed_location()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if public.gw_restaurant_key(new.address)<>public.gw_restaurant_key(old.address) then
  new.osm_id:=null;new.latitude:=null;new.longitude:=null;
 end if;
 return new;
end $$;
revoke all on function public.gw_clear_changed_location() from public,anon,authenticated;
drop trigger if exists gw_restaurant_address_identity on public.gw_restaurants;
create trigger gw_restaurant_address_identity before update of address on public.gw_restaurants for each row execute function public.gw_clear_changed_location();
notify pgrst, 'reload schema';
commit;
