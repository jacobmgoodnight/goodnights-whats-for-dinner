// Non-destructive deployed check: public assets/welcome and deliberately INVALID credentials.
// Never accepts a family/member token. Does not create a family/poll or submit a ballot.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),base='https://jacobmgoodnight.github.io/goodnights-whats-for-dinner/';
const config={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'config.js'),'utf8'),config);
const {supabaseUrl,publishableKey}=config.window.GW_CONFIG;
const headers={'Content-Type':'application/json',apikey:publishableKey,Authorization:'Bearer '+publishableKey};
(async()=>{
 for(const [fn,p,expected] of [
  ['gw_save_restaurant_location',{p_token:'invalid-release-check',p_name:'No write permitted'},/Family access denied/],
  ['gw_resolve_tie_random',{p_token:'invalid-release-check',p_poll_id:'00000000-0000-4000-8000-000000000000'},/Organizer access denied/],
  ['gw_add_restaurant',{p_token:'invalid-release-check',p_name:'No write permitted'},/Family access denied/]
 ]){
  const response=await fetch(supabaseUrl+'/rest/v1/rpc/'+fn,{method:'POST',headers,body:JSON.stringify(p)});
  const body=await response.text();assert.equal(response.status,400,fn+' endpoint status');assert.match(body,expected);
 }
 console.log('PASS: live PostgREST resolves both migrated RPCs and guarded legacy signature; invalid credentials rejected before writes.');
 if(process.argv.includes('--api-only'))return;
 for(const file of ['index.html','app.js','maps.js','voting.js','family.js','logos.js','styles.css','config.js']){
  const response=await fetch(base+file+'?release-check=20261021',{cache:'no-store'});assert.equal(response.status,200,file);
  const actual=(await response.text()).replace(/\r\n/g,'\n'),expected=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');assert.equal(actual,expected,file+' differs from tested source');
 }
 const {chromium}=require(process.env.GW_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:320,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(base,{waitUntil:'networkidle'});
  assert.match(await page.locator('body').innerText(),/goodnights/i);assert.equal(await page.locator('.nav').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--orange').trim()),'#f66f40');
  assert.deepEqual(errors,[]);await context.close();
 }finally{await browser.close()}
 console.log('PASS: deployed Pages assets match tested source; clean-session 320px welcome loads without JS errors/overflow and preserves original palette.');
})().catch(e=>{console.error(e);process.exitCode=1});
