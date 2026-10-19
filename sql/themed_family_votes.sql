-- Additive metadata only; older clients, polls and personal links keep working.
alter table public.gw_polls add column if not exists cuisine text not null default '';
create or replace function public.gw_create_poll_themed(p_token text,p_meal text,p_method text,p_restaurant_ids uuid[],p_member_ids uuid[],p_allow_member_home boolean default false,p_group_join boolean default true,p_cuisine text default '')
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare pid uuid;
begin
 if p_cuisine is null or not p_cuisine=any(array['','pizza','mexican','burgers','chicken','italian','asian','seafood','steak','cafe']) then raise exception 'Choose a supported cuisine'; end if;
 pid:=public.gw_create_poll_configured(p_token,p_meal,p_method,p_restaurant_ids,p_member_ids,p_allow_member_home,p_group_join);
 update public.gw_polls set cuisine=p_cuisine where id=pid;
 return pid;
end $$;
revoke all on function public.gw_create_poll_themed(text,text,text,uuid[],uuid[],boolean,boolean,text) from public;
grant execute on function public.gw_create_poll_themed(text,text,text,uuid[],uuid[],boolean,boolean,text) to anon,authenticated;

do $upgrade$
declare d text;
begin
 d:=pg_get_functiondef('public.gw_get_poll(uuid)'::regprocedure);
 if position('''cuisine''' in d)=0 then
  if position('''allow_member_home'',p.allow_member_home' in d)=0 then raise exception 'Unexpected poll reader'; end if;
  execute replace(d,'''allow_member_home'',p.allow_member_home','''cuisine'',p.cuisine,''allow_member_home'',p.allow_member_home');
 end if;
 -- An opaque family ID scopes a browser-local last-name preference. It grants no access.
 -- Only holders of this poll's valid group invitation receive it, with no member credentials.
 d:=pg_get_functiondef('public.gw_group_poll(uuid,text,uuid,text,jsonb,boolean)'::regprocedure);
 if position('''family_id''' in d)=0 then
  if position('''rostered'',true,''people'',data' in d)=0 then raise exception 'Unexpected group reader'; end if;
  execute replace(d,'''rostered'',true,''people'',data','''family_id'',p.family_id,''rostered'',true,''people'',data');
 end if;
end $upgrade$;
