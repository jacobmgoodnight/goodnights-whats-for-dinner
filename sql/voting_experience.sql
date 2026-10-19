-- Additive upgrade. Existing polls keep personal-link access and member navigation.
alter table public.gw_polls add column if not exists allow_member_home boolean not null default true;
alter table public.gw_polls add column if not exists group_join_token text;

-- Only the organizer can read or change the shared invitation credential.
create or replace function public.gw_poll_settings(p_token text,p_poll_id uuid,p_allow_member_home boolean default null,p_group_join boolean default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.gw_polls;
begin
 select q.* into p from public.gw_polls q join public.gw_families f on f.id=q.family_id where q.id=p_poll_id and f.token=p_token for update of q;
 if not found then raise exception 'Organizer access denied'; end if;
 if p_group_join is true and not p.roster_enabled then raise exception 'Create a vote with selected members to use group access'; end if;
 update public.gw_polls set allow_member_home=coalesce(p_allow_member_home,allow_member_home),
 group_join_token=case when p_group_join is false then null when p_group_join is true then coalesce(group_join_token,replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','')) else group_join_token end
 where id=p.id returning * into p;
 return jsonb_build_object('allow_member_home',p.allow_member_home,'group_join_token',p.group_join_token);
end $$;
revoke all on function public.gw_poll_settings(text,uuid,boolean,boolean) from public;
grant execute on function public.gw_poll_settings(text,uuid,boolean,boolean) to anon,authenticated;

create or replace function public.gw_create_poll_configured(p_token text,p_meal text,p_method text,p_restaurant_ids uuid[],p_member_ids uuid[],p_allow_member_home boolean default true,p_group_join boolean default false)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare pid uuid;
begin
 pid:=public.gw_create_poll_for_members(p_token,p_meal,p_method,p_restaurant_ids,p_member_ids);
 perform public.gw_poll_settings(p_token,pid,p_allow_member_home,p_group_join);
 return pid;
end $$;
revoke all on function public.gw_create_poll_configured(text,text,text,uuid[],uuid[],boolean,boolean) from public;
grant execute on function public.gw_create_poll_configured(text,text,text,uuid[],uuid[],boolean,boolean) to anon,authenticated;

-- This is an explicitly enabled, poll-scoped family honor-system entry point.
-- It never returns reusable member credentials, contacts, or saved individual ballots.
create or replace function public.gw_group_poll(p_poll_id uuid,p_group_token text,p_member_id uuid default null,p_action text default 'people',p_ballot jsonb default null,p_include_avatars boolean default true)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.gw_polls; m public.gw_members; data jsonb;
begin
 select * into p from public.gw_polls where id=p_poll_id and group_join_token=p_group_token and group_join_token is not null for update;
 if not found then raise exception 'Group invitation unavailable. Ask the organizer for a personal link.'; end if;
 if p_action='people' then
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'avatar',case when p_include_avatars then x.avatar else null end,'active',x.active,'voted',exists(select 1 from public.gw_ballots b where b.poll_id=p.id and b.voter_key=x.id::text)) order by x.created_at,x.name),'[]'::jsonb) into data
  from public.gw_members x join public.gw_poll_members pm on pm.member_id=x.id and pm.poll_id=p.id where x.family_id=p.family_id;
  return jsonb_build_object('rostered',true,'people',data,'eligible',exists(select 1 from public.gw_poll_members pm join public.gw_members x on x.id=pm.member_id where pm.poll_id=p.id and x.id=p_member_id and x.active and x.family_id=p.family_id));
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
end $$;
revoke all on function public.gw_group_poll(uuid,text,uuid,text,jsonb,boolean) from public;
grant execute on function public.gw_group_poll(uuid,text,uuid,text,jsonb,boolean) to anon,authenticated;

-- Delete only on an explicit organizer action. Related poll records cascade;
-- members, restaurant records and reusable invitation tokens are untouched.
create or replace function public.gw_delete_polls(p_token text,p_poll_ids uuid[] default null,p_finished boolean default false)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
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
end $$;
revoke all on function public.gw_delete_polls(text,uuid[],boolean) from public;
grant execute on function public.gw_delete_polls(text,uuid[],boolean) to anon,authenticated;

-- Public poll response includes only the UI navigation preference, never the group token.
do $upgrade$
declare d text;
begin
 d:=pg_get_functiondef('public.gw_get_poll(uuid)'::regprocedure);
 if position('''allow_member_home''' in d)=0 then
  if position('''roster_enabled'',p.roster_enabled' in d)=0 then raise exception 'Unexpected poll reader'; end if;
  execute replace(d,'''roster_enabled'',p.roster_enabled','''allow_member_home'',p.allow_member_home,''roster_enabled'',p.roster_enabled');
 end if;
end $upgrade$;
