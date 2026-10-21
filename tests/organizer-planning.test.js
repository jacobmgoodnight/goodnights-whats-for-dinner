const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const tick=()=>new Promise(r=>setImmediate(r));
async function harness({owner=true,active=false,planningFailure=false,alerts=null}={}){
 const listeners={},nodes={},calls=[],storage={},toast={textContent:'',classList:{add(){},remove(){}}};
 const restaurants=[0,1,2].map(i=>({id:'r'+i,name:'Pizza '+i,category:'Pizza',address:i+' Fixture St',active:true}));
 const members=[0,1].map(i=>({id:'m'+i,name:'Person '+i,active:true,token:'fixture-personal-'+i,avatar:'🙂'}));
 const original={id:'old',title:'Friday family dinner',auto_tie:false,meal:'Dinner',method:'swipe',cuisine:'pizza',status:active?'open':'closed',expected_voters:2,voted_count:active?1:2,options:structuredClone(restaurants),ballots:active?null:[{r0:true,r1:false,r2:false},{r0:false,r1:true,r2:false}],roster_enabled:true,member_ids:['m0','m1'],group_join_token:'old-group',tie_winner_id:null};
 const polls=[original],presets=[],nominations=[{id:'n1',name:'Pizza 0',address:'9 Different St',category:'Pizza',note:'Try <here>',status:'pending',by_name:'Person 0'}];let fail=planningFailure?'gw_planning_home':'',caption='Our dinner crew',newCount=0,gate,failAfterCreate='';
 const family=()=>({id:'family',name:'Synthetic family',restaurants:restaurants.filter(r=>r.active),polls:polls.map(p=>({...p}))});
 const app={innerHTML:'',addEventListener:(name,fn)=>listeners[name]=fn};
 const ctx={URL,crypto:require('node:crypto').webcrypto,console:{error(){},log(){}},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},location:{href:owner?'https://fixture.test/?family=fixture-owner':'https://fixture.test/?member=fixture-personal-0',pathname:'/'},history:{replaceState(){}},navigator:{},confirm:()=>true,window:{GoodnightsAlerts:alerts,GW_CONFIG:{supabaseUrl:'https://api.fixture.test',publishableKey:'fixture'},scrollTo(){}},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v,removeItem:k=>delete storage[k]},document:{getElementById:id=>({app,brand:{addEventListener(){}},modeBadge:{},toast}[id]||nodes[id])},
  fetch:async(url,request)=>{
   const fn=url.split('/').pop(),p=JSON.parse(request.body);calls.push({fn,p});if(gate?.fn===fn)await gate.promise;if(fail===fn)throw Error('Synthetic failure');let result;
   if(fn==='gw_get_family')result=family();else if(fn==='gw_get_member')result={...members[0],family:family()};else if(fn==='gw_list_members')result=members.filter(m=>m.active);
   else if(fn==='gw_get_poll'){result=polls.find(q=>q.id===p.p_poll_id);if(!result)throw Error('Missing poll')}
   else if(fn==='gw_get_poll_people')result={rostered:true,eligible:!owner,people:members.map((m,i)=>({id:m.id,name:m.name,active:m.active,voted:original.status==='closed'||i===0}))};
   else if(fn==='gw_poll_settings')result={allow_member_home:false,group_join_token:'fixture-group'};else if(fn==='gw_member_has_voted')result=false;
   else if(fn==='gw_planning_home')result={ready:true,caption:owner?caption:'',can_nominate:!owner,active_polls:polls.filter(q=>q.status==='open'),presets:owner?presets:[],nominations:owner?nominations:nominations.filter(n=>n.by_name==='Person 0'),events:[]};
   else if(fn==='gw_save_dinner_preset'){const d=p.p_draft,preset={id:'preset-'+presets.length,name:p.p_name,draft:d,places:d.place_ids.length,people:d.member_ids.length};presets.push(preset);result=preset.id}
   else if(fn==='gw_get_dinner_preset'){const preset=presets.find(x=>x.id===p.p_preset_id);result={...preset,options:preset.draft.place_ids.map(id=>restaurants.find(r=>r.id===id)),people:preset.draft.member_ids.map(id=>members.find(m=>m.id===id))}}
   else if(fn==='gw_nominate_restaurant'){result='sent';nominations.push({id:result,name:p.p_name,address:p.p_address,note:p.p_note,status:'pending',by_name:'Person 0'})}
   else if(fn==='gw_set_results_caption'){caption=p.p_caption;result=caption}
   else if(fn==='gw_save_restaurant_location')result={status:'saved',id:'new-place',created:true};
   else if(fn==='gw_review_nomination'){nominations.find(n=>n.id===p.p_nomination_id).status=p.p_dismiss?'dismissed':'accepted';result=true}
   else if(fn==='gw_create_dinner'||fn.startsWith('gw_create_poll')){const d=fn==='gw_create_dinner'?p.p_draft:{meal:p.p_meal,method:p.p_method,place_ids:p.p_restaurant_ids,member_ids:p.p_member_ids,cuisine:p.p_cuisine};const fresh={...original,id:'fresh-'+(++newCount),title:d.title||'',auto_tie:!!d.auto_tie,status:'open',voted_count:0,ballots:null,tie_winner_id:null,group_join_token:'fresh-group-'+newCount,options:restaurants.filter(r=>d.place_ids.includes(r.id))};polls.push(fresh);result=fresh.id;if(failAfterCreate)fail=failAfterCreate}
   else throw Error('Unexpected fixture RPC '+fn);return {ok:true,json:async()=>structuredClone(result)};
  }
 };
 vm.createContext(ctx);for(const file of ['voting.js','maps.js','logos.js','family.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});for(let i=0;i<5;i++)await tick();
 return {app,calls,nodes,polls,original,restaurants,members,presets,nominations,toast,fail:fn=>fail=fn,failAfterCreate:fn=>failAfterCreate=fn,change(target){listeners.change({target:{dataset:{},...target}})},input(id,value){listeners.input({target:{id,value}})},async click(act,data={}){await listeners.click({target:{closest:()=>({dataset:{act,...data}})}});await tick()},hold(fn){let release;gate={fn,promise:new Promise(r=>release=r)};return ()=>{gate=null;release()}}};
}
test('Tonight prioritizes a current vote and restores the original header when no vote is active',async()=>{
 const h=await harness({active:true});assert.match(h.app.innerHTML,/TONIGHT/);assert.match(h.app.innerHTML,/Friday family dinner/);assert.match(h.app.innerHTML,/Waiting on Person 1/);assert.doesNotMatch(h.app.innerHTML,/So\.\.\. what's for dinner/);h.original.status='closed';await h.click('retryPlanning');assert.match(h.app.innerHTML,/So\.\.\. what's for dinner/);assert.match(h.app.innerHTML,/Start a family vote|Manage restaurants/);
});
test('planning read failure preserves the usable home with a retry',async()=>{const h=await harness({planningFailure:true});assert.match(h.app.innerHTML,/So\.\.\. what's for dinner/);assert.match(h.app.innerHTML,/could not load/);h.fail('');await h.click('retryPlanning');assert.match(h.app.innerHTML,/Dinner presets/)});
test('compact Review defaults auto tie off, retains edits and creates a fresh titled poll only after confirmation',async()=>{
 const h=await harness();await h.click('repeatDinner',{id:'old'});assert.match(h.app.innerHTML,/<details class="card voting-options">/);assert.doesNotMatch(h.app.innerHTML,/id="autoTie"[^>]*checked/);h.input('pollTitle','Friday <takeout>');h.change({id:'autoTie',checked:true});await h.click('createGo',{step:'1'});await h.click('createGo',{step:'3'});assert.match(h.app.innerHTML,/Friday &lt;takeout&gt;/);assert.match(h.app.innerHTML,/id="autoTie"[^>]*checked/);assert.equal(h.calls.filter(c=>c.fn==='gw_create_dinner').length,0);
 await h.click('createPoll');const sent=h.calls.find(c=>c.fn==='gw_create_dinner').p.p_draft;assert.equal(sent.title,'Friday <takeout>');assert.equal(sent.auto_tie,true);assert.deepEqual(sent.member_ids,['m0','m1']);assert.equal(Object.keys(sent).some(k=>/token|ballot|winner|poll_id/.test(k)),false);assert.match(h.app.innerHTML,/Your vote is ready/);assert.match(h.app.innerHTML,/you send it/);assert.match(h.app.innerHTML,/Positive ties use one saved automatic random draw/);assert.equal(h.original.tie_winner_id,null);
});
test('presets contain only draft choices, reopen Review, and explain current omissions',async()=>{
 const h=await harness();await h.click('repeatDinner',{id:'old'});h.input('presetName','Weeknight');h.input('pollTitle','Quick dinner');await h.click('savePreset');assert.equal(h.polls.length,1);assert.equal(h.presets.length,1);assert.equal(Object.keys(h.presets[0].draft).some(k=>/token|ballot|winner|poll_id/.test(k)),false);h.restaurants[2].active=false;h.members[1].active=false;await h.click('usePreset',{id:'preset-0'});assert.match(h.app.innerHTML,/Use this dinner preset/);assert.match(h.app.innerHTML,/omitted/);assert.match(h.app.innerHTML,/Pizza 2|Person 1/);assert.equal(h.polls.length,1);
});
test('failed preset saves and duplicate taps preserve the draft without overlapping writes',async()=>{
 const h=await harness();await h.click('repeatDinner',{id:'old'});h.input('presetName','Weeknight');h.fail('gw_save_dinner_preset');await h.click('savePreset');assert.match(h.app.innerHTML,/Save these choices as a dinner preset/);h.fail('');const release=h.hold('gw_save_dinner_preset'),pending=h.click('savePreset');await tick();await h.click('savePreset');release();await pending;assert.equal(h.presets.length,1);assert.equal(h.calls.findLast(c=>c.fn==='gw_save_dinner_preset').p.p_name,'Weeknight');
});
test('personal members nominate places; failures retain fields and organizer actions remain guarded',async()=>{
 const h=await harness({owner:false});assert.match(h.app.innerHTML,/Suggest a place/);h.input('nominationName','<New place>');h.input('nominationAddress','9 New St');h.fail('gw_nominate_restaurant');await h.click('nominatePlace');assert.match(h.toast.textContent,/failure/);h.fail('');await h.click('nominatePlace');const payload=h.calls.findLast(c=>c.fn==='gw_nominate_restaurant').p;assert.equal(payload.p_member_token,'fixture-personal-0');assert.equal(payload.p_name,'<New place>');assert.match(h.app.innerHTML,/&lt;New place&gt;/);const before=h.calls.length;for(const act of ['reviewNomination','enableAlerts','savePreset'])await h.click(act,{id:'n1'});assert.equal(h.calls.length,before);
});
test('nomination approval uses location review and marks accepted only after a successful save',async()=>{
 const h=await harness();await h.click('reviewNomination',{id:'n1'});assert.match(h.app.innerHTML,/Review this location/);assert.match(h.app.innerHTML,/9 Different St/);assert.equal(h.calls.some(c=>c.fn==='gw_save_restaurant_location'),false);h.fail('gw_save_restaurant_location');await h.click('confirmLocation');assert.equal(h.nominations[0].status,'pending');assert.match(h.app.innerHTML,/Review this location/);h.fail('');await h.click('confirmLocation');assert.equal(h.nominations[0].status,'accepted');assert.equal(h.calls.findLast(c=>c.fn==='gw_review_nomination').p.p_restaurant_id,'new-place');
});
test('caption inclusion is opt-in and saving the family caption requires organizer credentials',async()=>{
 const h=await harness();await h.click('openpoll',{id:'old'});assert.match(h.app.innerHTML,/value="Our dinner crew"/);assert.doesNotMatch(h.app.innerHTML,/id="includeCaption"[^>]*checked/);h.input('resultsCaption','Family <caption>');await h.click('saveResultsCaption');assert.equal(h.calls.find(c=>c.fn==='gw_set_results_caption').p.p_caption,'Family <caption>');const m=await harness({owner:false}),before=m.calls.length;await m.click('saveResultsCaption');assert.equal(m.calls.length,before);
});

test('blocked device permission never claims that queued organizer alerts are enabled',async()=>{const h=await harness({alerts:{prepare:async()=>{},availability:()=>({supported:true,permission:"denied"}),status:()=>({configured:true,enabled:true})}});assert.match(h.app.innerHTML,/Notifications are blocked/);assert.doesNotMatch(h.app.innerHTML,/Alerts are enabled on this device/)});

test('a Home refresh failure after creation retains the new poll handoff rather than another Create button',async()=>{
 const h=await harness();await h.click('repeatDinner',{id:'old'});h.input('pollTitle','Fresh dinner');h.failAfterCreate('gw_get_family');await h.click('createPoll');
 assert.equal(h.calls.filter(c=>c.fn==='gw_create_dinner').length,1);assert.equal(h.polls.length,2);assert.match(h.app.innerHTML,/Your vote is ready/);assert.doesNotMatch(h.app.innerHTML,/data-act="createPoll"/);assert.equal(h.original.status,'closed');
});
