const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const listeners={};const html={innerHTML:''},badge={textContent:''},toast={textContent:'',classList:{add(){},remove(){}}};
const store={};
const dom={app:html,modeBadge:badge,toast,brand:{addEventListener(){}},voterName:{value:'Jacob'}};
html.addEventListener=(name,fn)=>listeners[name]=fn;
const context={
 crypto:webcrypto,console,URL,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
 confirm:()=>true,prompt:()=>null,
 localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]},
 document:{getElementById:id=>dom[id]||null},
 location:{href:'https://example.github.io/goodnights/',pathname:'/goodnights/'},
 history:{replaceState(){}},navigator:{},
 window:{scrollTo(){}}
};
vm.createContext(context);
for(const file of ['config.js','voting.js','maps.js','app.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),context,{filename:file});
function tick(){return new Promise(resolve=>setImmediate(resolve))}
async function click(act,data={}){const btn={dataset:{act,...data}};await listeners.click({target:{closest:()=>btn}});await tick()}
function change(dataset,checked){listeners.change({target:{dataset,checked}})}
(async()=>{
 await tick();
 assert.match(html.innerHTML,/So\.\.\. what's for dinner/);
 await click('nav',{page:'create'});
 assert.match(html.innerHTML,/Start a vote/);
 const opts=[...html.innerHTML.matchAll(/data-select="([a-f0-9-]+)"/g)].map(x=>x[1]);
 assert.equal(opts.length,8);
 change({select:opts[0]},true);change({select:opts[1]},true);
 listeners.change({target:{dataset:{},id:'voters',value:'1'}});
 await click('createPoll');
 assert.match(html.innerHTML,/Pick up to 2/);
 const p=[...html.innerHTML.matchAll(/data-approval="([a-f0-9-]+)"/g)].map(x=>x[1]);
 assert.equal(p.length,2);
 change({approval:p[0]},true);
 await click('submitVote');
 assert.match(html.innerHTML,/THE FAMILY HAS SPOKEN/);
 assert.match(html.innerHTML,/The results/);
 console.log('App smoke test passed: create poll, cast vote, show results.');
})().catch(e=>{console.error(e);process.exitCode=1});
