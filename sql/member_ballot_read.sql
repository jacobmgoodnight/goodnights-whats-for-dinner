-- Read only the caller's own ballot. Existing member tokens and voting rules stay intact.
create or replace function public.gw_get_my_ballot(p_poll_id uuid,p_member_token text)
returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
declare m public.gw_members; fid uuid; own_ballot jsonb;
begin
 select * into m from public.gw_members where token=p_member_token and active;
 if not found then raise exception 'Personal link invalid or reset'; end if;
 select family_id into fid from public.gw_polls where id=p_poll_id;
 if fid is distinct from m.family_id then raise exception 'Poll is not in this family'; end if;
 select ballot into own_ballot from public.gw_ballots where poll_id=p_poll_id and voter_key=m.id::text;
 return own_ballot;
end $$;
revoke all on function public.gw_get_my_ballot(uuid,text) from public;
grant execute on function public.gw_get_my_ballot(uuid,text) to anon,authenticated;
