const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const listeners={},store={};
const html={innerHTML:'',addEventListener:(name,fn)=>listeners[name]=fn};
const badge={textContent:''},toast={textContent:'',classList:{add(){},remove(){}}};
const dom={app:html,modeBadge:badge,toast,brand:{addEventListener(){}}};
const context={
 crypto:webcrypto,console,URL,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
 confirm:()=>true,prompt:()=>null,
 localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]},
 document:{getElementById:id=>dom[id]||null},
 location:{href:'https://example.github.io/goodnights/',pathname:'/goodnights/'},
 history:{replaceState(){}},navigator:{},window:{scrollTo(){}}
};
vm.createContext(context);
// Force local demo regardless of the real production API configuration.
vm.runInContext('window.GW_CONFIG={}',context);
for(const file of ['voting.js','maps.js','logos.js','family.js','app.js'])
 vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),context,{filename:file});
function tick(){return new Promise(resolve=>setImmediate(resolve))}
async function click(act,data={}){
 await listeners.click({target:{closest:()=>({dataset:{act,...data}})}});await tick()
}
(async()=>{
 await tick();
 assert.match(html.innerHTML,/So\.\.\. what's for dinner/);
 await click('nav',{page:'restaurants'});
 assert.match(html.innerHTML,/Your saved favorites/);
 assert.doesNotMatch(html.innerHTML,/Find local restaurants/);
 await click('toggleDiscovery');
 assert.match(html.innerHTML,/Find local restaurants/);
 assert.match(html.innerHTML,/Find it on Google Maps/);
 assert.match(html.innerHTML,/class="logo-symbol"|data-restaurant-logo/);
 const logo={matches:()=>true,naturalWidth:16,naturalHeight:16,style:{},hidden:false,nextElementSibling:{hidden:true}};
 listeners.load({target:logo});
 assert.equal(logo.style.maxWidth,'16px');
 assert.equal(logo.style.maxHeight,'16px');
 listeners.error({target:logo});
 assert.equal(logo.hidden,true);
 assert.equal(logo.nextElementSibling.hidden,false);
 const largeLogo={matches:()=>true,naturalWidth:512,naturalHeight:256,style:{}};
 listeners.load({target:largeLogo});
 assert.equal(largeLogo.style.maxWidth,'128px');
 assert.equal(largeLogo.style.maxHeight,'128px');
 await click('nav',{page:'create'});
 const opts=[...html.innerHTML.matchAll(/data-select="([a-f0-9-]+)"/g)].map(x=>x[1]);
 assert.equal(opts.length,8);
 for(const id of opts.slice(0,2))
  listeners.change({target:{dataset:{select:id},checked:true}});
 await tick();
 await click('createNext');await click('createNext');await click('createNext');
 await click('createPoll');
 assert.match(html.innerHTML,/On the menu/);
 assert.match(html.innerHTML,/personal member link|personal family member link/);
 // A vertical scroll must not answer a consensus card, even with horizontal drift.
 await click('nav',{page:'create'});
 listeners.change({target:{name:'method',value:'swipe',dataset:{}}});
 await click('previewMode',{method:'swipe'});
 assert.match(html.innerHTML,/0 of 3 answered/);
 const target={closest:()=>true};
 const touch=(screenX,screenY)=>({identifier:1,screenX,screenY});
 const start=()=>listeners.touchstart({target,touches:[touch(0,0)],changedTouches:[touch(0,0)]});
 start();listeners.touchend({target,changedTouches:[touch(80,180)]});
 assert.match(html.innerHTML,/0 of 3 answered/);
 start();listeners.touchcancel();listeners.touchend({target,changedTouches:[touch(100,0)]});
 assert.match(html.innerHTML,/0 of 3 answered/);
 // A gesture that begins as scrolling stays a scroll, even if its end drifts sideways.
 start();listeners.touchmove({target,touches:[touch(4,35)]});listeners.touchend({target,changedTouches:[touch(140,40)]});
 assert.match(html.innerHTML,/0 of 3 answered/);
 // Adding a second finger cancels the gesture instead of answering on lift.
 start();listeners.touchmove({target,touches:[touch(30,0),{identifier:2,screenX:20,screenY:20}]});listeners.touchend({target,changedTouches:[touch(100,0)]});
 assert.match(html.innerHTML,/0 of 3 answered/);
 start();listeners.touchend({target,changedTouches:[{identifier:9,screenX:100,screenY:0}]});
 assert.match(html.innerHTML,/0 of 3 answered/);
 start();listeners.touchend({target,changedTouches:[touch(100,10)]});
 assert.match(html.innerHTML,/1 of 3 answered/);
 await click('swipeNo');
 await click('swipeNo');
 assert.match(html.innerHTML,/3 of 3 answered/);
 assert.match(html.innerHTML,/All restaurants answered/);
 console.log('App smoke passed: logo visuals, restaurant discovery, poll creation and member-only voting UI');
})().catch(e=>{console.error(e);process.exitCode=1});
