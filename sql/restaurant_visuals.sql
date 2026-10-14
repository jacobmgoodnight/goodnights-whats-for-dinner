-- Apply once to the existing Goodnights Supabase project. Does not delete or rewrite votes.
alter table public.gw_restaurants
  add column if not exists icon_mode text not null default 'auto';
alter table public.gw_restaurants
  add column if not exists icon_value text not null default '';
do $$ begin
 if not exists(select 1 from pg_constraint where conname='gw_restaurants_icon_mode_check') then
  alter table public.gw_restaurants add constraint gw_restaurants_icon_mode_check
   check (icon_mode in ('auto','logo_url','website','builtin'));
 end if;
 if not exists(select 1 from pg_constraint where conname='gw_restaurants_icon_value_length_check') then
  alter table public.gw_restaurants add constraint gw_restaurants_icon_value_length_check
   check (char_length(icon_value)<=500);
 end if;
end $$;

create or replace function public.gw_update_restaurant(
  p_token text,p_restaurant_id uuid,p_name text,p_category text,
  p_address text,p_icon_mode text,p_icon_value text
) returns uuid language plpgsql security definer
set search_path = public,pg_temp as $$
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
end $$;
revoke all on function public.gw_update_restaurant(text,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.gw_update_restaurant(text,uuid,text,text,text,text,text) to anon,authenticated;

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
        'address',address,'latitude',latitude,'longitude',longitude,'osm_id',osm_id,'icon_mode',icon_mode,'icon_value',icon_value)
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
      'id',r.id,'name',r.name,'category',r.category,'address',r.address,'icon_mode',r.icon_mode,'icon_value',r.icon_value)
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
