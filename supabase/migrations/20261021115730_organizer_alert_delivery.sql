-- Organizer-only Web Push. No notification subscription is created by this upgrade.
-- VAPID private/worker keys are provisioned separately in Vault; disabled by default.
begin;
set local lock_timeout='5s';
create schema if not exists gw_private;
revoke all on schema gw_private from public,anon,authenticated;
create table gw_private.push_settings(
 singleton boolean primary key default true check(singleton),enabled boolean not null default false,
 public_key text not null default '',subject text not null default 'https://jacobmgoodnight.github.io/goodnights-whats-for-dinner/',
 worker_url text not null default 'https://rwqclcpmtuebxndadkxv.supabase.co/functions/v1/goodnights-organizer-alerts',
 check(public_key='' or public_key ~ '^[A-Za-z0-9_-]{87}$'),
 check(subject ~ '^https://[^[:space:]]+$'),
 check(worker_url ~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/goodnights-organizer-alerts$')
);
insert into gw_private.push_settings(singleton) values(true);
alter table gw_private.push_settings enable row level security;
revoke all on gw_private.push_settings from public,anon,authenticated;
create table public.gw_push_subscriptions(
 id uuid primary key default gen_random_uuid(),family_id uuid not null references public.gw_families(id),
 endpoint text not null unique check(char_length(endpoint)<=2048),p256dh text not null,auth text not null,
 active boolean not null default true,created_at timestamptz not null default now()
);
create index gw_push_subscriptions_family on public.gw_push_subscriptions(family_id) where active;
create table public.gw_push_deliveries(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.gw_dinner_events(id) on delete cascade,
 subscription_id uuid not null references public.gw_push_subscriptions(id),
 status text not null default 'pending' check(status in ('pending','leased','sent','failed')),
 attempts integer not null default 0 check(attempts between 0 and 3),next_attempt_at timestamptz not null default now(),
 lease uuid,lease_until timestamptz,last_status integer,created_at timestamptz not null default now(),unique(event_id,subscription_id)
);
create index gw_push_deliveries_due on public.gw_push_deliveries(next_attempt_at,created_at) where status in ('pending','leased');
create index gw_push_deliveries_subscription on public.gw_push_deliveries(subscription_id);
alter table public.gw_push_subscriptions enable row level security;
alter table public.gw_push_deliveries enable row level security;
revoke all on public.gw_push_subscriptions,public.gw_push_deliveries from public,anon,authenticated;

create function public.gw_push_endpoint_allowed(value text)
returns boolean language sql immutable set search_path=pg_catalog,public,pg_temp as $$
 select coalesce(char_length(value)<=2048 and value ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com)/[^[:space:]#]+$',false)
$$;
revoke all on function public.gw_push_endpoint_allowed(text) from public,anon,authenticated;

create function public.gw_push_worker_config()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare settings gw_private.push_settings; private_key text; worker_key text;
begin
 select * into settings from gw_private.push_settings where singleton;
 if not settings.enabled or settings.public_key='' then return jsonb_build_object('configured',false);end if;
 select decrypted_secret into private_key from vault.decrypted_secrets where name='gw_organizer_vapid_private';
 select decrypted_secret into worker_key from vault.decrypted_secrets where name='gw_organizer_worker_key';
 return jsonb_build_object('configured',private_key is not null and worker_key is not null,'public_key',settings.public_key,'private_key',private_key,'worker_key',worker_key,'subject',settings.subject,'worker_url',settings.worker_url);
end $$;
revoke all on function public.gw_push_worker_config() from public,anon,authenticated;
grant execute on function public.gw_push_worker_config() to service_role;

create function public.gw_push_status(p_token text,p_endpoint text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare fid uuid; settings jsonb;
begin
 select id into fid from public.gw_families where token=p_token;if fid is null then raise exception 'Organizer access denied';end if;
 settings:=public.gw_push_worker_config();
 return jsonb_build_object('configured',settings->'configured','public_key',case when (settings->>'configured')::boolean then settings->>'public_key' else null end,
 'enabled',exists(select 1 from public.gw_push_subscriptions where family_id=fid and endpoint=p_endpoint and active));
end $$;
revoke all on function public.gw_push_status(text,text) from public;
grant execute on function public.gw_push_status(text,text) to anon,authenticated;

create function public.gw_subscribe_push(p_token text,p_subscription jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare fid uuid; target_endpoint text:=p_subscription->>'endpoint'; rid uuid;
begin
 select id into fid from public.gw_families where token=p_token for update;if fid is null then raise exception 'Organizer access denied';end if;
 if not coalesce((public.gw_push_worker_config()->>'configured')::boolean,false) then raise exception 'Background alerts are not configured yet';end if;
 if jsonb_typeof(p_subscription) is distinct from 'object' or p_subscription-array['endpoint','keys','expirationTime']<>'{}'::jsonb or jsonb_typeof(p_subscription->'keys') is distinct from 'object' or (p_subscription->'keys')-array['p256dh','auth']<>'{}'::jsonb then raise exception 'Invalid browser subscription';end if;
 if not public.gw_push_endpoint_allowed(target_endpoint) or (p_subscription->'keys'->>'p256dh') is null or (p_subscription->'keys'->>'p256dh') !~ '^[A-Za-z0-9_-]{87}=?$' or (p_subscription->'keys'->>'auth') is null or (p_subscription->'keys'->>'auth') !~ '^[A-Za-z0-9_-]{22}(==)?$' then raise exception 'Unsupported browser push subscription';end if;
 if exists(select 1 from public.gw_push_subscriptions s where s.endpoint=target_endpoint and s.family_id<>fid) then raise exception 'Device subscription unavailable';end if;
 if not exists(select 1 from public.gw_push_subscriptions s where s.endpoint=target_endpoint and s.family_id=fid and s.active) and (select count(*) from public.gw_push_subscriptions where family_id=fid and active)>=10 then raise exception 'Maximum of 10 organizer devices';end if;
 insert into public.gw_push_subscriptions(family_id,endpoint,p256dh,auth) values(fid,target_endpoint,p_subscription->'keys'->>'p256dh',p_subscription->'keys'->>'auth')
 on conflict(endpoint) do update set active=true,p256dh=excluded.p256dh,auth=excluded.auth where gw_push_subscriptions.family_id=fid returning id into rid;
 if rid is null then raise exception 'Device subscription unavailable';end if;
 return rid;
end $$;
revoke all on function public.gw_subscribe_push(text,jsonb) from public;
grant execute on function public.gw_subscribe_push(text,jsonb) to anon,authenticated;

create function public.gw_unsubscribe_push(p_token text,p_endpoint text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare fid uuid; rid uuid;
begin
 select id into fid from public.gw_families where token=p_token;if fid is null then raise exception 'Organizer access denied';end if;
 update public.gw_push_subscriptions set active=false where family_id=fid and endpoint=p_endpoint returning id into rid;
 if rid is not null then update public.gw_push_deliveries set status='failed',lease=null,lease_until=null where subscription_id=rid and status in ('pending','leased');end if;
 return rid is not null;
end $$;
revoke all on function public.gw_unsubscribe_push(text,text) from public;
grant execute on function public.gw_unsubscribe_push(text,text) to anon,authenticated;

create function public.gw_queue_dinner_push()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.gw_push_deliveries(event_id,subscription_id) select new.id,s.id from public.gw_push_subscriptions s where s.family_id=new.family_id and s.active and s.created_at<=new.created_at on conflict(event_id,subscription_id) do nothing;
 -- pg_net sends after commit. A dispatch failure leaves the durable queue for cron;
 -- it must not invalidate a successfully stored family ballot.
 begin
  if to_regprocedure('public.gw_dispatch_organizer_push()') is not null then execute 'select public.gw_dispatch_organizer_push()';end if;
 exception when others then null;
 end;
 return new;
end $$;
revoke all on function public.gw_queue_dinner_push() from public,anon,authenticated;
create trigger gw_queue_dinner_push after insert on public.gw_dinner_events for each row execute function public.gw_queue_dinner_push();

create function public.gw_claim_push_deliveries(p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 -- Expired events and exhausted leases cannot become delayed surprise notifications.
 update public.gw_push_deliveries d set status='failed',lease=null,lease_until=null where d.status in ('pending','leased') and ((d.attempts>=3 and (d.lease_until is null or d.lease_until<now())) or not exists(select 1 from public.gw_dinner_events e where e.id=d.event_id and e.created_at>now()-interval '24 hours'));
 with picked as (
  select d.id from public.gw_push_deliveries d join public.gw_push_subscriptions s on s.id=d.subscription_id
  where s.active and d.attempts<3 and d.next_attempt_at<=now() and (d.status='pending' or (d.status='leased' and d.lease_until<now()))
  order by d.created_at,d.id for update of d skip locked limit greatest(1,least(coalesce(p_limit,20),50))
 ), claimed as (
  update public.gw_push_deliveries d set status='leased',attempts=d.attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '2 minutes' from picked where d.id=picked.id returning d.*
 ) select coalesce(jsonb_agg(jsonb_build_object('delivery_id',d.id,'lease',d.lease,'event_id',e.id,'poll_id',e.poll_id,'kind',e.kind,'subscription',jsonb_build_object('endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth)))),'[]') into result from claimed d join public.gw_dinner_events e on e.id=d.event_id join public.gw_push_subscriptions s on s.id=d.subscription_id;
 return result;
end $$;
revoke all on function public.gw_claim_push_deliveries(integer) from public,anon,authenticated;
grant execute on function public.gw_claim_push_deliveries(integer) to service_role;

create function public.gw_finish_push_delivery(p_delivery_id uuid,p_lease uuid,p_status integer)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.gw_push_deliveries;
begin
 select * into d from public.gw_push_deliveries where id=p_delivery_id and lease=p_lease and status='leased' for update;
 if not found then return false;end if;
 if p_status in (404,410) then update public.gw_push_subscriptions set active=false where id=d.subscription_id;end if;
 update public.gw_push_deliveries set status=case when p_status between 200 and 299 then 'sent' when p_status in (404,410) or attempts>=3 then 'failed' else 'pending' end,last_status=p_status,next_attempt_at=now()+make_interval(mins=>power(2,d.attempts)::integer),lease=null,lease_until=null where id=d.id;
 return true;
end $$;
revoke all on function public.gw_finish_push_delivery(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.gw_finish_push_delivery(uuid,uuid,integer) to service_role;
notify pgrst,'reload schema';
commit;
