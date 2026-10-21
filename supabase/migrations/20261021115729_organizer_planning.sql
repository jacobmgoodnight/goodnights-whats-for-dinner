-- Additive planning features. Requires the deployed roster/theme/H1/H4 upgrades.
-- No existing IDs, credentials, ballots, saved draws or restaurant rows are rewritten.
begin;
set local lock_timeout='5s';
alter table public.gw_polls add column title text not null default '' check(char_length(title)<=80);
alter table public.gw_polls add column auto_tie boolean not null default false;
create index gw_polls_open_family on public.gw_polls(family_id,created_at desc) where status='open';

create table public.gw_family_settings(
 family_id uuid primary key references public.gw_families(id),
 results_caption text not null default '' check(char_length(results_caption)<=100)
);
create table public.gw_dinner_presets(
 id uuid primary key default gen_random_uuid(),family_id uuid not null references public.gw_families(id),
 name text not null check(char_length(btrim(name)) between 1 and 60),draft jsonb not null,
 active boolean not null default true,created_at timestamptz not null default now()
);
create index gw_dinner_presets_family on public.gw_dinner_presets(family_id,created_at) where active;
create unique index gw_dinner_presets_name on public.gw_dinner_presets(family_id,public.gw_restaurant_key(name)) where active;
create table public.gw_nominations(
 id uuid primary key default gen_random_uuid(),family_id uuid not null references public.gw_families(id),
 member_id uuid not null references public.gw_members(id),name text not null check(char_length(btrim(name)) between 1 and 120),
 address text not null default '' check(char_length(address)<=240),category text not null default '' check(char_length(category)<=80),
 note text not null default '' check(char_length(note)<=250),status text not null default 'pending' check(status in ('pending','accepted','dismissed')),
 restaurant_id uuid references public.gw_restaurants(id),created_at timestamptz not null default now(),
 check(status<>'accepted' or restaurant_id is not null)
);
create index gw_nominations_family on public.gw_nominations(family_id,status,created_at desc);
create index gw_nominations_member on public.gw_nominations(member_id,created_at desc);
create unique index gw_nominations_pending_identity on public.gw_nominations(member_id,public.gw_restaurant_key(name),public.gw_restaurant_key(address)) where status='pending';
create table public.gw_dinner_events(
 id uuid primary key default gen_random_uuid(),family_id uuid not null references public.gw_families(id),
 poll_id uuid not null references public.gw_polls(id) on delete cascade,
 phase text not null check(phase in ('completion','resolved')),
 kind text not null check(kind in ('decided','tie','no-choice','empty')),
 created_at timestamptz not null default now(),unique(poll_id,phase)
);
create index gw_dinner_events_family on public.gw_dinner_events(family_id,created_at desc);
alter table public.gw_family_settings enable row level security;
alter table public.gw_dinner_presets enable row level security;
alter table public.gw_nominations enable row level security;
alter table public.gw_dinner_events enable row level security;
revoke all on public.gw_family_settings,public.gw_dinner_presets,public.gw_nominations,public.gw_dinner_events from public,anon,authenticated;

-- One allowlist for creation and presets: historical outcomes/credentials are rejected.
create function public.gw_validate_dinner_draft(p_token text,p_draft jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
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
end $$;
revoke all on function public.gw_validate_dinner_draft(text,jsonb) from public,anon,authenticated;

create function public.gw_create_dinner(p_token text,p_draft jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare d jsonb; places uuid[]; people uuid[]; pid uuid;
begin
 d:=public.gw_validate_dinner_draft(p_token,p_draft);
 select array_agg(value::uuid) into places from jsonb_array_elements_text(d->'place_ids');
 select array_agg(value::uuid) into people from jsonb_array_elements_text(d->'member_ids');
 pid:=public.gw_create_poll_themed(p_token,d->>'meal',d->>'method',places,people,(d->>'allow_member_home')::boolean,(d->>'group_join')::boolean,d->>'cuisine');
 update public.gw_polls set title=d->>'title',auto_tie=(d->>'auto_tie')::boolean where id=pid;
 return pid;
end $$;
revoke all on function public.gw_create_dinner(text,jsonb) from public;
grant execute on function public.gw_create_dinner(text,jsonb) to anon,authenticated;

create function public.gw_save_dinner_preset(p_token text,p_name text,p_draft jsonb,p_preset_id uuid default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
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
end $$;
revoke all on function public.gw_save_dinner_preset(text,text,jsonb,uuid) from public;
grant execute on function public.gw_save_dinner_preset(text,text,jsonb,uuid) to anon,authenticated;

create function public.gw_archive_dinner_preset(p_token text,p_preset_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare fid uuid;
begin
 select id into fid from public.gw_families where token=p_token;if fid is null then raise exception 'Organizer access denied';end if;
 update public.gw_dinner_presets set active=false where id=p_preset_id and family_id=fid;return found;
end $$;
revoke all on function public.gw_archive_dinner_preset(text,uuid) from public;
grant execute on function public.gw_archive_dinner_preset(text,uuid) to anon,authenticated;

create function public.gw_get_dinner_preset(p_token text,p_preset_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare preset public.gw_dinner_presets;
begin
 select x.* into preset from public.gw_dinner_presets x join public.gw_families f on f.id=x.family_id where x.id=p_preset_id and x.active and f.token=p_token;
 if not found then raise exception 'Preset unavailable';end if;
 return jsonb_build_object('id',preset.id,'name',preset.name,'draft',preset.draft,
 'options',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',coalesce(r.name,'Unavailable place'),'active',coalesce(r.active,false)) order by x.ord),'[]') from jsonb_array_elements_text(preset.draft->'place_ids') with ordinality v(id,ord) cross join lateral (select v.id::uuid id,v.ord) x left join public.gw_restaurants r on r.id=x.id and r.family_id=preset.family_id),
 'people',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',coalesce(m.name,'Unavailable person'),'active',coalesce(m.active,false)) order by x.ord),'[]') from jsonb_array_elements_text(preset.draft->'member_ids') with ordinality v(id,ord) cross join lateral (select v.id::uuid id,v.ord) x left join public.gw_members m on m.id=x.id and m.family_id=preset.family_id));
end $$;
revoke all on function public.gw_get_dinner_preset(text,uuid) from public;
grant execute on function public.gw_get_dinner_preset(text,uuid) to anon,authenticated;

create function public.gw_nominate_restaurant(p_member_token text,p_name text,p_address text default '',p_category text default '',p_note text default '')
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
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
end $$;
revoke all on function public.gw_nominate_restaurant(text,text,text,text,text) from public;
grant execute on function public.gw_nominate_restaurant(text,text,text,text,text) to anon,authenticated;

create function public.gw_review_nomination(p_token text,p_nomination_id uuid,p_restaurant_id uuid default null,p_dismiss boolean default false)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
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
end $$;
revoke all on function public.gw_review_nomination(text,uuid,uuid,boolean) from public;
grant execute on function public.gw_review_nomination(text,uuid,uuid,boolean) to anon,authenticated;

create function public.gw_set_results_caption(p_token text,p_caption text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare fid uuid; caption text:=btrim(coalesce(p_caption,''));
begin
 select id into fid from public.gw_families where token=p_token;if fid is null then raise exception 'Organizer access denied';end if;
 if char_length(caption)>100 then raise exception 'Caption must contain at most 100 characters';end if;
 insert into public.gw_family_settings(family_id,results_caption) values(fid,caption) on conflict(family_id) do update set results_caption=excluded.results_caption;return caption;
end $$;
revoke all on function public.gw_set_results_caption(text,text) from public;
grant execute on function public.gw_set_results_caption(text,text) to anon,authenticated;

-- Same leader calculation as the immutable random-draw RPC and voting.js.
create function public.gw_dinner_decision(p_poll_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
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
end $$;
revoke all on function public.gw_dinner_decision(uuid) from public,anon,authenticated;

create function public.gw_process_dinner_poll(p_poll_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
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
end $$;
revoke all on function public.gw_process_dinner_poll(uuid) from public,anon,authenticated;
create function public.gw_dinner_ballot_changed() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin perform public.gw_process_dinner_poll(new.poll_id);return new;end $$;
create function public.gw_dinner_poll_changed() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin if new.status is distinct from old.status or new.tie_winner_id is distinct from old.tie_winner_id then perform public.gw_process_dinner_poll(new.id);end if;return new;end $$;
revoke all on function public.gw_dinner_ballot_changed(),public.gw_dinner_poll_changed() from public,anon,authenticated;
create trigger gw_dinner_ballot_changed after insert or update of ballot on public.gw_ballots for each row execute function public.gw_dinner_ballot_changed();
create trigger gw_dinner_poll_changed after update of status,tie_winner_id on public.gw_polls for each row execute function public.gw_dinner_poll_changed();

create function public.gw_planning_home(p_token text default null,p_member_token text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
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
end $$;
revoke all on function public.gw_planning_home(text,text) from public;
grant execute on function public.gw_planning_home(text,text) to anon,authenticated;

-- Reader upgrade, preserving its full existing public payload/privacy boundary.
create or replace function public.gw_get_poll(p_poll_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.gw_polls; n integer; ready boolean;
begin
 select * into p from public.gw_polls where id=p_poll_id;if not found then raise exception 'Vote link not found';end if;
 select count(*) into n from public.gw_ballots where poll_id=p.id;ready:=(p.status='closed' or n>=p.expected_voters);
 return jsonb_build_object('id',p.id,'title',p.title,'auto_tie',p.auto_tie,'meal',p.meal,'method',p.method,'status',case when ready then 'closed' else 'open' end,'tie_winner_id',p.tie_winner_id,'cuisine',p.cuisine,'allow_member_home',p.allow_member_home,'roster_enabled',p.roster_enabled,'expected_voters',p.expected_voters,'voted_count',n,'created_at',p.created_at,
 'options',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'category',r.category,'address',r.address,'icon_mode',r.icon_mode,'icon_value',r.icon_value) order by r.name) from public.gw_poll_options o join public.gw_restaurants r on r.id=o.restaurant_id where o.poll_id=p.id),'[]'),
 'ballots',case when ready then coalesce((select jsonb_agg(b.ballot) from public.gw_ballots b where b.poll_id=p.id),'[]') else null end);
end $$;
revoke all on function public.gw_get_poll(uuid) from public;
grant execute on function public.gw_get_poll(uuid) to anon,authenticated;
-- Add title to organizer/member history without replacing private member readers.
do $upgrade$
declare definition text;
begin
 select pg_get_functiondef('public.gw_get_family(text)'::regprocedure) into definition;
 if position('''meal'',q.meal' in definition)=0 then raise exception 'Unexpected family reader. Review before upgrading';end if;
 execute replace(definition,'''meal'',q.meal','''title'',q.title,''auto_tie'',q.auto_tie,''meal'',q.meal');
end $upgrade$;
notify pgrst,'reload schema';
commit;
