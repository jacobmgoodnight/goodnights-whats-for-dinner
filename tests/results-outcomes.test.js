const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');

// Exercise the actual private image/demo/celebration functions with synthetic data.
// Hooks exist only in this VM, never in the shipped app.
function harness(){
 const texts=[],animations=[],store={},listeners={};
 const app={innerHTML:'',addEventListener:(n,f)=>listeners[n]=f};
 const ctx={URL,File,Blob,crypto:require('node:crypto').webcrypto,console,
  setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},navigator:{},
  location:{href:'https://example.test/',pathname:'/'},history:{replaceState(){}},
  localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v},
  window:{GW_CONFIG:{},scrollTo(){}},
  Image:class{set src(value){this.onerror()}},
  document:{body:{appendChild:el=>animations.push(el)},getElementById:id=>({app,brand:{addEventListener(){}},modeBadge:{},toast:{classList:{add(){},remove(){}}}}[id]),
   createElement:tag=>tag==='canvas'?{getContext:()=>({beginPath(){},roundRect(){},fill(){},fillText:t=>texts.push(t),measureText:t=>({width:t.length*10})}),toBlob:cb=>cb(new Blob(['fixture']))}:{setAttribute(){},remove(){}}}
 };
 vm.createContext(ctx);
 for(const file of ['voting.js','maps.js','logos.js','family.js','app.js']){
  let source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  if(file==='app.js')source=source.replace('init();',`demoInit();window.h1={makeResultsCard,demoRpc,pollNeedsRefresh,celebrate(value,preview=false){poll=value;state.preview=preview;celebrateResults()},store:()=>store};`);
  vm.runInContext(source,ctx);
 }
 return {api:ctx.window.h1,texts,animations,store};
}
const options=[{id:'a',name:'Pizza',category:'Pizza'},{id:'b',name:'Tacos',category:'Mexican'}];
const allNo={id:'no-choice',meal:'Dinner',method:'swipe',status:'closed',options,voted_count:2,ballots:[{a:false,b:false},{a:false,b:false}]};

test('result image uses no-choice wording without winner stars, trophy or decided claims',async()=>{
 const h=harness();await h.api.makeResultsCard({...allNo,sharePeople:[{name:'Fixture',avatar:'🙂'}]});
 const text=h.texts.join('\n');assert.match(text,/Nothing sounds good tonight/);assert.match(text,/Start a new shortlist/);assert.match(text,/0% yes/);
 assert.doesNotMatch(text,/🏆|⭐|family picked|tie!|Decided together|decided together/);
 h.texts.length=0;await h.api.makeResultsCard({...allNo,tie_winner_id:'a'});
 assert.match(h.texts.join('\n'),/Chosen randomly between 2 tied leaders/);
 assert.match(h.texts.join('\n'),/Historical saved draw/);
});
test('no-choice and empty results never celebrate, positive results retain once-per-session behavior',()=>{
 const h=harness();h.api.celebrate(allNo);h.api.celebrate({...allNo,id:'empty',voted_count:0,ballots:[]});assert.equal(h.animations.length,0);
 const positive={...allNo,id:'positive',ballots:[{a:true,b:false},{a:true,b:false}]};
 h.api.celebrate(positive,true);assert.equal(h.animations.length,0);
 h.api.celebrate(positive);h.api.celebrate(positive);assert.equal(h.animations.length,1);
 assert.equal(h.api.pollNeedsRefresh(allNo),false);
 assert.equal(h.api.pollNeedsRefresh({...positive,ballots:[{a:true,b:false},{a:false,b:true}]}),true);
});
test('demo direct calls reject an all-no draw and preserve a saved historical draw',()=>{
 const h=harness();
 // Initialize demo data through the same action used by the app.
 h.api.demoRpc('gw_create_family',{p_name:'Fixture',p_token:'fixture-owner'});
 const data=h.api.store();data.members=[];data.restaurants=options.map(o=>({...o,family_id:data.family.id,active:true}));
 const id=h.api.demoRpc('gw_create_poll',{p_token:'fixture-owner',p_meal:'Dinner',p_method:'swipe',p_expected_voters:2,p_restaurant_ids:['a','b']});
 data.ballots[id]={one:{ballot:{a:false,b:false}},two:{ballot:{a:false,b:false}}};
 const before=JSON.stringify(data.ballots);
 assert.throws(()=>h.api.demoRpc('gw_resolve_tie_random',{p_token:'fixture-owner',p_poll_id:id}));
 data.polls[0].tie_winner_id='b';
 assert.equal(h.api.demoRpc('gw_resolve_tie_random',{p_token:'fixture-owner',p_poll_id:id}),'b');
 assert.throws(()=>h.api.demoRpc('gw_resolve_tie_random',{p_token:'fixture-member',p_poll_id:id}),/Organizer/);
 assert.equal(JSON.stringify(data.ballots),before);
});
