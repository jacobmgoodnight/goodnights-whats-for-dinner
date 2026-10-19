const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const tick=()=>new Promise(r=>setImmediate(r));
async function setup({owner=true,memberId='m0',failPeople=false,anonymous=false,method='approval',allowHome=true,group=false,saved=false}={}){
 const calls=[],shares=[],listeners={},store={},nodes={},timers=[];const photo='data:image/jpeg;base64,/9j/AAA=';
 const people=[{id:'m0',name:'Taylor',avatar:photo,token:anonymous?'ab'.repeat(24):'fixture-taylor',phone:'taylor@icloud.com',active:true},{id:'m1',name:'Morgan',avatar:'🦊',token:'fixture-morgan',phone:'+15551234567',active:true},{id:'m2',name:'Sam',avatar:'🏀',token:'fixture-sam',phone:'',active:true}];
 const restaurants=[{id:'r0',name:'Pizza night',category:'Pizza',address:'100 Main St, Town'},{id:'r1',name:'Taco time',category:'Mexican',address:'Town'}];
 let chosen=['m0','m1'],voted=new Set(saved?[memberId]:[]),statusError=failPeople,confirmResult=true,ineligibleOverride=false;let settings={allow_member_home:allowHome,group_join_token:group?'fixture-group':null};
 const current=()=>({id:'p1',meal:'Dinner',method,allow_member_home:settings.allow_member_home,status:voted.size>=chosen.length?'closed':'open',expected_voters:chosen.length,voted_count:voted.size,roster_enabled:true,options:restaurants,ballots:voted.size>=chosen.length?[...voted].map(()=>['r0']):null});
 const family=()=>({name:'Fixture',restaurants,polls:[current()]});const app={innerHTML:'',addEventListener:(n,f)=>listeners[n]=f};
 const ctx={URL,crypto:require('node:crypto').webcrypto,console:{error(){},log(){}},setTimeout:()=>0,clearTimeout(){},setInterval:f=>{timers.push(f);return timers.length},clearInterval(){},window:{GW_CONFIG:{supabaseUrl:'https://fixture.test',publishableKey:'fixture'},scrollTo(){}},location:{href:group&&!owner?'https://example.test/?poll=p1&join=fixture-group':anonymous?'https://example.test/?poll=p1':owner?'https://example.test/?family=fixture-owner':'https://example.test/?member='+people.find(p=>p.id===memberId).token+'&poll=p1',pathname:'/'},confirm:()=>confirmResult,history:{replaceState(){}},localStorage:{getItem:k=>store[k],setItem:(k,v)=>store[k]=v,removeItem:k=>delete store[k]},document:{getElementById:id=>({app,modeBadge:{},brand:{addEventListener(){}},toast:{classList:{add(){},remove(){}}}}[id]||nodes[id])},navigator:{share:async data=>shares.push(data),clipboard:{writeText:async t=>shares.push({text:t})}},fetch:async(url,request)=>{
  const fn=url.split('/').pop(),p=JSON.parse(request.body);calls.push({fn,p});let result;
  if(fn==='gw_get_family')result=family();else if(fn==='gw_list_members')result=people;
  else if(fn==='gw_get_member'){const m=people.find(m=>m.token===p.p_member_token);result={id:m.id,name:m.name,avatar:m.avatar,family:family()}}
  else if(fn==='gw_poll_settings'){if(p.p_allow_member_home!==undefined)settings.allow_member_home=p.p_allow_member_home;if(p.p_group_join!==undefined)settings.group_join_token=p.p_group_join?'fixture-group':null;result=settings}
  else if(fn==='gw_delete_polls')result=1;
  else if(fn==='gw_group_poll'){if(p.p_action==='people')result={rostered:true,eligible:chosen.includes(p.p_member_id),people:people.filter(m=>chosen.includes(m.id)).map(m=>({id:m.id,name:m.name,avatar:p.p_include_avatars===false?null:m.avatar,active:true,voted:voted.has(m.id)}))};else if(p.p_action==='identity'){const m=people.find(m=>m.id===p.p_member_id);result={id:m.id,name:m.name,avatar:m.avatar}}else if(p.p_action==='has_voted')result=voted.has(p.p_member_id);else if(p.p_action==='vote'){voted.add(p.p_member_id);result={ok:true}}}
  else if(fn==='gw_get_poll')result=current();else if(fn==='gw_member_has_voted')result=voted.has(memberId);
  else if(fn==='gw_get_poll_people'){if(statusError)throw Error('Unavailable');result={rostered:true,eligible:chosen.includes(memberId)&&!owner&&!ineligibleOverride,people:people.filter(m=>chosen.includes(m.id)).map(m=>({id:m.id,name:m.name,avatar:p.p_include_avatars?m.avatar:null,active:true,voted:voted.has(m.id)}))}}
  else if(fn==='gw_create_poll_for_members'||fn==='gw_create_poll_configured'){chosen=p.p_member_ids;voted=new Set();result='p1'}else if(fn==='gw_vote_as_member'){voted.add(memberId);result={ok:true}}else throw Error(fn);
  return {ok:true,json:async()=>result};
 }};
 vm.createContext(ctx);for(const f of ['voting.js','maps.js','logos.js','family.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx);for(let i=0;i<4;i++)await tick();
 return {app,calls,shares,photo,listeners,nodes,store,setConfirm:value=>confirmResult=value,forceIneligible:()=>ineligibleOverride=true,async click(act,data={}){await listeners.click({preventDefault(){},target:{closest:()=>({dataset:{act,...data}})}});await tick()},vote:id=>voted.add(id),statusError:value=>statusError=value,pollTick:async()=>{await timers.at(-1)();await tick()}};
}
test('wizard validates places/people and sends only selected participant IDs',async()=>{
 const h=await setup();await h.click('nav',{page:'create'});await h.click('createGo',{step:'3'});assert.match(h.app.innerHTML,/Pick the contenders/);await h.click('createPoll');assert.equal(h.calls.filter(c=>c.fn==='gw_create_poll_for_members').length,0);
 for(const id of ['r0','r1'])h.listeners.change({target:{dataset:{select:id},checked:true}});await h.click('createNext');assert.match(h.app.innerHTML,/Who's joining/);await h.click('clearPeople');await h.click('createNext');assert.match(h.app.innerHTML,/Who's joining/);
 for(const id of ['m0','m1'])h.listeners.change({target:{dataset:{person:id},checked:true}});await h.click('createNext');assert.match(h.app.innerHTML,/How should we vote/);await h.click('createNext');assert.match(h.app.innerHTML,/Your dinner crew/);assert.match(h.app.innerHTML,/Taylor/);assert.doesNotMatch(h.app.innerHTML,/taylor@icloud.com|fixture-taylor/);await h.click('createPoll');const create=h.calls.find(c=>c.fn==='gw_create_poll_for_members');assert.deepEqual(Array.from(create.p.p_member_ids),['m0','m1']);assert.equal(create.p.p_expected_voters,undefined);assert.match(h.app.innerHTML,/2 remaining/);assert.doesNotMatch(h.app.innerHTML,/Text Sam/);
});
test('waiting status reuses custom photos, exposes no reminder actions to members and blocks uninvited ballots',async()=>{
 const h=await setup({owner:false});assert.match(h.app.innerHTML,/Taylor/);assert.match(h.app.innerHTML,/data:image\/jpeg;base64/);assert.doesNotMatch(h.app.innerHTML,/data-act="remindMember"|taylor@icloud.com|fixture-morgan/);h.vote('m0');await h.pollTick();assert.equal(h.calls.filter(c=>c.fn==='gw_get_poll_people').at(-1).p.p_include_avatars,false);assert.ok(h.app.innerHTML.includes(h.photo));assert.match(h.app.innerHTML,/Change my vote/);
 const guest=await setup({owner:false,memberId:'m2'});assert.match(guest.app.innerHTML,/not on this vote’s guest list/);assert.doesNotMatch(guest.app.innerHTML,/data-approval=/);await guest.click('submitVote');assert.equal(guest.calls.filter(c=>c.fn==='gw_vote_as_member').length,0);
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

test('waiting panel follows the ballot, member copy link is absent and home navigation can be hidden',async()=>{
 const h=await setup({owner:false,allowHome:false});const html=h.app.innerHTML;
 assert.ok(html.indexOf('data-approval=')<html.indexOf('Waiting on…'));
 assert.doesNotMatch(html,/Copy voting link|← My votes|data-act="copyPoll"/);
 await h.click('goHome');assert.match(h.app.innerHTML,/data-approval=/);
 assert.match(html,/Checks for votes every 8 seconds/);
});
test('saved votes take precedence over an ineligible status message',async()=>{
 const h=await setup({owner:false,saved:true});h.forceIneligible();await h.pollTick();assert.match(h.app.innerHTML,/You're all voted!/);assert.doesNotMatch(h.app.innerHTML,/sitting this one out/);
});
test('rank selection preserves the page and native dropdown while updating duplicate choices',async()=>{
 const h=await setup({owner:false,method:'ranked'}),html=h.app.innerHTML;
 assert.match(html,/rankLogo0/);
 h.nodes.rank0={value:'r0'};h.nodes.rank1={value:'r0'};h.nodes.rankLogo0={innerHTML:''};h.nodes.rankLogo1={innerHTML:''};
 h.listeners.change({target:{id:'rank0',dataset:{rank:'0'},value:'r0'}});
 assert.equal(h.app.innerHTML,html);assert.match(h.nodes.rankLogo0.innerHTML,/svg|img/);
 h.listeners.change({target:{id:'rank1',dataset:{rank:'1'},value:'r0'}});
 assert.equal(h.nodes.rank0.value,'');assert.equal(h.app.innerHTML,html);
});
test('opt-in group picker uses scoped credentials and never reads reusable tokens or saved ballots',async()=>{
 const h=await setup({owner:false,group:true});assert.match(h.app.innerHTML,/Who's voting/);assert.match(h.app.innerHTML,/Taylor|Morgan/);assert.doesNotMatch(h.app.innerHTML,/fixture-taylor|fixture-morgan|icloud.com/);
 await h.click('chooseGroupMember',{id:'m0'});assert.match(h.app.innerHTML,/data-approval=/);assert.doesNotMatch(h.app.innerHTML,/← My votes/);
 h.listeners.change({target:{dataset:{approval:'r0'},checked:true}});await h.click('submitVote');assert.match(h.app.innerHTML,/You're all voted!/);assert.doesNotMatch(h.app.innerHTML,/Change my vote|sitting this one out/);
 assert.ok(h.calls.some(c=>c.fn==='gw_group_poll'&&c.p.p_action==='vote'));assert.ok(h.store.gw_group_vote_p1);
 assert.equal(h.calls.filter(c=>['gw_get_member','gw_get_my_ballot','gw_vote_as_member'].includes(c.fn)).length,0);
 await h.click('changeGroupMember');assert.match(h.app.innerHTML,/Who's voting/);assert.equal(h.store.gw_group_vote_p1,undefined);
});
test('organizer history deletion requires confirmation and members cannot invoke it',async()=>{
 const h=await setup();await h.click('nav',{page:'history'});assert.match(h.app.innerHTML,/Clear finished history/);h.setConfirm(false);await h.click('deletePoll',{id:'p1'});assert.equal(h.calls.filter(c=>c.fn==='gw_delete_polls').length,0);
 h.setConfirm(true);await h.click('deletePoll',{id:'p1'});assert.deepEqual(Array.from(h.calls.find(c=>c.fn==='gw_delete_polls').p.p_poll_ids),['p1']);await h.click('clearHistory');assert.equal(h.calls.filter(c=>c.fn==='gw_delete_polls').at(-1).p.p_finished,true);
 const member=await setup({owner:false});await member.click('deletePoll',{id:'p1'});await member.click('clearHistory');assert.equal(member.calls.filter(c=>c.fn==='gw_delete_polls').length,0);
});
test('configured poll creation sends navigation and group access preferences atomically',async()=>{
 const h=await setup();await h.click('nav',{page:'create'});for(const id of ['r0','r1'])h.listeners.change({target:{dataset:{select:id},checked:true}});
 await h.click('createNext');await h.click('createNext');await h.click('createNext');assert.match(h.app.innerHTML,/Anyone with this invitation/);
 h.listeners.change({target:{id:'allowMemberHome',dataset:{},checked:false}});h.listeners.change({target:{id:'groupJoin',dataset:{},checked:true}});await h.click('createPoll');const call=h.calls.find(c=>c.fn==='gw_create_poll_configured');assert.equal(call.p.p_allow_member_home,false);assert.equal(call.p.p_group_join,true);
});

