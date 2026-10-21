// Optional isolated integration runner. No network or Supabase credentials used.
// Install @electric-sql/pglite outside the repo and set GW_PGLITE_MODULE to it.
const {PGlite}=require(process.env.GW_PGLITE_MODULE||'@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('supabase/migrations/20261020182044_honest_consensus_outcomes.sql');
(async()=>{
 const db=new PGlite();
 try{
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  await db.exec(read('database.sql'));
  // The original migration's poll-reader patch depends on intervening upgrades.
  // Load its unchanged column/function/grants only; H1 never changes the reader.
  await db.exec(read('sql/random_tiebreaker.sql').split('do $upgrade$')[0]);
  await db.exec(`BEGIN;
   INSERT INTO gw_families(id,name,token) VALUES('00000000-0000-4000-8000-000000000001','Historical fixture',repeat('b',48));
   INSERT INTO gw_restaurants(id,family_id,name) VALUES
    ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Fixture A'),
    ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','Fixture B');
   SELECT gw_create_poll(repeat('b',48),'Dinner','swipe',1,ARRAY['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003']::uuid[]);
   INSERT INTO gw_ballots(poll_id,voter_key,voter_name,ballot) SELECT id,'fixture','Fixture','{"00000000-0000-4000-8000-000000000002":false,"00000000-0000-4000-8000-000000000003":false}'::jsonb FROM gw_polls;
   `);
  const {rows}=await db.query('SELECT id FROM gw_polls');
  await db.exec('SET LOCAL ROLE anon');
  const old=await db.query('SELECT gw_resolve_tie_random(repeat($1,48),$2)',['b',rows[0].id]);
  await db.exec('RESET ROLE');
  const before=await db.query('SELECT * FROM gw_polls');
  await db.exec(migration);
  await db.exec('SET LOCAL ROLE anon');
  const saved=await db.query('SELECT gw_resolve_tie_random(repeat($1,48),$2)',['b',before.rows[0].id]);
  assert.deepEqual(saved.rows,old.rows);
  await db.exec('RESET ROLE');assert.deepEqual((await db.query('SELECT * FROM gw_polls')).rows,before.rows);
  const fresh=await db.query(`SELECT gw_create_poll(repeat('b',48),'Dinner','swipe',1,ARRAY['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003']::uuid[]) AS id`);
  await db.query(`INSERT INTO gw_ballots(poll_id,voter_key,voter_name,ballot) SELECT $1,voter_key,voter_name,ballot FROM gw_ballots WHERE poll_id=$2`,[fresh.rows[0].id,rows[0].id]);
  await db.exec('SET LOCAL ROLE anon; SAVEPOINT rejected_draw');
  await assert.rejects(db.query('SELECT gw_resolve_tie_random(repeat($1,48),$2)',['b',fresh.rows[0].id]),/No restaurant received a yes vote/);
  await db.exec('ROLLBACK TO SAVEPOINT rejected_draw; RESET ROLE');
  assert.equal((await db.query('SELECT tie_winner_id FROM gw_polls WHERE id=$1',[fresh.rows[0].id])).rows[0].tie_winner_id,null);
  await db.exec('ROLLBACK');
  await db.exec(migration);
  await db.exec(read('tests/sql/honest_consensus.rollback.sql'));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM gw_families')).rows[0].n,0);
  console.log('PASS: isolated PostgreSQL H1 guard; all methods, empty/open/unique/all-no rejection, early close, saved historical draw as anon, owner checks, unchanged ballots/links, runoffs, ranked transfers, grants; fixtures rolled back.');
 }finally{await db.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
