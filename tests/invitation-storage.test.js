const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
async function open({kind='member',accepted=false,network=false,saved={}}={}){
 const values={...saved},listeners={},app={innerHTML:'',addEventListener:(n,f)=>listeners[n]=f},toast={classList:{add(){},remove(){}}};
 const doc={app,toast,modeBadge:{},brand:{addEventListener(){}}},family={id:'synthetic',name:'Synthetic family',restaurants:[],polls:[]};
 const c={URL,crypto:require('node:crypto').webcrypto,console,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},navigator:{},location:{href:'https://goodnights.test/?'+kind+'=incoming',pathname:'/'},history:{replaceState(){}},localStorage:{getItem:k=>values[k],setItem:(k,v)=>values[k]=v,removeItem:k=>delete values[k]},document:{getElementById:id=>doc[id]},window:{GW_CONFIG:{supabaseUrl:'https://fixture.test',publishableKey:'synthetic'},scrollTo(){}},fetch:async(url,opts)=>{
  const p=JSON.parse(opts.body);if(Object.values(p).includes('incoming')){if(network)throw Error('offline');if(!accepted)return {ok:false,json:async()=>({message:'invalid'})}}
  return {ok:true,json:async()=>url.endsWith('gw_get_member')?{id:'person',name:'Synthetic member',family}:url.endsWith('gw_get_family')?family:{ready:false}};
 }};
 vm.createContext(c);for(const f of ['voting.js','maps.js','logos.js','family.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),c);
 for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));return {values,app,toast};
}
for(const kind of ['member','family'])for(const network of [false,true])test(kind+' invitation failure preserves both saved credentials ('+(network?'network':'invalid')+')',async()=>{
 const saved={goodnights_family_token:'saved-owner',goodnights_member_token:'saved-member'},h=await open({kind,network,saved});assert.deepEqual(h.values,saved);assert.match(h.toast.textContent,/saved access is unchanged/);
});
for(const kind of ['member','family'])test('verified '+kind+' invitation replaces saved access only after validation',async()=>{
 const h=await open({kind,accepted:true,saved:{goodnights_family_token:'saved-owner',goodnights_member_token:'saved-member'}});assert.equal(h.values['goodnights_'+kind+'_token'],'incoming');assert.equal(h.values['goodnights_'+(kind==='member'?'family':'member')+'_token'],undefined);assert.match(h.app.innerHTML,/Synthetic/);
});
