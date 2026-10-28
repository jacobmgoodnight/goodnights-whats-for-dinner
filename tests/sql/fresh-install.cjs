// Isolated PostgreSQL only; no URL, production records or hosted requests accepted.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
module.exports=async function isolated(check){
 const runtime=process.env.GW_PG_RUNTIME;if(!runtime)throw Error('Set GW_PG_RUNTIME to external embedded-postgres/pg node_modules');
 const Embedded=(await import(pathToFileURL(path.join(runtime,'embedded-postgres/dist/index.js')).href)).default,{Client}=require(path.join(runtime,'pg'));
 const port=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p))})});
 const cluster=new Embedded({databaseDir:fs.mkdtempSync(path.join(os.tmpdir(),'gw-fresh-')),user:'postgres',password:'synthetic-only',port,persistent:true,initdbFlags:['--encoding=UTF8','--locale=C'],postgresFlags:['-h','127.0.0.1'],onLog(){},onError(){}});let c,started=false;
 try{await cluster.initialise();await cluster.start();started=true;c=new Client({host:'127.0.0.1',port,user:'postgres',password:'synthetic-only',database:'postgres'});await c.connect();await c.query('create role anon;create role authenticated;create role service_role;');
  const installer=fs.readFileSync(path.join(__dirname,'../../sql/fresh-install.sql'),'utf8');await c.query(installer);
  await assert.rejects(c.query(installer),/requires an empty project/);await c.query('rollback');
  const owner='a'.repeat(48),other='b'.repeat(48),fid=(await c.query('select gw_create_family($1,$2) as data',['Synthetic family',owner])).rows[0].data.id;
  const ids=[];for(let i=0;i<3;i++)ids.push((await c.query('insert into gw_restaurants(family_id,name,address) values($1,$2,$3) returning id',[fid,'Synthetic Pizza '+i,i+' Test St'])).rows[0].id);
  const person=(await c.query('select gw_add_member($1,$2) as data',[owner,'Synthetic person'])).rows[0].data;
  const guest=(await c.query('select gw_add_member($1,$2) as data',[owner,'Synthetic guest'])).rows[0].data;
  const create=async(method)=>(await c.query("select gw_create_poll_configured($1,'Dinner',$2,$3,$4,false,true) as id",[owner,method,ids,[person.id,guest.id]])).rows[0].id;
  for(const method of ['approval','swipe','ranked']){
   const id=await create(method),ballot=method==='swipe'?Object.fromEntries(ids.map((r,i)=>[r,i===0])):ids.slice(0,method==='approval'?1:3);
   await c.query('set role anon');await c.query('select gw_vote_as_member($1,$2,$3)',[id,person.token,JSON.stringify(ballot)]);
   await c.query('select gw_vote_as_member($1,$2,$3)',[id,person.token,JSON.stringify(ballot)]); // edit before final vote
   assert.deepEqual((await c.query('select gw_get_my_ballot($1,$2) as b',[id,person.token])).rows[0].b,ballot);
   await c.query('select gw_vote_as_member($1,$2,$3)',[id,guest.token,JSON.stringify(ballot)]);
   const result=(await c.query('select gw_get_poll($1) as p',[id])).rows[0].p;assert.equal(result.status,'closed');assert.equal(result.ballots.length,2);assert.ok(!JSON.stringify(result).includes(person.token));
   await assert.rejects(c.query('select gw_vote($1,$2,$3)',[id,'name',JSON.stringify(ballot)]),/permission denied/);await c.query('reset role');
  }
  const id=await create('approval'),group=(await c.query('select group_join_token from gw_polls where id=$1',[id])).rows[0].group_join_token;
  await c.query('set role anon');const people=(await c.query("select gw_group_poll($1,$2,null,'people') as p",[id,group])).rows[0].p;
  assert.equal(people.people.length,2);assert.ok(!JSON.stringify(people).includes(person.token));
  await c.query("select gw_group_poll($1,$2,$3,'vote',$4)",[id,group,person.id,JSON.stringify([ids[0]])]);
  await assert.rejects(c.query("select gw_group_poll($1,$2,$3,'vote',$4)",[id,group,person.id,JSON.stringify([ids[1]])]),/already voted/);
  await assert.rejects(c.query("select gw_group_poll($1,$2,null,'people')",[id,'wrong']),/unavailable/);
  await assert.rejects(c.query('select * from gw_members'),/permission denied/);
  await assert.rejects(c.query('select gw_process_dinner_poll($1)',[id]),/permission denied/);
  await assert.rejects(c.query('select gw_get_family($1)',[other]),/not found/);await c.query('reset role');
  assert.equal((await c.query("select bool_and(relrowsecurity) as ok from pg_class where relnamespace='public'::regnamespace and relname like 'gw_%' and relkind='r'")).rows[0].ok,true);
  if(check)await check({c,Client,connection:{host:'127.0.0.1',port,user:'postgres',password:'synthetic-only',database:'postgres'},fid,owner,person,guest,ids});
  console.log('PASS: empty install, repeat refusal, three methods, personal edits, completion/public privacy, group vote-once, token/role guards and RLS.');
 }finally{if(c)await c.end();if(started)await cluster.stop()}
};
if(require.main===module)module.exports().catch(e=>{console.error(e);process.exitCode=1});
