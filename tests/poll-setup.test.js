const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('organizer bulk selection, proximity filters and personal poll sharing',async()=>{
 const listeners={},store={goodnights_family_token:'fixture-owner'},calls=[],copied=[];
 const restaurants=Array.from({length:23},(_,i)=>({id:'r'+i,name:'Place '+String(i).padStart(2,'0'),address:i<2?'Nearby Town':'Far Town',latitude:i===22?null:40+i/10,longitude:i===22?null:-86}));
 const app={innerHTML:'',addEventListener:(n,f)=>listeners[n]=f};
 const dom={app,modeBadge:{},toast:{classList:{add(){},remove(){}}},brand:{addEventListener(){}},pollSearch:{focus(){},setSelectionRange(){}}};
 let options=[];
 const context={console,URL,crypto:require('node:crypto').webcrypto,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},location:{href:'https://example.test/?family=fixture-owner'},history:{replaceState(){}},localStorage:{getItem:k=>store[k],setItem:(k,v)=>store[k]=v,removeItem:k=>delete store[k]},document:{getElementById:id=>dom[id]},window:{GW_CONFIG:{supabaseUrl:'https://fixture.test',publishableKey:'fixture'},scrollTo(){}},navigator:{clipboard:{writeText:async x=>copied.push(x)},geolocation:{getCurrentPosition:ok=>ok({coords:{latitude:40,longitude:-86}})}},fetch:async(url,request)=>{
 const fn=url.split('/').pop(),p=JSON.parse(request.body);calls.push({fn,p});let result;
 if(fn==='gw_get_family')result={name:'Fixture',restaurants,polls:[]};
 else if(fn==='gw_create_poll_configured'){options=restaurants.filter(r=>p.p_restaurant_ids.includes(r.id));result='fixture-poll'}
 else if(fn==='gw_get_poll')result={id:'fixture-poll',status:'open',method:'approval',meal:'Dinner',options,expected_voters:4,voted_count:0};
 else if(fn==='gw_list_members')result=[{id:'member-a',name:'Fixture member',token:'fixture-personal'}];
 else throw Error(fn);
 return {ok:true,json:async()=>result};
 }};
 vm.createContext(context);for(const f of ['voting.js','maps.js','logos.js','family.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),context);
 const tick=()=>new Promise(r=>setImmediate(r));await tick();
 const click=async(act,data={})=>{await listeners.click({target:{closest:()=>({dataset:{act,...data}})}});await tick()};
 await click('nav',{page:'create'});
 const beforePreview=calls.length;
 for(const method of ['approval','swipe','ranked']){
  await click('previewMode',{method});assert.match(app.innerHTML,/PRACTICE VOTE/);assert.match(app.innerHTML,/Practice voter/);assert.doesNotMatch(app.innerHTML,/copyMemberPoll|closePoll/);
  if(method==='approval')listeners.change({target:{dataset:{approval:'practice-pizza'},checked:true}});
  else if(method==='swipe'){await click('swipeYes');await click('swipeNo');await click('swipeYes')}
  else for(const [rank,value] of ['practice-pizza','practice-burger','practice-taco'].entries())listeners.change({target:{dataset:{rank:String(rank)},value}});
  await click('submitVote');assert.match(app.innerHTML,/THE FAMILY HAS SPOKEN/);assert.match(app.innerHTML,/PRACTICE VOTE/);
 }
 await click('exitPreview');assert.equal(calls.length,beforePreview);assert.match(app.innerHTML,/Start a vote/);
 await click('selectAll');assert.match(app.innerHTML,/20 selected/);
 listeners.change({target:{dataset:{select:'r22'},checked:true}});assert.match(app.innerHTML,/20 selected/);
 await click('clear');await click('pollLocation');listeners.change({target:{id:'pollRadius',dataset:{},value:'5'}});
 assert.match(app.innerHTML,/1 shown/);assert.doesNotMatch(app.innerHTML,/data-select="r22"/);
 await click('resetPollFilters');listeners.input({target:{id:'pollSearch',value:'Nearby Town',selectionStart:11}});await click('selectAll');assert.match(app.innerHTML,/2 selected/);
 await click('createNext');await click('createNext');await click('createNext');
 await click('createPoll');assert.match(app.innerHTML,/Invite family to this vote/);assert.match(app.innerHTML,/Fixture member/);
 await click('copyMemberPoll',{id:'member-a'});const u=new URL(copied[0]);assert.equal(u.searchParams.get('member'),'fixture-personal');assert.equal(u.searchParams.get('poll'),'fixture-poll');assert.equal(u.searchParams.has('family'),false);
 await click('shareMemberPoll',{id:'member-a'});assert.equal(copied.length,2);
 assert.equal(calls.find(c=>c.fn==='gw_create_poll_configured').p.p_restaurant_ids.length,2);
});
