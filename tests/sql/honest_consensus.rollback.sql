-- Synthetic fixtures only. Run in an EMPTY isolated database after database.sql,
-- the random-draw function, and the H1 migration. Never run on the live family.
BEGIN;
DO $verify$
DECLARE fid uuid; owner_token text:=repeat('a',48); pid uuid; mode text; credential text;
 r1 uuid; r2 uuid; r3 uuid; b1 jsonb; b2 jsonb; picked uuid; before_ballots jsonb;
 before_family jsonb; i integer; n integer; runoff uuid;
BEGIN
 INSERT INTO public.gw_families(name,token) VALUES('H1 isolated fixture',owner_token) RETURNING id INTO fid;
 INSERT INTO public.gw_restaurants(family_id,name) VALUES(fid,'Fixture A') RETURNING id INTO r1;
 INSERT INTO public.gw_restaurants(family_id,name) VALUES(fid,'Fixture B') RETURNING id INTO r2;
 INSERT INTO public.gw_restaurants(family_id,name) VALUES(fid,'Fixture C') RETURNING id INTO r3;
 SELECT to_jsonb(f) INTO before_family FROM public.gw_families f WHERE id=fid;
 FOREACH mode IN ARRAY ARRAY['approval','swipe','ranked'] LOOP
  pid:=public.gw_create_poll(owner_token,'Dinner',mode,2,ARRAY[r1,r2,r3]);
  BEGIN PERFORM public.gw_resolve_tie_random(owner_token,pid);RAISE EXCEPTION 'Empty draw allowed';EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Wait for voting%' THEN RAISE;END IF;END;
  b1:=case mode when 'approval' then jsonb_build_array(r1) when 'swipe' then jsonb_build_object(r1::text,true,r2::text,false,r3::text,false) else jsonb_build_array(r1,r2,r3) end;
  b2:=case mode when 'approval' then jsonb_build_array(r2) when 'swipe' then jsonb_build_object(r1::text,false,r2::text,true,r3::text,false) else jsonb_build_array(r2,r1,r3) end;
  INSERT INTO public.gw_ballots(poll_id,voter_key,voter_name,ballot) VALUES(pid,'fixture-1','Fixture 1',b1);
  BEGIN PERFORM public.gw_resolve_tie_random(owner_token,pid);RAISE EXCEPTION 'Open draw allowed';EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Wait for voting%' THEN RAISE;END IF;END;
  INSERT INTO public.gw_ballots(poll_id,voter_key,voter_name,ballot) VALUES(pid,'fixture-2','Fixture 2',b2);
  SELECT jsonb_agg(to_jsonb(b) ORDER BY voter_key) INTO before_ballots FROM public.gw_ballots b WHERE poll_id=pid;
  FOREACH credential IN ARRAY ARRAY['fixture-member','fixture-group','bad-owner'] LOOP
   BEGIN PERFORM public.gw_resolve_tie_random(credential,pid);RAISE EXCEPTION 'Unauthorized draw allowed';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Organizer access denied' THEN RAISE;END IF;END;
  END LOOP;
  picked:=public.gw_resolve_tie_random(owner_token,pid);
  IF NOT picked=any(ARRAY[r1,r2]) THEN RAISE EXCEPTION 'Not a tied leader';END IF;
  FOR i IN 1..25 LOOP IF public.gw_resolve_tie_random(owner_token,pid)<>picked THEN RAISE EXCEPTION 'Rerolled';END IF;END LOOP;
  IF (SELECT jsonb_agg(to_jsonb(b) ORDER BY voter_key) FROM public.gw_ballots b WHERE poll_id=pid)<>before_ballots THEN RAISE EXCEPTION 'Ballots changed';END IF;
  BEGIN PERFORM public.gw_resolve_tie_random('fixture-member',pid);RAISE EXCEPTION 'Saved draw bypassed owner';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Organizer access denied' THEN RAISE;END IF;END;
  -- The existing runoff API still creates a fresh poll; the original stays saved.
  runoff:=public.gw_create_poll(owner_token,'Dinner','ranked',2,ARRAY[r1,r2]);
  IF runoff=pid OR (SELECT count(*) FROM public.gw_ballots WHERE poll_id=runoff)<>0 THEN RAISE EXCEPTION 'Bad runoff';END IF;
  pid:=public.gw_create_poll(owner_token,'Dinner',mode,2,ARRAY[r1,r2,r3]);
  INSERT INTO public.gw_ballots(poll_id,voter_key,voter_name,ballot) VALUES(pid,'fixture-1','Fixture 1',b1),(pid,'fixture-2','Fixture 2',b1);
  BEGIN PERFORM public.gw_resolve_tie_random(owner_token,pid);RAISE EXCEPTION 'Clear winner overridden';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'This vote does not need a tiebreaker' THEN RAISE;END IF;END;
 END LOOP;
 -- All-no: both early-closed historical headcounts and automatic completion.
 FOREACH n IN ARRAY ARRAY[1,3] LOOP
  pid:=public.gw_create_poll(owner_token,'Dinner','swipe',3,ARRAY[r1,r2,r3]);
  FOR i IN 1..n LOOP
   INSERT INTO public.gw_ballots(poll_id,voter_key,voter_name,ballot) VALUES(pid,'fixture-'||i,'Fixture',jsonb_build_object(r1::text,false,r2::text,false,r3::text,false));
  END LOOP;
  IF n=1 THEN UPDATE public.gw_polls SET status='closed' WHERE id=pid;END IF;
  SELECT jsonb_agg(to_jsonb(b) ORDER BY voter_key) INTO before_ballots FROM public.gw_ballots b WHERE poll_id=pid;
  BEGIN PERFORM public.gw_resolve_tie_random(owner_token,pid);RAISE EXCEPTION 'All-no draw allowed';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'No restaurant received a yes vote. Start a new shortlist' THEN RAISE;END IF;END;
  IF (SELECT tie_winner_id FROM public.gw_polls WHERE id=pid) IS NOT NULL THEN RAISE EXCEPTION 'Saved rejected draw';END IF;
  IF (SELECT jsonb_agg(to_jsonb(b) ORDER BY voter_key) FROM public.gw_ballots b WHERE poll_id=pid)<>before_ballots THEN RAISE EXCEPTION 'All-no ballots changed';END IF;
 END LOOP;
 -- Ranked transfer still eliminates A and draws only between B and C.
 pid:=public.gw_create_poll(owner_token,'Dinner','ranked',6,ARRAY[r1,r2,r3]);
 FOR i IN 1..6 LOOP
  INSERT INTO public.gw_ballots(poll_id,voter_key,voter_name,ballot) VALUES(pid,'fixture-'||i,'Fixture',case when i=1 then jsonb_build_array(r1,r2,r3) when i<=3 then jsonb_build_array(r2,r3,r1) else jsonb_build_array(r3,r2,r1) end);
 END LOOP;
 picked:=public.gw_resolve_tie_random(owner_token,pid);
 IF NOT picked=any(ARRAY[r2,r3]) THEN RAISE EXCEPTION 'Ranked transfer changed';END IF;
 IF (SELECT to_jsonb(f) FROM public.gw_families f WHERE id=fid)<>before_family THEN RAISE EXCEPTION 'Family link changed';END IF;
 IF NOT has_function_privilege('anon','public.gw_resolve_tie_random(text,uuid)','EXECUTE') OR NOT has_function_privilege('authenticated','public.gw_resolve_tie_random(text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'RPC unavailable';END IF;
 IF EXISTS(SELECT 1 FROM information_schema.routine_privileges WHERE routine_name='gw_resolve_tie_random' AND grantee='PUBLIC') THEN RAISE EXCEPTION 'Public execute granted';END IF;
END $verify$;
ROLLBACK;
