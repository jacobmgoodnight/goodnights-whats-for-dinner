// Every request is intercepted. Synthetic names/tokens only; no production service or images.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require(process.env.GW_PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'../..');
async function fixture(browser,width){
 const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),calls=[],errors=[],owner='a'.repeat(48),polls=new Map();let failCreate=true,failJoin=true,failVote=true,failPeople=true,serial=0,enabled=true;
 const library=[{id:'saved-place',name:'Saved Pizza',category:'Pizza',address:'Synthetic town',icon_mode:'builtin',icon_value:'pizza'}];
 const current=q=>({id:q.id,one_time:true,title:q.title,meal:q.meal,method:q.method,expected_voters:q.expected,status:q.closed||q.guests.filter(g=>g.ballot).length>=q.expected?'closed':'open',voted_count:q.guests.filter(g=>g.ballot).length,options:q.options,roster_enabled:true,allow_member_home:false,ballots:q.guests.filter(g=>g.ballot).length>=q.expected?q.guests.map(g=>g.ballot):null});
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());assert.equal(u.hostname,'goodnights.test');
  if(u.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:'window.GW_CONFIG={supabaseUrl:location.origin,publishableKey:"synthetic",oneTimePolls:'+enabled+'};'});
  if(u.pathname.startsWith('/rest/v1/rpc/')){
   const fn=u.pathname.split('/').pop(),p=route.request().postDataJSON();calls.push({fn,p});let result;
   if(fn==='gw_get_family'){assert.equal(p.p_token,owner);result={name:'Synthetic family',restaurants:library,polls:[...polls.values()].map(current)}}
   else if(fn==='gw_planning_home')result={ready:false};
   else if(fn==='gw_push_status')result={configured:false};
   else if(fn==='gw_list_members')result=[];
   else if(fn==='gw_create_one_time_poll'){
    assert.equal(p.p_token,owner);if(!polls.has(p.p_request_id))polls.set(p.p_request_id,{id:p.p_request_id,title:p.p_title,meal:p.p_meal,method:p.p_method,expected:p.p_expected_voters,token:'synthetic-'+p.p_request_id,guests:[],options:p.p_place_names.map((name,i)=>({id:'synthetic-place-'+i,name,category:'',address:'',icon_mode:'builtin',icon_value:'restaurant'}))});
    if(failCreate){failCreate=false;return route.fulfill({status:503,json:{message:'Synthetic creation response lost. Try again.'}})}result=p.p_request_id;
   }else if(fn==='gw_get_poll')result=current(polls.get(p.p_poll_id));
   else if(fn==='gw_get_poll_people'){assert.equal(p.p_token,owner);result={rostered:true,eligible:false,people:[]}}
   else if(fn==='gw_poll_settings'){assert.equal(p.p_token,owner);const q=polls.get(p.p_poll_id);result={allow_member_home:false,group_join_token:q.token}}
   else if(fn==='gw_one_time_access'){
    const q=polls.get(p.p_poll_id);assert.ok(p.p_group_token===q.token||p.p_token===owner);let g=q.guests.find(g=>g.id===p.p_guest_id);
    if(p.p_action==='people'){if(p.p_group_token&&failPeople){failPeople=false;return route.fulfill({status:503,json:{message:'Synthetic invitation check failed'}})}result={rostered:true,eligible:!!g,people:q.guests.map(g=>({id:g.id,name:g.name,avatar:'🙂',active:true,voted:!!g.ballot}))}}
    else if(p.p_action==='join'){
     if(failJoin){failJoin=false;return route.fulfill({status:503,json:{message:'Synthetic join failed. Try again.'}})}
     const name=p.p_name.trim();if(!name)return route.fulfill({status:400,json:{message:'Enter your name'}});
     if(!g){g={id:'synthetic-guest-'+(++serial),name};q.guests.push(g)}else g.name=name;
     result={id:g.id,name:g.name,avatar:'🙂'};
    }else if(p.p_action==='identity'){assert.ok(g);result={id:g.id,name:g.name,avatar:'🙂'}}
    else if(p.p_action==='has_voted')result=!!g?.ballot;
    else if(p.p_action==='vote'){assert.ok(g);if(g.ballot)assert.deepEqual(g.ballot,p.p_ballot);g.ballot=p.p_ballot;if(failVote){failVote=false;return route.fulfill({status:503,json:{message:'Synthetic vote response lost. Try again.'}})}result={ok:true}}
    else throw Error('Unexpected action '+p.p_action);
   }else throw Error('Unexpected RPC '+fn);
   return route.fulfill({json:result});
  }
  const file=u.pathname==='/'?'index.html':u.pathname.slice(1);assert.ok(!file.includes('..'));return route.fulfill({body:fs.readFileSync(path.join(root,file)),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(file)]||'text/plain'});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page,calls,errors,polls,owner,pause:()=>enabled=false};
}
(async()=>{const browser=await chromium.launch({channel:process.env.GW_BROWSER_CHANNEL||'msedge',headless:true});try{
 for(const width of [320,390]){
  const h=await fixture(browser,width),{page,context,calls,polls,owner}=h;
  for(const method of ['approval','swipe','ranked']){
   await page.goto('https://goodnights.test/?family='+owner);await page.getByRole('button',{name:'Start a one-time vote →'}).click();
   await page.getByLabel('Restaurant names · one per line').fill('Pizza near the hotel\nTacos with cousins\nCafé <test>');await page.getByLabel('How many people will vote?').fill('2');
   await page.getByText('Meal, voting method & optional title',{exact:true}).click();await page.getByLabel('Voting method',{exact:true}).selectOption(method);await page.getByLabel('Title (optional)',{exact:true}).fill('Cousins dinner');
   if(method==='approval'){await page.screenshot({path:path.join(os.tmpdir(),'gw-one-time-create-'+width+'.png'),fullPage:true});}
   await page.getByRole('button',{name:'Create & get invitation →'}).click();
   if(method==='approval'){
    await page.locator('#toast').filter({hasText:'Synthetic creation response lost'}).waitFor();assert.equal(await page.getByLabel('Restaurant names · one per line').inputValue(),'Pizza near the hotel\nTacos with cousins\nCafé <test>');await page.getByRole('button',{name:'Create & get invitation →'}).click();
    const attempts=calls.filter(c=>c.fn==='gw_create_one_time_poll');assert.equal(attempts.length,2);assert.equal(attempts[0].p.p_request_id,attempts[1].p.p_request_id);
   }
   try{await page.getByRole('heading',{name:'Invite everyone with one link'}).waitFor({timeout:10000})}catch(e){console.error((await page.locator('body').innerText()).slice(0,1800),calls.slice(-8));throw e}const q=[...polls.values()].at(-1);assert.equal(polls.size,['approval','swipe','ranked'].indexOf(method)+1);
   assert.equal(await page.getByRole('button',{name:/Personal invitations|Add family members/}).count(),0);const invitation=await page.getByRole('link',{name:'Open invitation',exact:true}).getAttribute('href');assert.ok(invitation.includes('join='));assert.ok(!invitation.includes(owner));
   await page.goto(invitation);if(method==='approval'){await page.getByRole('heading',{name:'Could not open the family invitation',exact:true}).waitFor();await page.getByRole('button',{name:'Retry',exact:true}).click()}await page.getByLabel('Your name',{exact:true}).waitFor();assert.equal(await page.locator('.nav').count(),0);
   if(method==='approval')await page.screenshot({path:path.join(os.tmpdir(),'gw-one-time-guest-'+width+'.png'),fullPage:true});
   await page.getByLabel('Your name',{exact:true}).fill('Synthetic Sam');await page.getByRole('button',{name:'Join this vote',exact:true}).focus();await page.keyboard.press('Enter');
   if(method==='approval'){await page.locator('#toast').filter({hasText:'Synthetic join failed'}).waitFor();assert.equal(await page.getByLabel('Your name',{exact:true}).inputValue(),'Synthetic Sam');await page.getByRole('button',{name:'Join this vote',exact:true}).click()}
   await page.locator('[data-act="submitVote"]').waitFor();await page.getByRole('button',{name:'Change name',exact:true}).click();await page.getByLabel('Your name',{exact:true}).fill('Synthetic Sam Corrected');await page.getByRole('button',{name:'Join this vote',exact:true}).click();await page.locator('[data-act="submitVote"]').waitFor();assert.equal(q.guests.length,1);assert.equal(q.guests[0].name,'Synthetic Sam Corrected');
   await page.reload();await page.locator('[data-act="submitVote"]').waitFor();assert.equal(await page.getByLabel('Your name',{exact:true}).count(),0);
   if(method==='approval')await page.locator('[data-approval="synthetic-place-0"]').check();
   else if(method==='ranked')for(let i=0;i<3;i++)await page.locator('#rank'+i).selectOption('synthetic-place-'+i);
   else for(let i=0;i<3;i++)await page.locator('[data-act="swipeNo"]').click();
   await page.locator('[data-act="submitVote"]').click();if(method==='approval'){await page.locator('#toast').filter({hasText:'Synthetic vote response lost'}).waitFor();await page.locator('[data-act="submitVote"]').click()}
   await page.getByRole('heading',{name:"You're all voted!"}).waitFor();await page.reload();await page.getByRole('heading',{name:"You're all voted!"}).waitFor();assert.equal(await page.locator('[data-act="resetVote"]').count(),0);assert.equal(q.guests.filter(g=>g.ballot).length,1);
   await page.getByRole('button',{name:'Another guest on this phone?',exact:true}).click();await page.getByLabel('Your name',{exact:true}).fill('Synthetic Riley');await page.getByRole('button',{name:'Join this vote',exact:true}).click();await page.locator('[data-act="submitVote"]').waitFor();
   if(method==='approval')await page.locator('[data-approval="synthetic-place-1"]').check();else if(method==='ranked')for(let i=0;i<3;i++)await page.locator('#rank'+i).selectOption('synthetic-place-'+i);else for(let i=0;i<3;i++)await page.locator('[data-act="swipeNo"]').click();
   await page.locator('[data-act="submitVote"]').click();await page.getByRole('heading',{name:'The results',exact:true}).waitFor();
   if(method==='swipe')await page.getByRole('heading',{name:'Nothing sounds good tonight',exact:true}).waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   assert.equal(await page.evaluate(()=>localStorage.getItem('goodnights_family_token')),owner);assert.equal(await page.evaluate(()=>localStorage.getItem('goodnights_member_token')),null);
   await page.goto('https://goodnights.test/?family='+owner+'&poll='+q.id);await page.getByRole('heading',{name:'The results',exact:true}).waitFor();
   if(method==='approval'){await page.getByRole('button',{name:'🗳️ Start a runoff',exact:true}).click();assert.equal(await page.getByLabel('Voting method',{exact:true}).inputValue(),'ranked');assert.equal((await page.getByLabel('Restaurant names · one per line').inputValue()).split('\n').length,2);await page.goto('https://goodnights.test/?family='+owner+'&poll='+q.id)}
   if(method==='swipe'){await page.getByRole('button',{name:'Start a new shortlist',exact:true}).click();assert.equal(await page.getByLabel('Restaurant names · one per line').inputValue(),'');await page.goto('https://goodnights.test/?family='+owner+'&poll='+q.id)}
   await page.getByRole('button',{name:'Use this dinner again',exact:true}).click();assert.equal((await page.getByLabel('Restaurant names · one per line').inputValue()).split('\n').length,3);assert.equal(await page.getByLabel('How many people will vote?').inputValue(),'2');assert.equal(polls.size,['approval','swipe','ranked'].indexOf(method)+1);
  }
  h.pause();await page.goto('https://goodnights.test/?family='+owner);await page.getByRole('heading',{name:"So... what's for dinner?",exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Start a one-time vote →'}).count(),0);
  const last=[...polls.values()].at(-1);await page.goto('https://goodnights.test/?poll='+last.id+'&join='+last.token);await page.getByRole('heading',{name:'The results',exact:true}).waitFor();
  assert.ok(!calls.some(c=>['gw_get_member','gw_get_my_ballot','gw_add_member','gw_group_poll','gw_vote_as_member','gw_save_restaurant_location'].includes(c.fn)));assert.deepEqual(h.errors,[]);await context.close();
 }
 const demo=await browser.newContext({viewport:{width:390,height:844}});
 await demo.route('**/*',async route=>{const u=new URL(route.request().url());assert.equal(u.hostname,'goodnights.test');assert.ok(!u.pathname.includes('/rest/'));if(u.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:'window.GW_CONFIG={};'});const file=u.pathname==='/'?'index.html':u.pathname.slice(1);assert.ok(!file.includes('..'));return route.fulfill({body:fs.readFileSync(path.join(root,file)),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(file)]||'text/plain'})});
 const page=await demo.newPage();await page.goto('https://goodnights.test/');await page.getByRole('button',{name:'Start a one-time vote →'}).click();await page.getByLabel('Restaurant names · one per line').fill('Demo Pizza\nDemo Tacos');await page.getByLabel('How many people will vote?').fill('1');await page.getByRole('button',{name:'Create & get invitation →'}).click();const invite=page.getByRole('link',{name:'Open invitation',exact:true});await invite.waitFor();await page.goto(await invite.getAttribute('href'));await page.getByLabel('Your name',{exact:true}).fill('Demo guest');await page.getByRole('button',{name:'Join this vote',exact:true}).click();await page.locator('[data-approval]').first().check();await page.locator('[data-act="submitVote"]').click();await page.getByRole('heading',{name:'The results',exact:true}).waitFor();const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('goodnights_demo_v2')));assert.equal(saved.members.length,4);assert.equal(saved.restaurants.filter(r=>r.active).length,8);assert.equal(saved.polls.filter(p=>p.one_time).length,1);await demo.close();
 console.log('PASS: 320/390px all-method one-time polls, corrections/return/shared phone, response-loss retries, status recovery, runoff/repeat/all-no drafts, keyboard/layout, pause-without-breaking-results, plus the actual offline demo; no permanent member/library changes.');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
