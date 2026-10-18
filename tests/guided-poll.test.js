const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const tick=()=>new Promise(r=>setImmediate(r));
async function setup({owner=true,memberId='m0',failPeople=false,anonymous=false}={}){
 const calls=[],shares=[],listeners={},store={},nodes={},timers=[];const photo='data:image/jpeg;base64,/9j/AAA=';
 const people=[{id:'m0',name:'Taylor',avatar:photo,token:anonymous?'ab'.repeat(24):'fixture-taylor',phone:'taylor@icloud.com',active:true},{id:'m1',name:'Morgan',avatar:'🦊',token:'fixture-morgan',phone:'+15551234567',active:true},{id:'m2',name:'Sam',avatar:'🏀',token:'fixture-sam',phone:'',active:true}];
 const restaurants=[{id:'r0',name:'Pizza night',category:'Pizza',address:'100 Main St, Town'},{id:'r1',name:'Taco time',category:'Mexican',address:'Town'}];
 let chosen=['m0','m1'],voted=new Set(),statusError=failPeople;
 const current=()=>({id:'p1',meal:'Dinner',method:'approval',status:voted.size>=chosen.length?'closed':'open',expected_voters:chosen.length,voted_count:voted.size,roster_enabled:true,options:restaurants,ballots:voted.size>=chosen.length?[...voted].map(()=>['r0']):null});
 const family=()=>({name:'Fixture',restaurants,polls:[current()]});const app={innerHTML:'',addEventListener:(n,f)=>listeners[n]=f};
 const ctx={URL,crypto:require('node:crypto').webcrypto,console:{error(){},log(){}},setTimeout:()=>0,clearTimeout(){},setInterval:f=>{timers.push(f);return timers.length},clearInterval(){},window:{GW_CONFIG:{supabaseUrl:'https://fixture.test',publishableKey:'fixture'},scrollTo(){}},location:{href:anonymous?'https://example.test/?poll=p1':owner?'https://example.test/?family=fixture-owner':'https://example.test/?member='+people.find(p=>p.id===memberId).token+'&poll=p1',pathname:'/'},history:{replaceState(){}},localStorage:{getItem:k=>store[k],setItem:(k,v)=>store[k]=v,removeItem:k=>delete store[k]},document:{getElementById:id=>({app,modeBadge:{},brand:{addEventListener(){}},toast:{classList:{add(){},remove(){}}}}[id]||nodes[id])},navigator:{share:async data=>shares.push(data),clipboard:{writeText:async t=>shares.push({text:t})}},fetch:async(url,request)=>{
  const fn=url.split('/').pop(),p=JSON.parse(request.body);calls.push({fn,p});let result;
  if(fn==='gw_get_family')result=family();else if(fn==='gw_list_members')result=people;
  else if(fn==='gw_get_member'){const m=people.find(m=>m.token===p.p_member_token);result={id:m.id,name:m.name,avatar:m.avatar,family:family()}}
  else if(fn==='gw_get_poll')result=current();else if(fn==='gw_member_has_voted')result=voted.has(memberId);
  else if(fn==='gw_get_poll_people'){if(statusError)throw Error('Unavailable');result={rostered:true,eligible:chosen.includes(memberId)&&!owner,people:people.filter(m=>chosen.includes(m.id)).map(m=>({id:m.id,name:m.name,avatar:p.p_include_avatars?m.avatar:null,active:true,voted:voted.has(m.id)}))}}
  else if(fn==='gw_create_poll_for_members'){chosen=p.p_member_ids;voted=new Set();result='p1'}else if(fn==='gw_vote_as_member'){voted.add(memberId);result={ok:true}}else throw Error(fn);
  return {ok:true,json:async()=>result};
 }};
 vm.createContext(ctx);for(const f of ['voting.js','maps.js','logos.js','family.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx);for(let i=0;i<4;i++)await tick();
 return {app,calls,shares,photo,listeners,nodes,async click(act,data={}){await listeners.click({preventDefault(){},target:{closest:()=>({dataset:{act,...data}})}});await tick()},vote:id=>voted.add(id),statusError:value=>statusError=value,pollTick:async()=>{await timers.at(-1)();await tick()}};
}
test('wizard validates places/people and sends only selected participant IDs',async()=>{
 const h=await setup();await h.click('nav',{page:'create'});await h.click('createGo',{step:'3'});assert.match(h.app.innerHTML,/Pick the contenders/);await h.click('createPoll');assert.equal(h.calls.filter(c=>c.fn==='gw_create_poll_for_members').length,0);
 for(const id of ['r0','r1'])h.listeners.change({target:{dataset:{select:id},checked:true}});await h.click('createNext');assert.match(h.app.innerHTML,/Who's joining/);await h.click('clearPeople');await h.click('createNext');assert.match(h.app.innerHTML,/Who's joining/);
 for(const id of ['m0','m1'])h.listeners.change({target:{dataset:{person:id},checked:true}});await h.click('createNext');assert.match(h.app.innerHTML,/How should we vote/);await h.click('createNext');assert.match(h.app.innerHTML,/Your dinner crew/);assert.match(h.app.innerHTML,/Taylor/);assert.doesNotMatch(h.app.innerHTML,/taylor@icloud.com|fixture-taylor/);await h.click('createPoll');const create=h.calls.find(c=>c.fn==='gw_create_poll_for_members');assert.deepEqual(Array.from(create.p.p_member_ids),['m0','m1']);assert.equal(create.p.p_expected_voters,undefined);assert.match(h.app.innerHTML,/2 remaining/);assert.doesNotMatch(h.app.innerHTML,/Text Sam/);
});
test('waiting status reuses custom photos, exposes no reminder actions to members and blocks uninvited ballots',async()=>{
 const h=await setup({owner:false});assert.match(h.app.innerHTML,/Taylor/);assert.match(h.app.innerHTML,/data:image\/jpeg;base64/);assert.doesNotMatch(h.app.innerHTML,/data-act="remindMember"|taylor@icloud.com|fixture-morgan/);h.vote('m0');await h.pollTick();assert.equal(h.calls.filter(c=>c.fn==='gw_get_poll_people').at(-1).p.p_include_avatars,false);assert.ok(h.app.innerHTML.includes(h.photo));assert.match(h.app.innerHTML,/Change my vote/);
 const guest=await setup({owner:false,memberId:'m2'});assert.match(guest.app.innerHTML,/sitting this one out/);assert.doesNotMatch(guest.app.innerHTML,/data-approval=/);await guest.click('submitVote');assert.equal(guest.calls.filter(c=>c.fn==='gw_vote_as_member').length,0);
});
test('participant-status failure blocks a rostered ballot until a successful retry',async()=>{
 const h=await setup({owner:false,failPeople:true});assert.match(h.app.innerHTML,/Checking your invitation/);assert.doesNotMatch(h.app.innerHTML,/data-approval=/);h.statusError(false);await h.click('refreshPeople');assert.match(h.app.innerHTML,/data-approval=/);
});
test('only waiting participants get reminder drafts; results feature photos and a Maps destination',async()=>{
 const h=await setup();await h.click('openpoll',{id:'p1'});await h.click('remindMember',{id:'m0'});assert.match(h.app.innerHTML,/Text reminder/);await h.click('shareReminder',{id:'m0'});assert.match(h.shares[0].text,/member=fixture-taylor/);assert.doesNotMatch(h.shares[0].text,/family=fixture-owner/);h.vote('m0');await h.pollTick();await h.click('shareReminder',{id:'m0'});assert.equal(h.shares.length,1);h.vote('m1');await h.pollTick();assert.match(h.app.innerHTML,/Decided together/);assert.ok(h.app.innerHTML.includes(h.photo));assert.match(h.app.innerHTML,/Open in Maps/);assert.match(h.app.innerHTML,/100%20Main%20St/);assert.doesNotMatch(h.app.innerHTML,/Text reminder/);assert.equal(h.shares.length,1);
});

test('group invites contain no personal credentials, and new phones connect a verified private link',async()=>{
 const owner=await setup();await owner.click('openpoll',{id:'p1'});await owner.click('shareGroupInvite');assert.match(owner.shares[0].text,/vote is open/);assert.match(owner.shares[0].text,/poll=p1/);assert.doesNotMatch(owner.shares[0].text,/member=|family=|icloud.com|fixture-taylor/);
 const guest=await setup({owner:false,anonymous:true});assert.match(guest.app.innerHTML,/Connect your personal link/);assert.doesNotMatch(guest.app.innerHTML,/data-approval=|Taylor|Morgan/);
 guest.nodes.personalVoteLink={value:'https://example.test/?family='+'ab'.repeat(24)};await guest.click('connectVote');assert.equal(guest.calls.filter(c=>c.fn==='gw_get_member').length,0);
 guest.nodes.personalVoteLink.value='https://elsewhere.test/?member='+'ab'.repeat(24);await guest.click('connectVote');assert.equal(guest.calls.filter(c=>c.fn==='gw_get_member').length,0);
 guest.nodes.personalVoteLink.value='https://example.test/?member='+'ab'.repeat(24);await guest.click('connectVote');assert.match(guest.app.innerHTML,/data-approval=/);assert.match(guest.app.innerHTML,/Taylor/);
});

