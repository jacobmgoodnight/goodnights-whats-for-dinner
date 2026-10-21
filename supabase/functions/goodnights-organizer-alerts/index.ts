// Only the private scheduler invokes this endpoint. No browser CORS or family tokens.
import webpush from 'npm:web-push@3.6.7';
import {createWorker} from './worker.mjs';
const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const rpc=async(name:string,args:unknown)=>{
 if(!url||!key)throw Error('Server configuration unavailable');
 const response=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('Private queue request failed');return await response.json();
};
Deno.serve(createWorker({rpc,requestDetails:webpush.generateRequestDetails.bind(webpush)}));
