// Optional browser verification of the real local-demo UI. All network is intercepted.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.GW_PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launch({channel:process.env.GW_BROWSER_CHANNEL||'msedge',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:320,height:844},hasTouch:true,isMobile:true});
  const fixture={family:{id:'fixture-family',name:'Fixture',token:'synthetic-owner'},members:[],polls:[],ballots:{},restaurants:[1,2].map(i=>({id:'fixture-'+i,family_id:'fixture-family',name:'Chain',category:'Pizza',address:i+' Oak St',active:true,osm_id:i===1?'node/1':null,latitude:i===1?40:null,longitude:i===1?-86:null,icon_mode:'builtin',icon_value:'pizza'}))};
  await context.addInitScript(data=>localStorage.setItem('goodnights_demo_v2',JSON.stringify(data)),fixture);
  let online=0;const errors=[];
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname!=='goodnights.test'){online++;return route.fulfill({status:503,body:'Synthetic search failure'})}
   if(u.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:'window.GW_CONFIG={};'});
   const file=u.pathname==='/'?'index.html':u.pathname.slice(1);if(!/^[\w./-]+$/.test(file)||file.includes('..'))return route.abort();
   const type=({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(file)]||'text/plain';
   try{return route.fulfill({body:fs.readFileSync(path.join(root,file)),contentType:type})}catch{return route.abort()}
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('https://goodnights.test/');
  await page.locator('.nav [data-act="nav"][data-page="restaurants"]').click();await page.locator('[data-act="toggleDiscovery"]').click();
  await page.locator('#localName').fill('Chain');assert.match(await page.locator('#localSavedSuggestions').innerText(),/1 Oak St/);assert.match(await page.locator('#localSavedSuggestions').innerText(),/2 Oak St/);assert.equal(online,0);
  await page.locator('[data-act="toggleAdd"]').click();await page.locator('#restName').fill('Chain');await page.locator('#manualAddress').fill('3 Oak St');await page.locator('[data-act="addManual"]').click();
  await page.locator('#locationReview').waitFor();assert.equal(await page.evaluate(()=>document.activeElement.id),'locationReview');
  assert.match(await page.locator('#locationReview').innerText(),/Possible duplicate/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=321));
  const restaurants=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('goodnights_demo_v2')).restaurants);
  assert.equal((await restaurants()).length,2);
  if(process.env.GW_LOCATION_SCREENSHOT)await page.locator('#locationReview').screenshot({path:process.env.GW_LOCATION_SCREENSHOT});
  await page.locator('[data-act="confirmLocation"]').click();assert.equal((await restaurants()).length,3);assert.equal((await restaurants())[0].id,'fixture-1');
  await page.locator('[data-act="addManual"]').click();assert.match(await page.locator('#locationReview').innerText(),/Already saved/);
  await page.locator('#locationReview .item').filter({hasText:'3 Oak St'}).locator('[data-act="useSavedLocation"]').click();assert.equal((await restaurants()).length,3);
  await page.locator('#restName').fill('Draft');await page.locator('#manualAddress').fill('8 Draft St');await page.locator('[data-act="townSearch"]').click();
  await page.locator('#toast').filter({hasText:'temporarily unavailable'}).waitFor();assert.equal(await page.locator('#restName').inputValue(),'Draft');assert.equal(await page.locator('#manualAddress').inputValue(),'8 Draft St');assert.equal(online,1);
  await page.locator('[data-act="editRestaurant"][data-id="fixture-1"]').click();await page.locator('#editAddress').fill('9 Changed St');page.once('dialog',d=>d.dismiss());await page.locator('[data-act="saveRestaurant"]').click();assert.equal((await restaurants())[0].address,'1 Oak St');
  page.once('dialog',d=>d.accept());await page.locator('[data-act="saveRestaurant"]').click();const changed=(await restaurants())[0];assert.equal(changed.id,'fixture-1');assert.equal(changed.osm_id,null);assert.equal(changed.latitude,null);assert.equal(changed.longitude,null);
  assert.deepEqual(errors,[]);await context.close();console.log('PASS: 320px real browser: local suggestions without requests, review/focus, separate branch, exact reuse, search-failure draft retention, and confirmed address-edit coordinate clearing.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
