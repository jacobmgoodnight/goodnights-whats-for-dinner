const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const tick=()=>new Promise(r=>setImmediate(r));
async function harness({owner=false,method='approval',saved=false}={}){
 const listeners={},store={},copies=[],calls=[],nodes={};let forcedCount=null,closed=false,ballot=saved?(method==='swipe'?{a:true,b:false,c:true}:['a','b','c'].slice(0,method==='approval'?1:3)):null;let createHook=null,submitHook=null;
 const options=['a','b','c'].map(id=>({id,name:'Place '+id,category:'Pizza'}));
 const app={innerHTML:'',addEventListener:(n,f)=>listeners[n]=f};const dom={app,modeBadge:{},toast:{classList:{add(){},remove(){}}},brand:{addEventListener:(n,f)=>listeners.brand=f}};
 const currentPoll=()=>({id:'poll-1',meal:'Dinner',method,status:closed?'closed':'open',options,voted_count:forcedCount??(ballot?1:0),expected_voters:3,ballots:closed&&ballot?[ballot]:null,created_at:'2026-10-17T12:00:00Z'});
 const family=()=>({name:'Fixture family',restaurants:options,polls:[currentPoll()]});
 const context={URL,crypto:require('node:crypto').webcrypto,console:{error(){},log(){}},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},confirm:()=>true,navigator:{clipboard:{writeText:async t=>copies.push(t)}},location:{href:owner?'https://example.test/?family=fixture-owner':'https://example.test/?member=fixture-personal&poll=poll-1',pathname:'/'},history:{replaceState(){}},localStorage:{getItem:k=>store[k],setItem:(k,v)=>store[k]=v,removeItem:k=>delete store[k]},document:{getElementById:id=>dom[id]||nodes[id]},window:{GW_CONFIG:{supabaseUrl:'https://fixture.test',publishableKey:'fixture'},scrollTo(){}},fetch:async(url,request)=>{
  const fn=url.split('/').pop(),p=JSON.parse(request.body);calls.push({fn,p});let result;
  if(fn==='gw_get_family')result=family();
  else if(fn==='gw_get_member')result={id:'member-1',name:'Taylor',avatar:'😎',family:family()};
  else if(fn==='gw_get_poll')result=currentPoll();
  else if(fn==='gw_member_has_voted')result=ballot!==null;
  else if(fn==='gw_get_my_ballot')result=ballot;
  else if(fn==='gw_list_members')result=[{id:'member-1',name:'Taylor',token:'fixture-personal'}];
  else if(fn==='gw_create_poll_for_members'){if(createHook)await createHook();result='poll-1'}
  else if(fn==='gw_vote_as_member'){if(submitHook)await submitHook();ballot=JSON.parse(JSON.stringify(p.p_ballot));result={ok:true}}
  else throw Error(fn);
  return {ok:true,json:async()=>result};
 }};
 vm.createContext(context);for(const f of ['voting.js','maps.js','logos.js','family.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),context);await tick();await tick();
 const click=async(act,data={})=>{await listeners.click({preventDefault(){},target:{closest:()=>({dataset:{act,...data}})}});await tick()};
 return {app,listeners,calls,copies,nodes,click,get ballot(){return ballot},close(){closed=true},completeByCount(){forcedCount=3},setCreateHook:hook=>createHook=hook,setSubmitHook:hook=>submitHook=hook};
}
test('duplicate creation is blocked while pending, and failed creation can be retried',async()=>{
 const h=await harness({owner:true});await h.click('nav',{page:'create'});for(const id of ['a','b'])h.listeners.change({target:{dataset:{select:id},checked:true}});
 await h.click('createNext');await h.click('createNext');await h.click('createNext');
 let release;h.setCreateHook(()=>new Promise(resolve=>release=resolve));const first=h.click('createPoll');await h.click('createPoll');assert.equal(h.calls.filter(c=>c.fn==='gw_create_poll_for_members').length,1);release();await first;
 await h.click('nav',{page:'create'});await h.click('createNext');await h.click('createNext');await h.click('createNext');h.setCreateHook(async()=>{throw Error('Network unavailable')});await h.click('createPoll');assert.match(h.app.innerHTML,/Start a vote/);h.setCreateHook(null);await h.click('createPoll');assert.equal(h.calls.filter(c=>c.fn==='gw_create_poll_for_members').length,3);
});
for(const method of ['approval','swipe','ranked'])test('saved '+method+' ballot can be restored, canceled and replaced once',async()=>{
 const h=await harness({method,saved:true});assert.match(h.app.innerHTML,/Change my vote/);await h.click('resetVote');assert.match(h.app.innerHTML,/Editing your saved vote/);assert.match(h.app.innerHTML,/Save vote changes/);
 if(method==='approval')assert.match(h.app.innerHTML,/data-approval="a" checked/);if(method==='swipe')assert.match(h.app.innerHTML,/3 of 3 answered/);if(method==='ranked')assert.match(h.app.innerHTML,/value="a" selected/);
 await h.click('cancelVoteEdit');assert.match(h.app.innerHTML,/Change my vote/);assert.equal(h.calls.filter(c=>c.fn==='gw_vote_as_member').length,0);
 await h.click('resetVote');
 if(method==='approval'){h.listeners.change({target:{dataset:{approval:'a'},checked:false}});h.listeners.change({target:{dataset:{approval:'b'},checked:true}})}else if(method==='swipe')await h.click('swipeNo');else for(const [rank,value] of ['c','b','a'].entries())h.listeners.change({target:{dataset:{rank:String(rank)},value}});
 let release;h.setSubmitHook(()=>new Promise(resolve=>release=resolve));const first=h.click('submitVote');await h.click('submitVote');assert.equal(h.calls.filter(c=>c.fn==='gw_vote_as_member').length,1);release();await first;
 assert.deepEqual(h.ballot,method==='approval'?['b']:method==='swipe'?{a:false,b:false,c:true}:['c','b','a']);assert.match(h.app.innerHTML,/Change my vote/);await h.click('submitVote');assert.equal(h.calls.filter(c=>c.fn==='gw_vote_as_member').length,1);
});
test('failed vote updates preserve the editing state and permit retry; closed polls cannot be edited',async()=>{
 const h=await harness({saved:true});await h.click('resetVote');h.setSubmitHook(async()=>{throw Error('Network unavailable')});await h.click('submitVote');assert.match(h.app.innerHTML,/Save vote changes/);h.setSubmitHook(null);await h.click('submitVote');assert.match(h.app.innerHTML,/Change my vote/);h.close();await h.click('resetVote');assert.match(h.app.innerHTML,/THE FAMILY HAS SPOKEN/);assert.doesNotMatch(h.app.innerHTML,/Save vote changes/);
});
test('members return from results to their dashboard and never see organizer navigation',async()=>{
 const h=await harness({saved:true});h.close();await h.click('openpoll',{id:'poll-1'});await h.click('goHome');assert.match(h.app.innerHTML,/Your family votes/);assert.match(h.app.innerHTML,/Taylor/);assert.match(h.app.innerHTML,/Recent results/);assert.doesNotMatch(h.app.innerHTML,/Create our family|New vote|data-page="members"|data-page="restaurants"/);
 await h.click('nav',{page:'create'});assert.match(h.app.innerHTML,/Your family votes/);await h.click('createPoll');assert.equal(h.calls.filter(c=>c.fn==='gw_create_poll_for_members').length,0);
 await h.click('openpoll',{id:'poll-1'});await h.listeners.brand({preventDefault(){}});await tick();assert.match(h.app.innerHTML,/Your family votes/);
});
test('home invitations are personal; organizer backup is explicitly labeled in Members',async()=>{
 const h=await harness({owner:true});assert.match(h.app.innerHTML,/Personal invitations/);assert.doesNotMatch(h.app.innerHTML,/data-act="familyLink"/);await h.click('nav',{page:'members'});assert.match(h.app.innerHTML,/Organizer access backup/);assert.match(h.app.innerHTML,/Copy private organizer link/);await h.click('copyMember',{id:'member-1'});assert.match(h.copies[0],/member=fixture-personal/);assert.doesNotMatch(h.copies[0],/family=/);
});

test('automatically finished polls appear under results even if the stored status remains open',async()=>{const h=await harness({saved:true});h.completeByCount();await h.click('goHome');assert.match(h.app.innerHTML,/Nothing to vote on right now/);assert.match(h.app.innerHTML,/See results/);assert.doesNotMatch(h.app.innerHTML,/Open vote →/)});
