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
for(const file of ['voting.js','maps.js','logos.js','app.js'])
 vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),context,{filename:file});
function tick(){return new Promise(resolve=>setImmediate(resolve))}
async function click(act,data={}){
 await listeners.click({target:{closest:()=>({dataset:{act,...data}})}});await tick()
}
(async()=>{
 await tick();
 assert.match(html.innerHTML,/So\.\.\. what's for dinner/);
 await click('nav',{page:'restaurants'});
 assert.match(html.innerHTML,/Find local restaurants/);
 assert.match(html.innerHTML,/Find it on Google Maps/);
 assert.match(html.innerHTML,/class="logo-symbol"|data-restaurant-logo/);
 await click('nav',{page:'create'});
 const opts=[...html.innerHTML.matchAll(/data-select="([a-f0-9-]+)"/g)].map(x=>x[1]);
 assert.equal(opts.length,8);
 for(const id of opts.slice(0,2))
  listeners.change({target:{dataset:{select:id},checked:true}});
 await tick();
 await click('createPoll');
 assert.match(html.innerHTML,/Pick up to 2/);
 assert.match(html.innerHTML,/personal member link|personal family member link/);
 // A vertical scroll must not answer a consensus card, even with horizontal drift.
 await click('nav',{page:'create'});
 listeners.change({target:{name:'method',value:'swipe',dataset:{}}});
 await click('createPoll');
 assert.match(html.innerHTML,/0 of 2 answered/);
 const target={closest:()=>true};
 const touch=(screenX,screenY)=>({identifier:1,screenX,screenY});
 const start=()=>listeners.touchstart({target,touches:[touch(0,0)],changedTouches:[touch(0,0)]});
 start();listeners.touchend({target,changedTouches:[touch(80,180)]});
 assert.match(html.innerHTML,/0 of 2 answered/);
 start();listeners.touchcancel();listeners.touchend({target,changedTouches:[touch(100,0)]});
 assert.match(html.innerHTML,/0 of 2 answered/);
 start();listeners.touchend({target,changedTouches:[touch(100,10)]});
 assert.match(html.innerHTML,/1 of 2 answered/);
 await click('swipeNo');
 assert.match(html.innerHTML,/2 of 2 answered/);
 assert.match(html.innerHTML,/All restaurants answered/);
 console.log('App smoke passed: logo visuals, restaurant discovery, poll creation and member-only voting UI');
})().catch(e=>{console.error(e);process.exitCode=1});
