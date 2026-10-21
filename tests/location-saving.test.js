const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const M=require('../maps.js'),tick=()=>new Promise(r=>setImmediate(r));
const saved=[{id:'a',name:'Chain',address:'1 Oak St',category:'Pizza',active:true,osm_id:'node/1'},{id:'b',name:'Chain',address:'2 Oak St',active:true},{id:'c',name:'Hidden',address:'3 Oak St',active:false}];
test('identity uses exact source first, then non-empty manual name/address; nearby/name-only are uncertain',()=>{
 assert.equal(M.locationMatches(saved,{name:'Changed upstream',address:'Other',osm_id:'node/1'})[0].id,'a');
 assert.equal(M.locationMatches(saved,{name:' CHAIN ',address:' 2  Oak ST '})[0].match,'exact');
 assert.equal(M.locationMatches(saved,{name:'Chain',address:'4 Oak St'}).every(r=>r.match==='possible'),true);
 assert.equal(M.locationMatches(saved,{name:'Chain',address:''}).every(r=>r.match==='possible'),true);
 assert.equal(M.locationMatches(saved,{name:'Chain',address:'1 Oak St',osm_id:'way/1'}).every(r=>r.match==='possible'),true);
 assert.deepEqual(M.locationMatches(saved,{name:'Different',address:'Other',latitude:40,longitude:-86}),[]);
 assert.equal(M.locationKey('  CULVER’S \t PIZZA '),'culver’s pizza');
 assert.notEqual(M.locationKey("Culver's"),M.locationKey('Culvers'));
});
test('suggestions use existing active names/addresses only and are bounded',()=>{
 assert.deepEqual(M.savedSuggestions(saved,'oak').map(r=>r.id),['a','b']);assert.deepEqual(M.savedSuggestions(saved,'Hidden'),[]);
 assert.deepEqual(M.savedSuggestions(saved,''),[]);assert.equal(M.savedSuggestions(Array(20).fill(saved[0]),'Chain').length,5);
});
async function harness({owner=true}={}){
 const listeners={},calls=[],nodes={},data=structuredClone(saved),toast={textContent:'',classList:{add(){},remove(){}}};let hook=null,failSearch=false;
 const app={innerHTML:'',addEventListener:(n,f)=>listeners[n]=f};
 for(const id of ['restName','restCategory','manualAddress','manualMode','manualValue','manualIcon','googlePaste','googleName','googleAddress','googleMode','googleValue','googleIcon','localSavedSuggestions','manualSavedSuggestions','googleSavedSuggestions'])nodes[id]={value:id.endsWith('Mode')?'auto':'',innerHTML:''};
 const context={URL,crypto:require('node:crypto').webcrypto,console:{error(){},log(){}},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},confirm:()=>true,
  window:{GW_CONFIG:{supabaseUrl:'https://fixture.test',publishableKey:'fixture'},scrollTo(){}},location:{href:owner?'https://example.test/?family=fixture-owner':'https://example.test/?member=fixture-personal',pathname:'/'},history:{replaceState(){}},
  localStorage:{getItem(){},setItem(){},removeItem(){}},navigator:{},document:{getElementById:id=>({app,modeBadge:{},brand:{addEventListener(){}},toast}[id]||nodes[id])},
  fetch:async(url,request)=>{
   if(url.includes('nominatim')||url.includes('overpass-api')){calls.push({fn:'online-search'});if(failSearch)throw Error('Search unavailable');return {ok:true,json:async()=>url.includes('nominatim')?[{lat:'40',lon:'-86'}]:{elements:[{type:'node',id:99,lat:40,lon:-86,tags:{name:'Chain',cuisine:'Pizza','addr:housenumber':'4','addr:street':'Oak St'}}]}}}
   const fn=url.split('/').pop(),p=JSON.parse(request.body);calls.push({fn,p});let result;
   if(fn==='gw_get_family')result={id:'f',name:'Fixture',restaurants:data.filter(r=>r.active),polls:[]};
   else if(fn==='gw_get_member')result={id:'m',name:'Fixture voter',family:{name:'Fixture',restaurants:data,polls:[]}};
   else if(fn==='gw_save_restaurant_location')result=hook?await hook(p):{status:'saved',id:p.p_use_restaurant_id||'new',created:!p.p_use_restaurant_id};
   else throw Error('Unexpected RPC '+fn);
   return {ok:true,json:async()=>structuredClone(result)};
  }};
 vm.createContext(context);for(const f of ['voting.js','maps.js','logos.js','family.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),context);
 await tick();await tick();
 return {app,calls,nodes,toast,setHook:f=>hook=f,failSearch:()=>failSearch=true,input(id,value){nodes[id]??={};nodes[id].value=value;listeners.input({target:{id,value}})},async click(act,data={}){await listeners.click({target:{closest:()=>({dataset:{act,...data}})}});await tick()}};
}
test('typing saved suggestions has zero network requests and preserves the form',async()=>{
 const h=await harness();await h.click('nav',{page:'restaurants'});await h.click('toggleDiscovery');const before=h.calls.length;
 h.input('localName','Chain');assert.match(h.nodes.localSavedSuggestions.innerHTML,/1 Oak St/);assert.match(h.nodes.localSavedSuggestions.innerHTML,/2 Oak St/);assert.equal(h.calls.length,before);
 h.input('restName','Chain');assert.match(h.nodes.manualSavedSuggestions.innerHTML,/View saved/);h.input('googleName','Chain');assert.equal(h.calls.length,before);
 await h.click('viewSavedLocation',{id:'b'});assert.match(h.app.innerHTML,/Edit Chain/);assert.equal(h.calls.length,before);
});
for(const flow of ['manual','google'])test(flow+' addition reviews separate chain locations and atomically sends appearance after confirmation',async()=>{
 const h=await harness();await h.click('nav',{page:'restaurants'});await h.click('toggleDiscovery');await h.click('toggleAdd');
 h.nodes[flow==='manual'?'restName':'googleName'].value='Chain';h.nodes[flow==='manual'?'manualAddress':'googleAddress'].value='4 Oak St';
 const prefix=flow==='manual'?'manual':'google';h.nodes[prefix+'Mode'].value='builtin';h.nodes[prefix+'Icon'].value='taco';
 await h.click(flow==='manual'?'addManual':'saveGoogle');assert.match(h.app.innerHTML,/Review this location/);assert.match(h.app.innerHTML,/Possible duplicate/);assert.match(h.app.innerHTML,/Keep a separate location/);
 assert.equal(h.calls.filter(c=>c.fn==='gw_save_restaurant_location').length,0);
 await h.click('confirmLocation');const call=h.calls.find(c=>c.fn==='gw_save_restaurant_location');assert.equal(call.p.p_name,'Chain');assert.equal(call.p.p_address,'4 Oak St');assert.equal(call.p.p_icon_mode,'builtin');assert.equal(call.p.p_icon_value,'taco');assert.equal(call.p.p_keep_separate,true);assert.deepEqual(call.p.p_reviewed_ids,['a','b']);
 assert.equal(h.calls.some(c=>c.fn==='gw_update_restaurant'),false);
});
test('exact saved choice reuses stable ID without overwriting metadata; missing address is reviewed',async()=>{
 const h=await harness();await h.click('nav',{page:'restaurants'});h.nodes.restName.value='Chain';h.nodes.manualAddress.value='1 Oak St';await h.click('addManual');assert.match(h.app.innerHTML,/Already saved/);assert.doesNotMatch(h.app.innerHTML,/data-act="confirmLocation"/);
 await h.click('useSavedLocation',{id:'a'});assert.equal(h.calls.find(c=>c.fn==='gw_save_restaurant_location').p.p_use_restaurant_id,'a');
 h.nodes.manualAddress.value='';await h.click('addManual');assert.match(h.app.innerHTML,/Without an address/);assert.match(h.app.innerHTML,/Keep a separate location/);
});
test('server reveals hidden/new matches before creation; failed saves preserve review for retry',async()=>{
 const h=await harness();await h.click('nav',{page:'restaurants'});h.nodes.restName.value='<New>';h.nodes.manualAddress.value='9 Test St';await h.click('addManual');assert.match(h.app.innerHTML,/&lt;New&gt;/);
 h.setHook(async()=>({status:'review',reason:'A hidden place needs review',matches:[{...saved[2],match:'possible'}],can_keep_separate:true}));await h.click('confirmLocation');assert.match(h.app.innerHTML,/Restore saved/);assert.match(h.app.innerHTML,/hidden place needs review/);
 h.setHook(async()=>{throw Error('Network unavailable')});await h.click('useSavedLocation',{id:'c'});assert.match(h.app.innerHTML,/Restore saved/);assert.equal(h.toast.textContent,'Network unavailable');
 h.setHook(async p=>{assert.equal(p.p_use_restaurant_id,'c');return {status:'saved',id:'c',restored:true,created:false}});await h.click('useSavedLocation',{id:'c'});assert.doesNotMatch(h.app.innerHTML,/Review restaurant location/);
});
test('cancel review retains entered details; member direct actions cannot save',async()=>{
 const h=await harness();await h.click('nav',{page:'restaurants'});h.nodes.restName.value='Chain';h.nodes.manualAddress.value='8 Test St';await h.click('addManual');await h.click('cancelLocationReview');assert.equal(h.nodes.manualAddress.value,'8 Test St');assert.equal(h.calls.some(c=>c.fn==='gw_save_restaurant_location'),false);
 const member=await harness({owner:false});const before=member.calls.length;await member.click('confirmLocation');await member.click('useSavedLocation',{id:'a'});assert.equal(member.calls.length,before);
});
test('OSM search remains explicit and saving a distinct source preserves its identity and coordinates',async()=>{
 const h=await harness();await h.click('nav',{page:'restaurants'});await h.click('toggleDiscovery');h.input('localName','Chain');assert.equal(h.calls.some(c=>c.fn==='online-search'),false);
 await h.click('townSearch');assert.equal(h.calls.filter(c=>c.fn==='online-search').length,2);
 await h.click('addNearby',{idx:'0'});assert.match(h.app.innerHTML,/4 Oak St/);assert.equal(h.calls.some(c=>c.fn==='gw_save_restaurant_location'),false);
 await h.click('confirmLocation');const p=h.calls.find(c=>c.fn==='gw_save_restaurant_location').p;assert.equal(p.p_osm_id,'node/99');assert.equal(p.p_latitude,40);assert.equal(p.p_longitude,-86);
});
test('public search failure keeps manual details and leaves the manual fallback available',async()=>{
 const h=await harness();await h.click('nav',{page:'restaurants'});await h.click('toggleDiscovery');await h.click('toggleAdd');h.nodes.restName.value='Draft';h.nodes.manualAddress.value='8 Draft St';h.failSearch();await h.click('townSearch');
 assert.equal(h.nodes.restName.value,'Draft');assert.equal(h.nodes.manualAddress.value,'8 Draft St');assert.match(h.app.innerHTML,/Save to family list/);assert.equal(h.calls.some(c=>c.fn==='gw_save_restaurant_location'),false);
});
