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
const icon=(category='',name='',restaurant)=>window.GoodnightsLogos.render(restaurant||{name,category});
let store, familyToken=localStorage.getItem(familyKey)||'',memberToken=localStorage.getItem(memberKey)||'',member=null,members=[],family=null,poll=null;
const F=window.GoodnightsFamily;
const state={repeatDraft:null,allowMemberHome:false,groupJoin:true,includeCardAvatars:false,refreshError:false,deferredPollRender:false,createStep:0,selectedPeople:new Set(),peopleInitialised:false,peopleLoadError:false,reminderId:null,discoverOpen:false,restaurantDrafts:{},renderedPage:null,renderedEditingId:null,skipDraftCapture:false,editingVote:false,pendingAction:null,resultCard:null,cardBusy:false,preview:false,editingMember:null,avatarDraft:'🙂',photoBusy:false,page:'home',selected:new Set(),meal:'Dinner',method:'approval',expected:4,
 name:localStorage.getItem('gw_name')||'',approvals:new Set(),swipes:{},swipeIndex:0,rank:[],
 pollSearch:'',pollCuisine:'',pollCenter:null,pollRadius:'',memberLoadError:false,search:'',nearby:[],nearbyBusy:false,center:null,city:'New Palestine, Indiana',restaurantName:'',nearbyQuery:'',
 adding:false,showNearby:false,busy:false,notice:'',editingId:null};
let pollTimer=null,groupAccess=null;
const groupKey=id=>'gw_group_vote_'+id;
const lastPersonKey=id=>'gw_group_last_person_'+id;
function rememberGroupPerson(){localStorage.setItem(groupKey(poll.id),JSON.stringify({token:groupAccess.token,memberId:member.id,familyId:poll.group_family_id}));if(poll.group_family_id)localStorage.setItem(lastPersonKey(poll.group_family_id),member.id)}
async function restoreGroupPerson(){
 if(!inGroup(poll.id)||member||!poll.group_family_id||poll.people_error)return;
 const eligible=id=>(poll.people||[]).some(m=>m.id===id&&m.active!==false);
 let id=localStorage.getItem(lastPersonKey(poll.group_family_id));
 // Upgrade older per-poll memories only when they agree on a single invited identity.
 // Shared phones with conflicting past choices get the picker instead of a guess.
 if(id==null&&typeof localStorage.key==='function'){
  const previous=new Set();for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith('gw_group_vote_'))continue;try{const old=JSON.parse(localStorage.getItem(key));if((!old?.familyId||old.familyId===poll.group_family_id)&&eligible(old?.memberId))previous.add(old.memberId)}catch{}}
  if(previous.size===1)id=[...previous][0];
 }
 if(!eligible(id))return;
 groupAccess.memberId=id;try{member=await groupRpc('identity');await loadVoterStatus(poll);poll.can_vote=true;rememberGroupPerson()}catch{groupAccess.memberId=null;member=null}
}
const celebratedResults=new Set();
function celebrateResults(){
 if(state.preview||!poll?.voted_count||celebratedResults.has(poll.id))return;
 const key='gw_results_seen_'+poll.id;celebratedResults.add(poll.id);
 try{if(typeof sessionStorage!=='undefined'){if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'1')}}catch{}
 app.querySelector?.('.winner')?.classList?.add('results-arrived');celebrateVote('results');
}
const inGroup=id=>!!groupAccess&&groupAccess.pollId===id;
const groupRpc=(action,extra={})=>rpc('gw_group_poll',{p_poll_id:groupAccess.pollId,p_group_token:groupAccess.token,p_member_id:groupAccess.memberId||null,p_action:action,...extra});
const memberHomeAllowed=()=>!inGroup(poll?.id)&&poll?.allow_member_home!==false;
function groupInviteUrl(){const u=new URL(resultsUrl());if(poll.group_join_token)u.searchParams.set('join',poll.group_join_token);return u.href}
function celebrateVote(kind='vote'){
 if(!document.createElement||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 const layer=document.createElement('div');layer.className='vote-celebration '+(kind==='results'?'results-celebration':'');layer.setAttribute('aria-hidden','true');
 layer.innerHTML=Array.from({length:kind==='results'?18:12},(_,i)=>'<span style="--x:'+((i*29+7)%96)+'%;--drift:'+((i%2?1:-1)*(25+i*5))+'px;--delay:'+(i%4)*.09+'s">'+(F.theme(poll)?[F.theme(poll).emoji,'🧡','✨','🥳']:(kind==='results'?['🏆','🧡','✨','🥳']:['🍕','🌮','🍔','🧡','✨','🥳']))[i%(F.theme(poll)||kind==='results'?4:6)]+'</span>').join('');
 document.body.appendChild(layer);setTimeout(()=>layer.remove(),2600);
}
function demoInit(){
 try{store=JSON.parse(localStorage.getItem(demoKey)||'null')}catch{store=null}
 if(!store||!store.family){
 const fam=uid();store={family:{id:fam,name:'Goodnight Family',token:token()},
 restaurants:sample.map(([name,category])=>({id:uid(),family_id:fam,name,category,address:'',active:true})),polls:[],ballots:{}};
 demoSave();
 }
 if(!store.members){store.members=['Alex','Jamie','Taylor','Sam'].map(name=>({id:uid(),name,token:token(),avatar:'🙂',active:true}));demoSave()}
 familyToken=store.family.token;
}
function demoSave(){localStorage.setItem(demoKey,JSON.stringify(store))}
function demoRpc(fn,p){
 const F=store.family;
 if(fn==='gw_poll_settings'){
  const q=store.polls.find(q=>q.id===p.p_poll_id);if(!q||p.p_token!==F.token)throw Error('Organizer access denied');
  if(p.p_allow_member_home!==undefined)q.allow_member_home=p.p_allow_member_home;
  if(p.p_group_join!==undefined)q.group_join_token=p.p_group_join?(q.group_join_token||token()):null;
  demoSave();return {allow_member_home:q.allow_member_home!==false,group_join_token:q.group_join_token};
 }
 if(fn==='gw_create_poll_themed'){const id=demoRpc('gw_create_poll_configured',p);store.polls.find(q=>q.id===id).cuisine=p.p_cuisine;demoSave();return id}
 if(fn==='gw_create_poll_configured'){const id=demoRpc('gw_create_poll_for_members',p);demoRpc('gw_poll_settings',{...p,p_poll_id:id});return id}
 if(fn==='gw_delete_polls'){
  if(p.p_token!==F.token)throw Error('Organizer access denied');
  const ids=store.polls.filter(q=>p.p_finished?(q.status==='closed'||Object.keys(store.ballots[q.id]||{}).length>=q.expected_voters):p.p_poll_ids.includes(q.id)).map(q=>q.id);
  store.polls=store.polls.filter(q=>!ids.includes(q.id));ids.forEach(id=>delete store.ballots[id]);demoSave();return ids.length;
 }
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
 if(fn==='gw_update_restaurant'){
  const r=store.restaurants.find(x=>x.id===p.p_restaurant_id&&x.family_id===F.id);
  if(!r||p.p_token!==F.token)throw Error('Restaurant not found or access denied');
  Object.assign(r,{name:p.p_name.trim(),category:p.p_category||'',address:p.p_address||'',
    icon_mode:p.p_icon_mode||'auto',icon_value:p.p_icon_value||''});
  demoSave();return r.id;
 }
 if(fn==='gw_archive_restaurant'){
   const r=store.restaurants.find(x=>x.id===p.p_restaurant_id);if(r)r.active=false;demoSave();return !!r;
 }
 if(fn==='gw_list_members'){if(p.p_token!==F.token)throw Error('Access denied');return store.members.filter(m=>m.active)}
 if(fn==='gw_create_poll_for_members'){const id=demoRpc('gw_create_poll',{...p,p_expected_voters:p.p_member_ids.length});store.polls.find(q=>q.id===id).member_ids=p.p_member_ids;demoSave();return id}
 if(fn==='gw_get_poll_people'){const q=store.polls.find(q=>q.id===p.p_poll_id);return {rostered:!!q.member_ids,eligible:false,people:store.members.filter(m=>!q.member_ids||q.member_ids.includes(m.id)).map(m=>({id:m.id,name:m.name,avatar:m.avatar,active:m.active,voted:false}))}}
 if(fn==='gw_create_poll'){
   const q={id:uid(),family_id:F.id,meal:p.p_meal,method:p.p_method,expected_voters:p.p_expected_voters,status:'open',created_at:new Date().toISOString(),restaurant_ids:p.p_restaurant_ids};store.polls.push(q);store.ballots[q.id]={};demoSave();return q.id;
 }
 if(fn==='gw_get_poll'){
   const q=store.polls.find(q=>q.id===p.p_poll_id);if(!q)throw Error('Poll is not in this browser’s demo');
   const b=Object.values(store.ballots[q.id]||{}),ready=q.status==='closed'||b.length>=q.expected_voters;
   return {id:q.id,meal:q.meal,method:q.method,expected_voters:q.expected_voters,created_at:q.created_at,
    tie_winner_id:q.tie_winner_id||null,cuisine:q.cuisine||'',allow_member_home:q.allow_member_home!==false,voted_count:b.length,status:ready?'closed':'open',options:q.restaurant_ids.map(id=>store.restaurants.find(x=>x.id===id)).filter(Boolean),
    ballots:ready?b.map(x=>x.ballot):null};
 }
 if(fn==='gw_vote'){
   const q=store.polls.find(q=>q.id===p.p_poll_id),b=store.ballots[q.id];
   if(q.status!=='open'||Object.keys(b).length>=q.expected_voters)throw Error('Voting is closed');
   b[p.p_voter_name.trim().toLowerCase()]={name:p.p_voter_name,ballot:p.p_ballot};demoSave();return {ok:true};
 }
 if(fn==='gw_resolve_tie_random'){
   if(p.p_token!==F.token)throw Error('Organizer access denied');
   const q=store.polls.find(q=>q.id===p.p_poll_id);if(!q)throw Error('Vote not found');
   if(q.tie_winner_id)return q.tie_winner_id;
   const result=demoRpc('gw_get_poll',{p_poll_id:q.id}),leaders=window.GoodnightsVoting.tally(result).winners;
   if(result.status!=='closed'||leaders.length<2)throw Error('Finish a tied vote first.');
   q.tie_winner_id=leaders[Math.floor(Math.random()*leaders.length)];q.status='closed';demoSave();return q.tie_winner_id;
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
const pollUrl=id=>{const u=new URL(location.href);u.search='?poll='+encodeURIComponent(id)+(inGroup(id)?'&join='+encodeURIComponent(groupAccess.token):memberToken&&!familyToken?'&member='+encodeURIComponent(memberToken):'');u.hash='';return u.href};
const memberUrl=t=>{const u=new URL(location.href);u.search='?member='+encodeURIComponent(t);u.hash='';return u.href};
const familyUrl=()=>{const u=new URL(location.href);u.search='?family='+encodeURIComponent(familyToken);u.hash='';return u.href};
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),4000)}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('Link copied!')}catch{prompt('Copy this link:',text)}}
const pendingLabels={repeatDinner:'Loading dinner draft…',join:'Connecting invitation…',chooseGroupMember:'Opening your ballot…',savePollSettings:'Saving voting options…',deletePoll:'Deleting vote…',clearHistory:'Clearing finished votes…',connectVote:'Connecting your phone…',createPoll:'Creating vote…',submitVote:'Saving your vote…',addMember:'Adding member…',saveMemberProfile:'Saving profile…',saveRestaurant:'Saving restaurant…',addManual:'Saving restaurant…',saveGoogle:'Saving restaurant…',addNearby:'Saving restaurant…',archive:'Hiding restaurant…',resetMemberLink:'Resetting link…',removeMember:'Removing member…',closePoll:'Closing vote…',randomTie:'Picking a tied winner…',runoff:'Creating runoff…',newFamily:'Creating family…',resetVote:'Loading your vote…'};
const pendingControls=new Map();
function syncPendingUI(){
 if(state.pendingAction){
  app.setAttribute?.('aria-busy','true');
  for(const control of app.querySelectorAll?.('button,input,select,textarea')||[]){
   if(!pendingControls.has(control))pendingControls.set(control,{disabled:control.disabled,text:control.dataset?.act===state.pendingAction?control.textContent:null});
   control.disabled=true;
   if(control.dataset?.act===state.pendingAction)control.textContent=pendingLabels[state.pendingAction];
  }
 }else{
  app.removeAttribute?.('aria-busy');
  for(const [control,original] of pendingControls){control.disabled=original.disabled;if(original.text!==null)control.textContent=original.text}
  pendingControls.clear();
 }
}
function navHtml(active){const items=familyToken?[['home','🏠 Home'],['restaurants','🍽️ Restaurants'],['create','🗳️ New vote'],['history','📜 History'],['members','👨‍👩‍👧‍👦 Members']]:[['home','🏠 My votes'],['history','📜 Past results']];return `<nav class="nav" aria-label="Navigation">${items.map(([id,label])=>`<button class="${active===id?'active':''}" ${active===id?'aria-current="page"':''} data-act="nav" data-page="${id}">${label}</button>`).join('')}</nav>`}
function layout(content,{nav=true}={}){if(state.preview)content=previewBanner()+content;badge.textContent=live?(familyToken?'ORGANIZER':member?'FAMILY MEMBER':'FAMILY APP'):'LOCAL DEMO';captureRestaurantDrafts();app.innerHTML=(nav?navHtml(state.page):'')+content;restoreRestaurantDrafts();state.renderedPage=state.page;state.renderedEditingId=state.editingId;syncPendingUI()}
function pill(q){return `<span class="status ${q.status==='closed'?'closed':''}">${q.status==='closed'?'Finished':'Voting open'}</span>`}
function timeAgo(date){try{return new Date(date).toLocaleDateString(undefined,{month:'short',day:'numeric'})}catch{return ''}}

function appearanceFields(prefix,r={}){
 const mode=r.icon_mode||'auto',value=r.icon_value||'';
 return '<div class="appearance-editor"><div class="field"><label for="'+prefix+'Mode">Restaurant logo</label>'+
  '<select id="'+prefix+'Mode">'+
  [['auto','Automatic brand logo (when recognized)'],['logo_url','Custom logo image URL'],['website','Website icon / favicon'],['builtin','Built-in SVG icon']]
  .map(([id,label])=>'<option value="'+id+'"'+(mode===id?' selected':'')+'>'+label+'</option>').join('')+
  '</select></div><div class="field"><label for="'+prefix+'Value">Logo image URL or website</label>'+
  '<input id="'+prefix+'Value" maxlength="500" value="'+esc(mode==='builtin'?'':value)+'" placeholder="https://example.com/logo.png or restaurant.com"></div>'+
  '<div class="field"><label for="'+prefix+'Icon">Built-in fallback icon</label><select id="'+prefix+'Icon">'+
  window.GoodnightsLogos.options(mode==='builtin'?value:window.GoodnightsLogos.keyFor(r.name,r.category))+
  '</select></div><p class="note">Automatic works for popular chains; use a restaurant website or paste a direct HTTPS image address for a custom logo. SVG food icons appear if an image is unavailable.</p></div>';
}
function readAppearance(prefix){
 const mode=$(prefix+'Mode').value;
 let value=$(prefix+'Value').value.trim();
 if(mode==='website'){
  value=window.GoodnightsLogos.domain(value);
  if(!value)throw Error('Enter a restaurant website such as culvers.com');
 }else if(mode==='logo_url'){
  value=window.GoodnightsLogos.imageURL(value);
  if(!value)throw Error('Use a direct HTTPS logo image URL');
 }else if(mode==='builtin')value=$(prefix+'Icon').value;
 else value='';
 return {icon_mode:mode,icon_value:value};
}
function restaurantRow(r,{select=false,remove=false}={}){
 return `<${select?'label':'div'} class="item">${select?`<input class="check" type="checkbox" aria-label="Select ${esc(r.name)}" data-select="${esc(r.id)}" ${state.selected.has(r.id)?'checked':''}>`:''}
 <div class="foodicon">${icon(r.category,r.name,r)}</div><div class="item-body"><div class="item-title">${esc(r.name)}</div><div class="item-detail">${esc([r.category,r.address].filter(Boolean).join(' · ')||'Family favorite')}${select&&state.pollCenter?` · ${r.distance===null?'Distance unavailable':r.distance.toFixed(1)+' mi'}`:''}</div></div>
 ${remove?`<div class="restaurant-actions"><button class="btn btn-quiet btn-sm" data-act="editRestaurant" data-id="${esc(r.id)}" aria-label="Edit ${esc(r.name)}">Edit</button><button class="btn btn-line btn-sm" data-act="archive" data-id="${esc(r.id)}" aria-label="Hide ${esc(r.name)}">Hide</button></div>`:''}</${select?'label':'div'}>`
}
function normalizeFamily(data){if(data?.polls)data.polls=data.polls.map(p=>({...p,status:p.status==='closed'||p.expected_voters>0&&p.voted_count>=p.expected_voters?'closed':'open'}));return data}
async function loadFamily(){if(memberToken&&!familyToken){const m=await rpc('gw_get_member',{p_member_token:memberToken});member={id:m.id,name:m.name,avatar:m.avatar};family=normalizeFamily(m.family);return}if(!familyToken){family=null;return}family=normalizeFamily(await rpc('gw_get_family',{p_token:familyToken}))}
async function loadMembers(){members=familyToken?await rpc('gw_list_members',{p_token:familyToken}):[]}
async function loadPoll(id){
 const previous=poll,next=await rpc('gw_get_poll',{p_poll_id:id});
 try{await loadVoterStatus(next)}catch{next.voter_error=true;next.people_error=true;if(previous?.id===id)next.voted_member_ids=previous.voted_member_ids||[]}
 await loadPeople(next);
 if(familyToken){try{Object.assign(next,await rpc('gw_poll_settings',{p_token:familyToken,p_poll_id:id}))}catch{next.settings_error=true}}
 poll=next;
}
async function loadVoterStatus(target){if(member&&(memberToken||inGroup(target.id)&&groupAccess.memberId)){const voted=inGroup(target.id)?await groupRpc('has_voted'):await rpc('gw_member_has_voted',{p_poll_id:target.id,p_member_token:memberToken});target.voted_member_ids=voted?[member.id]:[]}}
function setPage(p){if(!familyToken&&['create','restaurants','members'].includes(p))p='home';state.preview=false;state.page=p;if(p!=='poll'){history.replaceState(null,'',location.pathname);clearInterval(pollTimer)}render();window.scrollTo({top:0,behavior:'instant'})}
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
 ${live?`<button class="btn btn-dark" data-act="newFamily">Create our family</button><div class="field"><label>Already have an invitation?</label><input id="joinToken" placeholder="Paste your personal or organizer link"></div><button class="btn btn-line" data-act="join">Join family</button>`:`<button class="btn btn-dark" data-act="demo">Explore the sample app</button><p class="note">Demo only until you connect Supabase. Votes stay in this browser and cannot be shared with other phones.</p>`}</div>`,{nav:false})}
function renderHome(){
 if(member&&!familyToken)return renderMemberHome();
 let latest=family.polls||[];
 layout(`<div class="card hero"><div class="hero-emoji">🍔</div><div class="eyebrow">${esc(family.name)} · DINNER CLUB</div><h1>So... what's for dinner?</h1><p class="lede">Skip the debate. Pick a few places, vote together, and let dinner decide itself.</p>${familyToken?`<button class="btn btn-dark" data-act="nav" data-page="create">Start a family vote →</button>`:`<p class="subtle">Signed in as ${esc(member?.name||"family member")}</p>`}</div>
 ${!live?`<div class="muted-box" style="margin-bottom:15px"><strong>🧪 Local demo</strong><div>This sample works on this device only. To vote together on multiple phones, complete the Supabase + GitHub Pages setup in the README.</div></div>`:''}
 ${familyToken?`<div class="grid2"><div class="card"><span class="eyebrow">FAMILY FAVORITES</span><h2>🍽️ ${family.restaurants.length} places</h2><p class="subtle">Add restaurants once. Vote on them anytime.</p><button class="btn btn-quiet btn-sm" data-act="nav" data-page="restaurants">Manage restaurants ↗</button></div>
 <div class="card"><span class="eyebrow">INVITE FAMILY</span><h2>👨‍👩‍👧‍👦 Invite your people</h2><p class="subtle">Choose a person and copy their own voting link.</p><button class="btn btn-quiet btn-sm" data-act="nav" data-page="members">Personal invitations ↗</button></div></div>`:''}
 <div class="between" style="margin:22px 0 11px"><h2 style="margin:0">Recent votes</h2><button class="btn btn-quiet btn-sm" data-act="nav" data-page="history">View all</button></div>
 ${latest.length?latest.slice(0,4).map(q=>`<div class="card"><div class="between"><div><strong>${esc(q.meal)} · ${methodName(q.method)}</strong><div class="subtle">${timeAgo(q.created_at)} · ${q.voted_count}/${q.expected_voters} voted</div></div>${pill(q)}</div><button class="btn btn-quiet btn-sm" style="margin-top:12px" data-act="openpoll" data-id="${esc(q.id)}">Open vote →</button></div>`).join(''):
 `<div class="card empty"><span class="empty-emoji">🗳️</span><h3>Your first vote is waiting</h3><p>There are no polls yet.</p>${familyToken?`<button class="btn btn-primary" data-act="nav" data-page="create">Create first vote</button>`:''}</div>`}${installationGuide()}`)
}
function renderMemberHome(){
 const polls=family.polls||[],open=polls.filter(p=>p.status==='open'),closed=polls.filter(p=>p.status==='closed');
 const cards=list=>list.map(p=>`<div class="card"><div class="between"><div><h3>${esc(p.meal)} · ${methodName(p.method)}</h3><p class="subtle">${timeAgo(p.created_at)} · ${p.voted_count}/${p.expected_voters} votes in</p></div>${pill(p)}</div><button class="btn btn-primary btn-full" data-act="openpoll" data-id="${esc(p.id)}">${p.status==='open'?'Open vote →':'See results →'}</button></div>`).join('');
 layout(`${memberIdentity(member)}<h1>Your family votes.</h1><p class="lede">Choose an open vote or catch up on the latest dinner decision.</p><h2>🗳️ Open votes</h2>${open.length?cards(open):'<div class="card empty"><h3>Nothing to vote on right now</h3><p>Your organizer will send an invitation when the next vote is ready.</p></div>'}<h2 style="margin-top:24px">🏆 Recent results</h2>${closed.length?cards(closed.slice(0,4)):'<p class="subtle">Finished votes will appear here.</p>'}${installationGuide()}`)
}
function memberAvatar(m){const a=F.avatar(m?.avatar);return a.startsWith('data:')?`<span class="member-avatar"><img data-member-avatar src="${esc(a)}" alt=""><span hidden>🙂</span></span>`:`<span class="member-avatar" aria-hidden="true">${esc(a)}</span>`}
function memberIdentity(m){return `<div class="member-identity">${memberAvatar(m)}<div><span class="eyebrow">YOUR FAMILY VOTE</span><strong>${esc(m.name)}</strong></div></div>`}
function memberEditor(){
 const m=members.find(m=>m.id===state.editingMember);if(!m)return '';
 return `<section class="card profile-editor"><h2>✏️ Edit ${esc(m.name)}</h2><div id="avatarPreview">${memberIdentity({name:m.name,avatar:state.avatarDraft})}</div>
 <div class="field"><label for="profileName">Name</label><input id="profileName" maxlength="60" value="${esc(m.name)}"></div>
 <div class="field"><label for="profilePhone">Phone or iMessage email (optional)</label><input id="profilePhone" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" value="${esc(m.phone||'')}" placeholder="+1 555 123 4567 or name@icloud.com"></div><p class="note">Visible only to the organizer. Use an iMessage-enabled email on Apple devices, or a phone number with country code. Share/Copy works if your messaging app cannot open the recipient.</p>
 <fieldset class="avatar-options"><legend>Choose an avatar</legend>${F.emojis.map(a=>`<button type="button" class="avatar-choice" aria-label="Avatar ${a}" aria-pressed="${state.avatarDraft===a}" data-act="chooseAvatar" data-avatar="${a}">${a}</button>`).join('')}</fieldset>
 <div class="field"><label for="profilePhoto">Or upload a small photo</label><input id="profilePhoto" type="file" accept="image/jpeg,image/png,image/webp"><span class="note">Saved as a clear 256×256 photo, with light JPEG compression. Reupload an original photo to upgrade an older 96×96 avatar.</span></div>
 <div class="btn-row"><button class="btn btn-primary" data-act="saveMemberProfile" ${state.photoBusy?'disabled':''}>Save profile</button><button class="btn btn-line" data-act="cancelMemberProfile">Cancel</button></div></section>`;
}
async function readAvatar(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG or WebP photo.');
 if(file.size>10*1024*1024)throw Error('Choose a photo smaller than 10 MB.');
 const url=URL.createObjectURL(file),img=new Image();
 try{await new Promise((ok,fail)=>{img.onload=ok;img.onerror=()=>fail(Error('Could not read this photo.'));img.src=url});
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d'),side=Math.min(img.naturalWidth,img.naturalHeight);ctx.fillStyle='#fff';ctx.fillRect(0,0,256,256);ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,256,256);let data=canvas.toDataURL('image/jpeg',0.9);if(data.length>120000)data=canvas.toDataURL('image/jpeg',0.75);if(F.avatar(data)!==data)throw Error('Photo could not be compressed. Try another photo.');return data;
 }finally{URL.revokeObjectURL(url)}
}
function renderMembers(){
 if(!familyToken){setPage('home');return}
 layout(`<div class="eyebrow">FAMILY SETTINGS</div><h1>Family members</h1><p class="lede">Personal links, familiar faces, and an easier way to invite everyone.</p>
 <div class="card"><h2>Add a member</h2><div class="field"><label for="newMemberName">Name</label><input id="newMemberName" maxlength="60" placeholder="e.g. Charlotte"></div><button class="btn btn-primary btn-full" data-act="addMember">＋ Add family member</button></div>
 ${memberEditor()}<div class="card"><h2>${members.length} members</h2>${members.map(m=>`<div class="member-profile-row"><div class="member-identity">${memberAvatar(m)}<div><strong>${esc(m.name)}</strong></div></div><div class="btn-row"><button class="btn btn-quiet btn-sm" data-act="copyMember" data-id="${esc(m.id)}">Copy invitation</button><button class="btn btn-primary btn-sm" data-act="editMemberProfile" data-id="${esc(m.id)}">Edit profile</button></div><details class="member-access"><summary>Access & membership</summary><p class="note">Reset an invitation if it was shared accidentally, or remove someone’s voting access.</p><div class="btn-row"><button class="btn btn-line btn-sm" data-act="resetMemberLink" data-id="${esc(m.id)}">Reset personal link</button><button class="btn btn-line btn-sm" data-act="removeMember" data-id="${esc(m.id)}">Remove member</button></div></details></div>`).join('')||'<p>No family members yet.</p>'}</div><p class="note">Only the organizer can edit profiles and phone numbers. Reset a personal link if it is shared accidentally.</p><details class="card organizer-backup"><summary>🔑 Organizer access backup</summary><p class="note">This private link gives full organizer access. Save it for yourself or another organizer. Invite voters with their personal links above.</p><button class="btn btn-line btn-full" data-act="familyLink">Copy private organizer link</button></details>`)
}
function renderRestaurants(){
 if(!familyToken){setPage('home');return}
 const editR=state.editingId?family.restaurants.find(r=>r.id===state.editingId):null;
 const search=state.search.toLowerCase().trim(),restaurants=(family.restaurants||[]).filter(r=>(r.name+' '+r.category+' '+r.address).toLowerCase().includes(search));
 layout(`<div class="eyebrow">OUR GO-TO SPOTS</div><div class="between"><div><h1>Our restaurants.</h1><p class="lede">Your family's personal shortlist. Add any place you like.</p></div><button class="btn btn-primary btn-sm" data-act="toggleDiscovery">${state.discoverOpen?'Done':'＋ Add restaurant'}</button></div>
 ${editR?`<div class="card restaurant-edit-card"><div class="eyebrow">CUSTOMIZE RESTAURANT</div><h2>Edit ${esc(editR.name)}</h2>
<div class="field"><label for="editName">Restaurant name</label><input id="editName" maxlength="120" value="${esc(editR.name)}"></div>
<div class="field"><label for="editCategory">Category</label><input id="editCategory" maxlength="80" value="${esc(editR.category||'')}"></div>
<div class="field"><label for="editAddress">Address</label><input id="editAddress" maxlength="240" value="${esc(editR.address||'')}"></div>
${appearanceFields('edit',editR)}
<div class="logo-preview-line"><span>Current</span><div class="foodicon">${icon(editR.category,editR.name,editR)}</div><span>Preview</span><div id="logoPreview" class="foodicon">${icon(editR.category,editR.name,editR)}</div></div>
<div class="btn-row"><button class="btn btn-line" data-act="previewRestaurant">Preview logo</button><button class="btn btn-line" data-act="cancelRestaurant">Cancel</button><button class="btn btn-primary" data-act="saveRestaurant">Save changes</button></div></div>`:''}
<div class="card"><h2>Your saved favorites</h2><div class="field" style="margin-top:0"><label for="restaurantSearch">Filter your list</label><input id="restaurantSearch" value="${esc(state.search)}" placeholder="Search saved restaurants…"></div>
 ${restaurants.length?restaurants.map(r=>restaurantRow(r,{remove:true})).join(''):`<div class="empty"><span class="empty-emoji">🥗</span><h3>No matching restaurants</h3><p>Add a favorite or change your search.</p></div>`}</div>
 ${state.discoverOpen?`<div id="restaurantDiscovery"> <div class="card"><div class="between"><h2 style="margin:0">Find something good</h2><button class="btn btn-primary btn-sm" data-act="toggleAdd">✍️ Enter manually</button></div>
 <h3>Find local restaurants</h3><p class="note">Search by restaurant name, town, or both. Leave the name blank to browse nearby places. OpenStreetMap results may be incomplete.</p><div class="field"><label for="localName">Restaurant name (optional)</label><input id="localName" maxlength="80" value="${esc(state.restaurantName)}" placeholder="e.g. Culver's or Puccini's"></div><div class="field"><label for="city">Town / location</label><input id="city" value="${esc(state.city)}" placeholder="New Palestine, Indiana"></div><div class="btn-row"><button class="btn btn-quiet btn-sm" data-act="townSearch" ${state.nearbyBusy?'disabled':''}>🔎 Search restaurants</button><button class="btn btn-quiet btn-sm" data-act="gpsSearch" ${state.nearbyBusy?'disabled':''}>📍 Search near me</button></div>
 ${state.adding?`<div class="field"><label for="restName">Restaurant name</label><input id="restName" maxlength="120" placeholder="e.g. Frosty Boy"></div><div class="field"><label for="restCategory">Cuisine or category</label><input id="restCategory" maxlength="80" placeholder="e.g. Burgers, Pizza, Ice cream"></div>${appearanceFields('manual')}<button class="btn btn-dark btn-full" data-act="addManual">Save to family list</button>`:''}
 ${state.nearbyBusy?'<p class="subtle">Looking for restaurants…</p>':''}${state.showNearby?`<h3 style="margin-top:20px">${state.nearby.length} ${state.nearbyQuery?'matching':'nearby'} restaurants${state.nearbyQuery?' for “'+esc(state.nearbyQuery)+'”':''}</h3>${state.nearby.length?state.nearby.map((r,i)=>`<div class="item"><div class="foodicon">${icon(r.category,r.name,r)}</div><div class="item-body"><div class="item-title">${esc(r.name)}</div><div class="item-detail">${esc(r.category)}${r.distance!=null?' · '+r.distance.toFixed(1)+' mi':''}${r.address?' · '+esc(r.address):''}</div></div>${family.restaurants.some(saved=>saved.osm_id&&saved.osm_id===r.osm_id)?'<span class="subtle">✓ Saved</span>':`<button class="btn btn-quiet btn-sm" data-act="addNearby" data-idx="${i}">+ Save</button>`}</div>`).join(''):'<p class="subtle">No matches found here. You can add a restaurant manually above.</p>'}`:''}
 </div>
 <div class="card"><h2>Find it on Google Maps</h2>
 <p class="subtle">Free option: search Google Maps in another tab, then copy the restaurant name and address here. No Google API key required.</p>
 <button class="btn btn-quiet btn-full" data-act="openGoogleMaps">🔎 Search Google Maps ↗</button>
 <div class="field"><label for="googlePaste">Paste a Google Maps listing, full link, or name and address</label><textarea class="searchbox" id="googlePaste" rows="3" style="resize:vertical;min-height:86px" placeholder="Restaurant name&#10;Street address, city, state&#10;or a Google Maps link"></textarea></div>
 <button class="btn btn-line btn-full" data-act="fillGoogle">Use pasted details ↓</button>
 <div class="field"><label for="googleName">Restaurant name</label><input id="googleName" maxlength="120" placeholder="e.g. Frosty Boy"></div>
 <div class="field"><label for="googleAddress">Address (optional)</label><input id="googleAddress" maxlength="240" placeholder="Street address, town, state"></div>
 ${appearanceFields('google')}
 <p class="note">Short maps.app.goo.gl links don't contain readable names. If you copy one, also paste the restaurant name and address from Google Maps.</p>
 <button class="btn btn-dark btn-full" data-act="saveGoogle">＋ Save to family restaurants</button>
 </div><button class="btn btn-line btn-full" data-act="toggleDiscovery">← Back to saved restaurants</button></div>`: ''}`)
}
function methodName(m){return {approval:'Approval',swipe:'Swipe / Consensus',ranked:'Ranked choice'}[m]||m}
function pollChoices(){
 const query=state.pollSearch.trim().toLowerCase();
 return (family.restaurants||[]).map(r=>({...r,distance:state.pollCenter&&Number.isFinite(r.latitude)&&Number.isFinite(r.longitude)?geodistance(state.pollCenter.lat,state.pollCenter.lon,r.latitude,r.longitude):null}))
 .filter(r=>F.matchesCuisine(r,state.pollCuisine)&&(!query||[r.name,r.category,r.address].join(' ').toLowerCase().includes(query))&&(!state.pollCenter||!state.pollRadius||(r.distance!==null&&r.distance<=Number(state.pollRadius))))
 .sort((a,b)=>state.pollCenter?(a.distance??Infinity)-(b.distance??Infinity)||a.name.localeCompare(b.name):a.name.localeCompare(b.name));
}
function cuisineControls(){
 const restaurants=family.restaurants||[],counts=F.cuisines.map(([id,label])=>({id,label,count:restaurants.filter(r=>F.matchesCuisine(r,id)).length})).filter(c=>c.count);
 return `<div class="cuisine-planner"><label for="pollCuisine">Already know what sounds good?</label><select id="pollCuisine"><option value="">All cuisines</option>${counts.map(c=>`<option value="${c.id}" ${state.pollCuisine===c.id?'selected':''}>${esc(c.label)} · ${c.count} places</option>`).join('')}</select><p class="note">Choose a cuisine to shortlist its places, then adjust your picks. Other filters still apply.</p><div class="btn-row">${counts.filter(c=>['pizza','mexican'].includes(c.id)).map(c=>`<button class="btn btn-line btn-sm" data-act="cuisine" data-cuisine="${c.id}" ${c.count<2?'disabled':''}>${esc(c.label)} night</button>`).join('')}</div>${state.pollCuisine?'<p class="cuisine-focus">A cuisine showdown! Your shortlist stays within this food type.</p>':''}</div>`;
}
function chooseCuisine(key){
 if(key&&!F.cuisines.some(c=>c[0]===key))return;
 state.pollCuisine=key;state.selected=new Set(pollChoices().slice(0,20).map(r=>r.id));render();
 toast(state.selected.size<2?'Fewer than two places match. Adjust the filters or add another favorite.':state.selected.size+' places shortlisted. Adjust your picks below.');
}
let installPrompt=null;
function installationGuide(){
 if(!live||window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone)return '';
 return `<details class="card install-guide"><summary>📲 Add Goodnights to your phone</summary><p>Keep your dinner crew a tap away, with the same app for organizers and family.</p>${installPrompt?'<button class="btn btn-quiet" data-act="installApp">Install Goodnights</button>':''}<p class="note"><strong>iPhone / iPad:</strong> open this site in Safari, then use Share → Add to Home Screen. Turn on Open as Web App if offered.<br><strong>Android / desktop:</strong> use your browser’s Install app or Add to Home screen option.</p><p class="note">Keep your private invitation link. If the installed app opens without your identity, open your invitation there or connect it using the link field. A family group invitation also works for that vote.</p><p class="note">Installation adds an app icon. Background result notifications aren’t enabled yet.</p></details>`;
}
function selectedPeople(){return members.filter(m=>state.selectedPeople.has(m.id)&&m.active!==false)}
function stepReady(step){return step===0?state.selected.size>=2&&state.selected.size<=20:[1].includes(step)?!state.peopleLoadError&&selectedPeople().length>=1&&selectedPeople().length<=20:['approval','swipe','ranked'].includes(state.method)}
async function loadCreatePeople(){
 try{await loadMembers();state.peopleLoadError=false;const active=members.filter(m=>m.active!==false);if(!state.peopleInitialised&&active.length){state.selectedPeople=new Set(active.slice(0,20).map(m=>m.id));state.peopleInitialised=true}else state.selectedPeople=new Set([...state.selectedPeople].filter(id=>active.some(m=>m.id===id)))}catch{state.peopleLoadError=true}
}
// Copy only reviewable choices. Source ballots, credentials and outcome never enter draft state.
function repeatSelections(options,people,currentFamily,currentMembers){
 const restaurants=(currentFamily.restaurants||[]).filter(r=>r.active!==false),active=currentMembers.filter(m=>m.active!==false);
 const places=options.filter(o=>restaurants.some(r=>r.id===o.id)),invited=people.filter(p=>active.some(m=>m.id===p.id));
 const notes=[];
 const omittedPlaces=options.filter(o=>!places.includes(o)).concat(places.slice(20));
 const omittedPeople=people.filter(p=>!invited.includes(p)).concat(invited.slice(20));
 if(omittedPlaces.length)notes.push('Places omitted (hidden, unavailable, or beyond the 20-place limit): '+omittedPlaces.map(o=>o.name||'Unavailable place').join(', ')+'.');
 if(omittedPeople.length)notes.push('People omitted (no longer active or beyond the 20-person limit): '+omittedPeople.map(p=>p.name||'Unavailable person').join(', ')+'.');
 return {selected:new Set(places.slice(0,20).map(o=>o.id)),selectedPeople:new Set(invited.slice(0,20).map(p=>p.id)),notes};
}
async function repeatDinner(id){
 const [source,currentFamily,currentMembers,roster]=await Promise.all([
  rpc('gw_get_poll',{p_poll_id:id}),rpc('gw_get_family',{p_token:familyToken}),rpc('gw_list_members',{p_token:familyToken}),
  rpc('gw_get_poll_people',{p_poll_id:id,p_token:familyToken,p_member_token:null,p_include_avatars:false})
 ]);
 if(source.status!=='closed'&&!(source.expected_voters>0&&source.voted_count>=source.expected_voters))throw Error('Finish this vote before using it again.');
 if(!['Lunch','Dinner'].includes(source.meal)||!['approval','swipe','ranked'].includes(source.method))throw Error('This dinner could not be copied. Start a new vote instead.');
 const draft=repeatSelections(source.options||[],roster.rostered?roster.people||[]:[],currentFamily,currentMembers);
 if(!roster.rostered)draft.notes.push('This older vote has no saved guest list. Select the people joining this time.');
 const cuisine=F.cuisines.some(c=>c[0]===source.cuisine)?source.cuisine:'';
 if(source.cuisine&&!cuisine)draft.notes.push('The previous cuisine is unavailable. Choose a cuisine or keep All cuisines.');
 family=normalizeFamily(currentFamily);members=currentMembers;
 state.selected=draft.selected;state.selectedPeople=draft.selectedPeople;state.peopleInitialised=true;state.peopleLoadError=false;
 state.meal=source.meal;state.method=source.method;state.pollCuisine=cuisine;
 state.pollSearch='';state.pollCenter=null;state.pollRadius='';state.allowMemberHome=false;state.groupJoin=true;
 state.repeatDraft={notes:draft.notes};state.createStep=3;setPage('create');
}
async function revalidateRepeatDraft(){
 const [currentFamily,currentMembers]=await Promise.all([rpc('gw_get_family',{p_token:familyToken}),rpc('gw_list_members',{p_token:familyToken})]);
 const options=[...state.selected].map(id=>(family.restaurants||[]).find(r=>r.id===id)||{id});
 const people=[...state.selectedPeople].map(id=>members.find(m=>m.id===id)||{id});
 const next=repeatSelections(options,people,currentFamily,currentMembers);
 family=normalizeFamily(currentFamily);members=currentMembers;state.selected=next.selected;state.selectedPeople=next.selectedPeople;
 if(next.notes.length){state.repeatDraft.notes.push(...next.notes);render();toast('Availability changed. Review the updated draft before creating it.');return false}
 return true;
}
function renderCreate(){
 if(!familyToken){setPage('home');return}
 const choices=pollChoices(),people=selectedPeople(),steps=['Places','People','Method','Review'],step=state.createStep;
 let content='';
 if(step===0)content=`<section class="card"><div class="field" style="margin-top:0"><label for="meal">What are we planning?</label><select id="meal"><option ${state.meal==='Dinner'?'selected':''}>Dinner</option><option ${state.meal==='Lunch'?'selected':''}>Lunch</option></select></div><div class="between"><h2>Pick the contenders</h2><span class="count">${state.selected.size} selected</span></div><p class="subtle">Choose 2–20 places. Tap a row to select it.</p><div class="field"><label for="pollSearch">Name, category or town</label><input id="pollSearch" value="${esc(state.pollSearch)}" placeholder="Restaurant or town…"></div><div class="btn-row"><button class="btn btn-quiet btn-sm" data-act="pollLocation">📍 Closest to me</button><button class="btn btn-line btn-sm" data-act="resetPollFilters">Reset filters</button><button class="btn btn-quiet btn-sm" data-act="random">🎲 Pick 5 for me</button></div>${cuisineControls()}
 ${state.pollCenter?`<div class="field"><label for="pollRadius">Distance from you</label><select id="pollRadius">${[['','Any distance'],['5','Within 5 miles'],['10','Within 10 miles'],['20','Within 20 miles']].map(([v,label])=>`<option value="${v}" ${state.pollRadius===v?'selected':''}>${label}</option>`).join('')}</select></div><p class="note">Straight-line distance, not driving time. Entries without coordinates appear last, or are excluded by a distance limit.</p>`:''}
 <div class="btn-row" style="margin:15px 0"><button class="btn btn-quiet btn-sm" data-act="selectAll">Select all shown (up to 20)</button><button class="btn btn-line btn-sm" data-act="clear">Clear selection</button></div><p class="note">${choices.length} shown · ${[...state.selected].filter(id=>!choices.some(r=>r.id===id)).length} selected outside these filters</p>
 ${choices.length?choices.map(r=>restaurantRow(r,{select:true})).join(''):'<p>No matching places. Reset the filters or add a restaurant.</p>'}</section>`;
 if(step===1)content=`<section class="card"><h2>Who's joining?</h2><p class="subtle">Choose the people eating together. Their number sets when the vote finishes.</p>${state.peopleLoadError?'<p>Could not load your family.</p><button class="btn btn-quiet" data-act="retryCreatePeople">Retry</button>':!members.length?'<div class="empty"><h3>Add your family first</h3><button class="btn btn-primary" data-act="nav" data-page="members">Add family members</button></div>':`<div class="btn-row"><button class="btn btn-quiet btn-sm" data-act="allPeople">Select everyone</button><button class="btn btn-line btn-sm" data-act="clearPeople">Clear</button></div><div class="people-grid">${members.filter(m=>m.active!==false).map(m=>`<label class="person-option ${state.selectedPeople.has(m.id)?'selected':''}"><input type="checkbox" data-person="${esc(m.id)}" ${state.selectedPeople.has(m.id)?'checked':''}>${memberAvatar(m)}<strong>${esc(m.name)}</strong></label>`).join('')}</div>`}<p class="note">${people.length} people selected. Invite them together or individually.</p></section>`;
 if(step===2)content=`<section class="card"><h2>How should we vote?</h2><p class="subtle">Pick a style, or practice a ballot first.</p>${[['approval','✅','Approval vote','Choose up to two favorites.'],['swipe','👍','Swipe / consensus','Yes or no to each restaurant.'],['ranked','🥇','Ranked choice','Rank your top three in order.']].map(([id,emoji,title,desc])=>`<label class="method ${state.method===id?'checked':''}"><input type="radio" name="method" value="${id}" ${state.method===id?'checked':''}><span class="methodmark">${emoji}</span><span><strong>${title}</strong><small>${desc}</small></span></label><button class="btn btn-line btn-sm practice-link" data-act="previewMode" data-method="${id}">🧪 Try ${title}</button>`).join('')}</section>`;
 if(step===3)content=`<section class="card review-hero"><div class="eyebrow">READY FOR THE FAMILY</div><h2>${esc(state.meal)} · ${methodName(state.method)}</h2>${state.repeatDraft?`<p class="note">Cuisine: ${esc(F.cuisines.find(c=>c[0]===state.pollCuisine)?.[1]||'All cuisines')} · <button class="btn btn-line btn-sm" data-act="createGo" data-step="0">Edit meal or cuisine</button></p>`:''}<p class="subtle">${state.selected.size} places · ${people.length} people</p><p class="note">Results stay hidden until these people finish, or you close the vote early.</p></section><section class="card"><div class="between"><h2>The menu</h2><button class="btn btn-line btn-sm" data-act="createGo" data-step="0">Edit places</button></div>${(family.restaurants||[]).filter(r=>state.selected.has(r.id)).map(r=>restaurantRow(r)).join('')}</section><section class="card"><div class="between"><h2>Your dinner crew</h2><button class="btn btn-line btn-sm" data-act="createGo" data-step="1">Edit people</button></div><div class="people-grid review-people">${people.map(m=>`<div class="person-option">${memberAvatar(m)}<strong>${esc(m.name)}</strong></div>`).join('')}</div><p class="note">Only these people can submit ballots. After creation, share the family group invitation or send personal links.</p><button class="btn btn-line btn-full" data-act="createGo" data-step="2">Change voting method</button></section><section class="card"><h2>Voting experience</h2><label class="setting-row"><input id="allowMemberHome" type="checkbox" ${state.allowMemberHome?'checked':''}><span><strong>Show “My votes” navigation</strong><small>Turn off to keep members on this vote and its results. This is a navigation preference, not an access restriction.</small></span></label><label class="setting-row"><input id="groupJoin" type="checkbox" ${state.groupJoin?'checked':''}><span><strong>Let the family choose their name from the group invite</strong><small>Anyone with this invitation can see invited names/photos and submit once as any invited person. Personal links stay private and are needed to edit a saved vote. Share only with your trusted family group.</small></span></label></section>`;
 layout(`<div class="wizard-flow"><div class="eyebrow">MAKE A DECISION</div><h1>${state.repeatDraft?'Use this dinner again.':'Start a vote.'}</h1>${state.repeatDraft?`<section class="card" aria-label="Dinner draft"><p>This is an editable draft. The previous vote stays unchanged. Nothing is created or shared until you choose Create vote. Voting experience starts with new-vote defaults; review the switches below.</p>${state.repeatDraft.notes.map(note=>`<p class="note">${esc(note)}</p>`).join('')}<p class="note">${state.selected.size<2?'Choose at least two current places. ':''}${people.length<1?'Choose at least one current person.':''}</p><button class="btn btn-line btn-sm" data-act="cancelRepeat">Cancel draft</button></section>`:''}<nav class="wizard-steps" aria-label="Vote creation steps">${steps.map((name,i)=>`<button class="${i===step?'active':''}" aria-current="${i===step?'step':'false'}" data-act="createGo" data-step="${i}"><span>${i+1}</span>${name}</button>`).join('')}</nav>${content}</div><div class="wizard-actions" role="region" aria-label="Vote creation actions"><div class="wizard-count" aria-live="polite"><strong>${step===0?state.selected.size+' places selected':step===1?people.length+' people selected':step===2?methodName(state.method):state.selected.size+' places · '+people.length+' people'}</strong><span>${step===0?'Choose at least two':step===1?'Choose at least one':step===2?'You can practice any style':'Next: invite everyone'}</span></div><div class="btn-row">${step>0?'<button class="btn btn-line" data-act="createBack">Back</button>':''}${step<3?`<button class="btn btn-primary" data-act="createNext" ${!stepReady(step)?'disabled':''}>Continue →</button>`:`<button class="btn btn-primary" data-act="createPoll" ${![0,1,2].every(stepReady)?'disabled':''}>Create ${esc(state.meal.toLowerCase())} vote →</button>`}</div></div>`);
}

function renderHistory(){
 layout(`<div class="eyebrow">THE DECISIONS WE MADE</div><h1>Vote history.</h1><p class="lede">Every delicious decision, all in one place.</p>${familyToken?'<button class="btn btn-line btn-sm" data-act="clearHistory">Clear finished history</button><p class="note">Permanently removes finished polls and their ballots, including older history. Open votes stay.</p>':''}
 ${(family.polls||[]).length?family.polls.map(q=>`<div class="card"><div class="between"><div><strong>${esc(q.meal)} · ${methodName(q.method)}</strong><div class="subtle">${timeAgo(q.created_at)} · ${q.voted_count}/${q.expected_voters} family votes</div></div>${pill(q)}</div><button class="btn btn-quiet btn-sm" style="margin-top:13px" data-act="openpoll" data-id="${esc(q.id)}">View poll →</button>${familyToken?`<button class="btn btn-line btn-sm" data-act="deletePoll" data-id="${esc(q.id)}">Delete</button>${q.status==='closed'?`<button class="btn btn-line btn-sm" data-act="repeatDinner" data-id="${esc(q.id)}">Use this dinner again</button>`:''}`:''}</div>`).join(''):`<div class="card empty"><span class="empty-emoji">🍜</span><h3>No votes yet</h3><p>Start a poll and it will appear here.</p></div>`}`)
}
function previewBanner(){return `<section class="card preview-banner"><div class="eyebrow">🧪 PRACTICE VOTE · NOTHING SAVED</div><h2>Try ${methodName(poll?.method)}</h2><div class="btn-row">${['approval','swipe','ranked'].map(m=>`<button class="btn btn-quiet btn-sm" data-act="previewMode" data-method="${m}">${methodName(m)}</button>`).join('')}</div><button class="btn btn-line btn-full" style="margin-top:12px" data-act="exitPreview">← Back to new vote</button></section>`}
function startPreview(method){
 if(!familyToken||!['approval','swipe','ranked'].includes(method))return;
 clearInterval(pollTimer);state.preview=true;state.page='poll';state.approvals=new Set();state.swipes={};state.swipeIndex=0;state.rank=[];
 const options=[{id:'practice-pizza',name:'Pizza night',category:'Pizza',icon_mode:'builtin',icon_value:'pizza'},{id:'practice-burger',name:'Burger stop',category:'Burgers',icon_mode:'builtin',icon_value:'burger'},{id:'practice-taco',name:'Taco time',category:'Mexican',icon_mode:'builtin',icon_value:'taco'}];
 poll={id:'preview',meal:'Dinner',method,options,status:'open',voted_count:0,expected_voters:1};render();window.scrollTo({top:0});
}
function resultsUrl(){const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('poll',poll.id);return u.href}
function pollMessage(m){return poll.status==='closed'?F.result(poll,window.GoodnightsVoting.tally(poll),resultsUrl()):F.invite(poll,m.name,memberPollUrl(m))}
function smsUrl(m,text){return F.sms(m?.phone||'',text,/iPad|iPhone|iPod/.test(navigator.userAgent||''))}
async function shareMessage(text){if(navigator.share){try{await navigator.share({title:'Goodnights 🍽️',text})}catch(e){if(e.name!=='AbortError')await copyMessage(text)}}else await copyMessage(text)}
async function copyMessage(text){try{await navigator.clipboard.writeText(text);toast('Message copied!')}catch{prompt('Copy this message:',text)}}
function pollSharing(){
 const invited=members.filter(m=>!poll.roster_enabled||(poll.people||[]).some(p=>p.id===m.id));
 const groupText=F.groupInvite(poll,groupInviteUrl());
 const closed=poll.status==='closed',summary=closed?F.result(poll,window.GoodnightsVoting.tally(poll),resultsUrl()):'';
 return `<section class="card sharing-card"><div class="eyebrow">${closed?'📣 DINNER IS DECIDED':'💌 INVITE THE FAMILY'}</div><h2>${closed?'Share the results':'Invite family to this vote'}</h2><p class="note">${closed?'Group-safe results include the winner and voting stats.':'Send each personal invitation only to that person.'} Text opens a draft; you choose when to send. Share opens your device’s app picker. If your text app omits the draft, use Copy message and paste it.</p>
 ${!closed?`<div class="group-invite"><h3>👨‍👩‍👧‍👦 Start in your family group chat</h3><p class="note">${poll.group_join_token?'One invitation opens an avatar/name picker. Anyone with it can choose an invited person; share only in your trusted family group.':'One link uses each person’s saved identity. On a new phone, connect your personal link once. Enable the optional name picker in Voting options below.'} Choose your existing family conversation in Messages.</p><pre class="message-preview">${esc(groupText)}</pre><div class="btn-row"><a class="btn btn-primary btn-sm" href="${esc(smsUrl(null,groupText))}">💬 Text group invite</a><button class="btn btn-quiet btn-sm" data-act="shareGroupInvite">Share group invite</button><button class="btn btn-line btn-sm" data-act="copyGroupInvite">Copy group invite</button></div></div>`:''}
 ${closed?`<pre class="message-preview">${esc(summary)}</pre><div class="btn-row"><a class="btn btn-primary" href="${esc(smsUrl(null,summary))}">💬 Text results</a><button class="btn btn-quiet" data-act="shareResultsMessage">↗ Share results</button><button class="btn btn-line" data-act="copyResultsMessage">📋 Copy message</button></div>`:''}
 ${!live?'<p class="note">Sharing is available in the connected family app.</p>':state.memberLoadError?'<p>Could not load family links.</p><button class="btn btn-quiet" data-act="retryMembers">Retry</button>':poll.roster_enabled&&poll.people_error?'<p>Load participant status to see invitations.</p><button class="btn btn-quiet" data-act="refreshPeople">Retry status</button>':invited.length?invited.map(m=>`<details class="member-invite"><summary>${memberAvatar(m)}<strong>${esc(m.name)}</strong><span>${closed?'Results':'Invitation'} ✉️</span></summary><pre class="message-preview">${esc(pollMessage(m))}</pre><div class="btn-row"><a class="btn btn-primary btn-sm" href="${esc(smsUrl(m,pollMessage(m)))}">💬 Text ${esc(m.name)}</a><button class="btn btn-quiet btn-sm" data-act="shareMemberPoll" data-id="${esc(m.id)}">↗ Share message</button><button class="btn btn-line btn-sm" data-act="copyMemberMessage" data-id="${esc(m.id)}">📋 Copy message</button>${!closed?`<button class="btn btn-line btn-sm" data-act="copyMemberPoll" data-id="${esc(m.id)}">Copy link</button>`:''}</div></details>`).join(''):'<p>No members yet.</p><button class="btn btn-quiet" data-act="nav" data-page="members">Add family members</button>'}
 </section>`;
}
function memberPollUrl(m){const u=new URL(memberUrl(m.token));u.searchParams.set('poll',poll.id);return u.href}
function peoplePanel(){
 if(state.preview||(!familyToken&&!memberToken&&!inGroup(poll.id)))return '';
 if(poll.people_error)return '<section class="people-panel"><p class="note">Could not update family status.</p><button class="btn btn-line btn-sm" data-act="refreshPeople">Retry</button></section>';
 const people=poll.people||[],waiting=people.filter(m=>!m.voted),voted=people.filter(m=>m.voted),closed=poll.status==='closed';if(!people.length)return '';
 const reminder=familyToken&&state.reminderId?members.find(m=>m.id===state.reminderId&&waiting.some(p=>p.id===m.id&&p.active!==false)):null;
 const text=reminder?F.reminder(poll,reminder.name,memberPollUrl(reminder)):'';
 const person=(m,done=false)=>`<span class="waiting-person ${done?'has-voted':''}"><span class="status-avatar">${memberAvatar(m)}${done?'<span class="voted-check" aria-label="Voted">✓</span>':''}</span><span>${esc(m.name)}${!done&&m.active===false?' · unavailable':''}</span>${familyToken&&!closed&&!done&&m.active!==false?`<button class="btn btn-line btn-sm" data-act="remindMember" data-id="${esc(m.id)}" aria-label="Remind ${esc(m.name)}">Remind</button>`:''}</span>`;
 return `<section class="people-panel ${!closed&&waiting.length&&!state.refreshError?'is-waiting':''}"><div class="between"><strong class="waiting-title">${closed?'🧡 Decided together':'Waiting on'}${!closed&&waiting.length&&!state.refreshError?'<span class="waiting-dots" aria-hidden="true"><i></i><i></i><i></i></span>':''}</strong><span class="subtle">${closed?poll.voted_count+' ballots':waiting.length+' remaining'}</span></div>
 ${!closed&&waiting.length?`<div class="waiting-strip" aria-label="Waiting for votes">${waiting.map(m=>person(m)).join('')}</div>`:''}
 ${voted.length?`${!closed?'<h3 class="already-voted-title">Already voted</h3>':''}<div class="waiting-strip already-voted" aria-label="People who voted">${voted.map(m=>person(m,true)).join('')}</div>`:''}
 ${state.refreshError&&!closed?'<p class="note" role="status">Connection paused. <button class="btn btn-line btn-sm" data-act="refreshPeople">Retry</button></p>':''}
 ${reminder&&!closed?`<div class="reminder-draft"><h3>👋 A reminder for ${esc(reminder.name)}</h3><pre class="message-preview">${esc(text)}</pre><div class="btn-row"><a class="btn btn-primary btn-sm" href="${esc(smsUrl(reminder,text))}">💬 Text reminder</a><button class="btn btn-line btn-sm" data-act="shareReminder" data-id="${esc(reminder.id)}">Share</button><button class="btn btn-line btn-sm" data-act="copyReminder" data-id="${esc(reminder.id)}">Copy</button></div></div>`:''}</section>`;
}
const peopleCache=new Map();
async function loadPeople(target,includeAvatars=true){
 if(!familyToken&&!memberToken&&!inGroup(target.id))return;
 try{const data=inGroup(target.id)?await groupRpc('people',{p_include_avatars:includeAvatars}):await rpc('gw_get_poll_people',{p_poll_id:target.id,p_token:familyToken||null,p_member_token:memberToken||null,p_include_avatars:includeAvatars});const previous=peopleCache.get(target.id)||[];target.people=(data.people||[]).map(p=>({...p,avatar:p.avatar||previous.find(old=>old.id===p.id)?.avatar||'🙂'}));peopleCache.set(target.id,target.people);target.group_family_id=data.family_id||target.group_family_id;target.roster_enabled=!!data.rostered;target.can_vote=!!data.eligible&&!target.voter_error;target.people_error=!!target.voter_error}catch{target.people_error=true}
}
function mapsForRestaurant(r){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([r.name,r.address].filter(Boolean).join(', '))}
function rankLogo(i){const r=poll.options.find(r=>r.id===state.rank[i]);return r?icon(r.category,r.name,r):'<span class="rank-placeholder">🍽️</span>'}
function rankReady(){const count=Math.min(3,poll.options.length),r=state.rank.slice(0,count);return r.filter(Boolean).length===count&&new Set(r).size===count}
function groupPicker(){
 if(poll.people_error)return '<section class="card"><h2>Could not open the family invitation</h2><p>It may have been turned off. Retry below or ask the organizer for your personal link.</p></section>';
 return `<section class="card"><h2>Who's voting? 👋</h2><p class="subtle">Tap your own name. This invitation is just for this vote. Already voted names are locked.</p><div class="people-grid group-picker">${(poll.people||[]).filter(m=>m.active!==false).map(m=>`<button class="person-option" data-act="chooseGroupMember" data-id="${esc(m.id)}" ${m.voted?'disabled aria-disabled="true"':''}>${memberAvatar(m)}<strong>${esc(m.name)}</strong><small>${m.voted?'✓ Already voted':'Ready to vote'}</small></button>`).join('')}</div><p class="note">Choose only yourself. A saved vote can be edited only through your private personal link.</p></section>`;
}
function pollSettingsHtml(){
 if(poll.settings_error)return '<p class="note">Voting options unavailable.</p><button class="btn btn-line btn-sm" data-act="refreshPeople">Retry options</button>';
 return `<details class="poll-settings"><summary>⚙️ Voting options</summary><label class="setting-row"><input id="pollAllowHome" type="checkbox" ${poll.allow_member_home!==false?'checked':''}><span><strong>Show “My votes” navigation</strong><small>A navigation preference; personal links still work.</small></span></label>${poll.roster_enabled?`<label class="setting-row"><input id="pollGroupJoin" type="checkbox" ${poll.group_join_token?'checked':''}><span><strong>Group invitation avatar/name picker</strong><small>Anyone with this invitation can see invited names/photos and submit once as any invited person. Share only with trusted family. Turning off revokes the group invitation; personal links keep working.</small></span></label>`:''}<button class="btn btn-primary btn-sm" data-act="savePollSettings">Save voting options</button></details>`;
}
function resultHighlights(){const highlights=F.highlights(poll,window.GoodnightsVoting.tally(poll));return highlights.length?`<div class="result-highlights">${highlights.map(s=>`<div><span aria-hidden="true">${s.emoji}</span><strong>${esc(s.title)}</strong><small>${esc(s.detail)}</small></div>`).join('')}</div>`:''}
function captureRestaurantDrafts(){
 if(state.renderedPage!=='restaurants'||state.skipDraftCapture){state.skipDraftCapture=false;return}
 for(const prefix of ['google','manual','edit']){
  const key=prefix==='edit'?'edit:'+state.renderedEditingId:prefix;if(prefix==='edit'&&!state.renderedEditingId)continue;
  const ids=prefix==='google'?['googlePaste','googleName','googleAddress','googleMode','googleValue','googleIcon']:prefix==='manual'?['restName','restCategory','manualMode','manualValue','manualIcon']:['editName','editCategory','editAddress','editMode','editValue','editIcon'];
  const draft=state.restaurantDrafts[key]||{};for(const id of ids){const input=$(id);if(input)draft[id]=input.value}state.restaurantDrafts[key]=draft;
 }
}
function restoreRestaurantDrafts(){
 if(state.page!=='restaurants')return;
 for(const key of ['google','manual','edit:'+state.editingId])for(const [id,value] of Object.entries(state.restaurantDrafts[key]||{})){const input=$(id);if(input)input.value=value}
}
function renderKeepingFocus(target){
 const id=target.id,name=target.name,inputValue=target.value,keys=['select','approval','rank','person'],key=keys.find(k=>target.dataset[k]!==undefined),value=key?target.dataset[key]:null,top=window.scrollY;
 render();const replacement=id?$(id):key?Array.from(app.querySelectorAll?.('[data-'+key+']')||[]).find(n=>n.dataset[key]===value):name?Array.from(app.querySelectorAll?.('[name]')||[]).find(n=>n.name===name&&n.value===inputValue):null;
 replacement?.focus?.({preventScroll:true});if(Number.isFinite(top))window.scrollTo({top,behavior:'instant'});
}

function renderPoll(){
 if(!poll){layout(`<div class="card empty"><span class="empty-emoji">⏳</span><p>Loading family vote…</p></div>`,{nav:false});return}
 const voter=state.preview?{id:'preview-voter',name:'Practice voter',avatar:'🧑‍🍳'}:member;
 const open=poll.status==='open',already=voter?!!(poll.voted_member_ids?.includes(voter.id)||(poll.people||[]).some(m=>m.id===voter.id&&m.voted))&&!state.editingVote:localStorage.getItem('gw_voted_'+poll.id)==='1';
 if(!open)return renderResults();
 const eligible=state.preview||!poll.roster_enabled||poll.can_vote===true;
 let voting='';
 if(inGroup(poll.id)&&!voter){voting=groupPicker()}
 else if(!voter&&!familyToken&&!state.preview){voting='<section class="card"><h2>Connect your personal link</h2><p class="subtle">Paste the private voting link your organizer sent you once to connect this phone.</p><div class="field"><label for="personalVoteLink">Your personal voting link</label><input id="personalVoteLink" type="url" autocomplete="off" placeholder="Paste your private member link…"></div><button class="btn btn-primary btn-full" data-act="connectVote">Continue to this vote</button><p class="note">Need your link? Ask the organizer to send it individually. Personal links are never listed in the group chat.</p></section>'}
 else if(familyToken&&!state.preview){voting=`<div class="card"><h2>On the menu</h2>${poll.options.map(r=>restaurantRow(r)).join('')}<p class="note">To cast your own ballot, open your personal member link from the invitations above.</p></div>`}

 else if(already){voting=`<div class="card empty"><span class="empty-emoji">🎉</span><h2>You're all voted!</h2><p>Results are hidden until everyone has voted. This page updates automatically.</p>${!inGroup(poll.id)?'<button class="btn btn-quiet" data-act="resetVote">Change my vote</button><p class="note">You can update your vote until voting finishes.</p>':'<p class="note">Need to edit? Open your personal link.</p>'}</div>`}
 else if(voter&&!eligible){voting='<div class="card empty"><h2>'+ (poll.people_error?'Checking your invitation…':'You’re not on this vote’s guest list')+'</h2><p>'+(poll.people_error?'Retry the participant status to load your ballot.':'The organizer chose other people for this vote. You can still see the result when it finishes.')+'</p></div>'}
 else if(poll.method==='approval'){
 voting=`<div class="card"><h2>Pick up to 2</h2><p class="subtle">Which restaurants would you be happy eating?</p>${poll.options.map(r=>restaurantRow(r)).join('')}</div>`;
 // Re-render approval rows with their own input, without changing family-list state.
 voting=`<div class="card"><h2>Pick up to 2</h2><p class="subtle">Which restaurants would you be happy eating?</p>${poll.options.map(r=>`<label class="item"><input class="check" type="checkbox" data-approval="${esc(r.id)}" ${state.approvals.has(r.id)?'checked':''}><span class="foodicon">${icon(r.category,r.name,r)}</span><span class="item-body"><span class="item-title">${esc(r.name)}</span><span class="item-detail">${esc(r.category)}</span></span></label>`).join('')}</div>`;
 }else if(poll.method==='swipe'){
 const i=Math.min(state.swipeIndex,poll.options.length-1),r=poll.options[i];
 voting=`<div class="card"><div class="between"><strong>Swipe / consensus</strong><span class="subtle">${Object.keys(state.swipes).length} of ${poll.options.length} answered</span></div><div class="progress"><span style="width:${(Object.keys(state.swipes).length/poll.options.length)*100}%"></span></div>
 <div class="votecard" id="swipeCard"><div class="foodicon">${icon(r.category,r.name,r)}</div><h2>${esc(r.name)}</h2><p>${esc(r.category)} · Swipe left or right, or use the buttons.</p></div>
 <div class="vote-btns"><button class="btn btn-line" data-act="swipeNo">👎 Not tonight</button><button class="btn btn-primary" data-act="swipeYes">👍 Sounds good</button></div>
 <p class="subtle" role="status">${Object.keys(state.swipes).length===poll.options.length?"All restaurants answered. Submit your vote below.":"Answer each restaurant, then submit your vote."}</p>
 ${i>0?`<button style="margin-top:10px" class="btn btn-quiet btn-sm" data-act="swipeBack">← Go back</button>`:''}</div>`;
 }else{
 const count=Math.min(3,poll.options.length);
 voting=`<div class="card"><h2>Rank your top ${count}</h2><p class="subtle">Choose a different restaurant for each position.</p>
 ${Array.from({length:count},(_,i)=>`<div class="rankoption"><label for="rank${i}">${['🥇 First choice','🥈 Second choice','🥉 Third choice'][i]}</label><div class="rank-control"><span class="rank-logo" id="rankLogo${i}" aria-hidden="true">${rankLogo(i)}</span><select id="rank${i}" data-rank="${i}"><option value="">Choose restaurant…</option>${poll.options.map(r=>`<option value="${esc(r.id)}" ${state.rank[i]===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</select></div></div>`).join('')}</div>`;
 }
 const ballotReady=poll.method==='approval'?state.approvals.size>=1&&state.approvals.size<=2:poll.method==='swipe'?Object.keys(state.swipes).length===poll.options.length:state.rank.slice(0,Math.min(3,poll.options.length)).filter(Boolean).length===Math.min(3,poll.options.length)&&new Set(state.rank).size===Math.min(3,poll.options.length);
 const pending=poll.method==='swipe'&&Object.keys(state.swipes).length!==poll.options.length;
 const ballotProgress=poll.method==='approval'?state.approvals.size+' selected':poll.method==='swipe'?Object.keys(state.swipes).length+' of '+poll.options.length+' answered':state.rank.filter(Boolean).length+' of '+Math.min(3,poll.options.length)+' ranked';
 const ballotHint=ballotReady?'Ready when you are':poll.method==='approval'?'Choose one or two places':poll.method==='swipe'?'Answer every restaurant':'Choose a different place for each rank';
 layout(`<div class="${!already&&eligible&&voter?'ballot-flow':''}">${member&&!state.preview&&memberHomeAllowed()?'<button class="btn btn-line btn-sm" style="margin-bottom:16px" data-act="goHome">← My votes</button>':''}<div class="eyebrow">IT'S TIME TO VOTE</div><h1>${F.theme(poll)?esc(F.theme(poll).emoji+' '+F.theme(poll).title):esc(poll.meal)+' plans?'}</h1><p class="lede">${F.theme(poll)?esc(F.theme(poll).tagline)+'<br>':''}${methodName(poll.method)} · ${poll.voted_count} of ${poll.expected_voters} votes in</p>
 ${voter?memberIdentity(voter):''}<div class="card"><div class="between"><strong>Family vote</strong>${pill(poll)}</div><div class="progress"><span style="width:${100*poll.voted_count/poll.expected_voters}%"></span></div><p class="note">Your family's choices stay secret until the vote finishes.</p></div>
 ${familyToken&&!state.preview?pollSharing():''}
 ${state.editingVote?'<div class="muted-box" role="status">✏️ Editing your saved vote. Your previous choices still count until you save changes.</div>':''}
 ${voting}
 ${peoplePanel()}
 ${inGroup(poll.id)&&member?'<button class="btn btn-line btn-sm" data-act="changeGroupMember">Not you? Choose your name</button>':''}
 ${(state.preview||!familyToken)&&!already&&eligible?voter?`<section class="ballot-actions" aria-label="Your ballot actions"><div class="ballot-summary" aria-live="polite"><strong>${esc(voter.name)} · ${ballotProgress}</strong><span>${ballotHint}</span></div><div class="btn-row"><button class="btn btn-primary" data-act="submitVote" ${!ballotReady||pending?'disabled':''}>${state.editingVote?'Save vote changes ✓':'Submit my vote ✓'}</button>${state.editingVote?'<button class="btn btn-line" data-act="cancelVoteEdit">Keep my saved vote</button>':''}</div></section>`:`<div class="card"><p class="note">Use your personal family member link to submit a vote. Ask the family owner for yours.</p></div>`:''}
 ${state.preview?'':familyToken?`<div class="card"><p class="subtle">Family organizer controls</p>${pollSettingsHtml()}<div class="btn-row"><button class="btn btn-quiet btn-sm" data-act="copyPoll">Copy vote link</button><button class="btn btn-line btn-sm" data-act="closePoll">Close voting early</button></div></div>`:''}
 </div>`,{nav:false});
}
function clearResultsCard(){if(state.resultCard)URL.revokeObjectURL(state.resultCard.url);state.resultCard=null}
function resultCardHtml(){
 if(!familyToken)return '';
 const card=state.resultCard;
 return `<section class="card"><h2>🖼️ A little dinner announcement</h2><p class="note">Make a shareable picture with the winner, restaurant visuals and voting stats.</p>${(poll.people||[]).some(m=>m.voted)?`<label class="setting-row"><input id="includeCardAvatars" type="checkbox" ${state.cardBusy?'disabled':''} ${state.includeCardAvatars?'checked':''}><span><strong>Include the dinner crew’s avatars and names</strong><small>Optional: these will be visible to anyone you share the picture with.</small></span></label>`:''}${card&&card.pollId===poll.id?`<img class="results-share-image" src="${card.url}" alt="Dinner results card"><div class="btn-row"><a class="btn btn-quiet" href="${card.url}" download="goodnights-results.png">⬇ Save image</a>${card.canShare?'<button class="btn btn-primary" data-act="shareResultsCard">↗ Share image</button>':''}</div><p class="note">If your messaging app shares only the image, send the results link with Copy message above.</p>`:`<button class="btn btn-quiet btn-full" data-act="prepareResultsCard" ${state.cardBusy?'disabled':''}>${state.cardBusy?'Making your card…':'✨ Make results image'}</button>`}</section>`;
}
function loadCardImage(src){return new Promise(resolve=>{const img=new Image();let done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value)};const timer=setTimeout(()=>finish(null),1800);img.crossOrigin='anonymous';img.referrerPolicy='no-referrer';img.onload=()=>finish(img);img.onerror=()=>finish(null);img.src=src})}
async function makeResultsCard(snapshot){
 const tally=window.GoodnightsVoting.tally(snapshot),options=snapshot.options||[],winners=options.filter(r=>tally.winners.includes(r.id));
 const crew=snapshot.sharePeople||[],stats=F.highlights(snapshot,tally);
 const canvas=document.createElement('canvas');canvas.width=960;canvas.height=crew.length?1310:1160;const ctx=canvas.getContext('2d');
 const box=(x,y,w,h,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()};
 const text=(value,x,y,size=30,color='#23221f',weight='600')=>{ctx.fillStyle=color;ctx.font=weight+' '+size+'px system-ui';ctx.fillText(value,x,y)};
 const fit=(value,size,maxWidth)=>{ctx.font='700 '+size+'px system-ui';let t=String(value);while(ctx.measureText(t).width>maxWidth&&t.length>1)t=t.slice(0,-2)+'…';return t};
 box(0,0,960,canvas.height,0,'#fdf8ee');box(42,42,876,canvas.height-84,36,'#fffefa');const brand=await loadCardImage(new URL('icons/icon-192.png',location.href).href);if(brand){ctx.drawImage(brand,84,79,42,42);text('goodnights',140,115,38)}else text('goodnights',84,115,38);text(F.theme(snapshot)?F.theme(snapshot).emoji+' '+F.theme(snapshot).title.toUpperCase():'WHAT’S FOR '+snapshot.meal.toUpperCase()+'?',84,158,19,'#ad4926');
 box(78,195,804,220,24,'#fbe7d2');text(winners.length===1?'🏆 The family picked…':winners.length?'🤝 We have a tie!':'🍽️ No winner this time',110,250,27);
 text(fit(winners.length===1?winners[0].name:winners.length?winners.map(r=>r.name).join(' / '):'Try another family vote',42,720),110,322,42);
 text(snapshot.voted_count+' family ballots · '+methodName(snapshot.method),110,376,23,'#655e54');
 const final=tally.rounds.at(-1)||{},rows=options.filter(r=>snapshot.method!=='ranked'||r.id in final).sort((a,b)=>tally.scores[b.id]-tally.scores[a.id]).slice(0,3);
 for(const [i,r] of rows.entries()){
  const y=452+i*122;box(80,y,800,106,18,'#fbf6ed');
  const d=window.GoodnightsLogos.details(r);let img=d.url?await loadCardImage(d.url):null;
  if(!img){const svg=window.GoodnightsLogos.svg(d.key).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" ').replace('currentColor','#d84b23');img=await loadCardImage('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg))}
  if(img){const scale=Math.min(64/img.naturalWidth,64/img.naturalHeight,1),w=img.naturalWidth*scale,h=img.naturalHeight*scale;ctx.drawImage(img,100+(64-w)/2,y+21+(64-h)/2,w,h)}
  text(fit(r.name,27,640),184,y+41,27);
  const stat=snapshot.method==='swipe'?Math.round(100*tally.scores[r.id]/Math.max(1,snapshot.voted_count))+'% yes':tally.scores[r.id]+(snapshot.method==='ranked'?' votes':' approvals');
  text((tally.winners.includes(r.id)?'⭐ ':'')+stat,184,y+77,22,'#776b5c');
 }
 if(tally.randomlyResolved){
  text('🎲 Chosen randomly between '+tally.tiedWinners.length+' tied leaders.',84,856,23,'#776b5c');
  text('The votes above are unchanged.',84,890,21,'#776b5c');
 }else text(fit(tally.details,23,790),84,856,23,'#776b5c');
 stats.slice(0,2).forEach((s,i)=>text(fit(s.emoji+' '+s.title+' · '+s.detail,21,790),84,898+i*34,21,'#776b5c'));
 if(crew.length){
  text('🧡 Decided together',84,986,25);
  for(const [i,m] of crew.slice(0,8).entries()){
   const x=120+i*101,y=1040,a=F.avatar(m.avatar);box(x-33,y-33,66,66,33,'#f8e9d7');
   const img=a.startsWith('data:')?await loadCardImage(a):null;
   if(img){ctx.save();ctx.beginPath();ctx.arc(x,y,33,0,Math.PI*2);ctx.clip();ctx.drawImage(img,x-33,y-33,66,66);ctx.restore()}else text(a.startsWith('data:')?'🙂':a,x-22,y+13,35);
   ctx.textAlign='center';text(fit(m.name,16,92),x,y+61,16);ctx.textAlign='start';
  }
  if(crew.length>8)text('+'+(crew.length-8)+' more around the table',84,1145,20,'#776b5c');
 }
 text('Dinner, decided together. 🧡',84,canvas.height-122,27);text('Goodnights • family restaurant voting',84,canvas.height-84,18,'#776b5c');
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Could not create the image.')),'image/png'));
 const file=new File([blob],'goodnights-results.png',{type:'image/png'});let canShare=false;try{canShare=!!navigator.canShare?.({files:[file]})}catch{}
 return {pollId:snapshot.id,url:URL.createObjectURL(blob),file,canShare};
}
function renderResults(){
 const {scores,winners,details}=window.GoodnightsVoting.tally(poll);
 const all=poll.options||[],win=all.filter(o=>winners.includes(o.id));
 const maximum=Math.max(1,...Object.values(scores));
 const desc=win.length===1?esc(win[0].name):win.length>1?`It's a tie! (${win.length} places)`:'No winner yet';
 layout(`${member&&!state.preview?memberIdentity(member):''}<div class="eyebrow">THE FAMILY HAS SPOKEN</div><div class="card winner"><div class="trophy">🏆</div><div class="eyebrow">${F.theme(poll)?esc(F.theme(poll).emoji+' '+F.theme(poll).title.toUpperCase()):poll.meal.toUpperCase()} RESULTS</div>${win.length===1?`<div class="winner-place-logo">${icon(win[0].category,win[0].name,win[0])}</div>`:''}<h1>${desc}</h1><p class="subtle">${esc(details)}</p>${win.length===1&&!state.preview?`<p class="winner-address">${esc(win[0].address||'Address not saved — Maps will search by name.')}</p><a class="btn btn-dark" target="_blank" rel="noopener noreferrer" href="${esc(mapsForRestaurant(win[0]))}">📍 Open in Maps</a>`:''}</div>${peoplePanel()}${resultHighlights()}
 <div class="card"><div class="between"><h2>The results</h2><span class="count">${poll.voted_count} votes</span></div>
 ${[...all].sort((a,b)=>scores[b.id]-scores[a.id]||a.name.localeCompare(b.name)).map(r=>`<div class="resultbar"><div class="bar-head"><span>${icon(r.category,r.name,r)} ${esc(r.name)}</span><span>${poll.method==='swipe'?Math.round(100*scores[r.id]/Math.max(1,poll.voted_count))+'%':poll.method==='ranked'?(r.id in (window.GoodnightsVoting.tally(poll).rounds.at(-1)||{})?scores[r.id]+' votes':'Eliminated'):scores[r.id]+' votes'}</span></div><div class="bar-track"><div class="bar-fill" style="width:${100*scores[r.id]/maximum}%"></div></div></div>`).join('')}
 <p class="note">${win.length>1?'The organizer can randomly pick a tied leader or start a runoff.':poll.method==='ranked'?'Ranked votes transfer to your next choice when a place is eliminated.':'Each voter can approve up to two places or vote yes/no as configured.'}</p></div>
 ${win.length>1&&familyToken&&!state.preview?`<div class="card tiebreaker"><h2>🤝 Let’s settle the tie</h2><p class="subtle">Pick once at random from the ${win.length} tied leaders, or invite everyone to a runoff. The random pick is saved for the whole family.</p><div class="btn-row"><button class="btn btn-primary" data-act="randomTie">🎲 Pick a tied winner</button><button class="btn btn-line" data-act="runoff">🗳️ Start a runoff</button></div></div>`:''}
 ${familyToken&&!state.preview?`<button class="btn btn-line" data-act="repeatDinner" data-id="${esc(poll.id)}">Use this dinner again</button>`:''}${familyToken&&!state.preview?pollSharing():''}${familyToken&&!state.preview?resultCardHtml():''}
 ${state.preview?'':`<div class="btn-row" style="margin-top:13px"><button class="btn btn-quiet" data-act="shareResultsMessage">Share results</button>${familyToken||member&&memberHomeAllowed()?`<button class="btn btn-line" data-act="goHome">${member?'Back to my votes':'Back to family'}</button>`:''}</div>`}
 `,{nav:false});celebrateResults();
}
async function safe(fn){try{state.busy=true;await fn()}catch(e){toast(e.message||'Something went wrong');console.error(e)}finally{state.busy=false}}
function pollNeedsRefresh(value){return value.status==='open'||window.GoodnightsVoting.tally(value).winners.length>1}
let pollSession=0;
async function openPoll(id){
 const session=++pollSession;clearInterval(pollTimer);state.editingVote=false;state.includeCardAvatars=false;state.refreshError=false;state.deferredPollRender=false;
 clearResultsCard();state.preview=false;state.approvals=new Set();state.swipes={};state.swipeIndex=0;state.rank=[];poll=null;state.page='poll';history.replaceState(null,'',pollUrl(id));window.scrollTo({top:0});render();
 await safe(async()=>{
  await loadPoll(id);if(session!==pollSession)return;
  if(inGroup(id)&&member&&(poll.people||[]).some(m=>m.id===member.id&&m.active!==false))rememberGroupPerson();else await restoreGroupPerson();
  if(session!==pollSession)return;
  if(familyToken&&live){try{await loadMembers();state.memberLoadError=false}catch{members=[];state.memberLoadError=true}}
  render();if(!pollNeedsRefresh(poll))return;
  pollTimer=setInterval(async()=>{
   if(session!==pollSession||state.page!=='poll'||document.hidden||state.refreshingPoll)return;
   state.refreshingPoll=true;try{
    const prev=poll,next=await rpc('gw_get_poll',{p_poll_id:id});await loadVoterStatus(next);await loadPeople(next,false);
    if(session!==pollSession||state.page!=='poll')return;
    next.group_join_token=prev.group_join_token;next.settings_error=prev.settings_error;const wasRefreshError=state.refreshError;state.refreshError=!!next.people_error;poll=next;
    if(prev.tie_winner_id!==next.tie_winner_id)clearResultsCard();
    if(prev.tie_winner_id!==next.tie_winner_id||prev.voted_count!==next.voted_count||prev.status!==next.status||JSON.stringify(prev.people)!==JSON.stringify(next.people)||prev.people_error!==next.people_error||wasRefreshError!==state.refreshError){
     if(next.status==='open'&&document.activeElement?.matches?.('select,input,textarea'))state.deferredPollRender=true;else render();
    }
    if(!pollNeedsRefresh(next))clearInterval(pollTimer);if(next.status==='closed'&&prev.status!=='closed'&&familyToken)toast('🏆 Results are in! Share them with your family below.')
   }catch{if(session===pollSession&&state.page==='poll'){state.refreshError=true;if(!document.activeElement?.matches?.('select,input,textarea'))render()}}finally{state.refreshingPoll=false}
  },8000);
 });
}
async function refreshFamily(){if(familyToken)await loadFamily();render()}
async function makePoll(ids,method=state.method,expected=state.expected,participantIds=null){
 const chosen=participantIds||selectedPeople().map(m=>m.id);
 const id=chosen.length?await rpc(state.pollCuisine?'gw_create_poll_themed':state.groupJoin||!state.allowMemberHome?'gw_create_poll_configured':'gw_create_poll_for_members',{p_token:familyToken,p_meal:state.meal,p_method:method,p_restaurant_ids:ids,p_member_ids:chosen,...(state.pollCuisine||state.groupJoin||!state.allowMemberHome?{p_allow_member_home:state.allowMemberHome,p_group_join:state.groupJoin}:{}),...(state.pollCuisine?{p_cuisine:state.pollCuisine}:{})}):await rpc('gw_create_poll',{p_token:familyToken,p_meal:state.meal,p_method:method,p_expected_voters:expected,p_restaurant_ids:ids});
 state.repeatDraft=null;await loadFamily();await openPoll(id);toast('Vote created! Share the voting link.');
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
const ownerActions=new Set(['createPoll','addMember','saveMemberProfile','editMemberProfile','resetMemberLink','removeMember','copyMember','familyLink','editRestaurant','saveRestaurant','archive','addManual','saveGoogle','addNearby','newFamily','closePoll','runoff','randomTie','repeatDinner','cancelRepeat','savePollSettings','deletePoll','clearHistory']);
async function doAction(act,button){
 if(act==='installApp'){if(!installPrompt)return;const request=installPrompt;installPrompt=null;await request.prompt();await request.userChoice;render();return}
 if(act==='chooseGroupMember'){
  if(!inGroup(poll?.id)||member)return;
  const chosen=(poll.people||[]).find(m=>m.id===button.dataset.id&&m.active!==false&&!m.voted);if(!chosen)return;
  const previous=groupAccess.memberId;groupAccess.memberId=chosen.id;
  try{const identity=await groupRpc('identity');if(await groupRpc('has_voted'))throw Error('That person has already voted. Choose your own name.');member=identity;rememberGroupPerson();await openPoll(poll.id)}catch(e){groupAccess.memberId=previous;member=null;await loadPeople(poll);render();throw e}return;
 }
 if(act==='changeGroupMember'){
  if(!inGroup(poll?.id))return;groupAccess.memberId=null;member=null;localStorage.removeItem(groupKey(poll.id));if(poll.group_family_id)localStorage.setItem(lastPersonKey(poll.group_family_id),'');await openPoll(poll.id);return;
 }
 if(act==='savePollSettings'){
  if(!familyToken||!poll)return;
  await rpc('gw_poll_settings',{p_token:familyToken,p_poll_id:poll.id,p_allow_member_home:!!$('pollAllowHome')?.checked,p_group_join:poll.roster_enabled?!!$('pollGroupJoin')?.checked:null});await loadPoll(poll.id);render();toast('Voting options saved. Share the updated group invitation below.');return;
 }
 if(act==='deletePoll'||act==='clearHistory'){
  if(!familyToken)return;
  const selected=(family.polls||[]).find(q=>q.id===button.dataset.id);
  if(act==='deletePoll'&&!selected)return;
  const message=act==='clearHistory'?'Permanently delete ALL finished votes and their ballots, including older history? Open votes, members and restaurants stay. This cannot be undone.':'Permanently delete this '+selected.meal.toLowerCase()+' vote ('+timeAgo(selected.created_at)+') and all its ballots? Its links will stop working. This cannot be undone.';
  if(!confirm(message))return;
  const n=await rpc('gw_delete_polls',{p_token:familyToken,...(act==='clearHistory'?{p_finished:true}:{p_poll_ids:[selected.id]})});await loadFamily();render();toast(n+' vote'+(n===1?'':'s')+' deleted.');return;
 }
 if(act==='shareGroupInvite'||act==='copyGroupInvite'){
  if(!familyToken||!poll||poll.status!=='open'||state.preview)return;
  const text=F.groupInvite(poll,groupInviteUrl());if(act==='shareGroupInvite')await shareMessage(text);else await copyMessage(text);return;
 }
 if(act==='connectVote'){
  if(!poll||state.preview)return;
  const raw=$('personalVoteLink')?.value.trim();let candidate='';
  try{const url=new URL(raw),here=new URL(location.href);if(url.origin!==here.origin||url.pathname!==here.pathname)throw Error();candidate=url.searchParams.get('member')||''}catch{throw Error('Paste your personal link for this Goodnights app.')}
  if(!/^[a-f0-9]{48}$/.test(candidate))throw Error('Use your personal member link, not an organizer or group link.');
  const id=poll.id;
  await safe(async()=>{
   const info=await rpc('gw_get_member',{p_member_token:candidate});
   await rpc('gw_get_poll_people',{p_poll_id:id,p_token:null,p_member_token:candidate,p_include_avatars:false});
   memberToken=candidate;familyToken='';member={id:info.id,name:info.name,avatar:info.avatar};family=normalizeFamily(info.family);localStorage.setItem(memberKey,candidate);localStorage.removeItem(familyKey);
   await openPoll(id);toast('This phone is connected as '+member.name+'.');
  });return;
 }

 if(act==='createNext'||act==='createBack'||act==='createGo'){
  if(!familyToken)return;
  const next=act==='createNext'?state.createStep+1:act==='createBack'?state.createStep-1:Number(button.dataset.step);
  if(!Number.isInteger(next)||next<0||next>3)return;
  if(next>state.createStep&&!Array.from({length:next},(_,i)=>i).every(stepReady)){toast('Finish choosing places and people first.');return}
  state.createStep=next;render();window.scrollTo({top:0});return;
 }
 if(act==='retryCreatePeople'){await loadCreatePeople();render();return}
 if(act==='allPeople'){state.selectedPeople=new Set(members.filter(m=>m.active!==false).slice(0,20).map(m=>m.id));render();return}
 if(act==='clearPeople'){state.selectedPeople.clear();render();return}
 if(act==='refreshPeople'){await safe(async()=>{await loadPoll(poll.id);state.refreshError=false;render()});return}
 if(act==='remindMember'){state.reminderId=button.dataset.id;render();app.querySelector?.('.reminder-draft')?.scrollIntoView({block:'center',behavior:'smooth'});return}
 if(act==='shareReminder'||act==='copyReminder'){
  if(!familyToken||!poll||poll.status!=='open')return;
  const m=members.find(m=>m.id===button.dataset.id);if(!m||!(poll.people||[]).some(p=>p.id===m.id&&!p.voted&&p.active!==false))return;
  const text=F.reminder(poll,m.name,memberPollUrl(m));if(act==='shareReminder')await shareMessage(text);else await copyMessage(text);return;
 }
 if(act==='toggleDiscovery'){captureRestaurantDrafts();state.discoverOpen=!state.discoverOpen;render();app.querySelector?.(state.discoverOpen?'#restaurantDiscovery':'#restaurantSearch')?.scrollIntoView({block:'start',behavior:'smooth'});return}

 if(ownerActions.has(act)&&!familyToken&&act!=='newFamily'){toast('Use your organizer link to manage the family.');return}

 if(act==='prepareResultsCard'){
  if(!familyToken||!poll||poll.status!=='closed'||state.preview||state.cardBusy)return;
  const snapshot={...poll,sharePeople:state.includeCardAvatars?(poll.people||[]).filter(m=>m.voted):[]};const pollId=poll.id;state.cardBusy=true;render();
  try{const card=await makeResultsCard(snapshot);if(poll?.id!==pollId||state.preview){URL.revokeObjectURL(card.url);return}clearResultsCard();state.resultCard=card}finally{state.cardBusy=false;render()}return;
 }
 if(act==='shareResultsCard'){
  const card=state.resultCard;if(!familyToken||!card?.canShare||card.pollId!==poll?.id)return;
  try{await navigator.share({title:'Goodnights 🍽️',text:F.result(poll,window.GoodnightsVoting.tally(poll),resultsUrl()),files:[card.file]})}catch(e){if(e.name!=='AbortError')toast('Use Save image, then attach it in your messaging app.')}return;
 }
 if(act==='previewMode'){
startPreview(button.dataset.method);return}
 if(act==='exitPreview'){state.preview=false;poll=null;setPage('create');return}
 if(act==='copyResultsMessage'||act==='shareResultsMessage'){
  if(!poll||poll.status!=='closed'||state.preview)return;
  const text=F.result(poll,window.GoodnightsVoting.tally(poll),resultsUrl());
  if(act==='copyResultsMessage')await copyMessage(text);else await shareMessage(text);return;
 }
 if(act==='editMemberProfile'){if(!familyToken)return;state.editingMember=button.dataset.id;state.avatarDraft=F.avatar(members.find(m=>m.id===state.editingMember)?.avatar);render();window.scrollTo({top:0});return}
 if(act==='cancelMemberProfile'){state.editingMember=null;render();return}
 if(act==='chooseAvatar'){state.avatarDraft=F.avatar(button.dataset.avatar);$('avatarPreview').innerHTML=memberIdentity({name:$('profileName').value,avatar:state.avatarDraft});app.querySelectorAll('[data-act="chooseAvatar"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.avatar===state.avatarDraft)));return}
 if(act==='saveMemberProfile'){
  if(state.photoBusy)return;
  const name=$('profileName').value.trim(),phone=F.contact($('profilePhone').value);if(!name)throw Error('Enter a name');
  await safe(async()=>{await rpc('gw_update_member_profile',{p_token:familyToken,p_member_id:state.editingMember,p_name:name,p_avatar:state.avatarDraft,p_phone:phone});await loadMembers();state.editingMember=null;render();toast('Profile saved!')});return;
 }

 if(act==='repeatDinner'){if(state.preview)return;await repeatDinner(button.dataset.id);return}
 if(act==='cancelRepeat'){
  state.repeatDraft=null;state.selected=new Set();state.selectedPeople=new Set();state.peopleInitialised=false;state.pollCuisine='';state.createStep=0;setPage('history');return;
 }
 if(act==='nav'){if(button.dataset.page==='members')await safe(loadMembers);if(button.dataset.page==='create'&&familyToken){state.repeatDraft=null;state.createStep=0;await loadCreatePeople()}setPage(button.dataset.page);return}
 if(act==='demo'){demoInit();await safe(async()=>{await loadFamily();render()});return}
 if(act==='newFamily'){
  const name=prompt('What should we call your family?','Goodnight Family');if(name===null)return;
  await safe(async()=>{const t=token();await rpc('gw_create_family',{p_name:name.trim()||'Goodnight Family',p_token:t});familyToken=t;localStorage.setItem(familyKey,t);await loadFamily();render();toast('Family created. Save your organizer link in Members.')});return;
 }
 if(act==='join'){
  const raw=$('joinToken').value.trim();let candidate=raw,kind='family',destination=null;
  if(/^https?:/i.test(raw)){
   let url;try{url=new URL(raw);const here=new URL(location.href);if(url.origin!==here.origin||url.pathname!==here.pathname)throw Error()}catch{throw Error('Use an invitation link for this Goodnights app.')}
   if(url.searchParams.has('member')){kind='member';candidate=url.searchParams.get('member')}
   else if(url.searchParams.has('family'))candidate=url.searchParams.get('family');
   else if(url.searchParams.has('poll'))destination=url.href;
   else throw Error('Paste your personal, organizer or group invitation link.');
  }
  if(destination){location.assign(destination);return}
  if(!candidate)throw Error('Paste your invitation link.');
  if(kind==='member'){
   const info=await rpc('gw_get_member',{p_member_token:candidate});memberToken=candidate;familyToken='';member={id:info.id,name:info.name,avatar:info.avatar};family=normalizeFamily(info.family);localStorage.setItem(memberKey,candidate);localStorage.removeItem(familyKey);
  }else{const info=await rpc('gw_get_family',{p_token:candidate});familyToken=candidate;memberToken='';member=null;family=normalizeFamily(info);localStorage.setItem(familyKey,candidate);localStorage.removeItem(memberKey)}
  render();toast('Connected to your family.');return;
 }
 if(act==='familyLink'){await copy(familyUrl());return}
 if(act==='addMember'){const n=$('newMemberName')?.value.trim();if(!n)throw Error('Enter a name');await safe(async()=>{await rpc('gw_add_member',{p_token:familyToken,p_name:n});await loadMembers();render();toast('Member added')});return}
 if(act==='copyMember'){const m=members.find(x=>x.id===button.dataset.id);if(m)copy(memberUrl(m.token));return}
 if(act==='resetMemberLink'||act==='removeMember'){
  const m=members.find(x=>x.id===button.dataset.id);if(!m)return;const reset=act==='resetMemberLink';
  if(!confirm(reset?'Replace '+m.name+'’s personal link? The old link will stop working. Send them the new invitation afterward.':'Remove '+m.name+'’s voting access? Their personal link and group name will stop working. Saved votes stay in history.'))return;
  await rpc(reset?'gw_rotate_member':'gw_remove_member',{p_token:familyToken,p_member_id:m.id});await loadMembers();render();toast(reset?'Personal link reset. Copy and send the new invitation.':'Member voting access removed.');return;
 }
 if(act==='editRestaurant'){state.editingId=button.dataset.id;render();window.scrollTo({top:0,behavior:'smooth'});return}
 if(act==='cancelRestaurant'){delete state.restaurantDrafts['edit:'+state.editingId];state.skipDraftCapture=true;state.editingId=null;render();return}
 if(act==='previewRestaurant'){
  const r={name:$('editName')?.value||'',category:$('editCategory')?.value||'',...readAppearance('edit')};
  $('logoPreview').innerHTML=icon(r.category,r.name,r);return;
 }
 if(act==='saveRestaurant'){
  const id=state.editingId,name=$('editName')?.value.trim(),category=$('editCategory')?.value.trim()||'',
        address=$('editAddress')?.value.trim()||'';
  if(!name)throw Error('Enter a restaurant name');
  const appearance=readAppearance('edit');
  await safe(async()=>{
   await rpc('gw_update_restaurant',{p_token:familyToken,p_restaurant_id:id,p_name:name,
     p_category:category,p_address:address,p_icon_mode:appearance.icon_mode,p_icon_value:appearance.icon_value});
   await loadFamily();state.editingId=null;render();toast(name+' updated');
  });return;
 }
 if(act==='toggleAdd'){state.adding=!state.adding;render();return}
 if(act==='addManual'){
  const name=$('restName')?.value.trim(),category=$('restCategory')?.value.trim();
  if(!name)throw Error('Enter a restaurant name.');
  const appearance=readAppearance('manual');
  await safe(async()=>{
   const id=await rpc('gw_add_restaurant',{p_token:familyToken,p_name:name,p_category:category||'',p_address:''});
   if(appearance.icon_mode!=='auto')await rpc('gw_update_restaurant',{p_token:familyToken,p_restaurant_id:id,
     p_name:name,p_category:category||'',p_address:'',p_icon_mode:appearance.icon_mode,p_icon_value:appearance.icon_value});
   await loadFamily();state.adding=false;render();toast(name+' added to your list');
  });return;
 }
 if(act==='archive'){
  if(!confirm('Hide this restaurant from future votes?'))return;
  await safe(async()=>{await rpc('gw_archive_restaurant',{p_token:familyToken,p_restaurant_id:button.dataset.id});await loadFamily();state.selected.delete(button.dataset.id);render();toast('Restaurant hidden')});return;
 }
 if(act==='openGoogleMaps'){
  const name=$('localName')?.value||state.restaurantName;
  const town=$('city')?.value||state.city;
  const url=window.GoodnightsMaps.searchUrl(name,town);
  window.open(url,'_blank','noopener,noreferrer');
  return;
 }
 if(act==='fillGoogle'){
  const raw=$('googlePaste')?.value||'';
  if(!raw.trim())throw Error('Paste the name and address or a full Google Maps link first.');
  const info=window.GoodnightsMaps.parsePaste(raw);
  if(info.name)$('googleName').value=info.name;
  if(info.address)$('googleAddress').value=info.address;
  toast(info.name?'Check the details below, then save.':info.shortLink?'Short Google Maps links cannot reveal a restaurant name. Please enter the name below.':'Enter the restaurant name below, then save.');
  return;
 }
 if(act==='saveGoogle'){
  const pasted=window.GoodnightsMaps.parsePaste($('googlePaste')?.value||'');
  const name=($('googleName')?.value.trim()||pasted.name||'').slice(0,120);
  const address=($('googleAddress')?.value.trim()||pasted.address||'').slice(0,240);
  if(!name)throw Error('Enter a restaurant name. Short Google Maps links need the name entered separately.');
  if(family.restaurants.some(r=>r.name.trim().toLowerCase()===name.trim().toLowerCase()))
   throw Error('This restaurant name is already saved. To add another location, include the town in its name.');
  const appearance=readAppearance('google');
  await safe(async()=>{
   const id=await rpc('gw_add_restaurant',{p_token:familyToken,p_name:name,p_category:'',p_address:address});
   if(appearance.icon_mode!=='auto')await rpc('gw_update_restaurant',{p_token:familyToken,p_restaurant_id:id,
     p_name:name,p_category:'',p_address:address,p_icon_mode:appearance.icon_mode,p_icon_value:appearance.icon_value});
   await loadFamily();render();toast(name+' added to your list!');
  });
  return;
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
  const arr=pollChoices();for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}state.selected=new Set(arr.slice(0,Math.min(5,arr.length)).map(x=>x.id));render();return;
 }
 if(act==='cuisine'){if(familyToken)chooseCuisine(button.dataset.cuisine);return}
 if(act==='selectAll'){for(const r of pollChoices()){if(state.selected.size>=20)break;state.selected.add(r.id)}render();return}
 if(act==='resetPollFilters'){state.pollCuisine='';state.pollSearch='';state.pollCenter=null;state.pollRadius='';render();return}
 if(act==='pollLocation'){
  if(!navigator.geolocation)throw Error('Location is unavailable. Filter by town instead.');
  await safe(async()=>{const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,()=>reject(Error('Could not get your location. Allow location access or filter by town.')),{timeout:12000}));state.pollCenter={lat:pos.coords.latitude,lon:pos.coords.longitude};render()});return;
 }
 if(act==='clear'){
state.selected.clear();render();return}
 if(act==='createPoll'){
  if(state.page!=='create'||state.createStep!==3)return;
  if(![0,1,2].every(stepReady))throw Error('Choose places, people and a voting method first.');
  if(state.repeatDraft&&!await revalidateRepeatDraft())return;
  const ids=[...state.selected];if(ids.length<2||ids.length>20)throw Error('Select 2–20 restaurants.');
  await safe(()=>makePoll(ids));return;
 }
 if(act==='openpoll'){await openPoll(button.dataset.id);return}
 if(act==='retryMembers'){await safe(async()=>{await loadMembers();state.memberLoadError=false;render()});return}
 if(act==='copyMemberPoll'||act==='shareMemberPoll'||act==='copyMemberMessage'){
  if(!familyToken||!poll)return;
  const m=members.find(m=>m.id===button.dataset.id);if(!m)return;
  if(act==='copyMemberMessage'){await copyMessage(pollMessage(m));return}
  if(act==='shareMemberPoll'){await shareMessage(pollMessage(m));return}
  const url=memberPollUrl(m);
  await copy(url);
  return;
 }
 if(act==='copyPoll'){
copy(pollUrl(poll.id));return}
 if(act==='closePoll'){
  if(!confirm('End voting now and reveal the votes already cast?'))return;
  await safe(async()=>{await rpc('gw_close_poll',{p_token:familyToken,p_poll_id:poll.id});await loadPoll(poll.id);await loadFamily();render()});return;
 }
 if(act==='swipeNo'){voteSwipe(false);return}
 if(act==='swipeYes'){voteSwipe(true);return}
 if(act==='swipeBack'){state.swipeIndex=Math.max(0,state.swipeIndex-1);render();return}
 if(act==='cancelVoteEdit'){state.editingVote=false;render();return}
 if(act==='resetVote'){
  if(inGroup(poll?.id))return;
  if(!memberToken||!member||!poll)return;
  await safe(async()=>{
   await loadPoll(poll.id);if(poll.status!=='open'){state.editingVote=false;render();toast('Voting has finished. Your saved vote is included.');return}
   const ballot=await rpc('gw_get_my_ballot',{p_poll_id:poll.id,p_member_token:memberToken});
   if(ballot===null)throw Error('Could not find your saved vote. Refresh and try again.');
   state.approvals=new Set(poll.method==='approval'?ballot:[]);state.swipes=poll.method==='swipe'?{...ballot}:{};state.rank=poll.method==='ranked'?[...ballot]:[];state.swipeIndex=0;state.editingVote=true;render();
  });return;
 }
 if(act==='submitVote'){
  if(!poll||poll.status!=='open'||state.page!=='poll')return;
  if(!state.preview&&member&&poll.voted_member_ids?.includes(member.id)&&!state.editingVote)return;
  if(!state.preview&&poll.roster_enabled&&poll.can_vote!==true)throw Error('Check your invitation status before voting.');
  state.name=state.preview?'Practice voter':member?.name||$('voterName')?.value.trim()||state.name;if(!state.name)throw Error('Open your personal link to vote.');
  let ballot;
  if(poll.method==='approval'){
   ballot=[...state.approvals];if(ballot.length<1||ballot.length>2)throw Error('Pick one or two restaurants.');
  }else if(poll.method==='swipe'){
   ballot=state.swipes;if(Object.keys(ballot).length!==poll.options.length)throw Error('Vote on every restaurant.');
  }else{
   ballot=state.rank.slice(0,Math.min(3,poll.options.length));
   if(ballot.some(x=>!x)||new Set(ballot).size!==ballot.length||ballot.length!==Math.min(3,poll.options.length))throw Error('Rank different restaurants in every position.');
  }
  if(state.preview){poll.ballots=[ballot];poll.voted_count=1;poll.status='closed';render();return}
  await safe(async()=>{
   if((!memberToken&&!inGroup(poll.id))||!member)throw Error('Use your personal member link or group invitation to vote');
   const editing=state.editingVote;
   if(inGroup(poll.id))await groupRpc('vote',{p_ballot:ballot});else await rpc('gw_vote_as_member',{p_poll_id:poll.id,p_member_token:memberToken,p_ballot:ballot});
   state.editingVote=false;poll.voted_member_ids=[member.id];
   localStorage.setItem('gw_name',state.name);localStorage.setItem('gw_voted_'+poll.id,'1');
   try{await loadPoll(poll.id);if(familyToken)await loadFamily()}catch{render();if(!editing&&poll.status==='open')celebrateVote();toast('Your vote was saved. Refresh for the latest status.');return}
   render();if(!editing&&poll.status==='open')celebrateVote();toast(editing?'Your vote has been updated!':'Your vote is in!');
  });return;
 }
 if(act==='randomTie'){
  if(window.GoodnightsVoting.tally(poll).winners.length<2)throw Error('No tiebreaker needed.');
  if(!confirm('Pick one of the tied leaders at random? This saves one final pick for everyone and cannot be rerolled.'))return;
  await safe(async()=>{await rpc('gw_resolve_tie_random',{p_token:familyToken,p_poll_id:poll.id});clearResultsCard();await loadPoll(poll.id);render();toast('🎲 Your tied winner is picked!')});return;
 }
 if(act==='runoff'){
  const scores=window.GoodnightsVoting.tally(poll).winners;if(scores.length<2)throw Error('No runoff needed.');
  state.meal=poll.meal;state.pollCuisine=poll.cuisine||'';const chosen=poll.roster_enabled?(poll.people||[]).filter(m=>m.active!==false).map(m=>m.id):[];if(poll.roster_enabled&&!chosen.length)throw Error('Load participant status, or start a new vote with active family members.');await safe(()=>makePoll(scores,'ranked',poll.expected_voters,chosen));return;
 }
 if(act==='goHome'){if(state.page==='poll'&&!familyToken&&!memberHomeAllowed())return;await safe(async()=>{if(familyToken||memberToken)await loadFamily();setPage('home')});return}
}
app.addEventListener('error',e=>{
 const img=e.target;
 if(img?.matches?.('img[data-member-avatar]')){img.hidden=true;if(img.nextElementSibling)img.nextElementSibling.hidden=false;return}
 if(img?.matches?.('img[data-restaurant-logo]')){
  img.hidden=true;
  if(img.nextElementSibling)img.nextElementSibling.hidden=false;
 }
},true);
// Keep small favicons at their native resolution instead of stretching them.
app.addEventListener('load',e=>{
 const img=e.target;
 if(img?.matches?.('img[data-restaurant-logo]')&&img.naturalWidth&&img.naturalHeight){
  img.style.maxWidth=Math.min(img.naturalWidth,128)+'px';
  img.style.maxHeight=Math.min(img.naturalHeight,128)+'px';
 }
},true);
app.addEventListener('click',async e=>{
 if(state.pendingAction){e.preventDefault?.();return}
 const button=e.target.closest('[data-act]');if(!button||button.disabled)return;
 const act=button.dataset.act,mutating=act in pendingLabels;
 if(mutating){state.pendingAction=act;syncPendingUI()}
 try{await doAction(act,button)}catch(err){toast(err.message||'Something went wrong')}finally{if(mutating){state.pendingAction=null;syncPendingUI()}}
});
app.addEventListener('change',e=>{
 const t=e.target;
 if(t.id==='profilePhoto'){
  const file=t.files?.[0];if(!file)return;
  const editing=state.editingMember;state.photoBusy=true;const save=app.querySelector('[data-act="saveMemberProfile"]');if(save)save.disabled=true;
  readAvatar(file).then(data=>{if(state.editingMember!==editing)return;state.avatarDraft=data;$('avatarPreview').innerHTML=memberIdentity({name:$('profileName').value,avatar:data})}).catch(e=>toast(e.message)).finally(()=>{state.photoBusy=false;if(save)save.disabled=false});return;
 }
 if(t.dataset.person){if(t.checked&&state.selectedPeople.size>=20){t.checked=false;toast('Choose up to 20 people.');return}t.checked?state.selectedPeople.add(t.dataset.person):state.selectedPeople.delete(t.dataset.person);renderKeepingFocus(t)}
 else if(t.dataset.select){if(t.checked&&state.selected.size>=20){t.checked=false;toast('Choose up to 20 restaurants.');return}t.checked?state.selected.add(t.dataset.select):state.selected.delete(t.dataset.select);renderKeepingFocus(t)}
 else if(t.dataset.approval){
  if(t.checked&&state.approvals.size>=2){t.checked=false;toast('Choose up to 2 restaurants.');return}
  t.checked?state.approvals.add(t.dataset.approval):state.approvals.delete(t.dataset.approval);renderKeepingFocus(t);
 }else if(t.dataset.rank!==undefined){
  const i=Number(t.dataset.rank);state.rank[i]=t.value;
  if(t.value)state.rank=state.rank.map((v,j)=>j!==i&&v===t.value?'':v);
  // Preserve the native select node: replacing/refocusing it reopens the iOS picker.
  for(let j=0;j<Math.min(3,poll.options.length);j++){const select=$('rank'+j);if(select&&select!==t)select.value=state.rank[j]||'';const logo=$('rankLogo'+j);if(logo)logo.innerHTML=rankLogo(j)}
  const ready=rankReady(),submit=app.querySelector?.('[data-act="submitVote"]');if(submit)submit.disabled=!ready;
  const summary=app.querySelector?.('.ballot-summary');if(summary)summary.innerHTML='<strong>'+esc((member?.name||'Practice voter')+' · '+state.rank.filter(Boolean).length+' of '+Math.min(3,poll.options.length)+' ranked')+'</strong><span>'+(ready?'Ready when you are':'Choose a different place for each rank')+'</span>';
 }else if(t.name==='method'){state.method=t.value;renderKeepingFocus(t)}
 else if(t.id==='pollCuisine'){if(familyToken)chooseCuisine(t.value)}
 else if(t.id==='pollRadius'){state.pollRadius=t.value;renderKeepingFocus(t)}
 else if(t.id==='allowMemberHome')state.allowMemberHome=t.checked;
 else if(t.id==='groupJoin')state.groupJoin=t.checked;
 else if(t.id==='includeCardAvatars'){if(!familyToken)return;state.includeCardAvatars=t.checked;clearResultsCard();render()}
 else if(t.id==='meal')state.meal=t.value;
 else if(t.id==='voters')state.expected=Number(t.value);
});
app.addEventListener('focusout',()=>{if(state.deferredPollRender)setTimeout(()=>{if(state.deferredPollRender&&!document.activeElement?.matches?.('select,input,textarea')){state.deferredPollRender=false;render()}},0)});
app.addEventListener('input',e=>{
 const t=e.target;if(t.id==='pollSearch'){state.pollSearch=t.value;const at=t.selectionStart;render();const field=$('pollSearch');field.focus();field.setSelectionRange(at,at)}
 else if(t.id==='restaurantSearch'){state.search=t.value;const at=t.selectionStart;render();const field=$('restaurantSearch');field.focus();field.setSelectionRange(at,at)}
 else if(t.id==='city')state.city=t.value;
 else if(t.id==='localName')state.restaurantName=t.value;
 else if(t.id==='voterName')state.name=t.value;
});
let swipeTouch=null;
app.addEventListener('touchstart',e=>{
 swipeTouch=null;
 if(e.touches.length!==1||!e.target.closest('#swipeCard'))return;
 const t=e.changedTouches[0];
 swipeTouch={id:t.identifier,x:t.screenX,y:t.screenY};
},{passive:true});
app.addEventListener('touchcancel',()=>{swipeTouch=null},{passive:true});
app.addEventListener('touchend',e=>{
 const start=swipeTouch;swipeTouch=null;
 if(!start||!e.target.closest('#swipeCard')||state.page!=='poll'||poll?.method!=='swipe')return;
 const t=Array.from(e.changedTouches).find(t=>t.identifier===start.id);
 if(!t)return;
 const dx=t.screenX-start.x,dy=t.screenY-start.y;
 if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)voteSwipe(dx>0);
},{passive:true});
async function init(){
 if(!live){demoInit();badge.textContent='LOCAL DEMO'}
 else if(params.get('member')){memberToken=params.get('member');familyToken='';localStorage.setItem(memberKey,memberToken);localStorage.removeItem(familyKey)}
 else if(params.get('family')){familyToken=params.get('family');memberToken='';member=null;localStorage.setItem(familyKey,familyToken);localStorage.removeItem(memberKey)}
 else if(memberToken)familyToken='';
 if(params.get('poll')&&params.get('join')&&!params.get('member')&&!params.get('family')){const id=params.get('poll');familyToken='';memberToken='';member=null;let saved;try{saved=JSON.parse(localStorage.getItem(groupKey(id))||'null')}catch{}groupAccess={pollId:id,token:params.get('join'),memberId:saved?.token===params.get('join')?saved.memberId:null};if(groupAccess.memberId)try{member=await groupRpc('identity')}catch{groupAccess.memberId=null;localStorage.removeItem(groupKey(id))}await openPoll(id);return}
 if(params.get('poll')){if(memberToken)try{await loadFamily()}catch(e){toast(e.message)}await openPoll(params.get('poll'));return}
 try{await loadFamily();render()}catch(e){toast(e.message);family=null;renderWelcome()}
}
window.addEventListener?.('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;if(state.page==='home'&&family)render()});
window.addEventListener?.('appinstalled',()=>{installPrompt=null;if(state.page==='home'&&family)render()});
document.getElementById('brand').addEventListener('click',async e=>{e.preventDefault();if(state.pendingAction||state.page==='poll'&&!familyToken&&!memberHomeAllowed())return;if(familyToken||memberToken){await safe(async()=>{await loadFamily();setPage('home')})}else setPage('home')});
init();
})();
