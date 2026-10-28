// Synthetic backend, all traffic intercepted. No production URLs or records.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require(process.env.GW_PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'../..');
(async()=>{const browser=await chromium.launch({channel:process.env.GW_BROWSER_CHANNEL||'msedge',headless:true});
 try{for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',timezoneId:'America/New_York'}),calls=[],errors=[],meals=[];let failSave=false,failHistory=false;
  const places=['a','b','c','d'].map((id,i)=>({id,name:i<2?'Synthetic Pizza '+id:'Synthetic Tacos '+id,category:i<2?'Pizza':'Mexican',address:i+' Test St',icon_mode:'builtin',icon_value:'pizza'}));
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());assert.equal(u.hostname,'goodnights.test');
   if(u.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:'window.GW_CONFIG={supabaseUrl:"https://goodnights.test",publishableKey:"synthetic"};'});
   if(u.pathname.startsWith('/rest/v1/rpc/')){
    const fn=u.pathname.split('/').pop(),p=route.request().postDataJSON();calls.push({fn,p});let result;
    if(fn==='gw_get_family')result={id:'synthetic-family',name:'Synthetic family',restaurants:places,polls:[{id:'finished-test',meal:'Dinner',method:'approval',status:'closed',voted_count:1,expected_voters:1,created_at:'2026-10-01T12:00:00Z'}]};
    else if(fn==='gw_get_poll')result={id:'finished-test',meal:'Dinner',method:'approval',status:'closed',voted_count:1,expected_voters:1,options:places,ballots:[['a']],created_at:'2026-10-01T12:00:00Z'};
    else if(fn==='gw_get_poll_people')result={rostered:false,eligible:false,people:[]};
    else if(fn==='gw_poll_settings')result={allow_member_home:false,group_join_token:null};
    else if(fn==='gw_list_members')result=[];
    else if(fn==='gw_planning_home')result={ready:true,active_polls:[],presets:[],nominations:[],events:[]};
    else if(fn==='gw_push_status')result={configured:false,enabled:false};
    else if(fn==='gw_meal_history'){
     if(failHistory)return route.fulfill({status:503,json:{message:'Synthetic unavailable'}});
     const latest={};for(const m of meals)if(!latest[m.restaurant_id]||m.eaten_on>latest[m.restaurant_id])latest[m.restaurant_id]=m.eaten_on;
     result={last_eaten:latest,meals:meals.map(m=>({...places.find(r=>r.id===m.restaurant_id),...m}))};
    }else if(fn==='gw_save_meal'){
     if(failSave){failSave=false;return route.fulfill({status:503,json:{message:'Synthetic save failed'}})}
     const m={id:p.p_meal_id,restaurant_id:p.p_restaurant_id,eaten_on:p.p_eaten_on,poll_id:p.p_poll_id};const at=meals.findIndex(x=>x.id===m.id);if(at<0)meals.push(m);else meals[at]=m;result=m.id;
    }else if(fn==='gw_delete_meal'){meals.splice(meals.findIndex(m=>m.id===p.p_meal_id),1);result=true}
    else throw Error('Unexpected RPC '+fn);
    return route.fulfill({json:result});
   }
   const file=u.pathname==='/'?'index.html':u.pathname.slice(1);assert.ok(!file.includes('..'));
   return route.fulfill({body:fs.readFileSync(path.join(root,file)),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(file)]||'text/plain'});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://goodnights.test/?family=synthetic-owner');await page.getByRole('button',{name:'Pick dinner for us',exact:true}).click();
  await page.locator('.quick-choice').waitFor();assert.equal(await page.locator('.quick-choice').count(),1);assert.equal(meals.length,0);
  const first=await page.locator('.quick-choice h2').innerText();await page.locator('[data-act="quickThree"]').click();await page.waitForFunction(()=>document.querySelectorAll('.quick-choice').length===3);assert.ok(!(await page.locator('.quick-choice h2').allTextContents()).includes(first));
  assert.equal(await page.locator('[data-act="quickPick"]').isDisabled(),true);
  await page.locator('.quick-filters summary').click();await page.evaluate(()=>window.cuisineSelect=document.getElementById('quickCuisine'));await page.locator('#quickCuisine').selectOption('pizza');assert.equal(await page.evaluate(()=>window.cuisineSelect===document.getElementById('quickCuisine')),true);
  await page.locator('.quick-choice [data-act="recordMeal"]').click();await page.getByRole('heading',{name:'We ate here',exact:true}).waitFor();
  const date=await page.locator('#mealDate').inputValue();assert.match(date,/^\d{4}-\d{2}-\d{2}$/);assert.equal(date,await page.locator('#mealDate').getAttribute('max'));
  await page.locator('#mealDate').fill('2026-10-07');failSave=true;await page.locator('[data-act="saveMeal"]').click();await page.locator('#toast').filter({hasText:'Synthetic save failed'}).waitFor();assert.equal(await page.locator('#mealDate').inputValue(),'2026-10-07');
  await page.locator('[data-act="saveMeal"]').click();await page.locator('.meal-row').waitFor();assert.equal(meals.length,1);const saves=calls.filter(x=>x.fn==='gw_save_meal');assert.equal(saves[0].p.p_meal_id,saves[1].p.p_meal_id);assert.equal(meals[0].poll_id,null);
  await page.locator('[data-act="editMeal"]').click();await page.locator('#mealPlace').selectOption('d');await page.locator('[data-act="saveMeal"]').click();await page.locator('.meal-row').filter({hasText:'Synthetic Tacos d'}).waitFor();assert.equal(meals.length,1);assert.equal(meals[0].restaurant_id,'d');
  await page.locator('.nav [data-page="restaurants"]').click();await page.getByRole('heading',{name:'Your saved favorites'}).waitFor();assert.match(await page.locator('.item').filter({hasText:'Synthetic Tacos d'}).innerText(),/Last eaten/);
  await page.locator('[data-act="openMeals"]').click();page.once('dialog',d=>d.accept());await page.locator('[data-act="deleteMeal"]').click();await page.getByText('No confirmed meals to show yet.').waitFor();assert.equal(meals.length,0);assert.equal(places.length,4);
  await page.locator('.nav [data-page="history"]').click();await page.locator('[data-act="openpoll"]').click();await page.locator('.winner h1').filter({hasText:'Synthetic Pizza a'}).waitFor();assert.equal(meals.length,0);
  await page.locator('[data-act="recordMeal"]').click();await page.locator('[data-act="saveMeal"]').click();await page.locator('.meal-row').waitFor();assert.equal(meals[0].poll_id,'finished-test');
  page.once('dialog',d=>d.accept());await page.locator('[data-act="deleteMeal"]').click();await page.getByText('No confirmed meals to show yet.').waitFor();
  failHistory=true;await page.locator('.nav [data-page="home"]').click();await page.getByRole('button',{name:'Pick dinner for us',exact:true}).click();assert.match(await page.locator('.quick-filters').innerText(),/saved places only/);assert.equal(await page.locator('#quickRecent').isDisabled(),true);failHistory=false;await page.locator('[data-act="refreshMeals"]').click();await page.waitForFunction(()=>!document.getElementById('quickRecent').disabled);
  assert.ok(!calls.some(x=>/create_poll|create_dinner|vote_as_member/.test(x.fn)));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(os.tmpdir(),'gw-quick-pick-'+width+'.png'),fullPage:true});await context.close();
 }console.log('PASS: 320/390px no-poll decisions, non-repeating alternatives, native cuisine select retained, date-only capture, failed-save retry identity, correction/deletion, last-eaten labels, history failure/fallback and no poll writes.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
