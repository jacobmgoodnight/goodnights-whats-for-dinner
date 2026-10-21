const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
module.exports=async function({c,Client,connection,root,token,person,other,places,people}){
 const read=f=>fs.readFileSync(path.join(root,f),'utf8');
 // Vault's privileged view is stubbed only in this local database; no production secrets.
 await c.query('create role service_role;create schema vault;create table vault.decrypted_secrets(name text primary key,decrypted_secret text);');
 await c.query(read('supabase/migrations/20261021115730_organizer_alert_delivery.sql'));
 await c.query('set role anon');assert.equal((await c.query('select gw_push_status($1) data',[token])).rows[0].data.configured,false);
 const ecdh=crypto.createECDH('prime256v1');ecdh.generateKeys();const publicKey=ecdh.getPublicKey().toString('base64url'),privateKey=ecdh.getPrivateKey().toString('base64url'),auth=crypto.randomBytes(16).toString('base64url');
 const sub=n=>({endpoint:'https://fcm.googleapis.com/fcm/send/synthetic-'+n,expirationTime:null,keys:{p256dh:publicKey,auth}});
 await assert.rejects(c.query('select gw_subscribe_push($1,$2)',[token,sub(1)]),/not configured/);
 await assert.rejects(c.query('select gw_push_worker_config()'),/permission denied/);
 await c.query('reset role');await c.query('insert into vault.decrypted_secrets values($1,$2),($3,$4)',['gw_organizer_vapid_private',privateKey,'gw_organizer_worker_key','c'.repeat(64)]);
 await c.query('update gw_private.push_settings set public_key=$1,enabled=true',[publicKey]);await c.query('set role anon');
 const status=(await c.query('select gw_push_status($1) data',[token])).rows[0].data;assert.equal(status.configured,true);assert.equal(status.public_key,publicKey);assert.equal(JSON.stringify(status).includes(privateKey),false);assert.equal(JSON.stringify(status).includes('c'.repeat(64)),false);
 for(const endpoint of ['http://127.0.0.1/a','https://fcm.googleapis.com.evil.test/a','https://fcm.googleapis.com@localhost/a','https://127.0.0.1/a','https://fcm.googleapis.com:9000/a','https://web.push.apple.com/a#fragment'])await assert.rejects(c.query('select gw_subscribe_push($1,$2)',[token,{...sub(1),endpoint}]),/Unsupported/);
 await assert.rejects(c.query('select gw_subscribe_push($1,$2)',[person.token,sub(1)]),/Organizer access denied/);
 const first=(await c.query('select gw_subscribe_push($1,$2) id',[token,sub(1)])).rows[0].id;
 assert.equal((await c.query('select gw_subscribe_push($1,$2) id',[token,sub(1)])).rows[0].id,first);
 const second=(await c.query('select gw_subscribe_push($1,$2) id',[token,sub(2)])).rows[0].id;
 assert.equal((await c.query('select gw_push_status($1,$2) data',[token,sub(1).endpoint])).rows[0].data.enabled,true);
 for(const name of ['gw_push_subscriptions','gw_push_deliveries'])await assert.rejects(c.query('select * from '+name),/permission denied/);
 await assert.rejects(c.query('select * from gw_private.push_settings'),/permission denied/);
 await assert.rejects(c.query('select gw_claim_push_deliveries(20)'),/permission denied/);
 await c.query('reset role');assert.equal((await c.query('select count(*)::int n from gw_push_deliveries')).rows[0].n,0,'no historical notification backfill');
 const emit=async()=>{const d={place_ids:places,member_ids:people,meal:'Dinner',method:'swipe',cuisine:'',title:'Private name never in push',auto_tie:false,allow_member_home:false,group_join:true};const id=(await c.query('select gw_create_dinner($1,$2) id',[token,d])).rows[0].id;const ballot=Object.fromEntries(places.map(id=>[id,false]));for(const t of [person.token,other.token])await c.query('select gw_vote_as_member($1,$2,$3)',[id,t,ballot]);return id};
 const pid=await emit();await c.query('set role service_role');
 const claims=(await c.query('select gw_claim_push_deliveries(20) data')).rows[0].data.sort((a,b)=>a.subscription.endpoint.localeCompare(b.subscription.endpoint));assert.equal(claims.length,2);assert.ok(claims.every(d=>d.poll_id===pid&&d.kind==='no-choice'));assert.equal(JSON.stringify(claims).includes('Private name'),false);
 assert.deepEqual((await c.query('select gw_claim_push_deliveries(20) data')).rows[0].data,[]);
 assert.equal((await c.query('select gw_finish_push_delivery($1,$2,201) done',[claims[0].delivery_id,crypto.randomUUID()])).rows[0].done,false);
 await c.query('select gw_finish_push_delivery($1,$2,201)',[claims[0].delivery_id,claims[0].lease]);
 await c.query('select gw_finish_push_delivery($1,$2,500)',[claims[1].delivery_id,claims[1].lease]);
 await c.query('reset role');await c.query('update gw_push_deliveries set next_attempt_at=now()');await c.query('set role service_role');
 const retry=(await c.query('select gw_claim_push_deliveries(20) data')).rows[0].data;assert.equal(retry.length,1);assert.notEqual(retry[0].lease,claims[1].lease);
 await c.query('select gw_finish_push_delivery($1,$2,410)',[retry[0].delivery_id,retry[0].lease]);
 await c.query('reset role');assert.equal((await c.query('select active from gw_push_subscriptions where id=$1',[second])).rows[0].active,false);
 await c.query('set role anon');await c.query('select gw_subscribe_push($1,$2)',[token,sub(3)]);await c.query('reset role');
 await emit();const a=new Client(connection),b=new Client(connection);await a.connect();await b.connect();
 try{await a.query('set role service_role;begin');await b.query('set role service_role');const x=(await a.query('select gw_claim_push_deliveries(1) data')).rows[0].data;const y=(await b.query('select gw_claim_push_deliveries(1) data')).rows[0].data;assert.equal(x.length,1);assert.equal(y.length,1);assert.notEqual(x[0].delivery_id,y[0].delivery_id);await a.query('commit')}finally{await a.end();await b.end()}
 await c.query('update gw_push_deliveries set lease_until=now()-interval \'3 minutes\',next_attempt_at=now() where status=\'leased\'');
 for(let i=0;i<3;i++){await c.query('set role service_role');const batch=(await c.query('select gw_claim_push_deliveries(20) data')).rows[0].data;for(const d of batch)await c.query('select gw_finish_push_delivery($1,$2,0)',[d.delivery_id,d.lease]);await c.query('reset role');await c.query('update gw_push_deliveries set next_attempt_at=now()');}
 assert.equal((await c.query("select count(*)::int n from gw_push_deliveries where status='pending'")).rows[0].n,0);
 await c.query('set role anon');await c.query('select gw_unsubscribe_push($1,$2)',[token,sub(1).endpoint]);assert.equal((await c.query('select gw_push_status($1,$2) data',[token,sub(1).endpoint])).rows[0].data.enabled,false);await c.query('reset role');
 // The scheduling SQL is rehearsed with local stand-ins for hosted-only extensions.
 await c.query('create schema net;create schema cron;create table cron.fixture_jobs(name text,expression text,command text);');
 await c.query("create function cron.schedule(text,text,text) returns bigint language plpgsql as $$begin insert into cron.fixture_jobs values($1,$2,$3);return 1;end$$;create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$select 1::bigint$$;");
 await c.query(read('supabase/migrations/20261021121321_organizer_alert_scheduler.sql').replace(/^create extension.*$/gm,''));
 assert.deepEqual((await c.query('select expression,command from cron.fixture_jobs')).rows,[{expression:'* * * * *',command:'select public.gw_dispatch_organizer_push();'}]);
 await c.query('set role anon');await assert.rejects(c.query('select gw_dispatch_organizer_push()'),/permission denied/);await c.query('reset role');
 // A hosted network-extension error cannot undo the final ballot or its durable alert.
 await c.query("create or replace function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$begin raise exception 'synthetic dispatcher outage';end$$;");
 const outage=await emit();assert.equal((await c.query('select count(*)::int n from gw_ballots where poll_id=$1',[outage])).rows[0].n,2);assert.ok((await c.query('select count(*)::int n from gw_push_deliveries d join gw_dinner_events e on e.id=d.event_id where e.poll_id=$1',[outage])).rows[0].n>0);
 console.log('PASS: private push config, explicit organizer subscriptions, endpoint/key validation, no backfill, per-device/event dedup, grants/RLS, leases/retry/expiry/disable and concurrent disjoint claims. Scheduler SQL rehearsed using local extension stand-ins; no push sent.');
};
