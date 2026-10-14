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
 await click('createPoll');
 assert.match(html.innerHTML,/Pick up to 2/);
 assert.match(html.innerHTML,/personal member link|personal family member link/);
 console.log('App smoke passed: logo visuals, restaurant discovery, poll creation and member-only voting UI');
})().catch(e=>{console.error(e);process.exitCode=1});
