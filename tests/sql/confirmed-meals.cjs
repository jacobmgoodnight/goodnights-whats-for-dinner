const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
require('./fresh-install.cjs')(async({c,Client,connection,fid,owner,person,guest,ids})=>{
 const old=async()=>{const names=(await c.query("select tablename from pg_tables where schemaname='public' and tablename like 'gw_%' and tablename<>'gw_meals' order by tablename")).rows;const snapshot={};for(const {tablename} of names)snapshot[tablename]=(await c.query('select to_jsonb(t) as row from '+tablename+' t order by to_jsonb(t)::text')).rows;return snapshot};
 const definitions=async()=>(await c.query("select proname,proacl,pg_get_functiondef(oid) as definition from pg_proc where pronamespace='public'::regnamespace and proname like 'gw_%' and proname not in ('gw_meal_history','gw_save_meal','gw_delete_meal') order by proname")).rows;
 const before=await old(),beforeFunctions=await definitions();await c.query(fs.readFileSync(path.join(__dirname,'../../supabase/migrations/20261028112638_confirmed_meals.sql'),'utf8'));assert.deepEqual(await old(),before);assert.deepEqual(await definitions(),beforeFunctions);
 const history=async(token=owner,member=null)=>(await c.query('select gw_meal_history($1,$2) as h',[token,member])).rows[0].h;
 assert.equal((await history()).meals.length,0,'completed votes never become meals');
 const id=randomUUID(),save=(mid=id,rid=ids[0],date='2026-10-07',poll=null,token=owner)=>c.query('select gw_save_meal($1,$2,$3,$4,$5)',[token,mid,rid,date,poll]);
 await c.query('set role anon');await save();await save();assert.equal((await history()).meals.length,1);
 assert.equal((await history(null,person.token)).last_eaten[ids[0]],'2026-10-07');
 for(const zone of ['-08:00','+14:00']){await c.query("select set_config('TimeZone',$1,false)",[zone]);assert.equal((await history()).meals[0].eaten_on,'2026-10-07')}
 await assert.rejects(save(randomUUID()),/already recorded/);
 await assert.rejects(save(randomUUID(),ids[0],'infinity'),/local date/);
 await assert.rejects(c.query("select gw_save_meal($1,$2,$3,(now() at time zone 'UTC')::date+2,null)",[owner,randomUUID(),ids[0]]),/local date/);
 await assert.rejects(history('wrong'),/denied/);await assert.rejects(history(null,'wrong'),/denied/);
 await assert.rejects(save(randomUUID(),ids[1],'2026-10-06',null,person.token),/Organizer access denied/);
 await assert.rejects(c.query('select * from gw_meals'),/permission denied/);
 await save(id,ids[1],'2026-10-06');assert.equal((await history()).last_eaten[ids[0]],undefined);assert.equal((await history()).meals[0].restaurant_id,ids[1]);
 await c.query('reset role');
 const clients=[new Client(connection),new Client(connection)];try{await Promise.all(clients.map(x=>x.connect()));const retryId=randomUUID();await Promise.all(clients.map(x=>x.query('select gw_save_meal($1,$2,$3,$4)',[owner,retryId,ids[0],'2026-10-05'])));assert.equal((await c.query('select count(*)::int as n from gw_meals where id=$1',[retryId])).rows[0].n,1)}finally{await Promise.all(clients.map(x=>x.end()))}
 const pid=(await c.query("select gw_create_poll_configured($1,'Dinner','approval',$2,$3,false,true) as id",[owner,ids,[person.id,guest.id]])).rows[0].id;
 const group=(await c.query('select group_join_token from gw_polls where id=$1',[pid])).rows[0].group_join_token;
 await assert.rejects(history(group),/denied/);await save(randomUUID(),ids[2],'2026-10-04',pid);
 const pub=(await c.query('select gw_get_poll($1) as p',[pid])).rows[0].p;assert.equal(pub.meals,undefined);assert.equal(pub.last_eaten,undefined);
 await c.query('select gw_delete_polls($1,$2,false)',[owner,[pid]]);assert.equal((await history()).meals.find(m=>m.restaurant_id===ids[2]).poll_id,null);
 await c.query('update gw_restaurants set active=false where id=$1',[ids[2]]);assert.equal((await history()).meals.find(m=>m.restaurant_id===ids[2]).active,false);
 await c.query('drop index gw_one_family_only');const otherToken='c'.repeat(48),otherF=(await c.query('insert into gw_families(name,token) values($1,$2) returning id',['Other synthetic family',otherToken])).rows[0].id;
 const otherR=(await c.query('insert into gw_restaurants(family_id,name) values($1,$2) returning id',[otherF,'Other synthetic place'])).rows[0].id;
 await assert.rejects(save(randomUUID(),otherR),/your family/);await assert.rejects(save(id,ids[0],'2026-10-01',null,otherToken),/your family|unavailable/);
 assert.equal((await history(otherToken)).meals.length,0);assert.equal((await c.query('select gw_delete_meal($1,$2) as ok',[otherToken,id])).rows[0].ok,false);
 await c.query('select gw_delete_meal($1,$2)',[owner,id]);assert.ok(!(await history()).meals.some(m=>m.id===id));
 for(let i=1;i<=55;i++)await c.query("select gw_save_meal($1,$2,$3,date '2026-09-01'-$4::integer)",[owner,randomUUID(),ids[0],i]);
 assert.equal((await history()).meals.length,50);assert.equal((await history()).last_eaten[ids[2]],'2026-10-04');
 await c.query('update gw_members set active=false where id=$1',[person.id]);await assert.rejects(history(null,person.token),/denied/);
 console.log('PASS: additive row preservation, no inferred meals, calendar dates, retry/concurrency dedup, correction/deletion, member/owner/group/cross-family privacy, archived places, poll deletion independence and bounded history.');
}).catch(e=>{console.error(e);process.exit(1)});
