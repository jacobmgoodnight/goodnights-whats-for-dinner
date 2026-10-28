// Invitation-first welcome; intercepted synthetic service only.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require(process.env.GW_PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'../..');
(async()=>{const browser=await chromium.launch({channel:process.env.GW_BROWSER_CHANNEL||'msedge',headless:true});try{
 for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true}),calls=[];const member='a'.repeat(48);
  await context.route('**/*',async route=>{const u=new URL(route.request().url());assert.equal(u.hostname,'goodnights.test');
   if(u.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:'window.GW_CONFIG={supabaseUrl:"https://goodnights.test",publishableKey:"synthetic"};'});
   if(u.pathname.startsWith('/rest/v1/rpc/')){const fn=u.pathname.split('/').pop(),p=route.request().postDataJSON();calls.push(fn);
    if(fn==='gw_get_member')return route.fulfill({json:{id:'synthetic-person',name:'Synthetic Sam',avatar:'🙂',family:{id:'synthetic-family',name:'Synthetic family',restaurants:[],polls:[]}}});
    if(fn==='gw_planning_home')return route.fulfill({json:{ready:false}});throw Error('Unexpected RPC '+fn);
   }
   const file=u.pathname==='/'?'index.html':u.pathname.slice(1);assert.ok(!file.includes('..'));return route.fulfill({body:fs.readFileSync(path.join(root,file)),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(file)]||'text/plain'});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('https://goodnights.test/');
  await page.getByLabel('Your invitation link',{exact:true}).waitFor();assert.equal(await page.locator('[data-act="newFamily"]').isVisible(),false);assert.equal(calls.length,0);
  await page.screenshot({path:path.join(os.tmpdir(),'gw-onboarding-'+width+'.png'),fullPage:true});
  await page.getByRole('button',{name:'Connect my invitation'}).click();await page.locator('#toast').filter({hasText:'Paste your invitation link'}).waitFor();
  await page.getByLabel('Your invitation link',{exact:true}).fill('https://other.test/?member='+member);await page.getByRole('button',{name:'Connect my invitation'}).click();await page.locator('#toast').filter({hasText:'Use an invitation link for this Goodnights app'}).waitFor();assert.equal(calls.length,0);
  await page.getByLabel('Your invitation link',{exact:true}).fill('https://goodnights.test/?member='+member);await page.getByRole('button',{name:'Connect my invitation'}).click();await page.getByRole('heading',{name:'Your family votes.'}).waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('goodnights_member_token')),member);await page.reload();await page.getByRole('heading',{name:'Your family votes.'}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);assert.ok(!calls.includes('gw_create_family'));await context.close();
 }console.log('PASS: invitation-first 320/390px welcome, labeled URL field, hidden household setup, empty/foreign-link recovery, personal connection and same-phone return.');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
