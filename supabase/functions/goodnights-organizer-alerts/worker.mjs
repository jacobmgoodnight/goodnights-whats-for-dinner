// Dependency-injected worker: unit tests use fake RPC/transport and synthetic keys.
const endpointAllowed=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&(u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||/^(?:[a-z0-9-]+\.)*push\.apple\.com$/.test(u.hostname))}catch{return false}};
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function secretEquals(a,b){let diff=a.length^b.length;for(let i=0;i<64;i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0}
export function createWorker({rpc,requestDetails,fetchImpl=fetch}){
 return async request=>{
  const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(request.method!=='POST')return reply(405,{error:'POST required'});
  const authorization=request.headers.get('Authorization')||'';
  if(!/^Bearer [a-f0-9]{64}$/.test(authorization))return reply(401,{error:'Unauthorized'});
  try{
   const config=await rpc('gw_push_worker_config',{});
   if(!config?.configured)return reply(503,{error:'Delivery not configured'});
   if(!secretEquals(authorization.slice(7),String(config.worker_key||'')))return reply(401,{error:'Unauthorized'});
   const deliveries=await rpc('gw_claim_push_deliveries',{p_limit:12});
   if(!Array.isArray(deliveries))throw Error('Invalid queue response');
   let cursor=0,sent=0,retried=0;
   const run=async()=>{while(cursor<deliveries.length){const d=deliveries[cursor++];let status=0;
    if(!uuid(d.delivery_id)||!uuid(d.lease)||!uuid(d.poll_id)||!uuid(d.event_id)||!['decided','tie','no-choice','empty'].includes(d.kind))throw Error('Invalid queue entry');
    if(!endpointAllowed(d.subscription?.endpoint))status=410;
    else try{
     const payload=JSON.stringify({kind:d.kind,pollId:d.poll_id,eventId:d.event_id});
     const details=requestDetails(d.subscription,payload,{vapidDetails:{subject:config.subject,publicKey:config.public_key,privateKey:config.private_key},TTL:3600,urgency:'normal',topic:d.event_id.replaceAll('-','')});
     // Never follow redirects to a destination not checked above.
     const response=await fetchImpl(details.endpoint,{method:'POST',headers:details.headers,body:details.body,redirect:'error',signal:AbortSignal.timeout(10000)});status=response.status;
    }catch{status=0}
    await rpc('gw_finish_push_delivery',{p_delivery_id:d.delivery_id,p_lease:d.lease,p_status:status});
    if(status>=200&&status<300)sent++;else retried++;
   }};
   const attempts=await Promise.allSettled(Array.from({length:Math.min(3,deliveries.length)},run));
   if(attempts.some(a=>a.status==='rejected'))throw Error('Queue acknowledgment failed');
   return reply(200,{claimed:deliveries.length,acceptedByPushService:sent,notAccepted:retried});
  }catch{return reply(503,{error:'Delivery temporarily unavailable'})}
 };
}
export {endpointAllowed};
