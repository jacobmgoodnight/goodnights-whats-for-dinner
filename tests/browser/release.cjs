// Organizer recovery/repeat checks: fictional local demo, all traffic intercepted.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.GW_PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launch({channel:process.env.GW_BROWSER_CHANNEL||'msedge',headless:true});
 try{
  for(const width of [320,390]){
   const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true});
   const restaurants=[0,1,2].map(i=>({id:'place-'+i,family_id:'fixture-family',name:'Synthetic Pizza '+i,address:i+' Test St',category:'Pizza',active:i<2,icon_mode:'builtin',icon_value:'pizza'}));
   const members=[0,1].map(i=>({id:'person-'+i,name:'Synthetic person '+i,token:'fixture-personal-'+i,active:i===0,avatar:'🙂'}));
   const source={id:'old-fixture',family_id:'fixture-family',meal:'Dinner',method:'swipe',cuisine:'pizza',expected_voters:2,status:'closed',created_at:'2026-10-01T12:00:00Z',restaurant_ids:restaurants.map(r=>r.id),member_ids:members.map(m=>m.id),allow_member_home:true,group_join_token:'fixture-old-group'};
   const fixture={family:{id:'fixture-family',name:'Synthetic family',token:'fixture-owner'},restaurants,members,polls:[source],ballots:{[source.id]:Object.fromEntries(members.map(m=>[m.id,{ballot:Object.fromEntries(restaurants.map(r=>[r.id,false]))}]))}};
   await context.addInitScript(data=>localStorage.setItem('goodnights_demo_v2',JSON.stringify(data)),fixture);
   let external=0;await context.route('**/*',async route=>{
    const u=new URL(route.request().url());if(u.hostname!=='goodnights.test'){external++;return route.abort()}
    if(u.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:'window.GW_CONFIG={};'});
    const file=u.pathname==='/'?'index.html':u.pathname.slice(1);if(!/^[\w./-]+$/.test(file)||file.includes('..'))return route.abort();
    try{return route.fulfill({body:fs.readFileSync(path.join(root,file)),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(file)]||'text/plain'})}catch{return route.abort()}
   });
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const store=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('goodnights_demo_v2')));
   await page.goto('https://goodnights.test/');
   await page.locator('.nav [data-page="history"]').click();await page.locator('[data-act="openpoll"]').click();
   await page.getByRole('heading',{name:'Nothing sounds good tonight'}).waitFor();
   assert.equal(await page.locator('[data-act="randomTie"],[data-act="runoff"],.trophy,.celebration').count(),0);
   await page.locator('[data-act="newShortlist"]').click();
   assert.match(await page.locator('.wizard-count').innerText(),/0 places/);
   assert.equal((await store()).polls.length,1);
   await page.locator('.nav [data-page="history"]').click();await page.locator('[data-act="repeatDinner"]').click();
   await page.getByRole('heading',{name:'Use this dinner again.'}).waitFor();
   const draft=page.locator('[aria-label="Dinner draft"]');
   assert.match(await draft.innerText(),/Synthetic Pizza 2/);assert.match(await draft.innerText(),/Synthetic person 1/);
   assert.equal((await store()).polls.length,1);
   assert.equal(await page.locator('[data-act="createPoll"]').isEnabled(),true);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.locator('[data-act="cancelRepeat"]').click();assert.deepEqual((await store()).polls,[source]);
   await page.locator('[data-act="repeatDinner"]').click();await page.locator('[data-act="createPoll"]').click();
   await page.locator('[data-act="shareGroupInvite"]').waitFor();
   const saved=await store(),fresh=saved.polls.find(p=>p.id!==source.id);
   assert.ok(fresh);assert.notEqual(fresh.group_join_token,source.group_join_token);assert.equal(fresh.cuisine,'pizza');assert.equal(fresh.method,'swipe');assert.deepEqual(fresh.restaurant_ids,['place-0','place-1']);assert.deepEqual(fresh.member_ids,['person-0']);assert.equal(fresh.tie_winner_id,undefined);assert.deepEqual(saved.ballots[fresh.id],{});
   assert.deepEqual(saved.polls.find(p=>p.id===source.id),source);assert.deepEqual(saved.ballots[source.id],fixture.ballots[source.id]);
   assert.equal(external,0);assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS: 320/390px organizer all-no recovery, calm results/no draw, repeat omissions, editable/cancelled draft, explicit fresh creation, original poll/ballots preserved, no external requests.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
