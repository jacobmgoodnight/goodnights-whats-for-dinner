-- Explicit participants for new polls. Historical polls keep their original head-count behavior.
alter table public.gw_polls add column if not exists roster_enabled boolean not null default false;
create table if not exists public.gw_poll_members (
 poll_id uuid not null references public.gw_polls(id) on delete cascade,
 member_id uuid not null references public.gw_members(id) on delete cascade,
 primary key(poll_id,member_id)
);
create index if not exists gw_poll_members_member_idx on public.gw_poll_members(member_id);
alter table public.gw_poll_members enable row level security;
revoke all on public.gw_poll_members from public,anon,authenticated;

create or replace function public.gw_create_poll_for_members(p_token text,p_meal text,p_method text,p_restaurant_ids uuid[],p_member_ids uuid[])
returns uuid language plpgsql security definer set search_path = public,pg_temp as $$
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
end $$;
revoke all on function public.gw_create_poll_for_members(text,text,text,uuid[],uuid[]) from public;
grant execute on function public.gw_create_poll_for_members(text,text,text,uuid[],uuid[]) to anon,authenticated;

create or replace function public.gw_get_poll_people(p_poll_id uuid,p_token text default null,p_member_token text default null,p_include_avatars boolean default true)
returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
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
end $$;
revoke all on function public.gw_get_poll_people(uuid,text,text,boolean) from public;
grant execute on function public.gw_get_poll_people(uuid,text,text,boolean) to anon,authenticated;

create or replace function public.gw_vote_as_member(p_poll_id uuid,p_member_token text,p_ballot jsonb)
returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
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
end $$;
revoke all on function public.gw_vote_as_member(uuid,text,jsonb) from public;
grant execute on function public.gw_vote_as_member(uuid,text,jsonb) to anon,authenticated;

-- Add only the roster flag to the existing public poll response; participant identities require a token.
do $upgrade$
declare d text;
begin
 d:=pg_get_functiondef('public.gw_get_poll(uuid)'::regprocedure);
 if position('''roster_enabled''' in d)=0 then
  if position('''expected_voters'',p.expected_voters' in d)=0 then raise exception 'Unexpected poll reader definition'; end if;
  execute replace(d,'''expected_voters'',p.expected_voters','''roster_enabled'',p.roster_enabled,''expected_voters'',p.expected_voters');
 end if;
end $upgrade$;

-- Keep the existing contact column and RPC signature so previous clients and saved profiles remain compatible.
create or replace function public.gw_update_member_profile(p_token text,p_member_id uuid,p_name text,p_avatar text,p_phone text)
returns boolean language plpgsql security definer set search_path = public,pg_temp as $$
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
end $$;
