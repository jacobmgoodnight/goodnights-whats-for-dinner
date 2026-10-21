// Only called by release.cjs's isolated synthetic database. Never accepts live URLs.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async function({c,Client,connection,root,fid,token,ids,member,person}){
 const read=f=>fs.readFileSync(path.join(root,f),'utf8');
 const before=(await c.query("select jsonb_build_object('family',(select jsonb_agg(to_jsonb(t)) from gw_families t),'members',(select jsonb_agg(to_jsonb(t) order by id) from gw_members t),'polls',(select jsonb_agg(to_jsonb(t) order by id) from gw_polls t),'ballots',(select jsonb_agg(to_jsonb(t) order by poll_id,voter_key) from gw_ballots t)) as data")).rows[0].data;
 await c.query(read('supabase/migrations/20261021115729_organizer_planning.sql'));
 const after=(await c.query("select jsonb_build_object('family',(select jsonb_agg(to_jsonb(t)) from gw_families t),'members',(select jsonb_agg(to_jsonb(t) order by id) from gw_members t),'polls',(select jsonb_agg(to_jsonb(t)-'title'-'auto_tie' order by id) from gw_polls t),'ballots',(select jsonb_agg(to_jsonb(t) order by poll_id,voter_key) from gw_ballots t)) as data")).rows[0].data;
 assert.deepEqual(after,before);assert.equal((await c.query('select count(*)::int n from gw_dinner_events')).rows[0].n,0);
 const other=(await c.query('select gw_add_member($1,$2) data',[token,'Other synthetic guest'])).rows[0].data;
 const third=(await c.query('insert into gw_restaurants(family_id,name,address) values($1,$2,$3) returning id',[fid,'Third fixture','7 Fixture St'])).rows[0].id;
 const places=[...ids,third],people=[member,other.id];
 const draft=(extra={})=>({place_ids:places,member_ids:people,meal:'Dinner',method:'swipe',cuisine:'pizza',title:'Friday <test>',auto_tie:true,allow_member_home:false,group_join:true,...extra});
 const create=async(d=draft())=>(await c.query('select gw_create_dinner($1,$2) id',[token,d])).rows[0].id;
 const get=async id=>(await c.query('select gw_get_poll($1) p',[id])).rows[0].p;
 const vote=(id,t,ballot)=>c.query('select gw_vote_as_member($1,$2,$3)',[id,t,JSON.stringify(ballot)]);
 await c.query('set role anon');
 for(const method of ['approval','swipe','ranked']){
  const id=await create(draft({method})),beforePoll=await get(id);
  assert.equal(beforePoll.title,'Friday <test>');assert.equal(beforePoll.auto_tie,true);assert.equal(beforePoll.ballots,null);assert.equal(JSON.stringify(beforePoll).includes(person.token),false);
  const ballots=method==='swipe'?[{[ids[0]]:true,[ids[1]]:false,[third]:false},{[ids[0]]:false,[ids[1]]:true,[third]:false}]:method==='ranked'?[[ids[0],ids[1],third],[ids[1],ids[0],third]]:[[ids[0]],[ids[1]]];
  await vote(id,person.token,ballots[0]);assert.equal((await get(id)).tie_winner_id,null);
  await vote(id,other.token,ballots[1]);const result=await get(id);assert.ok(ids.includes(result.tie_winner_id));assert.deepEqual(result.ballots,ballots);
  assert.equal((await c.query('select gw_resolve_tie_random($1,$2) id',[token,id])).rows[0].id,result.tie_winner_id);
  await c.query('reset role');const events=(await c.query('select kind from gw_dinner_events where poll_id=$1',[id])).rows;assert.deepEqual(events,[{kind:'decided'}]);await c.query('set role anon');
 }
 const no=await create();const allNo=Object.fromEntries(places.map(id=>[id,false]));await vote(no,person.token,allNo);await vote(no,other.token,allNo);assert.equal((await get(no)).tie_winner_id,null);
 await assert.rejects(c.query('select gw_resolve_tie_random($1,$2)',[token,no]),/No restaurant received a yes vote/);
 const manual=await create(draft({auto_tie:false}));await vote(manual,person.token,{...allNo,[ids[0]]:true});await vote(manual,other.token,{...allNo,[ids[1]]:true});assert.equal((await get(manual)).tie_winner_id,null);
 await c.query('select gw_resolve_tie_random($1,$2)',[token,manual]);await c.query('reset role');assert.deepEqual((await c.query('select phase,kind from gw_dinner_events where poll_id=$1 order by phase',[manual])).rows,[{phase:'completion',kind:'tie'},{phase:'resolved',kind:'decided'}]);
 assert.equal((await c.query('select kind from gw_dinner_events where poll_id=$1',[no])).rows[0].kind,'no-choice');
 await c.query('set role anon');const empty=await create();await c.query('select gw_close_poll($1,$2)',[token,empty]);assert.equal((await get(empty)).tie_winner_id,null);
 for(const bad of [{ballots:[]},{tie_winner_id:ids[0]},{poll_id:manual},{group_join_token:'not-a-draft'},{member_token:person.token},{member_ids:[member,member]},{place_ids:[ids[0]]},{auto_tie:'true'}])await assert.rejects(create(draft(bad)),/Invalid|Duplicate|Choose/);
 await assert.rejects(c.query('select gw_create_dinner($1,$2)',[person.token,draft()]),/Organizer access denied/);
 const preset=(await c.query('select gw_save_dinner_preset($1,$2,$3) id',[token,'Quick weeknight',draft()])).rows[0].id;
 const saved=(await c.query('select gw_get_dinner_preset($1,$2) p',[token,preset])).rows[0].p;assert.deepEqual(saved.draft,draft());assert.equal(saved.options.length,3);
 await assert.rejects(c.query('select gw_get_dinner_preset($1,$2)',[person.token,preset]),/unavailable/);
 await c.query('reset role');await c.query('update gw_members set active=false where id=$1',[other.id]);await c.query('set role anon');
 assert.equal((await c.query('select gw_get_dinner_preset($1,$2) p',[token,preset])).rows[0].p.people.find(m=>m.id===other.id).active,false);
 await assert.rejects(create(saved.draft),/changed/);await c.query('reset role');await c.query('update gw_members set active=true where id=$1',[other.id]);await c.query('set role anon');
 const nomination=(await c.query('select gw_nominate_restaurant($1,$2,$3,$4,$5) id',[person.token,'Chain','88 Test St','Pizza','Want to try <script>'])).rows[0].id;
 assert.equal((await c.query('select gw_nominate_restaurant($1,$2,$3) id',[person.token,' CHAIN ','88  Test St'])).rows[0].id,nomination);
 const own=(await c.query('select gw_planning_home(null,$1) data',[person.token])).rows[0].data;assert.equal(own.nominations.length,1);assert.equal(own.presets.length,0);assert.equal(own.events.length,0);assert.equal(own.caption,'');assert.equal(JSON.stringify(own).includes(other.token),false);
 assert.equal((await c.query('select gw_planning_home(null,$1) data',[other.token])).rows[0].data.nominations.length,0);
 await assert.rejects(c.query('select gw_nominate_restaurant($1,$2)',[token,'No organizer impersonation']),/personal family link/);
 await assert.rejects(c.query('select gw_review_nomination($1,$2,$3)',[person.token,nomination,ids[0]]),/Organizer access denied/);
 await c.query('select gw_review_nomination($1,$2,$3)',[token,nomination,ids[0]]);
 assert.equal((await c.query('select gw_planning_home(null,$1) data',[person.token])).rows[0].data.nominations[0].status,'accepted');
 await c.query('select gw_set_results_caption($1,$2)',[token,'The family has spoken <test>']);
 const owner=(await c.query('select gw_planning_home($1,null) data',[token])).rows[0].data;assert.equal(owner.caption,'The family has spoken <test>');assert.ok(owner.presets.some(p=>p.id===preset));assert.ok(owner.events.length);
 await assert.rejects(c.query('select gw_set_results_caption($1,$2)',[other.token,'No']),/Organizer access denied/);
 await assert.rejects(c.query('select gw_set_results_caption($1,$2)',[token,'x'.repeat(101)]),/100 characters/);
 for(const table of ['gw_dinner_events','gw_nominations','gw_dinner_presets','gw_family_settings'])await assert.rejects(c.query('select * from '+table),/permission denied/);
 await assert.rejects(c.query('select gw_dinner_decision($1)',[manual]),/permission denied/);
 await c.query('select gw_archive_dinner_preset($1,$2)',[token,preset]);await assert.rejects(c.query('select gw_get_dinner_preset($1,$2)',[token,preset]),/unavailable/);
 await c.query('reset role');
 // Genuine two-connection final-voter race. No browser is needed for the draw.
 const race=await create(draft({method:'approval'}));const a=new Client(connection),b=new Client(connection);await a.connect();await b.connect();
 try{
  await a.query('set role anon;begin');await b.query('set role anon');
  await a.query('select gw_vote_as_member($1,$2,$3)',[race,person.token,JSON.stringify([ids[0]])]);
  const pending=b.query('select gw_vote_as_member($1,$2,$3)',[race,other.token,JSON.stringify([ids[1]])]);
  await new Promise(r=>setTimeout(r,100));await a.query('commit');await pending;
  assert.ok(ids.includes((await get(race)).tie_winner_id));assert.equal((await c.query('select count(*)::int n from gw_dinner_events where poll_id=$1',[race])).rows[0].n,1);
 }finally{await a.end();await b.end()}
 console.log('PASS: additive planning preserves old rows/links/ballots; automatic saved positive ties in all modes, all-no/empty/off guards, manual resolution events, real concurrent final voters, title/privacy, strict fresh drafts, presets/revalidation, nominations/auth/dedup, caption and RLS/grants.');
 await require('./push-fixtures.cjs')({c,Client,connection,root,token,person,other,places,people});
};
