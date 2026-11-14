const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{execFileSync}=require('node:child_process');
const D=require('../decisions.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const places=['a','b','c','d','e'].map(id=>({id,name:'Synthetic '+id,category:'Pizza'})),today='2026-11-13';

test('daily order is deterministic, ignores list order and duplicates, and skips hidden places',()=>{
 const a=D.dailyOrder(places,today).map(r=>r.id),b=D.dailyOrder([...places].reverse().concat(places[0]),today).map(r=>r.id);
 assert.deepEqual(a,b);assert.equal(new Set(a).size,5);
 assert.deepEqual(D.dailyOrder([{...places[0],active:false},places[1]],today).map(r=>r.id),['b']);
 assert.notDeepEqual(D.dailyOrder(places,today).map(r=>r.id),D.dailyOrder(places,'2026-11-14').map(r=>r.id));
});

test('windows walk the whole order without repeats and report what is left',()=>{
 const seen=[];let r=D.suggest(places,{today});
 while(r.choices.length){seen.push(...r.choices.map(c=>c.id));r=D.suggest(places,{today,start:r.start+r.size})}
 assert.deepEqual(seen,D.dailyOrder(places,today).map(c=>c.id));
 const three=D.suggest(places,{today,start:1,size:3});assert.equal(three.choices.length,3);assert.equal(three.remaining,1);assert.equal(three.choices[0].id,seen[1]);
 assert.equal(D.suggest(places,{today,size:9}).size,3);assert.equal(D.suggest([],{today}).total,0);
 assert.throws(()=>D.suggest(places,{today:'2026-11-13T00:00:00Z'}),/Invalid dinner date/);
});

test('local date follows the family time zone, not UTC',()=>{
 for(const [zone,expected] of [['America/Indiana/Indianapolis','2026-11-12'],['Pacific/Kiritimati','2026-11-13']]){
  const out=execFileSync(process.execPath,['-e',"console.log(require('./decisions.js').localDate(new Date('2026-11-13T02:00:00Z')))"],{cwd:path.join(__dirname,'..'),env:{...process.env,TZ:zone},encoding:'utf8'}).trim();
  assert.equal(out,expected);
 }
});

async function setup({owner=true,restaurants=places.map((r,i)=>({...r,category:i<3?'Pizza':'Mexican',active:true})),tonight=null}={}){
 const listeners={},calls=[],storage={},toast={textContent:'',classList:{add(){},remove(){}}};
 const members=[{id:'m0',name:'Person 0',active:true,avatar:'🙂'},{id:'m1',name:'Person 1',active:true,avatar:'🙂'}];
 const app={innerHTML:'',addEventListener:(name,fn)=>listeners[name]=fn};
 const family=()=>({id:'family-fixture',name:'Fixture',restaurants:structuredClone(restaurants),polls:[]});
 const ctx={URL,crypto:require('node:crypto').webcrypto,console:{error(){},log(){}},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
  window:{GW_CONFIG:{supabaseUrl:'https://fixture.test',publishableKey:'fixture'},scrollTo(){}},
  location:{href:owner?'https://example.test/?family=fixture-owner':'https://example.test/?member=fixture-personal-0',pathname:'/'},history:{replaceState(){}},
  localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v,removeItem:k=>delete storage[k]},navigator:{},confirm:()=>true,
  document:{getElementById:id=>({app,modeBadge:{},brand:{addEventListener(){}},toast}[id])},
  fetch:async(url,request)=>{
   const fn=url.split('/').pop(),p=JSON.parse(request.body);calls.push({fn,p});let result;
   if(fn==='gw_get_family')result=family();
   else if(fn==='gw_get_member')result={id:'m0',name:'Person 0',avatar:'🙂',family:family()};
   else if(fn==='gw_planning_home')result={ready:true,active_polls:tonight?[tonight]:[],presets:[],nominations:[],events:[]};
   else if(fn==='gw_get_poll')result=tonight;
   else if(fn==='gw_get_poll_people')result={rostered:true,people:[]};
   else if(fn==='gw_list_members')result=members;
   else throw Error('Unexpected RPC '+fn);
   return {ok:true,json:async()=>structuredClone(result)};
  }
 };
 vm.createContext(ctx);
 for(const file of ['voting.js','maps.js','logos.js','family.js','decisions.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
 for(let i=0;i<4;i++)await tick();
 return {app,calls,toast,
  writes:()=>calls.filter(c=>!['gw_get_family','gw_get_member','gw_planning_home','gw_get_poll','gw_get_poll_people','gw_list_members'].includes(c.fn)),
  change(target){listeners.change({target:{dataset:{},...target}})},
  async click(act,data={}){await listeners.click({target:{closest:()=>({dataset:{act,...data}})}});await tick()},
  shown(){return [...app.innerHTML.matchAll(/<h2>(Synthetic [a-e])<\/h2>/g)].map(m=>m[1].slice(-1))}
 };
}

test('organizer reaches one suggestion from Home in one tap, with Maps and no writes',async()=>{
 const h=await setup();assert.match(h.app.innerHTML,/data-act="openQuick"/);assert.match(h.app.innerHTML,/Start a family vote/);
 await h.click('openQuick');assert.match(h.app.innerHTML,/Let’s eat here/);assert.equal(h.shown().length,1);
 assert.equal(h.shown()[0],D.dailyOrder(places,D.localDate())[0].id);
 assert.match(h.app.innerHTML,/google\.com\/maps\/search/);assert.match(h.app.innerHTML,/rel="noopener noreferrer"/);assert.match(h.app.innerHTML,/nothing is saved/);
 assert.doesNotMatch(h.app.innerHTML,/fixture-owner/);assert.deepEqual(h.writes(),[]);
});

test('Try another never repeats a place and ends with an explicit Start over',async()=>{
 const h=await setup();await h.click('openQuick');const seen=[...h.shown()];
 for(let i=0;i<4;i++){await h.click('quickNext');seen.push(...h.shown())}
 assert.equal(new Set(seen).size,5);assert.doesNotMatch(h.app.innerHTML,/data-act="quickNext"/);assert.match(h.app.innerHTML,/data-act="quickRestart"/);
 await h.click('quickNext');assert.equal(h.shown()[0],seen[4]);
 await h.click('quickRestart');assert.equal(h.shown()[0],seen[0]);assert.deepEqual(h.writes(),[]);
});

test('cuisine filter narrows choices and an empty cuisine explains itself',async()=>{
 const h=await setup();await h.click('openQuick');
 h.change({id:'quickCuisine',value:'mexican'});await h.click('quickThree');assert.deepEqual(h.shown().sort(),['d','e']);assert.match(h.app.innerHTML,/2 saved 🌮 Mexican places/);
 h.change({id:'quickCuisine',value:'not-a-cuisine'});assert.equal(h.shown().length,3);
 const empty=await setup({restaurants:[]});assert.match(empty.app.innerHTML,/data-act="openQuick"/);await empty.click('openQuick');assert.match(empty.app.innerHTML,/No saved places yet/);assert.match(empty.app.innerHTML,/Add restaurants/);
});

test('organizer turns the options on screen into an editable vote draft without creating a poll',async()=>{
 const h=await setup();await h.click('openQuick');assert.doesNotMatch(h.app.innerHTML,/data-act="quickVote"/);
 await h.click('quickThree');const ids=h.shown();assert.equal(ids.length,3);assert.match(h.app.innerHTML,/vote on these 3/);
 await h.click('quickVote');assert.match(h.toast.textContent,/3 places shortlisted/);
 for(const id of ids)assert.match(h.app.innerHTML,new RegExp(`data-select="${id}" checked`));
 assert.deepEqual(h.writes(),[]);
});

test('personal members can Quick Pick but cannot start a vote from it',async()=>{
 const h=await setup({owner:false});assert.match(h.app.innerHTML,/Your family votes/);assert.match(h.app.innerHTML,/Quick pick a place/);
 await h.click('openQuick');await h.click('quickThree');assert.equal(h.shown().length,3);assert.doesNotMatch(h.app.innerHTML,/quickVote/);
 await h.click('quickVote');assert.match(h.toast.textContent,/organizer link/);assert.match(h.app.innerHTML,/Let’s eat here/);assert.deepEqual(h.writes(),[]);
});

test('an active vote keeps its Home hero and offers Quick Pick once as an escape',async()=>{
 const tonight={id:'open-poll',meal:'Dinner',method:'approval',status:'open',expected_voters:2,voted_count:1,options:[],people:[]};
 const h=await setup({tonight});assert.match(h.app.innerHTML,/1 of 2 have voted/);
 assert.equal(h.app.innerHTML.match(/data-act="openQuick"/g).length,1);assert.match(h.app.innerHTML,/Need an answer right now/);
});
