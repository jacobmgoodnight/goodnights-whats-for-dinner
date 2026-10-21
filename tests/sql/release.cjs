// Rehearse against a catalog-only snapshot of deployed gw_* definitions. No live URL.
// GW_SCHEMA_SNAPSHOT: private schema JSON; GW_PG_RUNTIME: external embedded-postgres + pg.
// Optional GW_BACKUP_VERIFY_DIR decrypts/checks a private backup in memory only.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..'),runtime=process.env.GW_PG_RUNTIME;
if(!runtime||!process.env.GW_SCHEMA_SNAPSHOT)throw Error('Set GW_PG_RUNTIME and GW_SCHEMA_SNAPSHOT; this runner accepts no database URL');
const schema=JSON.parse(fs.readFileSync(process.env.GW_SCHEMA_SNAPSHOT,'utf8'));
const quote=s=>'"'+s.replaceAll('"','""')+'"';
(async()=>{
 const Embedded=(await import(pathToFileURL(path.join(runtime,'embedded-postgres/dist/index.js')).href)).default;
 const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
 const cluster=new Embedded({databaseDir:fs.mkdtempSync(path.join(os.tmpdir(),'gw-release-')),user:'postgres',password:'synthetic-only',port,persistent:true,initdbFlags:['--encoding=UTF8','--locale=C'],postgresFlags:['-h','127.0.0.1'],onLog(){},onError(){}});
 const {Client}=require(path.join(runtime,'pg'));let c,started=false;
 try{
  await cluster.initialise();await cluster.start();started=true;
  c=new Client({host:'127.0.0.1',port,user:'postgres',password:'synthetic-only',database:'postgres'});await c.connect();
  await c.query('create role anon;create role authenticated;create schema extensions;create extension pgcrypto with schema extensions;set search_path=public,extensions;');
  if(process.env.GW_BACKUP_VERIFY_DIR){
   const dir=process.env.GW_BACKUP_VERIFY_DIR;
   const key=execFileSync(process.env.GW_POWERSHELL||'pwsh.exe',['-NoProfile','-Command',"$ErrorActionPreference='Stop';$s=(Get-Content -Raw -LiteralPath '"+path.join(dir,'backup-key.dpapi').replaceAll("'","''")+"').Trim() | ConvertTo-SecureString;[Console]::Write([System.Net.NetworkCredential]::new('', $s).Password)"],{encoding:'utf8'}).trim();
   assert.ok(key.length>=40,'Private backup key could not be recovered');
   const encrypted=fs.readFileSync(path.join(dir,'production-before.pgp'));
   const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
   const payload=(await c.query('select extensions.pgp_sym_decrypt($1,$2) as payload',[encrypted,key])).rows[0].payload;
   assert.equal(crypto.createHash('md5').update(payload).digest('hex'),manifest.checksum);
   assert.equal(Buffer.byteLength(payload),manifest.bytes);
   const decoded=JSON.parse(payload);
   assert.deepEqual(Object.keys(decoded.data).sort(),schema.tables.map(t=>t.name).sort());
   for(const table of schema.tables)assert.ok(Array.isArray(decoded.data[table.name]));
   assert.deepEqual(decoded.schema,schema);
   // No production rows are restored or used as test fixtures.
   console.log('PASS: private backup decrypts locally, checksum/length/schema and all seven data arrays verified; no private contents printed or restored.');
  }
  for(const t of schema.tables){
   await c.query('create table public.'+quote(t.name)+' ('+t.columns.map(a=>quote(a.name)+' '+a.type+(a.default?' default '+a.default:'')+(a.notnull?' not null':'')).join(',')+')');
  }
  for(const kind of ['nonfk','fk'])for(const t of schema.tables)for(const con of t.constraints||[])if((con.type==='f')===(kind==='fk'))await c.query('alter table public.'+quote(t.name)+' add constraint '+quote(con.name)+' '+con.definition);
  for(const t of schema.tables){
   const existing=(await c.query('select indexname from pg_indexes where schemaname=\'public\' and tablename=$1',[t.name])).rows.map(r=>r.indexname);
   for(const index of t.indexes||[])if(!existing.some(name=>index.includes('INDEX '+name+' ')))await c.query(index);
   if(t.rls)await c.query('alter table public.'+quote(t.name)+' enable row level security');
  }
  assert.equal(schema.policies,null,'Review unexpected policies before rehearsal');
  await c.query('set check_function_bodies=off');
  for(const f of schema.functions)await c.query(f.definition);
  await c.query('set check_function_bodies=on');
  for(const f of schema.functions){
   const signature='public.'+quote(f.name)+'('+f.identity+')';
   await c.query('revoke all on function '+signature+' from public,anon,authenticated');
   for(const role of ['anon','authenticated'])if((f.acl||[]).some(a=>a.startsWith(role+'=')&&a.split('/')[0].includes('X')))await c.query('grant execute on function '+signature+' to '+role);
  }
  for(const trigger of schema.triggers||[])await c.query(trigger);
  // Create a saved historical all-no draw before H1, using fictional rows only.
  await c.query('begin');
  const token='c'.repeat(48),fid=(await c.query('select gw_create_family($1,$2) as data',['Release fixture',token])).rows[0].data.id;
  const ids=[];for(let i=0;i<2;i++)ids.push((await c.query('insert into gw_restaurants(family_id,name,address) values($1,$2,$3) returning id',[fid,'Fixture branch '+i,i+' Test St'])).rows[0].id);
  const pid=(await c.query("select gw_create_poll($1,'Dinner','swipe',1,$2) as id",[token,ids])).rows[0].id;
  await c.query('insert into gw_ballots(poll_id,voter_key,voter_name,ballot) values($1,$2,$3,$4)',[pid,'fixture','Fixture',JSON.stringify(Object.fromEntries(ids.map(id=>[id,false])))]);
  const old=(await c.query('select gw_resolve_tie_random($1,$2) as id',[token,pid])).rows[0].id;
  const before=(await c.query('select to_jsonb(p) as p from gw_polls p where id=$1',[pid])).rows[0].p;
  await c.query(fs.readFileSync(path.join(root,'supabase/migrations/20261020182044_honest_consensus_outcomes.sql'),'utf8'));
  assert.equal((await c.query('select gw_resolve_tie_random($1,$2) as id',[token,pid])).rows[0].id,old);
  assert.deepEqual((await c.query('select to_jsonb(p) as p from gw_polls p where id=$1',[pid])).rows[0].p,before);
  await c.query('rollback');
  for(const migration of ['20261020182044_honest_consensus_outcomes.sql','20261020191956_location_aware_restaurant_saving.sql'])await c.query(fs.readFileSync(path.join(root,'supabase/migrations',migration),'utf8'));
  await c.query(fs.readFileSync(path.join(root,'tests/sql/honest_consensus.rollback.sql'),'utf8'));
  await c.query('insert into gw_families(id,name,token) values($1,$2,$3)',[fid,'Release fixture',token]);
  for(let i=0;i<2;i++)await c.query('insert into gw_restaurants(id,family_id,name,address) values($1,$2,$3,$4)',[ids[i],fid,'Fixture branch '+i,i+' Test St']);
  const member=(await c.query('select gw_add_member($1,$2) as data',[token,'Synthetic guest'])).rows[0].data.id;
  const members=(await c.query('select gw_list_members($1) as data',[token])).rows[0].data;
  const person=(Array.isArray(members)?members:members.members).find(m=>m.id===member);
  assert.ok(person.token);
  const create=async(method='swipe')=>(await c.query("select gw_create_poll_themed($1,'Dinner',$2,$3,$4,false,true,'pizza') as id",[token,method,ids,[member]])).rows[0].id;
  const fresh=await create();
  const original=(await c.query('select gw_get_poll($1) as p',[fresh])).rows[0].p;
  assert.equal(original.cuisine,'pizza');assert.equal(original.roster_enabled,true);
  const group=(await c.query('select group_join_token from gw_polls where id=$1',[fresh])).rows[0].group_join_token;
  await c.query('set role anon');
  const people=(await c.query('select gw_get_poll_people($1,$2,null,false) as data',[fresh,token])).rows[0].data;
  assert.ok(people.people.some(m=>m.id===member));assert.ok(!JSON.stringify(people).includes(person.token));
  await c.query('select gw_vote_as_member($1,$2,$3)',[fresh,person.token,JSON.stringify(Object.fromEntries(ids.map(id=>[id,false])))]);
  await assert.rejects(c.query('select gw_resolve_tie_random($1,$2)',[token,fresh]),/No restaurant received a yes vote/);
  const repeated=await create('ranked');assert.notEqual(repeated,fresh);
  await c.query('reset role');
  assert.equal((await c.query('select count(*)::int as n from gw_ballots where poll_id=$1',[repeated])).rows[0].n,0);
  assert.notEqual((await c.query('select group_join_token from gw_polls where id=$1',[repeated])).rows[0].group_join_token,group);
  const save=(address,extra={})=>c.query('select gw_save_restaurant_location($1,$2,$3,$4,$5,null,null,$6,null,\'auto\',\'\',$7) as result',[token,'Test Chain','Pizza',address,extra.osm||null,!!extra.separate,extra.reviewed||[]]).then(r=>r.rows[0].result);
  const first=await save('1 Test Ave',{osm:'node/90001'});assert.equal(first.status,'saved');
  const review=await save('2 Test Ave');assert.equal(review.status,'review');
  const second=await save('2 Test Ave',{separate:true,reviewed:review.matches.map(m=>m.id)});assert.equal(second.status,'saved');assert.notEqual(first.id,second.id);
  assert.equal((await save('New upstream text',{osm:'node/90001'})).id,first.id);
  await c.query('set role anon');
  await assert.rejects(c.query('select * from gw_families'),/permission denied/);
  await assert.rejects(c.query('select gw_vote($1,$2,$3)',[fresh,'Name only','{}']),/permission denied/);
  await c.query('reset role');
  assert.ok((await c.query("select bool_and(relrowsecurity) as enabled from pg_class where relnamespace='public'::regnamespace and relname like 'gw_%' and relkind='r'")).rows[0].enabled);
  console.log('PASS: deployed catalog reconstructed with RLS/grants, both migrations, saved historical pick, H1 fixtures, real roster/theme/member vote, all-no guard, fresh repeat IDs/group credentials/empty ballots and H4 separate locations/exact source reuse.');
  if(process.env.GW_PLANNING_TESTS)await require('./planning-fixtures.cjs')({c,Client,connection:{host:'127.0.0.1',port,user:'postgres',password:'synthetic-only',database:'postgres'},root,fid,token,ids,member,person});
 }finally{if(c)await c.end();if(started)await cluster.stop()}
})().catch(e=>{console.error(e);process.exit(1)});
