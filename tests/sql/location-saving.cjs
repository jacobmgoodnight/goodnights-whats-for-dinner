// Optional real PostgreSQL integration runner. Installs nothing and never uses Supabase.
// Set GW_PG_RUNTIME to an external node_modules containing embedded-postgres and pg.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const runtime=process.env.GW_PG_RUNTIME;if(!runtime)throw Error('Set GW_PG_RUNTIME to the isolated test node_modules directory');
const {Client}=require(path.join(runtime,'pg'));
const migration=read('supabase/migrations/20261020191956_location_aware_restaurant_saving.sql');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const Embedded=(await import(pathToFileURL(path.join(runtime,'embedded-postgres/dist/index.js')).href)).default;
 const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
 const databaseDir=fs.mkdtempSync(path.join(os.tmpdir(),'gw-h4-fixture-'));
 const cluster=new Embedded({databaseDir,user:'postgres',password:'synthetic-only',port,persistent:true,postgresFlags:['-h','127.0.0.1'],onLog(){},onError(){}});
 const clients=[];let started=false;
 try{
  await cluster.initialise();await cluster.start();started=true;
  for(let i=0;i<3;i++){const c=new Client({host:'127.0.0.1',port,user:'postgres',password:'synthetic-only',database:'postgres'});await c.connect();clients.push(c)}
  const [admin,a,b]=clients;
  await admin.query('create role anon; create role authenticated;');
  await admin.query(read('database.sql'));await admin.query(read('sql/restaurant_visuals.sql'));await admin.query(migration);
  const fid=(await admin.query("insert into gw_families(name,token) values('H4 synthetic',repeat('a',48)) returning id")).rows[0].id;
  await a.query('set role anon');await b.query('set role anon');
  const query='select public.gw_save_restaurant_location($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) as result';
  const request=async(c,d={})=>(await c.query(query,[d.token||'a'.repeat(48),d.name||'Chain',d.category||'Pizza',d.address??'1 Oak St',d.osm||null,d.lat??null,d.lon??null,d.separate||false,d.use||null,d.mode||'auto',d.icon||'',d.reviewed||[]])).rows[0].result;
  // Explicit fixture approval after the server reveals ALL current matches.
  const save=async(c,d={})=>{const r=await request(c,d);return d.separate&&r.status==='review'&&r.can_keep_separate?request(c,{...d,reviewed:r.matches.map(m=>m.id)}):r};
  const row=async id=>(await admin.query('select * from gw_restaurants where id=$1',[id])).rows[0];
  const first=await save(a);assert.equal(first.created,true);
  assert.equal((await save(a,{address:'2 Oak St'})).status,'review');
  const branch=await save(a,{address:'2 Oak St',separate:true});assert.notEqual(first.id,branch.id);
  const stale=await request(a,{address:'3 New St',separate:true,reviewed:[first.id]});assert.equal(stale.status,'review');assert.equal(stale.matches.some(m=>m.id===branch.id),true);
  const initial=await row(first.id);
  const repeat=await save(a,{name:'  CHAIN ',address:' 1   Oak St ',category:'Changed',mode:'builtin',icon:'taco'});
  assert.equal(repeat.id,first.id);assert.equal(repeat.created,false);assert.deepEqual(await row(first.id),initial);
  const pid=(await admin.query("select gw_create_poll(repeat('a',48),'Dinner','approval',1,$1) as id",[[first.id,branch.id]])).rows[0].id;
  await admin.query("insert into gw_ballots(poll_id,voter_key,voter_name,ballot) values($1,'fixture','Fixture',$2)",[pid,JSON.stringify([first.id])]);
  const history=(await admin.query('select * from gw_poll_options where poll_id=$1 order by restaurant_id',[pid])).rows;
  await admin.query('update gw_restaurants set active=false where id=$1',[first.id]);
  assert.equal((await save(a)).id,first.id);assert.deepEqual(await row(first.id),initial);assert.deepEqual((await admin.query('select * from gw_poll_options where poll_id=$1 order by restaurant_id',[pid])).rows,history);
  const osm=await save(a,{name:'OSM chain',address:'3 Oak St',osm:'node/101',lat:40,lon:-86});
  const osmBefore=await row(osm.id);
  assert.equal((await save(a,{name:'Renamed upstream',address:'Different upstream',osm:'node/101',lat:41,lon:-87})).id,osm.id);
  assert.deepEqual(await row(osm.id),osmBefore);
  await admin.query('update gw_restaurants set active=false where id=$1',[osm.id]);
  assert.equal((await save(a,{name:'Renamed upstream',address:'Other',osm:'node/101'})).restored,true);assert.deepEqual(await row(osm.id),osmBefore);
  assert.equal((await save(a,{name:'OSM chain',address:'3 Oak St',osm:'way/102',lat:40,lon:-86})).status,'review');
  const way=await save(a,{name:'OSM chain',address:'3 Oak St',osm:'way/102',lat:40,lon:-86,separate:true});assert.notEqual(osm.id,way.id);
  const ambiguous=await save(a,{name:'OSM chain',address:'3 Oak St',separate:true});assert.equal(ambiguous.status,'review');assert.equal(ambiguous.can_keep_separate,false);
  assert.equal((await save(a,{name:'OSM chain',address:'3 Oak St',use:way.id})).id,way.id);
  assert.equal((await save(a,{name:'Unknown',address:''})).status,'review');
  const unknown=await save(a,{name:'Unknown',address:'',separate:true});assert.equal(unknown.created,true);
  assert.equal((await save(a,{name:'Unknown',address:''})).status,'review');
  await assert.rejects(a.query("select gw_add_restaurant(repeat('a',48),'Unknown','','')"),/Review locations/);
  await assert.rejects(save(a,{token:'member-fixture'}),/Family access denied/);
  await assert.rejects(save(a,{token:'group-fixture'}),/Family access denied/);
  await assert.rejects(save(a,{use:'00000000-0000-4000-8000-000000000001'}),/not found in your family/);
  await assert.rejects(save(a,{osm:'node/001'}),/Invalid OpenStreetMap/);
  await assert.rejects(save(a,{name:'\t\n'}),/Restaurant name must contain/);
  await assert.rejects(save(a,{osm:'node/'+'9'.repeat(120)}),/Invalid OpenStreetMap/);
  await assert.rejects(save(a,{lat:40,lon:-86}),/Coordinates require/);
  await assert.rejects(admin.query('insert into gw_restaurants(family_id,name,osm_id) values($1,$2,$3)',[fid,'Duplicate','node/101']),e=>e.code==='23505');
  await assert.rejects(admin.query('insert into gw_restaurants(family_id,name,address) values($1,$2,$3)',[fid,' CHAIN ',' 1  Oak St ']),e=>e.code==='23505');
  assert.equal((await a.query("select gw_add_restaurant(repeat('a',48),'Other','','','node/101') as id")).rows[0].id,osm.id);
  // Explicit address edit keeps ID/history but discards stale source coordinates.
  await a.query("select gw_update_restaurant(repeat('a',48),$1,'OSM chain','Pizza','4 Oak St','auto','')",[osm.id]);
  const edited=await row(osm.id);assert.equal(edited.osm_id,null);assert.equal(edited.latitude,null);assert.equal(edited.longitude,null);
  // Different sessions really block on the family row until the first commits.
  const bPid=(await b.query('select pg_backend_pid() as pid')).rows[0].pid;
  for(const draft of [{name:'Concurrent OSM',address:'10 Test Rd',osm:'node/201'},{name:'Concurrent manual',address:'11 Test Rd'},{name:'Restore concurrent',address:'12 Test Rd'}]){
   if(draft.name==='Restore concurrent'){const r=await save(a,draft);await admin.query('update gw_restaurants set active=false where id=$1',[r.id])}
   await a.query('begin');await b.query('begin');
   const one=await save(a,draft);let completed=false;
   const other=save(b,draft).then(r=>{completed=true;return r});
   let blocked=false;
   for(let i=0;i<100;i++){const q=await admin.query("select wait_event_type='Lock' as blocked from pg_stat_activity where pid=$1",[bPid]);if(q.rows[0]?.blocked){blocked=true;break}await delay(10)}
   assert.equal(blocked,true,'second save did not wait on the family lock');assert.equal(completed,false);
   await a.query('commit');const two=await other;await b.query('commit');assert.equal(one.id,two.id);assert.equal(two.created,false);
  }
  // A bad visual is atomic: no partially inserted restaurant survives.
  const count=(await admin.query('select count(*)::int as n from gw_restaurants')).rows[0].n;
  await assert.rejects(save(a,{name:'Bad visual',address:'99 Test Rd',mode:'logo_url',icon:'http://bad.test/a.png'}),/https/);
  assert.equal((await admin.query('select count(*)::int as n from gw_restaurants')).rows[0].n,count);
  assert.equal((await admin.query("select has_function_privilege('anon','public.gw_restaurant_key(text)','execute') as allowed")).rows[0].allowed,false);
  assert.equal((await admin.query("select relrowsecurity from pg_class where oid='gw_restaurants'::regclass")).rows[0].relrowsecurity,true);
  assert.equal((await admin.query("select count(*)::int as n from information_schema.routine_privileges where routine_name='gw_save_restaurant_location' and grantee='PUBLIC'")).rows[0].n,0);
  assert.deepEqual((await admin.query('select * from gw_poll_options where poll_id=$1 order by restaurant_id',[pid])).rows,history);
  assert.deepEqual((await admin.query('select ballot from gw_ballots where poll_id=$1',[pid])).rows[0].ballot,[first.id]);
  await admin.query('update gw_restaurants set active=false where id=$1',[unknown.id]);
  const active=(await admin.query('select count(*)::int as n from gw_restaurants where active')).rows[0].n;
  await admin.query("insert into gw_restaurants(family_id,name,address) select $1,'Limit fixture '||i,'Limit address '||i from generate_series(1,$2::int) i",[fid,250-active]);
  assert.equal((await save(a)).id,first.id); // Existing active matches still work at capacity.
  await assert.rejects(save(a,{name:'Over capacity',address:'New limit address'}),/Maximum of 250/);
  await assert.rejects(save(a,{use:unknown.id}),/Maximum of 250/);
  // Refuse an upgrade over preexisting duplicates instead of silently merging/deleting.
  await admin.query('drop index gw_restaurants_osm_identity');
  await admin.query('insert into gw_restaurants(family_id,name,osm_id) values($1,$2,$3)',[fid,'Legacy duplicate','way/102']);
  const before=(await admin.query('select count(*)::int as n from gw_restaurants')).rows[0].n;
  await assert.rejects(admin.query(migration),/Existing location duplicates need owner review/);await admin.query('rollback');
  assert.equal((await admin.query('select count(*)::int as n from gw_restaurants')).rows[0].n,before);
  console.log('PASS: real isolated PostgreSQL: separate branches, normalization, exact reuse, archived restore, missing-address review, ambiguous sources, old RPC guard, unchanged history/metadata, authorization, atomic visuals, coordinate clearing, unique constraints, three genuine two-connection lock races, and duplicate-preflight refusal.');
 }finally{await Promise.allSettled(clients.map(c=>c.end()));if(started)await cluster.stop()}
// The embedded runtime's beforeExit hook otherwise forces exit code 0.
})().catch(error=>{console.error(error);process.exit(1)});
