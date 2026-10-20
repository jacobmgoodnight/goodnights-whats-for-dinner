-- Manual integration check: run against an initialized project. Always rolls back.
BEGIN;
DO $verify$
DECLARE fid uuid; owner_token text; m1 uuid; m2 uuid; r1 uuid; r2 uuid; r3 uuid;
 t1 text:=encode(extensions.gen_random_bytes(24),'hex');t2 text:=encode(extensions.gen_random_bytes(24),'hex');
 pid uuid; mode text; b1 jsonb; b2 jsonb; picked uuid; before_ballots jsonb; i integer;
BEGIN
 SELECT id,token INTO fid,owner_token FROM public.gw_families LIMIT 1;
 INSERT INTO public.gw_members(family_id,name,token) VALUES(fid,'Temporary tie voter A',t1) RETURNING id INTO m1;
 INSERT INTO public.gw_members(family_id,name,token) VALUES(fid,'Temporary tie voter B',t2) RETURNING id INTO m2;
 INSERT INTO public.gw_restaurants(family_id,name) VALUES(fid,'Temporary tie A') RETURNING id INTO r1;
 INSERT INTO public.gw_restaurants(family_id,name) VALUES(fid,'Temporary tie B') RETURNING id INTO r2;
 INSERT INTO public.gw_restaurants(family_id,name) VALUES(fid,'Temporary eliminated C') RETURNING id INTO r3;
 FOREACH mode IN ARRAY ARRAY['approval','swipe','ranked'] LOOP
  pid:=public.gw_create_poll_for_members(owner_token,'Dinner',mode,ARRAY[r1,r2,r3],ARRAY[m1,m2]);
  BEGIN PERFORM public.gw_resolve_tie_random(owner_token,pid);RAISE EXCEPTION 'Empty draw allowed';EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Wait for voting%' THEN RAISE;END IF;END;
  b1:=case mode when 'approval' then jsonb_build_array(r1) when 'swipe' then jsonb_build_object(r1::text,true,r2::text,false,r3::text,false) else jsonb_build_array(r1,r2,r3) end;
  b2:=case mode when 'approval' then jsonb_build_array(r2) when 'swipe' then jsonb_build_object(r1::text,false,r2::text,true,r3::text,false) else jsonb_build_array(r2,r1,r3) end;
  PERFORM public.gw_vote_as_member(pid,t1,b1);
  BEGIN PERFORM public.gw_resolve_tie_random(owner_token,pid);RAISE EXCEPTION 'Open draw allowed';EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Wait for voting%' THEN RAISE;END IF;END;
  PERFORM public.gw_vote_as_member(pid,t2,b2);
  before_ballots:=public.gw_get_poll(pid)->'ballots';
  BEGIN PERFORM public.gw_resolve_tie_random(t1,pid);RAISE EXCEPTION 'Member draw allowed';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Organizer access denied' THEN RAISE;END IF;END;
  BEGIN PERFORM public.gw_resolve_tie_random('bad',pid);RAISE EXCEPTION 'Bad owner allowed';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Organizer access denied' THEN RAISE;END IF;END;
  picked:=public.gw_resolve_tie_random(owner_token,pid);
  IF NOT picked=any(ARRAY[r1,r2]) OR public.gw_get_poll(pid)->>'tie_winner_id'<>picked::text THEN RAISE EXCEPTION 'Not a saved tied leader';END IF;
  FOR i IN 1..25 LOOP IF public.gw_resolve_tie_random(owner_token,pid)<>picked THEN RAISE EXCEPTION 'Rerolled';END IF;END LOOP;
  IF public.gw_get_poll(pid)->'ballots'<>before_ballots THEN RAISE EXCEPTION 'Ballots changed';END IF;
  BEGIN PERFORM public.gw_resolve_tie_random(t1,pid);RAISE EXCEPTION 'Saved winner bypassed owner';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Organizer access denied' THEN RAISE;END IF;END;
  pid:=public.gw_create_poll_for_members(owner_token,'Dinner',mode,ARRAY[r1,r2,r3],ARRAY[m1,m2]);
  PERFORM public.gw_vote_as_member(pid,t1,b1);PERFORM public.gw_vote_as_member(pid,t2,b1);
  BEGIN PERFORM public.gw_resolve_tie_random(owner_token,pid);RAISE EXCEPTION 'Clear winner overridden';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'This vote does not need a tiebreaker' THEN RAISE;END IF;END;
 END LOOP;
 -- Ranked transfer creates a 3–3 tie between B and C, eliminating A.
 pid:=public.gw_create_poll(owner_token,'Dinner','ranked',6,ARRAY[r1,r2,r3]);
 FOR i IN 1..6 LOOP
  INSERT INTO public.gw_ballots(poll_id,voter_key,voter_name,ballot) VALUES(pid,gen_random_uuid()::text,'Temporary',
   case when i=1 then jsonb_build_array(r1,r2,r3) when i<=3 then jsonb_build_array(r2,r3,r1) else jsonb_build_array(r3,r2,r1) end);
 END LOOP;
 picked:=public.gw_resolve_tie_random(owner_token,pid);
 IF NOT picked=any(ARRAY[r2,r3]) THEN RAISE EXCEPTION 'Ranked transfers not honored';END IF;
 IF has_function_privilege('anon','public.gw_vote(uuid,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Legacy voting exposed';END IF;
 IF NOT has_function_privilege('anon','public.gw_resolve_tie_random(text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'RPC unavailable';END IF;
END $verify$;
ROLLBACK;
SELECT 'PASS: all three methods, owner guard, closed/empty/unique rejection, saved draw idempotence, unchanged ballots, ranked transfer finalists, narrow grants; synthetic fixtures rolled back' AS result;
