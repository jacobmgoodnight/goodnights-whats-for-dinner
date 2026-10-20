-- Additive, organizer-controlled resolution. Ballots and their counts never change.
alter table public.gw_polls add column if not exists tie_winner_id uuid;

create or replace function public.gw_resolve_tie_random(p_token text,p_poll_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
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
 if coalesce(cardinality(leaders),0)<2 then raise exception 'This vote does not need a tiebreaker'; end if;
 chosen:=leaders[1+floor(random()*cardinality(leaders))::integer];
 update public.gw_polls set tie_winner_id=chosen,status='closed' where id=p.id;
 return chosen;
end $$;
revoke all on function public.gw_resolve_tie_random(text,uuid) from public;
grant execute on function public.gw_resolve_tie_random(text,uuid) to anon,authenticated;

do $upgrade$
declare d text;
begin
 d:=pg_get_functiondef('public.gw_get_poll(uuid)'::regprocedure);
 if position('''tie_winner_id''' in d)=0 then
  if position('''cuisine'',p.cuisine' in d)=0 then raise exception 'Unexpected poll reader'; end if;
  execute replace(d,'''cuisine'',p.cuisine','''tie_winner_id'',p.tie_winner_id,''cuisine'',p.cuisine');
 end if;
end $upgrade$;
