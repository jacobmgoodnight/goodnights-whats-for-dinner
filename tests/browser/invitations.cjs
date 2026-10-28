// First/returning group voter. All traffic is intercepted; no real credentials.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.GW_PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launch({channel:process.env.GW_BROWSER_CHANNEL||'msedge',headless:true});
 try{for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true}),calls=[],errors=[];let voted=false;
  const options=['a','b'].map(id=>({id,name:'Synthetic Pizza '+id,category:'Pizza',address:'1 Test St',icon_mode:'builtin',icon_value:'pizza'}));
  const people=()=>[{id:'test-person',name:'Synthetic Sam',avatar:'🙂',active:true,voted},{id:'other-person',name:'Synthetic Riley',avatar:'😎',active:true,voted:false}];
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());assert.equal(u.hostname,'goodnights.test');
   if(u.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:'window.GW_CONFIG={supabaseUrl:"https://goodnights.test",publishableKey:"synthetic"};'});
   if(u.pathname.startsWith('/rest/v1/rpc/')){
    const fn=u.pathname.split('/').pop(),p=route.request().postDataJSON();calls.push({fn,p});let result;
    if(fn==='gw_get_poll')result={id:'test-poll',meal:'Dinner',method:'approval',status:'open',expected_voters:2,voted_count:voted?1:0,roster_enabled:true,allow_member_home:false,options,ballots:null};
    else if(fn==='gw_group_poll'){
     assert.equal(p.p_group_token,'synthetic-group');
     if(p.p_action==='people')result={family_id:'test-family',rostered:true,eligible:!!p.p_member_id,people:people()};
     else if(p.p_action==='identity')result=people().find(x=>x.id===p.p_member_id);
     else if(p.p_action==='has_voted')result=voted;
     else if(p.p_action==='vote'){assert.equal(voted,false);assert.deepEqual(p.p_ballot,['a']);voted=true;result={ok:true}}
     else throw Error('Unexpected action '+p.p_action);
    }else throw Error('Unexpected RPC '+fn);
    return route.fulfill({json:result});
   }
   const file=u.pathname==='/'?'index.html':u.pathname.slice(1);assert.ok(!file.includes('..'));
   return route.fulfill({body:fs.readFileSync(path.join(root,file)),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(file)]||'text/plain'});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://goodnights.test/?poll=test-poll&join=synthetic-group');
  await page.getByRole('heading',{name:"Who's voting? 👋"}).waitFor();await page.locator('[data-id="test-person"]').click();
  await page.locator('[data-approval="a"]').check();await page.locator('[data-act="submitVote"]').click();await page.getByRole('heading',{name:"You're all voted!"}).waitFor();
  await page.reload();await page.getByRole('heading',{name:"You're all voted!"}).waitFor();
  assert.equal(await page.locator('[data-act="resetVote"]').count(),0);assert.equal(await page.locator('.nav').count(),0);
  await page.locator('[data-act="changeGroupMember"]').click();assert.equal(await page.locator('[data-id="test-person"]').isDisabled(),true);
  assert.ok(!calls.some(x=>['gw_get_member','gw_get_family','gw_get_my_ballot','gw_vote_as_member'].includes(x.fn)));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await context.close();
 }console.log('PASS: 320/390px first invitation, vote, remembered acknowledgement, Not you, locked voter and no personal/organizer RPC access.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
