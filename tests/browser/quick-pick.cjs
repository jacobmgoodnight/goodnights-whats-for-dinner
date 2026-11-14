// Quick Pick on small phones; intercepted synthetic service only, no database credentials.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require(process.env.GW_PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'../..');
const restaurants=[['Synthetic Slice','Pizza'],['Synthetic Pie','Pizza'],['Synthetic Taqueria','Mexican'],['Synthetic Burger Stand','Burgers'],['Synthetic Noodle House With A Very Long Name','Asian']].map(([name,category],i)=>({id:'00000000-0000-4000-8000-00000000000'+i,name,category,address:i+' Synthetic Street, Testville',active:true}));
(async()=>{const browser=await chromium.launch({channel:process.env.GW_BROWSER_CHANNEL||'msedge',headless:true});try{
 for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true}),calls=[];
  await context.addInitScript(()=>localStorage.setItem('goodnights_family_token','synthetic-organizer-'+'x'.repeat(40)));
  await context.route('**/*',async route=>{const u=new URL(route.request().url());
   if(u.hostname!=='goodnights.test')return route.abort();
   if(u.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:'window.GW_CONFIG={supabaseUrl:"https://goodnights.test",publishableKey:"synthetic"};'});
   if(u.pathname.startsWith('/rest/v1/rpc/')){const fn=u.pathname.split('/').pop();calls.push(fn);
    if(fn==='gw_get_family')return route.fulfill({json:{id:'synthetic-family',name:'Synthetic family',restaurants,polls:[]}});
    if(fn==='gw_planning_home')return route.fulfill({json:{ready:true,active_polls:[],presets:[],nominations:[],events:[]}});
    if(fn==='gw_push_status')return route.fulfill({json:{configured:false,enabled:false}});
    if(fn==='gw_list_members')return route.fulfill({json:[{id:'synthetic-person',name:'Synthetic Sam',avatar:'🙂',active:true}]});
    throw Error('Unexpected RPC '+fn);
   }
   const file=u.pathname==='/'?'index.html':u.pathname.slice(1);assert.ok(!file.includes('..'));if(!fs.existsSync(path.join(root,file)))return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(path.join(root,file)),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(file)]||'text/plain'});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('https://goodnights.test/');
  await page.getByRole('button',{name:'Start a family vote →'}).waitFor();await page.screenshot({path:path.join(os.tmpdir(),'gw-quick-pick-home-'+width+'.png')});
  await page.getByRole('button',{name:'⚡ Quick pick'}).click();await page.getByRole('heading',{name:'Let’s eat here.'}).waitFor();
  const first=await page.locator('.quick-choice h2').innerText();assert.ok(restaurants.some(r=>r.name===first));
  const maps=await page.getByRole('link',{name:'Open '+first+' in Maps'}).getAttribute('href');assert.match(maps,/^https:\/\/www\.google\.com\/maps\/search\//);assert.doesNotMatch(maps,/synthetic-organizer/);
  await page.screenshot({path:path.join(os.tmpdir(),'gw-quick-pick-'+width+'.png'),fullPage:true});
  await page.getByRole('button',{name:'Try another'}).click();assert.notEqual(await page.locator('.quick-choice h2').innerText(),first);
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.act),'quickNext');
  const select=await page.locator('#quickCuisine').elementHandle();await page.selectOption('#quickCuisine','pizza');
  assert.ok(await select.evaluate(node=>node.isConnected),'native cuisine select must stay in place');
  assert.match(await page.locator('.quick-choice h2').innerText(),/Synthetic (Slice|Pie)/);
  await page.selectOption('#quickCuisine','');await page.getByRole('button',{name:'Show me 3'}).click();assert.equal(await page.locator('.quick-choice').count(),3);
  await page.screenshot({path:path.join(os.tmpdir(),'gw-quick-pick-three-'+width+'.png'),fullPage:true});
  for(const target of await page.locator('.quick-choice .btn, .quick-actions .btn, .quick-vote').all()){const box=await target.boundingBox();assert.ok(box.height>=44,'touch target '+box.height)}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal scroll at '+width);
  await page.getByRole('button',{name:/Let the family vote on these 3/}).click();await page.locator('#toast').filter({hasText:'3 places shortlisted'}).waitFor();
  assert.equal(await page.locator('[data-select]:checked').count(),3);
  assert.ok(!calls.some(fn=>/create|save|delete|vote/.test(fn)),'Quick Pick must not write: '+calls.join(','));assert.deepEqual(errors,[]);await context.close();
 }console.log('PASS: Quick Pick 320/390px — one tap from Home, Maps link without credentials, Try another, in-place native cuisine select, three options, 44px targets, no horizontal scroll, editable vote draft, zero writes.');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
