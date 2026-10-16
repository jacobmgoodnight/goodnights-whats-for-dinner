-- Additive upgrade for existing member links. No member IDs or tokens change.
alter table public.gw_members add column if not exists avatar text not null default '🙂';
alter table public.gw_members add column if not exists phone text not null default '';

create or replace function public.gw_update_member_profile(p_token text,p_member_id uuid,p_name text,p_avatar text,p_phone text)
returns boolean language plpgsql security definer set search_path = public,pg_temp as $$
declare fid uuid; clean_name text := btrim(coalesce(p_name,'')); a text := coalesce(p_avatar,'🙂'); ph text := btrim(coalesce(p_phone,''));
begin
 select id into fid from public.gw_families where token=p_token;
 if fid is null then raise exception 'Owner access denied'; end if;
 if char_length(clean_name) not between 1 and 60 then raise exception 'Enter a name (1–60 characters)'; end if;
 if not (a = any(array['🙂','😀','😎','🥰','🧑‍🍳','👩','👨','👧','👦','👶','🐶','🐱','🦊','🐻','🦄','🏀']) or (length(a)<=24000 and a ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$')) then raise exception 'Choose an emoji or upload a photo'; end if;
 if ph <> '' and ph !~ '^\+?[0-9]{7,15}$' then raise exception 'Invalid phone number'; end if;
 update public.gw_members set name=clean_name,avatar=a,phone=ph where id=p_member_id and family_id=fid and active;
 if not found then raise exception 'Member not found'; end if;
 return true;
end $$;
revoke all on function public.gw_update_member_profile(text,uuid,text,text,text) from public;
grant execute on function public.gw_update_member_profile(text,uuid,text,text,text) to anon,authenticated;

create or replace function public.gw_list_members(p_token text)
returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
declare fid uuid;
begin
 select id into fid from public.gw_families where token=p_token;
 if fid is null then raise exception 'Owner access denied'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'token',m.token,'avatar',m.avatar,'phone',m.phone,'created_at',m.created_at) order by m.created_at,m.name) from public.gw_members m where m.family_id=fid and m.active),'[]'::jsonb);
end $$;

create or replace function public.gw_get_member(p_member_token text)
returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
declare m public.gw_members; f public.gw_families;
begin
 select * into m from public.gw_members where token=p_member_token and active;
 if not found then raise exception 'Personal link invalid or reset'; end if;
 select * into f from public.gw_families where id=m.family_id;
 return jsonb_build_object('id',m.id,'name',m.name,'avatar',m.avatar,'family',public.gw_get_family(f.token));
end $$;
