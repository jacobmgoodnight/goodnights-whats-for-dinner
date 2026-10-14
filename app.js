/* Goodnights — no build step, no framework, no paid APIs. */
(() => {
'use strict';
const app=document.getElementById('app'), badge=document.getElementById('modeBadge');
const cfg=window.GW_CONFIG||{}, live=!!(cfg.supabaseUrl&&cfg.publishableKey);
const demoKey='goodnights_demo_v2', familyKey='goodnights_family_token', memberKey='goodnights_member_token';
const sample=[
 ['Chipotle','Mexican'],['Culver’s','Burgers'],['Chick-fil-A','Chicken'],
 ['Texas Roadhouse','Steakhouse'],['Puccini’s Pizza','Pizza'],['Olive Garden','Italian'],
 ['QDOBA','Mexican'],['Panera Bread','Cafe']
];
const uid=()=>crypto.randomUUID();
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),x=>x.toString(16).padStart(2,'0')).join('');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const params=new URL(location.href).searchParams;
const icon=(category='',name='')=>{
 const s=(category+' '+name).toLowerCase();
 if(/pizza/.test(s))return '🍕'; if(/taco|mexican|qdoba|chipotle/.test(s))return '🌮';
 if(/burger|culver|fast.food/.test(s))return '🍔';if(/chicken|chick/.test(s))return '🍗';
 if(/steak|roadhouse|bbq/.test(s))return '🥩';if(/italian|pasta|olive/.test(s))return '🍝';
 if(/sushi|japanese|asian|thai/.test(s))return '🍜';if(/cafe|coffee|panera|sandwich/.test(s))return '🥪';
 if(/seafood|fish/.test(s))return '🐟';return '🍽️';
};
let store, familyToken=localStorage.getItem(familyKey)||'',memberToken=localStorage.getItem(memberKey)||'',member=null,members=[],family=null,poll=null;
const state={page:'home',selected:new Set(),meal:'Dinner',method:'approval',expected:4,
 name:localStorage.getItem('gw_name')||'',approvals:new Set(),swipes:{},swipeIndex:0,rank:[],
 search:'',nearby:[],nearbyBusy:false,center:null,city:'New Palestine, Indiana',restaurantName:'',nearbyQuery:'',
 adding:false,showNearby:false,busy:false,notice:''};
let pollTimer=null;
function demoInit(){
 try{store=JSON.parse(localStorage.getItem(demoKey)||'null')}catch{store=null}
 if(!store||!store.family){
 const fam=uid();store={family:{id:fam,name:'Goodnight Family',token:token()},
 restaurants:sample.map(([name,category])=>({id:uid(),family_id:fam,name,category,address:'',active:true})),polls:[],ballots:{}};
 demoSave();
 }
 familyToken=store.family.token;
}
function demoSave(){localStorage.setItem(demoKey,JSON.stringify(store))}
function demoRpc(fn,p){
 const F=store.family;
 if(fn==='gw_create_family'){
   store={family:{id:uid(),name:p.p_name,token:p.p_token},restaurants:[],polls:[],ballots:{}};demoSave();familyToken=p.p_token;return store.family;
 }
 if(fn==='gw_get_family'){
   if(p.p_token!==F.token)throw Error('Family link not found in this browser’s demo');
   return {id:F.id,name:F.name,restaurants:store.restaurants.filter(r=>r.active),
     polls:[...store.polls].reverse().slice(0,20).map(q=>({id:q.id,meal:q.meal,method:q.method,expected_voters:q.expected_voters,status:q.status,created_at:q.created_at,voted_count:Object.keys(store.ballots[q.id]||{}).length}))};
 }
 if(fn==='gw_add_restaurant'){
   if(p.p_token!==F.token)throw Error('Access denied');
   let r=store.restaurants.find(r=>r.name.toLowerCase()===p.p_name.trim().toLowerCase());
   if(r)r.active=true;else{r={id:uid(),family_id:F.id,active:true,name:p.p_name,category:p.p_category||'',address:p.p_address||'',latitude:p.p_latitude,longitude:p.p_longitude,osm_id:p.p_osm_id};store.restaurants.push(r)}
   demoSave();return r.id;
 }
 if(fn==='gw_archive_restaurant'){
   const r=store.restaurants.find(x=>x.id===p.p_restaurant_id);if(r)r.active=false;demoSave();return !!r;
 }
 if(fn==='gw_create_poll'){
   const q={id:uid(),family_id:F.id,meal:p.p_meal,method:p.p_method,expected_voters:p.p_expected_voters,status:'open',created_at:new Date().toISOString(),restaurant_ids:p.p_restaurant_ids};store.polls.push(q);store.ballots[q.id]={};demoSave();return q.id;
 }
 if(fn==='gw_get_poll'){
   const q=store.polls.find(q=>q.id===p.p_poll_id);if(!q)throw Error('Poll is not in this browser’s demo');
   const b=Object.values(store.ballots[q.id]||{}),ready=q.status==='closed'||b.length>=q.expected_voters;
   return {id:q.id,meal:q.meal,method:q.method,expected_voters:q.expected_voters,created_at:q.created_at,
    voted_count:b.length,status:ready?'closed':'open',options:q.restaurant_ids.map(id=>store.restaurants.find(x=>x.id===id)).filter(Boolean),
    ballots:ready?b.map(x=>x.ballot):null};
 }
 if(fn==='gw_vote'){
   const q=store.polls.find(q=>q.id===p.p_poll_id),b=store.ballots[q.id];
   if(q.status!=='open'||Object.keys(b).length>=q.expected_voters)throw Error('Voting is closed');
   b[p.p_voter_name.trim().toLowerCase()]={name:p.p_voter_name,ballot:p.p_ballot};demoSave();return {ok:true};
 }
 if(fn==='gw_close_poll'){
   const q=store.polls.find(q=>q.id===p.p_poll_id);if(q)q.status='closed';demoSave();return !!q;
 }
 throw Error('Unknown action '+fn);
}
async function rpc(fn,p){
 if(!live)return demoRpc(fn,p);
 const url=cfg.supabaseUrl.replace(/\/+$/,'')+'/rest/v1/rpc/'+encodeURIComponent(fn);
 const r=await fetch(url,{method:'POST',headers:{'apikey':cfg.publishableKey,'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(p)});
 let json;try{json=await r.json()}catch{throw Error('Database did not respond. Check your Supabase setup.')}
 if(!r.ok)throw Error(json.message||json.error||`Database error (${r.status})`);
 return json;
}
const pollUrl=id=>{const u=new URL(location.href);u.search='?poll='+encodeURIComponent(id)+(memberToken&&!familyToken?'&member='+encodeURIComponent(memberToken):'');u.hash='';return u.href};
const memberUrl=t=>{const u=new URL(location.href);u.search='?member='+encodeURIComponent(t);u.hash='';return u.href};
const familyUrl=()=>{const u=new URL(location.href);u.search='?family='+encodeURIComponent(familyToken);u.hash='';return u.href};
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),4000)}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('Link copied!')}catch{prompt('Copy this link:',text)}}
function navHtml(active){return `<nav class="nav" aria-label="Navigation">${[['home','🏠 Home'],['restaurants','🍽️ Restaurants'],['create','🗳️ New vote'],['history','📜 History'],...(familyToken?[['members','👨‍👩‍👧‍👦 Members']]:[])].map(([id,label])=>`<button class="${active===id?'active':''}" data-act="nav" data-page="${id}">${label}</button>`).join('')}</nav>`}
function layout(content,{nav=true}={}){badge.textContent=live?'FAMILY APP':'LOCAL DEMO';app.innerHTML=(nav?navHtml(state.page):'')+content}
function pill(q){return `<span class="status ${q.status==='closed'?'closed':''}">${q.status==='closed'?'Finished':'Voting open'}</span>`}
function timeAgo(date){try{return new Date(date).toLocaleDateString(undefined,{month:'short',day:'numeric'})}catch{return ''}}
function restaurantRow(r,{select=false,remove=false}={}){
 return `<div class="item">${select?`<input class="check" type="checkbox" aria-label="Select ${esc(r.name)}" data-select="${esc(r.id)}" ${state.selected.has(r.id)?'checked':''}>`:''}
 <div class="foodicon">${icon(r.category,r.name)}</div><div class="item-body"><div class="item-title">${esc(r.name)}</div><div class="item-detail">${esc([r.category,r.address].filter(Boolean).join(' · ')||'Family favorite')}</div></div>
 ${remove?`<button class="btn btn-quiet btn-sm" data-act="archive" data-id="${esc(r.id)}" aria-label="Hide ${esc(r.name)}">Hide</button>`:''}</div>`
}
async function loadFamily(){if(memberToken&&!familyToken){const m=await rpc('gw_get_member',{p_member_token:memberToken});member={id:m.id,name:m.name};family=m.family;return}if(!familyToken){family=null;return}family=await rpc('gw_get_family',{p_token:familyToken})}
async function loadMembers(){members=familyToken?await rpc('gw_list_members',{p_token:familyToken}):[]}
async function loadPoll(id){poll=await rpc('gw_get_poll',{p_poll_id:id});if(memberToken&&member){const voted=await rpc('gw_member_has_voted',{p_poll_id:id,p_member_token:memberToken});poll.voted_member_ids=voted?[member.id]:[]}}
function setPage(p){state.page=p;if(p!=='poll'){history.replaceState(null,'',location.pathname);clearInterval(pollTimer)}render();window.scrollTo({top:0,behavior:'instant'})}
function render(){
 if(state.page==='poll')return renderPoll();
 if(!family)return renderWelcome();
 if(state.page==='members')return renderMembers();
 if(state.page==='restaurants')return renderRestaurants();
 if(state.page==='create')return renderCreate();
 if(state.page==='history')return renderHistory();
 renderHome();
}
function renderWelcome(){layout(`<div class="card hero"><div class="eyebrow">WELCOME TO GOODNIGHTS</div><h1>Good food. <br>Family decisions.</h1><p class="lede">Create your family's private restaurant list and let everyone have a say.</p>
 ${live?`<button class="btn btn-dark" data-act="newFamily">Create our family</button><div class="field"><label>Already have a family link?</label><input id="joinToken" placeholder="Paste your family invite link"></div><button class="btn btn-line" data-act="join">Join family</button>`:`<button class="btn btn-dark" data-act="demo">Explore the sample app</button><p class="note">Demo only until you connect Supabase. Votes stay in this browser and cannot be shared with other phones.</p>`}</div>`,{nav:false})}
function renderHome(){
 let latest=family.polls||[];
 layout(`<div class="card hero"><div class="hero-emoji">🍔</div><div class="eyebrow">${esc(family.name)} · DINNER CLUB</div><h1>So... what's for dinner?</h1><p class="lede">Skip the debate. Pick a few places, vote together, and let dinner decide itself.</p>${familyToken?`<button class="btn btn-dark" data-act="nav" data-page="create">Start a family vote →</button>`:`<p class="subtle">Signed in as ${esc(member?.name||"family member")}</p>`}</div>
 ${!live?`<div class="muted-box" style="margin-bottom:15px"><strong>🧪 Local demo</strong><div>This sample works on this device only. To vote together on multiple phones, complete the Supabase + GitHub Pages setup in the README.</div></div>`:''}
 ${familyToken?`<div class="grid2"><div class="card"><span class="eyebrow">FAMILY FAVORITES</span><h2>🍽️ ${family.restaurants.length} places</h2><p class="subtle">Add restaurants once. Vote on them anytime.</p><button class="btn btn-quiet btn-sm" data-act="nav" data-page="restaurants">Manage restaurants ↗</button></div>
 <div class="card"><span class="eyebrow">INVITE FAMILY</span><h2>👨‍👩‍👧‍👦 Share our list</h2><p class="subtle">Share a family link so everyone can see and manage the list.</p><button class="btn btn-quiet btn-sm" data-act="familyLink">Copy family invite ↗</button></div></div>`:''}
 <div class="between" style="margin:22px 0 11px"><h2 style="margin:0">Recent votes</h2><button class="btn btn-quiet btn-sm" data-act="nav" data-page="history">View all</button></div>
 ${latest.length?latest.slice(0,4).map(q=>`<div class="card"><div class="between"><div><strong>${esc(q.meal)} · ${methodName(q.method)}</strong><div class="subtle">${timeAgo(q.created_at)} · ${q.voted_count}/${q.expected_voters} voted</div></div>${pill(q)}</div><button class="btn btn-quiet btn-sm" style="margin-top:12px" data-act="openpoll" data-id="${esc(q.id)}">Open vote →</button></div>`).join(''):
 `<div class="card empty"><span class="empty-emoji">🗳️</span><h3>Your first vote is waiting</h3><p>There are no polls yet.</p>${familyToken?`<button class="btn btn-primary" data-act="nav" data-page="create">Create first vote</button>`:''}</div>`}`)
}
function renderMembers(){
 if(!familyToken){setPage('home');return}
 layout(`<div class="eyebrow">FAMILY SETTINGS</div><h1>Family members</h1><p class="lede">Each person gets one permanent voting link. Only the family owner can manage members.</p>
 <div class="card"><h2>Add a member</h2><div class="field"><label for="newMemberName">Name</label><input id="newMemberName" maxlength="60" placeholder="e.g. Charlotte"></div><button class="btn btn-primary btn-full" data-act="addMember">＋ Add family member</button></div>
 <div class="card"><h2>${members.length} members</h2>${members.map(m=>`<div class="item"><span class="foodicon">👤</span><div class="item-body"><strong>${esc(m.name)}</strong><div class="subtle">Permanent personal link</div></div><button class="btn btn-quiet btn-sm" data-act="copyMember" data-id="${esc(m.id)}">Copy link</button><button class="btn btn-line btn-sm" data-act="editMember" data-id="${esc(m.id)}">Edit</button></div>`).join('')||'<p>No family members yet.</p>'}</div><p class="note">Reset a link if it is shared accidentally. The previous link will stop working.</p>`)
}
function renderRestaurants(){
 const search=state.search.toLowerCase().trim(),restaurants=(family.restaurants||[]).filter(r=>(r.name+' '+r.category+' '+r.address).toLowerCase().includes(search));
 layout(`<div class="eyebrow">OUR GO-TO SPOTS</div><div class="between"><div><h1>Our restaurants.</h1><p class="lede">Your family's personal shortlist. Add any place you like.</p></div><span class="count">${family.restaurants.length} saved</span></div>
 <div class="card"><div class="between"><h2 style="margin:0">Find something good</h2><button class="btn btn-primary btn-sm" data-act="toggleAdd">＋ Add</button></div>
 <h3>Find local restaurants</h3><p class="note">Search by restaurant name, town, or both. Leave the name blank to browse nearby places. OpenStreetMap results may be incomplete.</p><div class="field"><label for="localName">Restaurant name (optional)</label><input id="localName" maxlength="80" value="${esc(state.restaurantName)}" placeholder="e.g. Culver's or Puccini's"></div><div class="field"><label for="city">Town / location</label><input id="city" value="${esc(state.city)}" placeholder="New Palestine, Indiana"></div><div class="btn-row"><button class="btn btn-quiet btn-sm" data-act="townSearch" ${state.nearbyBusy?'disabled':''}>🔎 Search restaurants</button><button class="btn btn-quiet btn-sm" data-act="gpsSearch" ${state.nearbyBusy?'disabled':''}>📍 Search near me</button></div>
 ${state.adding?`<div class="field"><label for="restName">Restaurant name</label><input id="restName" maxlength="120" placeholder="e.g. Frosty Boy"></div><div class="field"><label for="restCategory">Cuisine or category</label><input id="restCategory" maxlength="80" placeholder="e.g. Burgers, Pizza, Ice cream"></div><button class="btn btn-dark btn-full" data-act="addManual">Save to family list</button>`:''}
 ${state.nearbyBusy?'<p class="subtle">Looking for restaurants…</p>':''}${state.showNearby?`<h3 style="margin-top:20px">${state.nearby.length} ${state.nearbyQuery?'matching':'nearby'} restaurants${state.nearbyQuery?' for “'+esc(state.nearbyQuery)+'”':''}</h3>${state.nearby.length?state.nearby.map((r,i)=>`<div class="item"><div class="foodicon">${icon(r.category,r.name)}</div><div class="item-body"><div class="item-title">${esc(r.name)}</div><div class="item-detail">${esc(r.category)}${r.distance!=null?' · '+r.distance.toFixed(1)+' mi':''}${r.address?' · '+esc(r.address):''}</div></div>${family.restaurants.some(saved=>saved.osm_id&&saved.osm_id===r.osm_id)?'<span class="subtle">✓ Saved</span>':`<button class="btn btn-quiet btn-sm" data-act="addNearby" data-idx="${i}">+ Save</button>`}</div>`).join(''):'<p class="subtle">No matches found here. You can add a restaurant manually above.</p>'}`:''}
 </div><div class="card"><div class="field" style="margin-top:0"><label for="restaurantSearch">Filter your list</label><input id="restaurantSearch" value="${esc(state.search)}" placeholder="Search saved restaurants…"></div>
 ${restaurants.length?restaurants.map(r=>restaurantRow(r,{remove:true})).join(''):`<div class="empty"><span class="empty-emoji">🥗</span><h3>No matching restaurants</h3><p>Add a favorite or change your search.</p></div>`}</div>`)
}
function methodName(m){return {approval:'Approval',swipe:'Swipe / Consensus',ranked:'Ranked choice'}[m]||m}
function renderCreate(){
 const choices=family.restaurants||[];
 layout(`<div class="eyebrow">MAKE A DECISION</div><h1>Start a vote.</h1><p class="lede">Choose what's on the menu, then invite everyone.</p>
 <div class="card"><div class="field-row"><div class="field" style="margin-top:0"><label for="meal">Meal</label><select id="meal"><option ${state.meal==='Dinner'?'selected':''}>Dinner</option><option ${state.meal==='Lunch'?'selected':''}>Lunch</option></select></div><div class="field" style="margin-top:0"><label for="voters">How many voters?</label><select id="voters">${Array.from({length:12},(_,i)=>i+1).map(n=>`<option value="${n}" ${state.expected===n?'selected':''}>${n} ${n===1?'person':'people'}</option>`).join('')}</select></div></div>
 <div class="between"><h2 style="margin:8px 0 0">Pick the contenders</h2><span class="count">${state.selected.size} selected</span></div><p class="subtle">Select 2–20 restaurants.</p>
 ${choices.length?choices.map(r=>restaurantRow(r,{select:true})).join(''):`<div class="empty"><span class="empty-emoji">🍽️</span><h3>First, add some restaurants</h3><p>Build your family list to start voting.</p><button class="btn btn-quiet" data-act="nav" data-page="restaurants">Add restaurants</button></div>`}
 ${choices.length?`<div class="btn-row" style="margin-top:15px"><button class="btn btn-quiet btn-sm" data-act="random">🎲 Pick 5 for me</button><button class="btn btn-line btn-sm" data-act="clear">Clear selection</button></div>`:''}</div>
 <div class="card"><h2>How should we vote?</h2>
 ${[['approval','✅','Approval vote','Everyone picks up to 2 places they’d be happy eating.'],['swipe','👉','Swipe / consensus','Yes or no on each restaurant. The highest positive percentage wins.'],['ranked','🥇','Ranked choice','Rank your top 3. Instant-runoff counting breaks clear ties.']].map(([id,emoji,title,desc])=>`<label class="method ${state.method===id?'checked':''}"><input type="radio" name="method" value="${id}" ${state.method===id?'checked':''}><span class="methodmark">${emoji}</span><span><strong>${title}</strong><small>${desc}</small></span></label>`).join('')}
 <p class="note">Results stay hidden until all expected voters finish, or you close the poll early.</p><button class="btn btn-primary btn-full" data-act="createPoll" ${state.selected.size<2?'disabled':''}>Create ${esc(state.meal.toLowerCase())} vote →</button></div>`)
}
function renderHistory(){
 layout(`<div class="eyebrow">THE DECISIONS WE MADE</div><h1>Vote history.</h1><p class="lede">Every delicious decision, all in one place.</p>
 ${(family.polls||[]).length?family.polls.map(q=>`<div class="card"><div class="between"><div><strong>${esc(q.meal)} · ${methodName(q.method)}</strong><div class="subtle">${timeAgo(q.created_at)} · ${q.voted_count}/${q.expected_voters} family votes</div></div>${pill(q)}</div><button class="btn btn-quiet btn-sm" style="margin-top:13px" data-act="openpoll" data-id="${esc(q.id)}">View poll →</button></div>`).join(''):`<div class="card empty"><span class="empty-emoji">🍜</span><h3>No votes yet</h3><p>Start a poll and it will appear here.</p></div>`}`)
}
function renderPoll(){
 if(!poll){layout(`<div class="card empty"><span class="empty-emoji">⏳</span><p>Loading family vote…</p></div>`,{nav:false});return}
 const open=poll.status==='open',already=member?!!poll.voted_member_ids?.includes(member.id):localStorage.getItem('gw_voted_'+poll.id)==='1';
 if(!open)return renderResults();
 let voting='';
 if(already){voting=`<div class="card empty"><span class="empty-emoji">🎉</span><h2>You're all voted!</h2><p>Results are hidden until everyone has voted. This page updates automatically.</p><button class="btn btn-quiet" data-act="resetVote">Another person / change vote</button></div>`}
 else if(poll.method==='approval'){
 voting=`<div class="card"><h2>Pick up to 2</h2><p class="subtle">Which restaurants would you be happy eating?</p>${poll.options.map(r=>restaurantRow(r)).join('')}</div>`;
 // Re-render approval rows with their own input, without changing family-list state.
 voting=`<div class="card"><h2>Pick up to 2</h2><p class="subtle">Which restaurants would you be happy eating?</p>${poll.options.map(r=>`<label class="item"><input class="check" type="checkbox" data-approval="${esc(r.id)}" ${state.approvals.has(r.id)?'checked':''}><span class="foodicon">${icon(r.category,r.name)}</span><span class="item-body"><span class="item-title">${esc(r.name)}</span><span class="item-detail">${esc(r.category)}</span></span></label>`).join('')}</div>`;
 }else if(poll.method==='swipe'){
 const i=Math.min(state.swipeIndex,poll.options.length-1),r=poll.options[i];
 voting=`<div class="card"><div class="between"><strong>Swipe / consensus</strong><span class="subtle">${i+1} of ${poll.options.length}</span></div><div class="progress"><span style="width:${(i/poll.options.length)*100}%"></span></div>
 <div class="votecard" id="swipeCard"><div class="foodicon">${icon(r.category,r.name)}</div><h2>${esc(r.name)}</h2><p>${esc(r.category)} · Swipe left or right, or use the buttons.</p></div>
 <div class="vote-btns"><button class="btn btn-line" data-act="swipeNo">👎 Not tonight</button><button class="btn btn-primary" data-act="swipeYes">👍 Sounds good</button></div>
 ${i>0?`<button style="margin-top:10px" class="btn btn-quiet btn-sm" data-act="swipeBack">← Go back</button>`:''}</div>`;
 }else{
 const count=Math.min(3,poll.options.length);
 voting=`<div class="card"><h2>Rank your top ${count}</h2><p class="subtle">Choose a different restaurant for each position.</p>
 ${Array.from({length:count},(_,i)=>`<div class="rankoption"><label for="rank${i}">${['🥇 First choice','🥈 Second choice','🥉 Third choice'][i]}</label><select id="rank${i}" data-rank="${i}"><option value="">Choose restaurant…</option>${poll.options.map(r=>`<option value="${esc(r.id)}" ${state.rank[i]===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</select></div>`).join('')}</div>`;
 }
 const ballotReady=poll.method==='approval'?state.approvals.size>=1&&state.approvals.size<=2:poll.method==='swipe'?Object.keys(state.swipes).length===poll.options.length:state.rank.slice(0,Math.min(3,poll.options.length)).filter(Boolean).length===Math.min(3,poll.options.length)&&new Set(state.rank).size===Math.min(3,poll.options.length);
 const pending=state.swipeIndex<poll.options.length-1&&poll.method==='swipe';
 layout(`<div class="eyebrow">IT'S TIME TO VOTE</div><h1>${esc(poll.meal)} plans?</h1><p class="lede">${methodName(poll.method)} · ${poll.voted_count} of ${poll.expected_voters} votes in</p>
 <div class="card"><div class="between"><strong>Family vote</strong>${pill(poll)}</div><div class="progress"><span style="width:${100*poll.voted_count/poll.expected_voters}%"></span></div><p class="note">Your family's choices stay secret until the vote finishes.</p></div>
 ${voting}
 ${!already?member?`<div class="card"><p>Voting as <strong>${esc(member.name)}</strong></p><button class="btn btn-primary btn-full" data-act="submitVote" ${!ballotReady||pending||state.busy?'disabled':''}>Submit my vote ✓</button></div>`:`<div class="card"><p class="note">Use your personal family member link to submit a vote. Ask the family owner for yours.</p></div>`:''}
 ${familyToken?`<div class="card"><p class="subtle">Family organizer controls</p><div class="btn-row"><button class="btn btn-quiet btn-sm" data-act="copyPoll">Copy vote link</button><button class="btn btn-line btn-sm" data-act="closePoll">Close voting early</button></div></div>`:`<button class="btn btn-line btn-full" data-act="copyPoll">Copy voting link</button>`}
 `,{nav:false});
}
function renderResults(){
 const {scores,winners,details}=window.GoodnightsVoting.tally(poll);
 const all=poll.options||[],win=all.filter(o=>winners.includes(o.id));
 const maximum=Math.max(1,...Object.values(scores));
 const desc=win.length===1?`${icon(win[0].category,win[0].name)} ${esc(win[0].name)}`:win.length>1?`It's a tie! (${win.length} places)`:'No winner yet';
 layout(`<div class="eyebrow">THE FAMILY HAS SPOKEN</div><div class="card winner"><div class="trophy">🏆</div><div class="eyebrow">${poll.meal.toUpperCase()} RESULTS</div><h1>${desc}</h1><p class="subtle">${esc(details)}</p></div>
 <div class="card"><div class="between"><h2>The results</h2><span class="count">${poll.voted_count} votes</span></div>
 ${[...all].sort((a,b)=>scores[b.id]-scores[a.id]||a.name.localeCompare(b.name)).map(r=>`<div class="resultbar"><div class="bar-head"><span>${icon(r.category,r.name)} ${esc(r.name)}</span><span>${poll.method==='swipe'?Math.round(100*scores[r.id]/Math.max(1,poll.voted_count))+'%':scores[r.id]+' '+(poll.method==='ranked'?'first-choice votes':'votes')}</span></div><div class="bar-track"><div class="bar-fill" style="width:${100*scores[r.id]/maximum}%"></div></div></div>`).join('')}
 <p class="note">${win.length>1?'A tie is never broken at random. Start a runoff to decide.':poll.method==='ranked'?'Ranked-choice totals show the final elimination round.':'Each voter can approve up to two places or vote yes/no as configured.'}</p></div>
 ${win.length>1&&familyToken?`<button class="btn btn-primary btn-full" data-act="runoff">🗳️ Start a runoff between tied restaurants</button>`:''}
 <div class="btn-row" style="margin-top:13px"><button class="btn btn-quiet" data-act="copyPoll">Share results</button><button class="btn btn-line" data-act="goHome">Back to family</button></div>
 `,{nav:false})
}
async function safe(fn){try{state.busy=true;await fn()}catch(e){toast(e.message||'Something went wrong');console.error(e)}finally{state.busy=false}}
async function openPoll(id){state.approvals=new Set();state.swipes={};state.swipeIndex=0;state.rank=[];poll=null;state.page='poll';history.replaceState(null,'',pollUrl(id));window.scrollTo({top:0});render();await safe(async()=>{await loadPoll(id);render();clearInterval(pollTimer);if(poll.status==='open')pollTimer=setInterval(async()=>{try{const prev=poll;const next=await rpc('gw_get_poll',{p_poll_id:id});poll=next;if(memberToken&&member){const voted=await rpc('gw_member_has_voted',{p_poll_id:id,p_member_token:memberToken});poll.voted_member_ids=voted?[member.id]:[]}if(prev.voted_count!==next.voted_count||prev.status!==next.status)render();if(next.status==='closed')clearInterval(pollTimer)}catch{}},8000)})}
async function refreshFamily(){if(familyToken)await loadFamily();render()}
async function makePoll(ids,method=state.method,expected=state.expected){
 const id=await rpc('gw_create_poll',{p_token:familyToken,p_meal:state.meal,p_method:method,p_expected_voters:expected,p_restaurant_ids:ids});
 await loadFamily();await openPoll(id);toast('Vote created! Share the voting link.');
}
function voteSwipe(value){if(!poll)return;const r=poll.options[state.swipeIndex];if(!r)return;state.swipes[r.id]=value;state.swipeIndex=Math.min(poll.options.length-1,state.swipeIndex+1);render()}
function geodistance(lat1,lon1,lat2,lon2){const a=Math.PI/180,dLat=(lat2-lat1)*a,dLon=(lon2-lon1)*a,x=Math.sin(dLat/2)**2+Math.cos(lat1*a)*Math.cos(lat2*a)*Math.sin(dLon/2)**2;return 3958.8*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
// Escape regex metacharacters and quotes so an arbitrary name stays a literal search term.
function overpassNamePattern(name){
 return String(name).trim().slice(0,80).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\\/g,'\\\\').replace(/"/g,'\\"');
}
async function findNearby(lat,lon,searchName=state.restaurantName){
 if(!Number.isFinite(lat)||!Number.isFinite(lon))throw Error('Could not determine the search location.');
 const term=String(searchName||'').trim();
 state.showNearby=false;state.nearbyBusy=true;state.nearbyQuery=term;render();
 try{
  // Search only when the user taps a button. Name lookups cover 20 km; browsing covers 10 km.
  // Overpass is volunteer-operated, so keep searches bounded and offer manual entry.
  const around=`(around:${term?20000:10000},${lat},${lon})`;
  const cuisine='["amenity"~"^(restaurant|fast_food|cafe|food_court|ice_cream)$"]';
  const namePattern=overpassNamePattern(term);
  const statements=[`nwr${around}${cuisine}${term?`["name"~"${namePattern}",i]`:''};`];
  if(term)statements.push(`nwr${around}${cuisine}["brand"~"${namePattern}",i];`);
  const query=`[out:json][timeout:25];(${statements.join('')});out center;`;
  const res=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(query)});
  if(!res.ok)throw Error('Restaurant search is temporarily busy. Try again or add a restaurant manually.');
  const data=await res.json(),all=[],seen=new Set();
  for(const el of data.elements||[]){
   const name=el.tags?.name||el.tags?.brand,latitude=el.lat??el.center?.lat,longitude=el.lon??el.center?.lon;
   if(!name||!Number.isFinite(latitude)||!Number.isFinite(longitude))continue;
   // Distinct restaurant locations can share the same chain name.
   const id=el.type+'/'+el.id;if(seen.has(id))continue;seen.add(id);
   all.push({name,category:el.tags?.cuisine||el.tags?.amenity?.replace(/_/g,' ')||'Restaurant',address:[el.tags?.['addr:housenumber'],el.tags?.['addr:street'],el.tags?.['addr:city']].filter(Boolean).join(' '),latitude,longitude,
    osm_id:id,distance:geodistance(lat,lon,latitude,longitude)});
  }
  state.nearby=all.sort((a,b)=>a.distance-b.distance).slice(0,45);state.showNearby=true;
 }finally{state.nearbyBusy=false;render()}
}
// Cache town lookups to avoid unnecessary repeat geocoding requests.
let townCache={};try{townCache=JSON.parse(localStorage.getItem('gw_town_cache')||'{}')||{}}catch{}
async function getTown(){
 const city=state.city.trim();if(!city)throw Error('Enter a town, or select “Search near me”.');
 const key=city.toLocaleLowerCase(),cached=townCache[key];
 if(cached&&Date.now()-cached.time<30*86400000){await findNearby(cached.lat,cached.lon);return}
 const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city)}`);
 if(!r.ok)throw Error('Location search is temporarily unavailable.');
 const data=await r.json();if(!data.length)throw Error('Town not found. Try “New Palestine, Indiana”.');
 const lat=Number(data[0].lat),lon=Number(data[0].lon);
 if(!Number.isFinite(lat)||!Number.isFinite(lon))throw Error('Town location could not be read.');
 townCache[key]={lat,lon,time:Date.now()};
 try{localStorage.setItem('gw_town_cache',JSON.stringify(townCache))}catch{}
 await findNearby(lat,lon);
}
async function doAction(act,button){
 if(act==='nav'){if(button.dataset.page==='members')await safe(loadMembers);setPage(button.dataset.page);return}
 if(act==='demo'){demoInit();await safe(async()=>{await loadFamily();render()});return}
 if(act==='newFamily'){
  const name=prompt('What should we call your family?','Goodnight Family');if(name===null)return;
  await safe(async()=>{const t=token();await rpc('gw_create_family',{p_name:name.trim()||'Goodnight Family',p_token:t});familyToken=t;localStorage.setItem(familyKey,t);await loadFamily();render();toast('Family created. Save your family invite link!')});return;
 }
 if(act==='join'){
  const raw=$('joinToken').value.trim();let t=raw;
  try{const u=new URL(raw);t=u.searchParams.get('family')||raw}catch{}
  if(!/^[a-f0-9]{48}$/.test(t))throw Error('Paste a valid Goodnights family invite link.');
  await safe(async()=>{familyToken=t;await loadFamily();localStorage.setItem(familyKey,t);render();toast('Joined your family!')});return;
 }
 if(act==='familyLink'){copy(familyUrl());return}
 if(act==='addMember'){const n=$('newMemberName')?.value.trim();if(!n)throw Error('Enter a name');await safe(async()=>{await rpc('gw_add_member',{p_token:familyToken,p_name:n});await loadMembers();render();toast('Member added')});return}
 if(act==='copyMember'){const m=members.find(x=>x.id===button.dataset.id);if(m)copy(memberUrl(m.token));return}
 if(act==='editMember'){const m=members.find(x=>x.id===button.dataset.id);if(!m)return;const v=prompt('New name, RESET to replace personal link, or REMOVE to disable member',m.name);if(v===null)return;await safe(async()=>{if(v.toUpperCase()==='RESET'){if(!confirm('Replace personal link? The previous link will stop working.'))return;await rpc('gw_rotate_member',{p_token:familyToken,p_member_id:m.id})}else if(v.toUpperCase()==='REMOVE'){if(!confirm('Remove '+m.name+'?'))return;await rpc('gw_remove_member',{p_token:familyToken,p_member_id:m.id})}else await rpc('gw_rename_member',{p_token:familyToken,p_member_id:m.id,p_name:v.trim()});await loadMembers();render();toast('Member updated')});return}
 if(act==='toggleAdd'){state.adding=!state.adding;render();return}
 if(act==='addManual'){
  const name=$('restName')?.value.trim(),category=$('restCategory')?.value.trim();
  if(!name)throw Error('Enter a restaurant name.');
  await safe(async()=>{await rpc('gw_add_restaurant',{p_token:familyToken,p_name:name,p_category:category||'',p_address:''});await loadFamily();state.adding=false;render();toast(name+' added to your list')});return;
 }
 if(act==='archive'){
  if(!confirm('Hide this restaurant from future votes?'))return;
  await safe(async()=>{await rpc('gw_archive_restaurant',{p_token:familyToken,p_restaurant_id:button.dataset.id});await loadFamily();state.selected.delete(button.dataset.id);render();toast('Restaurant hidden')});return;
 }
 if(act==='townSearch'){await safe(getTown);return}
 if(act==='gpsSearch'){
  if(!navigator.geolocation)throw Error('Location is unavailable in this browser.');
  await safe(async()=>{const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:12000}));await findNearby(pos.coords.latitude,pos.coords.longitude)});return;
 }
 if(act==='addNearby'){
  const r=state.nearby[Number(button.dataset.idx)];if(!r)return;
  await safe(async()=>{await rpc('gw_add_restaurant',{p_token:familyToken,p_name:r.name,p_category:r.category,p_address:r.address,p_osm_id:r.osm_id,p_latitude:r.latitude,p_longitude:r.longitude});await loadFamily();render();toast('Saved '+r.name)});return;
 }
 if(act==='random'){
  const arr=[...family.restaurants];for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}state.selected=new Set(arr.slice(0,Math.min(5,arr.length)).map(x=>x.id));render();return;
 }
 if(act==='clear'){state.selected.clear();render();return}
 if(act==='createPoll'){
  const ids=[...state.selected];if(ids.length<2||ids.length>20)throw Error('Select 2–20 restaurants.');
  await safe(()=>makePoll(ids));return;
 }
 if(act==='openpoll'){await openPoll(button.dataset.id);return}
 if(act==='copyPoll'){copy(pollUrl(poll.id));return}
 if(act==='closePoll'){
  if(!confirm('End voting now and reveal the votes already cast?'))return;
  await safe(async()=>{await rpc('gw_close_poll',{p_token:familyToken,p_poll_id:poll.id});await loadPoll(poll.id);await loadFamily();render()});return;
 }
 if(act==='swipeNo'){voteSwipe(false);return}
 if(act==='swipeYes'){voteSwipe(true);return}
 if(act==='swipeBack'){state.swipeIndex=Math.max(0,state.swipeIndex-1);render();return}
 if(act==='resetVote'){if(memberToken){await openPoll(poll.id);return}localStorage.removeItem('gw_voted_'+poll.id);state.name='';state.approvals=new Set();state.swipes={};state.swipeIndex=0;state.rank=[];render();return}
 if(act==='submitVote'){
  state.name=member?.name||$('voterName')?.value.trim()||state.name;if(!state.name)throw Error('Open your personal link to vote.');
  let ballot;
  if(poll.method==='approval'){
   ballot=[...state.approvals];if(ballot.length<1||ballot.length>2)throw Error('Pick one or two restaurants.');
  }else if(poll.method==='swipe'){
   ballot=state.swipes;if(Object.keys(ballot).length!==poll.options.length)throw Error('Vote on every restaurant.');
  }else{
   ballot=state.rank.slice(0,Math.min(3,poll.options.length));
   if(ballot.some(x=>!x)||new Set(ballot).size!==ballot.length||ballot.length!==Math.min(3,poll.options.length))throw Error('Rank different restaurants in every position.');
  }
  await safe(async()=>{if(!memberToken||!member)throw Error('Use your personal member link to vote');await rpc('gw_vote_as_member',{p_poll_id:poll.id,p_member_token:memberToken,p_ballot:ballot});localStorage.setItem('gw_name',state.name);localStorage.setItem('gw_voted_'+poll.id,'1');await loadPoll(poll.id);if(familyToken)await loadFamily();render();toast('Your vote is in!')});return;
 }
 if(act==='runoff'){
  const scores=window.GoodnightsVoting.tally(poll).winners;if(scores.length<2)throw Error('No runoff needed.');
  state.meal=poll.meal;await safe(()=>makePoll(scores,'ranked',poll.expected_voters));return;
 }
 if(act==='goHome'){
  if(!familyToken){state.page='home';family=null;history.replaceState(null,'',location.pathname);render();return}
  await safe(async()=>{await loadFamily();setPage('home')});return;
 }
}
app.addEventListener('click',async e=>{
 const button=e.target.closest('[data-act]');if(!button||button.disabled)return;
 try{await doAction(button.dataset.act,button)}catch(err){toast(err.message||'Something went wrong')}
});
app.addEventListener('change',e=>{
 const t=e.target;
 if(t.dataset.select){t.checked?state.selected.add(t.dataset.select):state.selected.delete(t.dataset.select);render()}
 else if(t.dataset.approval){
  if(t.checked&&state.approvals.size>=2){t.checked=false;toast('Choose up to 2 restaurants.');return}
  t.checked?state.approvals.add(t.dataset.approval):state.approvals.delete(t.dataset.approval);render();
 }else if(t.dataset.rank!==undefined){
  const i=Number(t.dataset.rank);state.rank[i]=t.value;
  if(t.value)state.rank=state.rank.map((v,j)=>j!==i&&v===t.value?'':v);render();
 }else if(t.name==='method'){state.method=t.value;render()}
 else if(t.id==='meal')state.meal=t.value;
 else if(t.id==='voters')state.expected=Number(t.value);
});
app.addEventListener('input',e=>{
 const t=e.target;if(t.id==='restaurantSearch'){state.search=t.value;const at=t.selectionStart;render();const field=$('restaurantSearch');field.focus();field.setSelectionRange(at,at)}
 else if(t.id==='city')state.city=t.value;
 else if(t.id==='localName')state.restaurantName=t.value;
 else if(t.id==='voterName')state.name=t.value;
});
let touchX=0;
app.addEventListener('touchstart',e=>{if(e.target.closest('#swipeCard'))touchX=e.changedTouches[0].screenX},{passive:true});
app.addEventListener('touchend',e=>{if(!e.target.closest('#swipeCard')||state.page!=='poll'||poll?.method!=='swipe')return;const dx=e.changedTouches[0].screenX-touchX;if(Math.abs(dx)>60)voteSwipe(dx>0)},{passive:true});
async function init(){
 if(!live){demoInit();badge.textContent='LOCAL DEMO'}
 else if(params.get('member')){memberToken=params.get('member');familyToken='';localStorage.setItem(memberKey,memberToken);localStorage.removeItem(familyKey)}
 else if(params.get('family')){familyToken=params.get('family');memberToken='';member=null;localStorage.setItem(familyKey,familyToken);localStorage.removeItem(memberKey)}
 else if(memberToken)familyToken='';
 if(params.get('poll')){if(memberToken)try{await loadFamily()}catch(e){toast(e.message)}await openPoll(params.get('poll'));return}
 try{await loadFamily();render()}catch(e){toast(e.message);family=null;renderWelcome()}
}
document.getElementById('brand').addEventListener('click',async e=>{e.preventDefault();if(familyToken){await safe(async()=>{await loadFamily();setPage('home')})}else setPage('home')});
init();
})();
