// Optional real-browser QA; routes every request to synthetic fixtures or local files.
// No server, production credentials, API, or external image requests are used.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require(process.env.GW_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),before=process.argv.find(a=>a.startsWith('--before='))?.split('=')[1];
const out=path.join(root,'docs/qa/q1-h3',before?'before':'after');fs.mkdirSync(out,{recursive:true});
const asset=file=>before?execFileSync(process.env.GW_GIT||'git',['show',before+':'+file],{cwd:root}):fs.readFileSync(path.join(root,file));
const options=[
 {id:'a',name:'Cedar & Stone Pizza',category:'Pizza',address:'14 Oak Street, Eastfield'},
 {id:'b',name:'Cedar & Stone Pizza',category:'Pizza',address:'220 River Road, Westfield'},
 {id:'c',name:'Market Street Kitchen',category:'American',address:''},
 {id:'d',name:'Garden Noodle House',category:'Asian',address:'18 Very Long Garden Avenue, Suite 200, Eastfield'},
 {id:'e',name:'The Corner Café',category:'Café',address:'75 Market Square, Westfield'}
].map(r=>({...r,icon_mode:'builtin',icon_value:'pizza'}));
async function fixture(browser,method,{width=390,height=844,reducedMotion='no-preference',brokenLogo=false}={}){
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion}),page=await context.newPage(),calls=[],errors=[];
 let ballot=null,failSave=false;
 const ballotOptions=options.map((r,i)=>brokenLogo&&i===0?{...r,icon_mode:'logo_url',icon_value:'https://broken-image.test/logo.png'}:r);
 const poll=()=>({id:'synthetic-poll',method,meal:'Dinner',status:'open',options:ballotOptions,voted_count:ballot?1:0,expected_voters:3,roster_enabled:true,allow_member_home:false,ballots:null});
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname!=='goodnights.test')return route.abort();
  if(url.pathname.startsWith('/rest/v1/rpc/')){
   const fn=url.pathname.split('/').pop(),p=route.request().postDataJSON();calls.push({fn,p});let result;
   if(fn==='gw_get_poll')result=poll();
   else if(fn==='gw_get_member')result={id:'fixture-member',name:'Taylor (test)',avatar:'🙂',family:{name:'Synthetic family',restaurants:options,polls:[poll()]}};
   else if(fn==='gw_get_poll_people')result={rostered:true,eligible:true,people:[{id:'fixture-member',name:'Taylor (test)',avatar:'🙂',active:true,voted:!!ballot}]};
   else if(fn==='gw_member_has_voted')result=!!ballot;
   else if(fn==='gw_get_my_ballot')result=ballot;
   else if(fn==='gw_vote_as_member'){
    if(failSave)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic connection failure. Try again.'})});
    ballot=p.p_ballot;result={ok:true};
   }else throw Error('Unexpected fixture RPC '+fn);
   return route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
  }
  if(url.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:'window.GW_CONFIG={supabaseUrl:location.origin,publishableKey:"synthetic-fixture"};'});
  const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(!/^[\w./-]+$/.test(file)||file.includes('..'))return route.abort();
  try{return route.fulfill({body:asset(file),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(file)]||'text/plain'})}catch{return route.abort()}
 });
 await page.goto('http://goodnights.test/?member=synthetic-fixture&poll=synthetic-poll');
 await page.locator('[data-act="submitVote"]').waitFor();
 const heading=page.getByRole('heading',{name:method==='approval'?'Pick up to 2':method==='ranked'?'Rank your top 3':'Dinner plans?'});
 const card=method==='swipe'?page.locator('#swipeCard').locator('..'):heading.locator('..');
 await card.evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-16));
 return {context,page,calls,errors,card,setFailSave:value=>failSave=value,get ballot(){return ballot}};
}
(async()=>{
 const browser=await chromium.launch({channel:process.env.GW_BROWSER_CHANNEL||'msedge',headless:true});
 try{
  for(const method of ['approval','swipe','ranked']){
   const h=await fixture(browser,method);
   await h.page.screenshot({path:path.join(out,method+'-390.png')});
   assert.equal(h.errors.length,0);await h.context.close();
  }
  if(before){console.log('Captured synthetic baseline screenshots at '+before);return}
  for(const width of [320,375,390,430])for(const method of ['approval','swipe','ranked']){
   const h=await fixture(browser,method,{width});
   if(method==='ranked')await h.page.locator('.ballot-places summary').click();
   assert.ok(await h.page.evaluate(width=>document.documentElement.scrollWidth<=width+1,width),method+' overflow at '+width);
   assert.ok((await h.page.locator('[data-act="submitVote"]').boundingBox()).height>=44);
   assert.match(await h.card.innerText(),method==='ranked'?/places and locations/:/14 Oak Street, Eastfield/);
   assert.equal(h.errors.length,0);await h.context.close();
  }
  for(const method of ['approval','swipe','ranked']){
   const h=await fixture(browser,method);
   if(method==='approval'){
    await h.page.locator('[data-approval="a"]').focus();await h.page.keyboard.press('Space');
    assert.equal(await h.page.evaluate(()=>document.activeElement.dataset.approval),'a');
    assert.equal(await h.page.locator('[data-approval="a"]').isChecked(),true);
    assert.notEqual(await h.page.locator('[data-approval="a"]').evaluate(el=>getComputedStyle(el).outlineStyle),'none');
   }else if(method==='ranked'){
    await h.page.locator('#rank0').focus();await h.page.evaluate(()=>window.originalRank=document.getElementById('rank0'));
    for(const [i,id] of ['a','b','c'].entries())await h.page.locator('#rank'+i).selectOption(id);
    assert.equal(await h.page.evaluate(()=>window.originalRank===document.getElementById('rank0')),true);
    assert.equal(await h.page.evaluate(()=>document.activeElement.id),'rank0');
    assert.match(await h.page.locator('#rankDetails0').innerText(),/14 Oak Street/);
    assert.match(await h.page.locator('#rankDetails2').innerText(),/Location not saved/);
    assert.match(await h.page.locator('#rank0 option[value="b"]').innerText(),/220 River Road/);
    await h.page.locator('#rank0').selectOption('b');assert.equal(await h.page.locator('#rank1').inputValue(),'');
    await h.page.locator('#rank0').selectOption('a');await h.page.locator('#rank1').selectOption('b');
    await h.page.locator('#rank0').focus();await h.page.keyboard.press('Tab');
    assert.equal(await h.page.evaluate(()=>document.activeElement.id),'rank1');
   }else{
    const count=h.calls.length;
    await h.page.locator('[data-act="swipeYes"]').focus();await h.page.keyboard.press('Enter');
    assert.equal(await h.page.evaluate(()=>document.activeElement.dataset.act),'swipeYes');
    for(let i=0;i<4;i++)await h.page.locator('[data-act="swipeNo"]').click();
    assert.match(await h.card.innerText(),/All restaurants answered/);assert.equal(h.calls.length,count);
    await h.page.locator('[data-act="swipeBack"]').click();assert.match(await h.card.innerText(),/Garden Noodle House/);
    await h.page.locator('[data-act="swipeNo"]').click();
    assert.equal(h.ballot,null); // Answering, backtracking and animations never submit.
   }
   h.setFailSave(true);await h.page.locator('[data-act="submitVote"]').click();
   await h.page.getByRole('status').filter({hasText:'Synthetic connection failure'}).waitFor();
   assert.equal(h.ballot,null);assert.equal(await h.page.locator('.vote-celebration').count(),0);
   assert.equal(await h.page.locator('[data-act="submitVote"]').isEnabled(),true);
   h.setFailSave(false);await h.page.locator('[data-act="submitVote"]').click();await h.page.getByRole('heading',{name:"You're all voted!"}).waitFor();
   assert.deepEqual(h.ballot,method==='approval'?['a']:method==='ranked'?['a','b','c']:{a:true,b:false,c:false,d:false,e:false});
   assert.equal(h.errors.length,0);await h.context.close();
  }
  for(const reducedMotion of ['no-preference','reduce']){
   const h=await fixture(browser,'swipe',{reducedMotion}),cdp=await h.context.newCDPSession(h.page);
   let box=await h.page.locator('#swipeCard').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
   const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
   const initialY=await h.page.evaluate(()=>scrollY);
   await touch('touchStart',[{x,y}]);await touch('touchMove',[{x:x+18,y:y-110}]);await touch('touchEnd',[]);
   assert.match(await h.card.innerText(),/0 of 5 answered/);
   assert.ok(await h.page.evaluate(()=>scrollY)>initialY,'vertical gesture must scroll');
   await h.card.evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+scrollY-16));
   box=await h.page.locator('#swipeCard').boundingBox();x=box.x+box.width/2-30;y=box.y+box.height/2;
   await touch('touchStart',[{x,y}]);await touch('touchMove',[{x:x+90,y:y+3}]);
   await h.page.locator('#swipeCard[data-direction="yes"]').waitFor();
   assert.match(await h.page.locator('.swipe-direction').innerText(),/Sounds good/);
   if(reducedMotion==='reduce')assert.equal(await h.page.locator('#swipeCard').evaluate(el=>getComputedStyle(el).transform),'none');
   await h.page.screenshot({path:path.join(out,'swipe-feedback-'+reducedMotion+'.png')});
   await touch('touchEnd',[]);assert.match(await h.card.innerText(),/1 of 5 answered/);
   await touch('touchStart',[{x,y}]);await touch('touchMove',[{x:x-90,y}]);await touch('touchCancel',[]);
   assert.match(await h.card.innerText(),/1 of 5 answered/);assert.equal(await h.page.locator('#swipeCard').getAttribute('data-direction'),null);
   assert.equal(h.errors.length,0);await h.context.close();
  }
  for(const size of [{width:844,height:390},{width:390,height:420}])for(const method of ['approval','swipe','ranked']){
   const h=await fixture(browser,method,size);assert.ok(await h.page.evaluate(width=>document.documentElement.scrollWidth<=width+1,size.width));
   await h.page.addStyleTag({content:'.ballot-actions{padding-bottom:46px}'}); // 34px safe-area padding simulation.
   await h.page.locator('[data-act="submitVote"]').scrollIntoViewIfNeeded();
   const box=await h.page.locator('[data-act="submitVote"]').boundingBox();assert.ok(box.y>=0&&box.y+box.height<=size.height-33);
   await h.context.close();
  }
  const fallback=await fixture(browser,'approval',{brokenLogo:true});
  assert.equal(await fallback.page.locator('.item').first().locator('[data-restaurant-logo]').isHidden(),true);
  assert.equal(await fallback.page.locator('.item').first().locator('.restaurant-logo-fallback').isVisible(),true);
  await fallback.context.close();
  // A deterministic 200% text-size simulation; physical browser text-size settings still need device QA.
  for(const method of ['approval','swipe','ranked']){
   const h=await fixture(browser,method,{width:320});
   await h.page.evaluate(()=>{const sizes=Array.from(document.querySelectorAll('body *')).map(el=>[el,parseFloat(getComputedStyle(el).fontSize)]);for(const [el,size] of sizes)el.style.fontSize=size*2+'px'});
   assert.ok(await h.page.evaluate(()=>document.documentElement.scrollWidth<=321),method+' 200% text overflow');
   if(method==='swipe')await h.page.screenshot({path:path.join(out,'swipe-320-text-200.png'),fullPage:true});
   await h.context.close();
  }
  console.log('PASS: synthetic Edge browser QA: 320/375/390/430px × all methods; landscape and short viewport; 200% text simulation; keyboard focus/native select retention; actual vertical/horizontal/cancelled touches; reduced motion; backtracking; failed saves/retries and unchanged payloads.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
