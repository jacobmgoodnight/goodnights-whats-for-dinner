-- Hosted pg_net's request table is readable to database roles and its grants
-- cannot be changed by postgres. Never put the Vault bearer key in that queue.
-- Send only from cron, with a bounded direct request; ballots only enqueue alerts.
begin;
set local lock_timeout='5s';
create extension if not exists http with schema extensions;
create or replace function public.gw_dispatch_organizer_push()
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare config jsonb; response_status integer;
begin
 -- The event trigger may call this function, but must never wait for a network.
 if pg_trigger_depth()>0 then return null;end if;
 if not exists(select 1 from public.gw_push_deliveries where status in ('pending','leased') and next_attempt_at<=now() and (lease_until is null or lease_until<now())) then return null;end if;
 config:=public.gw_push_worker_config();if not coalesce((config->>'configured')::boolean,false) then return null;end if;
 begin
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','3000');
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','55000');
  select status into response_status from extensions.http(('POST',config->>'worker_url',
   array[extensions.http_header('Authorization','Bearer '||(config->>'worker_key'))],
   'application/json','{}')::extensions.http_request);
  perform extensions.http_reset_curlopt();
 exception when others then
  perform extensions.http_reset_curlopt();raise;
 end;
 if response_status<>200 then raise exception 'Organizer delivery returned HTTP %',response_status;end if;
 return response_status;
end $$;
revoke all on function public.gw_dispatch_organizer_push() from public,anon,authenticated;
commit;
