const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const tick=()=>new Promise(r=>setImmediate(r));
async function setup({owner=true,memberId='m0',failPeople=false,anonymous=false,method='approval',allowHome=true,group=false,saved=false,welcome=false,sharedStore={},pollId='p1',cuisine='',familyId='family-fixture',raceVote=false,pizzaOnly=false,tied=false,allNo=false,earlyClosed=false}={}){
 const calls=[],shares=[],listeners={},store=sharedStore,nodes={},timers=[];const photo='data:image/jpeg;base64,/9j/AAA=';
 const people=[{id:'m0',name:'Taylor',avatar:photo,token:anonymous?'ab'.repeat(24):'fixture-taylor',phone:'taylor@icloud.com',active:true},{id:'m1',name:'Morgan',avatar:'🦊',token:'fixture-morgan',phone:'+15551234567',active:true},{id:'m2',name:'Sam',avatar:'🏀',token:'fixture-sam',phone:'',active:true}];
 const restaurants=[{id:'r0',name:'Pizza night',category:'Pizza',address:'100 Main St, Town'},{id:'r1',name:pizzaOnly?'Another pizza place':'Taco time',category:pizzaOnly?'Pizza':'Mexican',address:'Town'}];
 let chosen=['m0','m1'],voted=new Set(saved?[memberId]:[]),statusError=failPeople,confirmResult=true,ineligibleOverride=false;let tieWinner=null;let settings={allow_member_home:allowHome,group_join_token:group?'fixture-group':null};
 const current=()=>({id:pollId,tie_winner_id:tieWinner,cuisine,meal:'Dinner',method,allow_member_home:settings.allow_member_home,status:earlyClosed||voted.size>=chosen.length?'closed':'open',expected_voters:chosen.length,voted_count:voted.size,roster_enabled:true,options:restaurants,ballots:earlyClosed||voted.size>=chosen.length?[...voted].map((_,i)=>method==='swipe'?(allNo?{r0:false,r1:false}:{r0:i===0,r1:i!==0}):[tied?'r'+i:'r0']):null});
 const family=()=>({name:'Fixture',restaurants,polls:[current()]});const app={innerHTML:'',addEventListener:(n,f)=>listeners[n]=f};
 const ctx={URL,crypto:require('node:crypto').webcrypto,console:{error(){},log(){}},setTimeout:()=>0,clearTimeout(){},setInterval:f=>{timers.push(f);return timers.length},clearInterval(){},window:{GW_CONFIG:{supabaseUrl:'https://fixture.test',publishableKey:'fixture'},scrollTo(){}},location:{href:(welcome?'https://example.test/':group&&!owner?'https://example.test/?poll=p1&join=fixture-group':anonymous?'https://example.test/?poll=p1':owner?'https://example.test/?family=fixture-owner':'https://example.test/?member='+people.find(p=>p.id===memberId).token+'&poll=p1').replace(/poll=p1/g,'poll='+pollId),pathname:'/'},confirm:()=>confirmResult,history:{replaceState(){}},localStorage:{getItem:k=>store[k]??null,key:i=>Object.keys(store)[i]??null,get length(){return Object.keys(store).length},setItem:(k,v)=>store[k]=v,removeItem:k=>delete store[k]},document:{getElementById:id=>({app,modeBadge:{},brand:{addEventListener(){}},toast:{classList:{add(){},remove(){}}}}[id]||nodes[id])},navigator:{share:async data=>shares.push(data),clipboard:{writeText:async t=>shares.push({text:t})}},fetch:async(url,request)=>{
  const fn=url.split('/').pop(),p=JSON.parse(request.body);calls.push({fn,p});let result;
  if(fn==='gw_get_family')result=family();else if(fn==='gw_list_members')result=people.filter(m=>m.active!==false);
  else if(fn==='gw_get_member'){const m=people.find(m=>m.token===p.p_member_token);result={id:m.id,name:m.name,avatar:m.avatar,family:family()}}
  else if(fn==='gw_poll_settings'){if(p.p_allow_member_home!==undefined)settings.allow_member_home=p.p_allow_member_home;if(p.p_group_join!==undefined)settings.group_join_token=p.p_group_join?'fixture-group':null;result=settings}
  else if(fn==='gw_delete_polls')result=1;else if(fn==='gw_rotate_member')result=true;else if(fn==='gw_remove_member'){people.find(m=>m.id===p.p_member_id).active=false;result=true}
  else if(fn==='gw_group_poll'){if(p.p_action==='people')result={family_id:familyId,rostered:true,eligible:chosen.includes(p.p_member_id),people:people.filter(m=>chosen.includes(m.id)).map(m=>({id:m.id,name:m.name,avatar:p.p_include_avatars===false?null:m.avatar,active:true,voted:voted.has(m.id)}))};else if(p.p_action==='identity'){if(raceVote)voted.add(p.p_member_id);const m=people.find(m=>m.id===p.p_member_id);result={id:m.id,name:m.name,avatar:m.avatar}}else if(p.p_action==='has_voted')result=voted.has(p.p_member_id);else if(p.p_action==='vote'){voted.add(p.p_member_id);result={ok:true}}}
  else if(fn==='gw_resolve_tie_random'){tieWinner='r1';result=tieWinner}
  else if(fn==='gw_get_poll')result=current();else if(fn==='gw_member_has_voted')result=voted.has(memberId);
  else if(fn==='gw_get_poll_people'){if(statusError)throw Error('Unavailable');result={rostered:true,eligible:chosen.includes(memberId)&&!owner&&!ineligibleOverride,people:people.filter(m=>chosen.includes(m.id)).map(m=>({id:m.id,name:m.name,avatar:p.p_include_avatars?m.avatar:null,active:true,voted:voted.has(m.id)}))}}
  else if(fn==='gw_create_poll_configured'||fn==='gw_create_poll_themed'){chosen=p.p_member_ids;voted=new Set();result='p1'}else if(fn==='gw_vote_as_member'){voted.add(memberId);result={ok:true}}else throw Error(fn);
  return {ok:true,json:async()=>result};
 }};
 vm.createContext(ctx);for(const f of ['voting.js','maps.js','logos.js','family.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx);for(let i=0;i<4;i++)await tick();
 return {app,calls,shares,photo,listeners,nodes,store,setTieWinner:value=>tieWinner=value,setHidden:value=>ctx.document.hidden=value,setConfirm:value=>confirmResult=value,forceIneligible:()=>ineligibleOverride=true,async click(act,data={}){await listeners.click({preventDefault(){},target:{closest:()=>({dataset:{act,...data}})}});await tick()},vote:id=>voted.add(id),statusError:value=>statusError=value,pollTick:async()=>{await timers.at(-1)();await tick()}};
}
test('wizard validates places/people and sends only selected participant IDs',async()=>{
 const h=await setup();await h.click('nav',{page:'create'});await h.click('createGo',{step:'3'});assert.match(h.app.innerHTML,/Pick the contenders/);await h.click('createPoll');assert.equal(h.calls.filter(c=>c.fn==='gw_create_poll_configured').length,0);
 for(const id of ['r0','r1'])h.listeners.change({target:{dataset:{select:id},checked:true}});await h.click('createNext');assert.match(h.app.innerHTML,/Who's joining/);await h.click('clearPeople');await h.click('createNext');assert.match(h.app.innerHTML,/Who's joining/);
 for(const id of ['m0','m1'])h.listeners.change({target:{dataset:{person:id},checked:true}});await h.click('createNext');assert.match(h.app.innerHTML,/How should we vote/);await h.click('createNext');assert.match(h.app.innerHTML,/4 people|2 people/);assert.match(h.app.innerHTML,/Taylor/);assert.doesNotMatch(h.app.innerHTML,/taylor@icloud.com|fixture-taylor/);await h.click('createPoll');const create=h.calls.find(c=>c.fn==='gw_create_poll_configured');assert.deepEqual(Array.from(create.p.p_member_ids),['m0','m1']);assert.equal(create.p.p_expected_voters,undefined);assert.match(h.app.innerHTML,/2 remaining/);assert.doesNotMatch(h.app.innerHTML,/Text Sam/);
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
 assert.ok(html.indexOf('data-approval=')<html.indexOf('Waiting on'));
 assert.doesNotMatch(html,/Copy voting link|← My votes|data-act="copyPoll"/);
 await h.click('goHome');assert.match(h.app.innerHTML,/data-approval=/);
 assert.match(html,/waiting-title[\s\S]*Waiting on[\s\S]*waiting-dots/);assert.doesNotMatch(html,/Checks for votes|View family status/);
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

test('new votes default to no member home navigation and a checked group name picker',async()=>{
 const h=await setup();await h.click('nav',{page:'create'});for(const id of ['r0','r1'])h.listeners.change({target:{dataset:{select:id},checked:true}});await h.click('createNext');await h.click('createNext');await h.click('createNext');
 assert.match(h.app.innerHTML,/id="allowMemberHome" type="checkbox" >/);assert.match(h.app.innerHTML,/id="groupJoin" type="checkbox" checked/);await h.click('createPoll');const create=h.calls.find(c=>c.fn==='gw_create_poll_configured');assert.equal(create.p.p_allow_member_home,false);assert.equal(create.p.p_group_join,true);
});
test('cuisine shortlists replace unrelated selections and bulk selection stays in the chosen food type',async()=>{
 const h=await setup();await h.click('nav',{page:'create'});for(const id of ['r0','r1'])h.listeners.change({target:{dataset:{select:id},checked:true}});
 h.listeners.change({target:{id:'pollCuisine',dataset:{},value:'pizza'}});assert.match(h.app.innerHTML,/1 selected/);assert.match(h.app.innerHTML,/data-select="r0"/);assert.doesNotMatch(h.app.innerHTML,/data-select="r1"/);await h.click('selectAll');assert.match(h.app.innerHTML,/1 selected/);
 await h.click('cuisine',{cuisine:'mexican'});assert.match(h.app.innerHTML,/data-select="r1"/);assert.doesNotMatch(h.app.innerHTML,/data-select="r0"/);await h.click('createNext');assert.match(h.app.innerHTML,/Pick the contenders/);
});
test('members get compact voted checks and text sharing, while only organizers get image controls',async()=>{
 const h=await setup({owner:false,saved:true});assert.match(h.app.innerHTML,/Already voted/);assert.match(h.app.innerHTML,/voted-check/);assert.doesNotMatch(h.app.innerHTML,/View family status|people-status|every 8 seconds/);h.vote('m1');await h.pollTick();assert.match(h.app.innerHTML,/Decided together/);assert.match(h.app.innerHTML,/data-act="shareResultsMessage"/);assert.doesNotMatch(h.app.innerHTML,/Make results image|includeCardAvatars|dinner announcement/);const before=h.app.innerHTML;await h.click('prepareResultsCard');await h.click('shareResultsCard');assert.equal(h.app.innerHTML,before);
 const owner=await setup();await owner.click('openpoll',{id:'p1'});owner.vote('m0');owner.vote('m1');await owner.pollTick();assert.match(owner.app.innerHTML,/Make results image/);
});


test('fresh installed-app entry verifies a same-site personal invitation before storing identity',async()=>{
 const h=await setup({owner:false,anonymous:true,welcome:true});assert.match(h.app.innerHTML,/Already have an invitation/);h.nodes.joinToken={value:'https://elsewhere.test/?member='+'ab'.repeat(24)};await h.click('join');assert.equal(h.calls.filter(c=>c.fn==='gw_get_member').length,0);assert.equal(h.store.goodnights_member_token,undefined);
 h.nodes.joinToken.value='https://example.test/?member='+'ab'.repeat(24);await h.click('join');assert.equal(h.store.goodnights_member_token,'ab'.repeat(24));assert.match(h.app.innerHTML,/Your family votes/);assert.match(h.app.innerHTML,/Add Goodnights to your phone/);
});
test('group name preference survives new poll URLs only within the same invited family',async()=>{
 const first=await setup({owner:false,group:true});await first.click('chooseGroupMember',{id:'m0'});assert.equal(first.store['gw_group_last_person_family-fixture'],'m0');
 const second=await setup({owner:false,group:true,pollId:'p2',sharedStore:first.store});assert.match(second.app.innerHTML,/data-approval=/);assert.doesNotMatch(second.app.innerHTML,/Who's voting/);assert.ok(second.store.gw_group_vote_p2);
 const other=await setup({owner:false,group:true,pollId:'p3',familyId:'another-family',sharedStore:first.store});assert.match(other.app.innerHTML,/Who's voting/);
 await second.click('changeGroupMember');assert.match(second.app.innerHTML,/Who's voting/);assert.equal(second.store['gw_group_last_person_family-fixture'],'');
});
test('already-voted group names are disabled and a stale picker cannot select a newly voted name',async()=>{
 const h=await setup({owner:false,group:true});h.vote('m0');await h.pollTick();assert.match(h.app.innerHTML,/data-id="m0" disabled aria-disabled="true"/);const before=h.calls.filter(c=>c.fn==='gw_group_poll'&&c.p.p_action==='identity').length;await h.click('chooseGroupMember',{id:'m0'});assert.equal(h.calls.filter(c=>c.fn==='gw_group_poll'&&c.p.p_action==='identity').length,before);
 const race=await setup({owner:false,group:true,raceVote:true});await race.click('chooseGroupMember',{id:'m0'});assert.match(race.app.innerHTML,/Who's voting/);assert.match(race.app.innerHTML,/data-id="m0" disabled/);assert.equal(race.store['gw_group_last_person_family-fixture'],undefined);
});
test('themed polls persist the organizer cuisine and show it on member pages',async()=>{
 const owner=await setup({pizzaOnly:true});await owner.click('nav',{page:'create'});await owner.click('cuisine',{cuisine:'pizza'});await owner.click('createNext');await owner.click('createNext');await owner.click('createNext');await owner.click('createPoll');const create=owner.calls.find(c=>c.fn==='gw_create_poll_themed');assert.equal(create.p.p_cuisine,'pizza');
 const member=await setup({owner:false,cuisine:'mexican'});assert.match(member.app.innerHTML,/🌮 Mexican night/);assert.match(member.app.innerHTML,/taco ’bout/);member.vote('m0');member.vote('m1');await member.pollTick();assert.match(member.app.innerHTML,/🌮 MEXICAN NIGHT RESULTS/);
});
test('member management uses separate guarded actions instead of a command prompt',async()=>{
 const h=await setup();await h.click('nav',{page:'members'});assert.doesNotMatch(h.app.innerHTML,/iMessage email saved|Text number saved|Link \/ remove/);assert.match(h.app.innerHTML,/Reset personal link/);assert.match(h.app.innerHTML,/Remove member/);
 h.setConfirm(false);await h.click('resetMemberLink',{id:'m0'});assert.equal(h.calls.filter(c=>c.fn==='gw_rotate_member').length,0);h.setConfirm(true);await h.click('resetMemberLink',{id:'m0'});assert.equal(h.calls.filter(c=>c.fn==='gw_rotate_member').length,1);await h.click('removeMember',{id:'m1'});assert.equal(h.calls.filter(c=>c.fn==='gw_remove_member').length,1);
 const member=await setup({owner:false});await member.click('resetMemberLink',{id:'m0'});await member.click('removeMember',{id:'m0'});assert.equal(member.calls.filter(c=>c.fn==='gw_rotate_member'||c.fn==='gw_remove_member').length,0);
});

test('older per-poll name memories migrate only when there is one unambiguous invited identity',async()=>{
 const same={gw_group_vote_old:JSON.stringify({token:'old-scoped',memberId:'m0'})};const h=await setup({owner:false,group:true,pollId:'next',sharedStore:same});assert.match(h.app.innerHTML,/data-approval=/);assert.equal(h.store['gw_group_last_person_family-fixture'],'m0');await h.click('changeGroupMember');assert.match(h.app.innerHTML,/Who's voting/);
 const shared={gw_group_vote_old:JSON.stringify({token:'old',memberId:'m0'}),gw_group_vote_other:JSON.stringify({token:'other',memberId:'m1'})};const ambiguous=await setup({owner:false,group:true,pollId:'next',sharedStore:shared});assert.match(ambiguous.app.innerHTML,/Who's voting/);
});

test('only organizers can confirm one random draw; tied member results observe the saved pick',async()=>{
 const h=await setup({tied:true});h.vote('m0');h.vote('m1');await h.click('openpoll',{id:'p1'});
 assert.match(h.app.innerHTML,/data-act="randomTie"/);assert.match(h.app.innerHTML,/data-act="runoff"/);
 h.setConfirm(false);await h.click('randomTie');assert.equal(h.calls.filter(c=>c.fn==='gw_resolve_tie_random').length,0);
 h.setConfirm(true);await h.click('randomTie');assert.equal(h.calls.filter(c=>c.fn==='gw_resolve_tie_random').length,1);
 assert.match(h.app.innerHTML,/Chosen randomly between 2 tied leaders/);assert.doesNotMatch(h.app.innerHTML,/data-act="randomTie"|data-act="runoff"/);
 await h.click('randomTie');assert.equal(h.calls.filter(c=>c.fn==='gw_resolve_tie_random').length,1);
 const m=await setup({owner:false,tied:true});m.vote('m0');m.vote('m1');await m.pollTick();assert.doesNotMatch(m.app.innerHTML,/data-act="randomTie"/);
 await m.click('randomTie');assert.equal(m.calls.filter(c=>c.fn==='gw_resolve_tie_random').length,0);
 // Simulate an organizer's draw on another device, then its public refresh.
 const currentCall=m.calls.length;m.setTieWinner('r1');await m.pollTick();assert.ok(m.calls.length>currentCall);assert.match(m.app.innerHTML,/Chosen randomly between 2 tied leaders/);assert.match(m.app.innerHTML,/<h1>Taco time<\/h1>/);
});

test('background polling pauses on hidden pages and catches up when visible',async()=>{
 const h=await setup({owner:false}),before=h.calls.length;
 h.setHidden(true);h.vote('m1');await h.pollTick();assert.equal(h.calls.length,before);
 h.setHidden(false);await h.pollTick();assert.ok(h.calls.length>before);assert.match(h.app.innerHTML,/1 of 2 votes in/);
});

for(const owner of [true,false])test('all-no results and shares agree for '+(owner?'organizer':'member')+', without draw/runoff actions',async()=>{
 const h=await setup({owner,method:'swipe',allNo:true});h.vote('m0');h.vote('m1');await h.click('openpoll',{id:'p1'});
 assert.match(h.app.innerHTML,/Nothing sounds good tonight/);assert.doesNotMatch(h.app.innerHTML,/class="trophy"|data-act="randomTie"|data-act="runoff"|DINNER IS DECIDED|Open in Maps/);
 assert.equal(h.app.innerHTML.includes('data-act="newShortlist"'),owner);
 await h.click('randomTie');await h.click('runoff');assert.equal(h.calls.filter(c=>c.fn==='gw_resolve_tie_random'||c.fn==='gw_create_poll_configured').length,0);
 await h.click('shareResultsMessage');assert.match(h.shares.at(-1).text,/Nothing sounds good tonight/);assert.doesNotMatch(h.shares.at(-1).text,/🏆|member=|family=/);
 if(owner){await h.click('newShortlist');assert.match(h.app.innerHTML,/Pick the contenders/);assert.match(h.app.innerHTML,/0 selected/);assert.equal(h.calls.filter(c=>c.fn.startsWith('gw_create_poll')).length,0)}
 else{await h.click('newShortlist');assert.match(h.app.innerHTML,/Nothing sounds good tonight/)}
});
test('early closed all-no and historical saved zero-support results remain distinct',async()=>{
 const h=await setup({method:'swipe',allNo:true,earlyClosed:true,saved:true});await h.click('openpoll',{id:'p1'});assert.match(h.app.innerHTML,/Nothing sounds good tonight/);
 h.setTieWinner('r1');await h.click('openpoll',{id:'p1'});assert.match(h.app.innerHTML,/Historical saved draw/);assert.match(h.app.innerHTML,/Taco time/);assert.doesNotMatch(h.app.innerHTML,/data-act="newShortlist"|data-act="randomTie"/);
});
