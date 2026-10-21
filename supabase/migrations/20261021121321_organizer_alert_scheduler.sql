-- Deploy and test the worker first. Settings remain disabled until private provisioning.
begin;
set local lock_timeout='5s';
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
create function public.gw_dispatch_organizer_push()
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare config jsonb; request_id bigint;
begin
 if not exists(select 1 from public.gw_push_deliveries where status in ('pending','leased') and next_attempt_at<=now() and (lease_until is null or lease_until<now())) then return null;end if;
 config:=public.gw_push_worker_config();if not coalesce((config->>'configured')::boolean,false) then return null;end if;
 select net.http_post(url:=config->>'worker_url',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(config->>'worker_key')),body:='{}'::jsonb,timeout_milliseconds:=60000) into request_id;
 return request_id;
end $$;
revoke all on function public.gw_dispatch_organizer_push() from public,anon,authenticated;
select cron.schedule('goodnights-organizer-alerts','* * * * *','select public.gw_dispatch_organizer_push();');
commit;
