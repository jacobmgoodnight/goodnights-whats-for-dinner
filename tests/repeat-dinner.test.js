const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function setup({owner=true,rostered=true,method='ranked',cuisine='pizza',count=3,invited=2}={}){
 const listeners={},nodes={},calls=[],storage={},toast={textContent:'',classList:{add(){},remove(){}}};
 const restaurants=Array.from({length:count},(_,i)=>({id:'r'+i,name:'Pizza '+i,category:'Pizza',active:true}));
 const members=Array.from({length:Math.max(invited,3)},(_,i)=>({id:'m'+i,name:'Person '+i,active:true,token:'fixture-personal-'+i,avatar:'🙂'}));
 const source={id:'old-poll',meal:'Lunch',method,cuisine,status:'closed',expected_voters:invited,voted_count:invited,options:structuredClone(restaurants),
  ballots:Array.from({length:invited},()=>method==='swipe'?Object.fromEntries(restaurants.map(r=>[r.id,true])):restaurants.map(r=>r.id)),tie_winner_id:'r1',group_join_token:'old-group-credential',allow_member_home:true};
 const roster=members.slice(0,invited).map(m=>({id:m.id,name:m.name,active:true}));
 const initial=JSON.stringify(source),polls=[source];let fail='',gate=null,createFailure=false;
 const app={innerHTML:'',addEventListener:(name,fn)=>listeners[name]=fn};
 const family=()=>({id:'family-fixture',name:'Fixture',restaurants:restaurants.filter(r=>r.active),polls:polls.map(p=>({...p}))});
 const ctx={URL,crypto:require('node:crypto').webcrypto,console:{error(){},log(){}},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
  window:{GW_CONFIG:{supabaseUrl:'https://fixture.test',publishableKey:'fixture'},scrollTo(){}},
  location:{href:owner?'https://example.test/?family=fixture-owner':'https://example.test/?member=fixture-personal-0',pathname:'/'},history:{replaceState(){}},
  localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v,removeItem:k=>delete storage[k]},navigator:{},confirm:()=>true,
  document:{getElementById:id=>({app,modeBadge:{},brand:{addEventListener(){}},toast}[id]||nodes[id])},
  fetch:async(url,request)=>{
   const fn=url.split('/').pop(),p=JSON.parse(request.body);calls.push({fn,p});
   if(gate&&gate.fn===fn)await gate.promise;
   if(fail===fn)throw Error('Fixture read unavailable');
   let result;
   if(fn==='gw_get_family')result=family();
   else if(fn==='gw_list_members')result=members.filter(m=>m.active);
   else if(fn==='gw_get_member')result={id:'m0',name:'Person 0',family:family()};
   else if(fn==='gw_get_poll'){result=polls.find(q=>q.id===p.p_poll_id);if(!result)throw Error('Vote link not found')}
   else if(fn==='gw_get_poll_people'){
    if(owner&&p.p_token!=='fixture-owner')throw Error('Family access denied');
    result={rostered,eligible:false,people:roster};
   }
   else if(fn==='gw_poll_settings')result={allow_member_home:true,group_join_token:'old-group-credential'};
   else if(fn==='gw_member_has_voted')result=true;
   else if(fn.startsWith('gw_create_poll')){
    if(createFailure)throw Error('Fixture create failed');
    const fresh={id:'fresh-'+polls.length,meal:p.p_meal,method:p.p_method,cuisine:p.p_cuisine||'',status:'open',expected_voters:p.p_member_ids.length,voted_count:0,
     options:restaurants.filter(r=>p.p_restaurant_ids.includes(r.id)),ballots:null,tie_winner_id:null,group_join_token:'fresh-group-'+polls.length};
    polls.push(fresh);result=fresh.id;
   }
   else throw Error('Unexpected RPC '+fn);
   return {ok:true,json:async()=>structuredClone(result)};
  }
 };
 vm.createContext(ctx);
 for(const file of ['voting.js','maps.js','logos.js','family.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
 for(let i=0;i<4;i++)await tick();
 return {app,calls,source,restaurants,members,roster,polls,toast,nodes,
  unchanged:()=>assert.equal(JSON.stringify(source),initial),setFail:fn=>fail=fn,setCreateFailure:value=>createFailure=value,
  hold(fn){let release;const promise=new Promise(r=>release=r);gate={fn,promise};return ()=>{gate=null;release()}},
  change(target){listeners.change({target:{dataset:{},...target}})},
  async click(act,data={}){await listeners.click({target:{closest:()=>({dataset:{act,...data}})}});await tick()}
 };
}
const creates=h=>h.calls.filter(c=>c.fn.startsWith('gw_create_poll'));

for(const method of ['approval','swipe','ranked'])test('repeat '+method+' opens Review, permits edits and creates only a fresh confirmed poll',async()=>{
 const h=await setup({method});await h.click('nav',{page:'history'});assert.match(h.app.innerHTML,/Use this dinner again/);
 await h.click('repeatDinner',{id:'old-poll'});assert.match(h.app.innerHTML,/aria-current="step" data-act="createGo" data-step="3"/);
 assert.match(h.app.innerHTML,/Lunch/);assert.match(h.app.innerHTML,/Cuisine: 🍕 Pizza/);assert.match(h.app.innerHTML,/Person 0|Person 1/);assert.equal(creates(h).length,0);
 assert.doesNotMatch(h.app.innerHTML,/old-group-credential|fixture-personal|tie_winner_id/);
 await h.click('createGo',{step:'0'});h.change({id:'meal',value:'Dinner'});h.change({dataset:{select:'r2'},checked:false});await h.click('createGo',{step:'3'});
 await h.click('createPoll');const created=creates(h);assert.equal(created.length,1);assert.equal(created[0].fn,'gw_create_poll_themed');
 assert.deepEqual(created[0].p,{p_token:'fixture-owner',p_meal:'Dinner',p_method:method,p_restaurant_ids:['r0','r1'],p_member_ids:['m0','m1'],p_allow_member_home:false,p_group_join:true,p_cuisine:'pizza'});
 assert.notEqual(h.polls[1].id,h.source.id);assert.notEqual(h.polls[1].group_join_token,h.source.group_join_token);assert.equal(h.polls[1].tie_winner_id,null);assert.equal(h.polls[1].ballots,null);h.unchanged();
});

test('results offer repeat only to organizer; member/direct action and practice cannot copy',async()=>{
 const h=await setup();await h.click('openpoll',{id:'old-poll'});assert.match(h.app.innerHTML,/Use this dinner again/);await h.click('repeatDinner',{id:'old-poll'});assert.match(h.app.innerHTML,/Dinner draft/);
 await h.click('previewMode',{method:'ranked'});const before=h.calls.length;await h.click('repeatDinner',{id:'old-poll'});assert.equal(h.calls.length,before);
 const member=await setup({owner:false});await member.click('nav',{page:'history'});assert.doesNotMatch(member.app.innerHTML,/Use this dinner again/);
 await member.click('openpoll',{id:'old-poll'});assert.doesNotMatch(member.app.innerHTML,/Use this dinner again/);const count=member.calls.length;await member.click('repeatDinner',{id:'old-poll'});assert.equal(member.calls.length,count);
});

test('hidden places and removed members are omitted by stable ID, explained and escaped',async()=>{
 const h=await setup();h.restaurants[2].active=false;h.members[1].active=false;h.source.options[2].name='<Hidden>';h.roster[1].name='<Removed>';
 await h.click('repeatDinner',{id:'old-poll'});assert.match(h.app.innerHTML,/Places omitted.*&lt;Hidden&gt;/);assert.match(h.app.innerHTML,/People omitted.*&lt;Removed&gt;/);
 await h.click('createPoll');assert.deepEqual(creates(h)[0].p.p_restaurant_ids,['r0','r1']);assert.deepEqual(creates(h)[0].p.p_member_ids,['m0']);
});

test('older no-roster polls leave people empty until explicitly chosen and do not infer cuisine',async()=>{
 const h=await setup({rostered:false,cuisine:''});await h.click('repeatDinner',{id:'old-poll'});
 assert.match(h.app.innerHTML,/older vote has no saved guest list/);assert.match(h.app.innerHTML,/0 people/);assert.match(h.app.innerHTML,/Cuisine: All cuisines/);
 await h.click('createPoll');assert.equal(creates(h).length,0);
 await h.click('createGo',{step:'1'});h.change({dataset:{person:'m2'},checked:true});await h.click('createGo',{step:'3'});await h.click('createPoll');
 assert.equal(creates(h)[0].fn,'gw_create_poll_configured');assert.deepEqual(creates(h)[0].p.p_member_ids,['m2']);assert.equal(creates(h)[0].p.p_expected_voters,undefined);h.unchanged();
});

test('no eligible places or people requires repair; upper limits explain every truncation',async()=>{
 const empty=await setup();empty.restaurants.forEach(r=>r.active=false);empty.members.forEach(m=>m.active=false);await empty.click('repeatDinner',{id:'old-poll'});
 assert.match(empty.app.innerHTML,/Choose at least two current places/);assert.match(empty.app.innerHTML,/Choose at least one current person/);await empty.click('createPoll');assert.equal(creates(empty).length,0);
 const max=await setup({count:21,invited:21});await max.click('repeatDinner',{id:'old-poll'});assert.match(max.app.innerHTML,/20 places · 20 people/);assert.match(max.app.innerHTML,/beyond the 20-place limit.*Pizza 20/);assert.match(max.app.innerHTML,/beyond the 20-person limit.*Person 20/);
 await max.click('createPoll');assert.equal(creates(max)[0].p.p_restaurant_ids.length,20);assert.equal(creates(max)[0].p.p_member_ids.length,20);
});

test('confirmation revalidates membership and places and requires a new review after changes',async()=>{
 const h=await setup();await h.click('repeatDinner',{id:'old-poll'});h.restaurants[2].active=false;h.members[1].active=false;
 await h.click('createPoll');assert.equal(creates(h).length,0);assert.match(h.app.innerHTML,/Places omitted/);assert.match(h.app.innerHTML,/People omitted/);assert.match(h.toast.textContent,/Availability changed/);
 await h.click('createPoll');assert.equal(creates(h).length,1);assert.deepEqual(creates(h)[0].p.p_member_ids,['m0']);assert.deepEqual(creates(h)[0].p.p_restaurant_ids,['r0','r1']);h.unchanged();
});

test('organizer can edit people, method, cuisine and voting settings before confirmation',async()=>{
 const h=await setup();await h.click('repeatDinner',{id:'old-poll'});
 await h.click('createGo',{step:'1'});h.change({dataset:{person:'m1'},checked:false});h.change({dataset:{person:'m2'},checked:true});
 await h.click('createGo',{step:'2'});h.change({name:'method',value:'swipe'});
 await h.click('createGo',{step:'0'});h.change({id:'pollCuisine',value:''});
 await h.click('createGo',{step:'3'});h.change({id:'groupJoin',checked:false});h.change({id:'allowMemberHome',checked:false});
 await h.click('createPoll');const {fn,p}=creates(h)[0];assert.equal(fn,'gw_create_poll_configured');assert.equal(p.p_method,'swipe');
 assert.deepEqual(p.p_member_ids,['m0','m2']);assert.equal(p.p_group_join,false);assert.equal(p.p_allow_member_home,false);assert.equal(p.p_cuisine,undefined);h.unchanged();
});

for(const failed of ['gw_get_poll','gw_get_family','gw_list_members','gw_get_poll_people'])test(failed+' failure leaves the existing draft intact and allows retry',async()=>{
 const h=await setup();await h.click('repeatDinner',{id:'old-poll'});await h.click('createGo',{step:'0'});h.change({dataset:{select:'r2'},checked:false});
 h.setFail(failed);await h.click('repeatDinner',{id:'old-poll'});assert.match(h.app.innerHTML,/2 selected/);assert.equal(creates(h).length,0);
 h.setFail('');await h.click('repeatDinner',{id:'old-poll'});assert.match(h.app.innerHTML,/3 places · 2 people/);h.unchanged();
});

test('failed confirmation read or creation preserves the edited draft and allows retry',async()=>{
 const h=await setup();await h.click('repeatDinner',{id:'old-poll'});h.setFail('gw_list_members');await h.click('createPoll');assert.equal(creates(h).length,0);assert.match(h.app.innerHTML,/Dinner draft/);
 h.setFail('');h.setCreateFailure(true);await h.click('createPoll');assert.match(h.app.innerHTML,/Dinner draft/);assert.equal(h.polls.length,1);
 h.setCreateFailure(false);await h.click('createPoll');assert.equal(h.polls.length,2);h.unchanged();
});

test('deleted or unfinished sources fail without creating; cancellation leaves original intact',async()=>{
 const h=await setup();await h.click('nav',{page:'history'});await h.click('repeatDinner',{id:'missing'});assert.match(h.app.innerHTML,/Vote history/);assert.equal(creates(h).length,0);
 await h.click('repeatDinner',{id:'old-poll'});await h.click('cancelRepeat');assert.match(h.app.innerHTML,/Vote history/);assert.equal(creates(h).length,0);h.unchanged();
 h.source.status='open';h.source.voted_count=0;await h.click('repeatDinner',{id:'old-poll'});assert.match(h.app.innerHTML,/Vote history/);assert.match(h.toast.textContent,/Finish this vote/);
});

test('repeated taps cannot overlap repeat loading or confirmation creation',async()=>{
 const h=await setup(),release=h.hold('gw_get_poll_people');const first=h.click('repeatDinner',{id:'old-poll'});await tick();await h.click('repeatDinner',{id:'old-poll'});release();await first;
 assert.equal(h.calls.filter(c=>c.fn==='gw_get_poll_people').length,1);
 const resume=h.hold('gw_create_poll_themed');const create=h.click('createPoll');await tick();await h.click('createPoll');resume();await create;assert.equal(creates(h).length,1);h.unchanged();
});
