// Destructive fixtures are restricted to a fresh, isolated local PostgreSQL cluster.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto'),{tally}=require('../../voting.js');
const migration=fs.readFileSync(path.join(__dirname,'../../supabase/migrations/20261028162644_one_time_travel_polls.sql'),'utf8');
require('./fresh-install.cjs')(async({c,Client,connection,owner,person,guest,fid,ids})=>{
 const one=async(sql,args=[])=>(await c.query(sql,args)).rows[0];
 const oldReader=(await one("select pg_get_functiondef('gw_get_poll(uuid)'::regprocedure) as d")).d;
 const snapshot=async()=>JSON.stringify((await c.query("select * from (select 'poll' as t,(to_jsonb(p)-'one_time') as data from gw_polls p union all select 'member',to_jsonb(m) from gw_members m union all select 'restaurant',to_jsonb(r) from gw_restaurants r union all select 'ballot',to_jsonb(b) from gw_ballots b) s order by t,data::text")).rows);
 const before=await snapshot(),acl=(await c.query("select oid::regprocedure::text as fn,proacl::text as acl from pg_proc where pronamespace='public'::regnamespace order by 1")).rows;
 await c.query(migration);assert.equal(await snapshot(),before);
 for(const old of acl)assert.equal((await one('select proacl::text as acl from pg_proc where oid=$1::regprocedure',[old.fn])).acl,old.acl);
 await assert.rejects(c.query(migration),/differs from the reviewed/);await c.query('rollback');
 const create=async(method='approval',expected=2,names=['Pizza (near the hotel)','Tacos','Café'],request=randomUUID(),token=owner)=>(await one('select gw_create_one_time_poll($1,$2,$3,$4,$5,$6,$7) as id',[token,names,expected,'Dinner',method,'Cousins dinner',request])).id;
 const access=async(id,token,action,guestId=null,name=null,ballot=null,ownerToken=null)=>(await one('select gw_one_time_access($1,$2,$3,$4,$5,$6,$7) as data',[id,token,ownerToken,guestId,action,name,ballot===null?null:JSON.stringify(ballot)])).data;
 const settings=async id=>(await one('select gw_poll_settings($1,$2) as data',[owner,id])).data;
 const get=async id=>(await one('select gw_get_poll($1) as p',[id])).p;
 const library=async()=>(await one('select gw_get_family($1) as f',[owner])).f.restaurants;
 const originalLibrary=await library(),originalMembers=(await one('select gw_list_members($1) as m',[owner])).m;
 await c.query('set role anon');
 // Normal personal links and ballot editing still work after the additive upgrade.
 const regular=(await one("select gw_create_poll_configured($1,'Dinner','approval',$2,$3,false,true) as id",[owner,ids,[person.id,guest.id]])).id;
 await c.query('select gw_vote_as_member($1,$2,$3)',[regular,person.token,JSON.stringify([ids[0]])]);
 await c.query('select gw_vote_as_member($1,$2,$3)',[regular,person.token,JSON.stringify([ids[1]])]);
 assert.deepEqual((await one('select gw_get_my_ballot($1,$2) as b',[regular,person.token])).b,[ids[1]]);
 const regularInvite=(await settings(regular)).group_join_token;
 assert.equal((await one("select gw_group_poll($1,$2,null,'people') as p",[regular,regularInvite])).p.people.length,2);
 await c.query('select gw_vote_as_member($1,$2,$3)',[regular,guest.token,JSON.stringify([ids[1]])]);assert.equal((await get(regular)).one_time,false);
 await assert.rejects(create('approval',2,undefined,undefined,person.token),/Organizer access denied/);
 for(const names of [null,[],['Only one'],['Same',' same '],['a',' '],['a','x'.repeat(121)],Array(21).fill('A')])await assert.rejects(create('approval',2,names),/restaurant names/);
 await assert.rejects(create('approval',0),/Invalid/);await assert.rejects(create('wrong'),/Invalid/);
 const retryKey=randomUUID(),id=await create('approval',2,undefined,retryKey);assert.equal(await create('approval',2,undefined,retryKey),id);
 const invite=(await settings(id)).group_join_token,p=await get(id);assert.equal(p.one_time,true);assert.equal(p.options.length,3);assert.equal(p.allow_member_home,false);assert.equal(p.roster_enabled,true);
 assert.ok(p.options.every(r=>r.address===''&&r.icon_mode==='builtin'));assert.equal(p.ballots,null);
 await assert.rejects(access(id,'wrong','people'),/unavailable/);await assert.rejects(access(id,null,'people',null,null,null,person.token),/unavailable/);
 await assert.rejects(access(id,null,'join',null,'No owner votes',null,owner),/shared invitation/);
 for(const name of ['', ' '.repeat(20),'x'.repeat(61)])await assert.rejects(access(id,invite,'join',null,name),/Enter your name/);
 let sam=await access(id,invite,'join',null,'  Sam   Test  ');assert.equal(sam.name,'Sam Test');assert.equal((await access(id,invite,'join',null,'sam test')).id,sam.id);
 sam=await access(id,invite,'join',sam.id,'Sam Corrected');assert.equal(sam.name,'Sam Corrected');
 const lee=await access(id,invite,'join',null,'Lee Test');await assert.rejects(access(id,invite,'join',sam.id,'Lee Test'),/in use/);
 await assert.rejects(access(id,invite,'join',null,'Third guest'),/places are taken/);
 const other=await create(),otherToken=(await settings(other)).group_join_token;
 await assert.rejects(access(other,invite,'people'),/unavailable/);await assert.rejects(access(other,otherToken,'identity',sam.id),/Enter your name/);
 await assert.rejects(access(other,otherToken,'join',sam.id,'Cross-poll'),/not part/);
 await assert.rejects(c.query('select gw_vote_as_member($1,$2,$3)',[id,person.token,JSON.stringify([p.options[0].id])]),/not invited/);
 await assert.rejects(c.query("select gw_group_poll($1,$2,$3,'identity')",[id,invite,person.id]),/Choose an invited/);
 await assert.rejects(access(id,invite,'vote',sam.id,null,[]),/Pick one or two/);
 await assert.rejects(access(id,invite,'vote',sam.id,null,[ids[0]]),/Invalid approval/);
 const ballot=[p.options[0].id];await access(id,invite,'vote',sam.id,null,ballot);await access(id,invite,'vote',sam.id,null,ballot);
 await assert.rejects(access(id,invite,'vote',sam.id,null,[p.options[1].id]),/already voted/);
 await assert.rejects(access(id,invite,'join',null,'Sam Corrected'),/already voted/);assert.equal((await get(id)).voted_count,1);
 const people=await access(id,null,'people',null,null,null,owner);assert.equal(people.people.length,2);assert.equal(people.people[0].name,'Sam Corrected');
 assert.ok(!JSON.stringify(people).includes(person.token));assert.ok(!JSON.stringify(people).includes(fid));
 const partial=await get(id);assert.equal(partial.ballots,null);assert.ok(!JSON.stringify(partial).includes('Sam Corrected'));
 await access(id,invite,'vote',lee.id,null,[p.options[1].id]);const tied=await get(id);assert.equal(tied.status,'closed');assert.equal(tally(tied).winners.length,2);
 const winner=(await one('select gw_resolve_tie_random($1,$2) as winner',[owner,id])).winner;assert.ok([p.options[0].id,p.options[1].id].includes(winner));
 assert.equal((await one('select gw_resolve_tie_random($1,$2) as winner',[owner,id])).winner,winner);
 await assert.rejects(access(id,invite,'join',null,'Late guest'),/Voting is closed/);
 assert.ok(!JSON.stringify(await get(id)).includes(invite));assert.ok(!JSON.stringify(await get(id)).includes('Sam Corrected'));
 for(const method of ['approval','swipe','ranked']){
  const pid=await create(method),token=(await settings(pid)).group_join_token,options=(await get(pid)).options.map(r=>r.id);
  const a=await access(pid,token,'join',null,'Synthetic A'),b=await access(pid,token,'join',null,'Synthetic B');
  const vote=method==='swipe'?Object.fromEntries(options.map(r=>[r,false])):options.slice(0,method==='ranked'?3:1);
  await access(pid,token,'vote',a.id,null,vote);await access(pid,token,'vote',b.id,null,vote);
  const result=await get(pid);assert.equal(result.status,'closed');assert.equal(result.ballots.length,2);
  if(method==='swipe'){assert.equal(tally(result).outcome,'no-choice');await assert.rejects(c.query('select gw_resolve_tie_random($1,$2)',[owner,pid]),/positive|support|tie|yes vote/i)}
  else assert.equal(tally(result).winners.length,1);
 }
 // Revoke/rotate only this synthetic invitation; old tokens and cross-family owners cannot recover it.
 await c.query('select gw_poll_settings($1,$2,false,false)',[owner,other]);await assert.rejects(access(other,otherToken,'people'),/unavailable/);
 await c.query('select gw_poll_settings($1,$2,false,true)',[owner,other]);assert.notEqual((await settings(other)).group_join_token,otherToken);
 // This deployment enforces one family per project. An unrelated organizer credential has no access.
 const otherOwner='c'.repeat(48);
 await assert.rejects(access(other,null,'people',null,null,null,otherOwner),/unavailable/);await assert.rejects(create('approval',2,undefined,retryKey,otherOwner),/Organizer access denied/);
 for(const role of ['anon','authenticated']){await c.query('reset role');await c.query('set role '+role);await assert.rejects(c.query('select * from gw_poll_guests'),/permission denied/);await assert.rejects(c.query('select gw_vote($1,$2,$3)',[other,'name','[]']),/permission denied/)}
 await c.query('reset role');assert.equal((await one("select relrowsecurity as r from pg_class where oid='gw_poll_guests'::regclass")).r,true);
 assert.deepEqual(await library(),originalLibrary);assert.deepEqual((await one('select gw_list_members($1) as m',[owner])).m,originalMembers);
 // Concurrent joins/votes share the poll row lock, so capacity and vote-once cannot race.
 const race=await create(),raceToken=(await settings(race)).group_join_token;
 const clients=[new Client(connection),new Client(connection)];for(const client of clients){await client.connect();await client.query('set role anon')}
 const raceCall=(client,action,gid=null,name=null,vote=null)=>client.query('select gw_one_time_access($1,$2,null,$3,$4,$5,$6) as data',[race,raceToken,gid,action,name,vote&&JSON.stringify(vote)]);
 try{
  const joined=await Promise.all(clients.map(client=>raceCall(client,'join',null,'Same synthetic name')));assert.equal(joined[0].rows[0].data.id,joined[1].rows[0].data.id);
  const cap=await Promise.allSettled(clients.map((client,i)=>raceCall(client,'join',null,'Guest '+i)));assert.equal(cap.filter(r=>r.status==='fulfilled').length,1);
  const guestId=joined[0].rows[0].data.id,options=(await get(race)).options;
  const votes=await Promise.allSettled(clients.map((client,i)=>raceCall(client,'vote',guestId,null,[options[i].id])));assert.equal(votes.filter(r=>r.status==='fulfilled').length,1);assert.equal((await get(race)).voted_count,1);
 }finally{for(const client of clients)await client.end()}
 await c.query('select gw_delete_polls($1,$2,false)',[owner,[id]]);
 assert.equal((await one('select count(*)::integer as n from gw_poll_guests where poll_id=$1',[id])).n,0);
 // Simulate frontend rollback: additive objects/data stay, old reader still works for old polls.
 await c.query(oldReader);assert.equal((await get(regular)).one_time,undefined);assert.equal((await get(regular)).ballots.length,2);
 console.log('PASS: additive migration/data+ACL preservation, name-only choices, all methods, private guests, role/token/family/poll boundaries, corrections, retry safety, concurrency, all-no, ties and saved draw, revocation and reader rollback.');
}).catch(e=>{console.error(e);process.exit(1)});
