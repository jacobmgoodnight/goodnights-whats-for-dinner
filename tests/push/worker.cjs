// Optional real Web Push encryption/signing with mocked network and queue. No live push.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),path=require('node:path'),{pathToFileURL}=require('node:url');
const webpush=require(path.join(process.env.GW_PUSH_RUNTIME||'', 'web-push'));
(async()=>{
 const {createWorker,endpointAllowed}=await import(pathToFileURL(path.resolve(__dirname,'../../supabase/functions/goodnights-organizer-alerts/worker.mjs')));
 const keys=webpush.generateVAPIDKeys(),ecdh=crypto.createECDH('prime256v1');ecdh.generateKeys();
 const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/synthetic',keys:{p256dh:ecdh.getPublicKey().toString('base64url'),auth:crypto.randomBytes(16).toString('base64url')}};
 const item={delivery_id:crypto.randomUUID(),lease:crypto.randomUUID(),poll_id:crypto.randomUUID(),event_id:crypto.randomUUID(),kind:'tie',subscription};
 const config={configured:true,public_key:keys.publicKey,private_key:keys.privateKey,worker_key:'c'.repeat(64),subject:'https://example.test/goodnights/'};
 const calls=[],network=[];let batch=[item],responseStatus=201,throwNetwork=false;
 const rpc=async(fn,p)=>{calls.push({fn,p});return fn==='gw_push_worker_config'?config:fn==='gw_claim_push_deliveries'?batch:true};
 const worker=createWorker({rpc,requestDetails:webpush.generateRequestDetails.bind(webpush),fetchImpl:async(url,options)=>{network.push({url,options});if(throwNetwork)throw Error('private endpoint error must not be returned');return new Response(null,{status:responseStatus})}});
 const request=(authorization='Bearer '+'c'.repeat(64))=>new Request('https://edge.test/',{method:'POST',headers:{Authorization:authorization}});
 assert.equal((await worker(request('Bearer wrong'))).status,401);assert.equal(calls.length,0);
 assert.equal((await worker(request('Bearer '+'d'.repeat(64)))).status,401);assert.equal(calls.some(c=>c.fn==='gw_claim_push_deliveries'),false);
 calls.length=0;const result=await worker(request());assert.equal(result.status,200);assert.equal((await result.json()).acceptedByPushService,1);
 assert.equal(network.length,1);assert.equal(network[0].options.redirect,'error');assert.ok(Buffer.isBuffer(network[0].options.body));assert.equal(network[0].options.body.includes(Buffer.from(item.poll_id)),false);
 assert.ok(network[0].options.headers.Authorization.startsWith('vapid '));assert.equal(JSON.stringify(network[0].options.headers).includes(keys.privateKey),false);
 assert.deepEqual(calls.at(-1).p,{p_delivery_id:item.delivery_id,p_lease:item.lease,p_status:201});
 responseStatus=410;await worker(request());assert.equal(calls.at(-1).p.p_status,410);
 throwNetwork=true;const failed=await worker(request());assert.equal((await failed.json()).notAccepted,1);assert.equal(calls.at(-1).p.p_status,0);
 const count=network.length;batch=[{...item,subscription:{...subscription,endpoint:'https://127.0.0.1/private'}}];await worker(request());assert.equal(network.length,count);assert.equal(calls.at(-1).p.p_status,410);
 for(const bad of ['http://fcm.googleapis.com/a','https://fcm.googleapis.com.evil.test/a','https://user@fcm.googleapis.com/a','https://fcm.googleapis.com:9000/a','https://web.push.apple.com/a#private'])assert.equal(endpointAllowed(bad),false);
 assert.equal(endpointAllowed('https://web.push.apple.com/synthetic'),true);assert.equal(endpointAllowed('https://updates.push.services.mozilla.com/synthetic'),true);
 // A failed acknowledgement does not abandon other in-flight deliveries or leak details.
 const acknowledgements=[];let active=0,maximum=0;const many=Array.from({length:7},()=>({...item,delivery_id:crypto.randomUUID(),lease:crypto.randomUUID(),event_id:crypto.randomUUID()}));
 const failing=createWorker({rpc:async(fn,p)=>{if(fn==='gw_push_worker_config')return config;if(fn==='gw_claim_push_deliveries')return many;if(fn==='gw_finish_push_delivery'){acknowledgements.push(p.p_delivery_id);if(p.p_delivery_id===many[0].delivery_id)throw Error('private ACK detail');return true}},requestDetails:webpush.generateRequestDetails.bind(webpush),fetchImpl:async()=>{active++;maximum=Math.max(maximum,active);await new Promise(r=>setTimeout(r,5));active--;return new Response(null,{status:201})}});
 const ackFailure=await failing(request());assert.equal(ackFailure.status,503);assert.equal(JSON.stringify(await ackFailure.json()).includes('private ACK detail'),false);assert.equal(acknowledgements.length,7);assert.ok(maximum<=3);assert.equal(active,0);
 console.log('PASS: real pinned Web Push encryption/VAPID signing, private scheduler authorization, generic payload, redirect/SSRF guard, bounded transport and error/expiry acknowledgements; every request mocked.');
})().catch(e=>{console.error(e);process.exitCode=1});
