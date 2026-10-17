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
const state={editingVote:false,pendingAction:null,resultCard:null,cardBusy:false,preview:false,editingMember:null,avatarDraft:'🙂',photoBusy:false,page:'home',selected:new Set(),meal:'Dinner',method:'approval',expected:4,
 name:localStorage.getItem('gw_name')||'',approvals:new Set(),swipes:{},swipeIndex:0,rank:[],
 pollSearch:'',pollCenter:null,pollRadius:'',memberLoadError:false,search:'',nearby:[],nearbyBusy:false,center:null,city:'New Palestine, Indiana',restaurantName:'',nearbyQuery:'',
 adding:false,showNearby:false,busy:false,notice:'',editingId:null};
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
const pendingLabels={createPoll:'Creating vote…',submitVote:'Saving your vote…',addMember:'Adding member…',saveMemberProfile:'Saving profile…',saveRestaurant:'Saving restaurant…',addManual:'Saving restaurant…',saveGoogle:'Saving restaurant…',addNearby:'Saving restaurant…',archive:'Hiding restaurant…',editMember:'Updating member…',closePoll:'Closing vote…',runoff:'Creating runoff…',newFamily:'Creating family…',resetVote:'Loading your vote…'};
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
function layout(content,{nav=true}={}){if(state.preview)content=previewBanner()+content;badge.textContent=live?(familyToken?'ORGANIZER':member?'FAMILY MEMBER':'FAMILY APP'):'LOCAL DEMO';app.innerHTML=(nav?navHtml(state.page):'')+content;syncPendingUI()}
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
async function loadPoll(id){poll=await rpc('gw_get_poll',{p_poll_id:id});if(memberToken&&member){const voted=await rpc('gw_member_has_voted',{p_poll_id:id,p_member_token:memberToken});poll.voted_member_ids=voted?[member.id]:[]}}
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
 ${live?`<button class="btn btn-dark" data-act="newFamily">Create our family</button><div class="field"><label>Already have a family link?</label><input id="joinToken" placeholder="Paste your family invite link"></div><button class="btn btn-line" data-act="join">Join family</button>`:`<button class="btn btn-dark" data-act="demo">Explore the sample app</button><p class="note">Demo only until you connect Supabase. Votes stay in this browser and cannot be shared with other phones.</p>`}</div>`,{nav:false})}
function renderHome(){
 if(member&&!familyToken)return renderMemberHome();
 let latest=family.polls||[];
 layout(`<div class="card hero"><div class="hero-emoji">🍔</div><div class="eyebrow">${esc(family.name)} · DINNER CLUB</div><h1>So... what's for dinner?</h1><p class="lede">Skip the debate. Pick a few places, vote together, and let dinner decide itself.</p>${familyToken?`<button class="btn btn-dark" data-act="nav" data-page="create">Start a family vote →</button>`:`<p class="subtle">Signed in as ${esc(member?.name||"family member")}</p>`}</div>
 ${!live?`<div class="muted-box" style="margin-bottom:15px"><strong>🧪 Local demo</strong><div>This sample works on this device only. To vote together on multiple phones, complete the Supabase + GitHub Pages setup in the README.</div></div>`:''}
 ${familyToken?`<div class="grid2"><div class="card"><span class="eyebrow">FAMILY FAVORITES</span><h2>🍽️ ${family.restaurants.length} places</h2><p class="subtle">Add restaurants once. Vote on them anytime.</p><button class="btn btn-quiet btn-sm" data-act="nav" data-page="restaurants">Manage restaurants ↗</button></div>
 <div class="card"><span class="eyebrow">INVITE FAMILY</span><h2>👨‍👩‍👧‍👦 Invite your people</h2><p class="subtle">Choose a person and copy their own voting link.</p><button class="btn btn-quiet btn-sm" data-act="nav" data-page="members">Personal invitations ↗</button></div></div>`:''}
 <div class="between" style="margin:22px 0 11px"><h2 style="margin:0">Recent votes</h2><button class="btn btn-quiet btn-sm" data-act="nav" data-page="history">View all</button></div>
 ${latest.length?latest.slice(0,4).map(q=>`<div class="card"><div class="between"><div><strong>${esc(q.meal)} · ${methodName(q.method)}</strong><div class="subtle">${timeAgo(q.created_at)} · ${q.voted_count}/${q.expected_voters} voted</div></div>${pill(q)}</div><button class="btn btn-quiet btn-sm" style="margin-top:12px" data-act="openpoll" data-id="${esc(q.id)}">Open vote →</button></div>`).join(''):
 `<div class="card empty"><span class="empty-emoji">🗳️</span><h3>Your first vote is waiting</h3><p>There are no polls yet.</p>${familyToken?`<button class="btn btn-primary" data-act="nav" data-page="create">Create first vote</button>`:''}</div>`}`)
}
function renderMemberHome(){
 const polls=family.polls||[],open=polls.filter(p=>p.status==='open'),closed=polls.filter(p=>p.status==='closed');
 const cards=list=>list.map(p=>`<div class="card"><div class="between"><div><h3>${esc(p.meal)} · ${methodName(p.method)}</h3><p class="subtle">${timeAgo(p.created_at)} · ${p.voted_count}/${p.expected_voters} votes in</p></div>${pill(p)}</div><button class="btn btn-primary btn-full" data-act="openpoll" data-id="${esc(p.id)}">${p.status==='open'?'Open vote →':'See results →'}</button></div>`).join('');
 layout(`${memberIdentity(member)}<h1>Your family votes.</h1><p class="lede">Choose an open vote or catch up on the latest dinner decision.</p><h2>🗳️ Open votes</h2>${open.length?cards(open):'<div class="card empty"><h3>Nothing to vote on right now</h3><p>Your organizer will send an invitation when the next vote is ready.</p></div>'}<h2 style="margin-top:24px">🏆 Recent results</h2>${closed.length?cards(closed.slice(0,4)):'<p class="subtle">Finished votes will appear here.</p>'}`)
}
function memberAvatar(m){const a=F.avatar(m?.avatar);return a.startsWith('data:')?`<span class="member-avatar"><img data-member-avatar src="${esc(a)}" alt=""><span hidden>🙂</span></span>`:`<span class="member-avatar" aria-hidden="true">${esc(a)}</span>`}
function memberIdentity(m){return `<div class="member-identity">${memberAvatar(m)}<div><span class="eyebrow">YOUR FAMILY VOTE</span><strong>${esc(m.name)}</strong></div></div>`}
function memberEditor(){
 const m=members.find(m=>m.id===state.editingMember);if(!m)return '';
 return `<section class="card profile-editor"><h2>✏️ Edit ${esc(m.name)}</h2><div id="avatarPreview">${memberIdentity({name:m.name,avatar:state.avatarDraft})}</div>
 <div class="field"><label for="profileName">Name</label><input id="profileName" maxlength="60" value="${esc(m.name)}"></div>
 <div class="field"><label for="profilePhone">Phone for text drafts (optional)</label><input id="profilePhone" type="tel" autocomplete="off" value="${esc(m.phone||'')}" placeholder="+1 555 123 4567"></div><p class="note">Visible only to the organizer. Include the country code for international numbers.</p>
 <fieldset class="avatar-options"><legend>Choose an avatar</legend>${F.emojis.map(a=>`<button type="button" class="avatar-choice" aria-label="Avatar ${a}" aria-pressed="${state.avatarDraft===a}" data-act="chooseAvatar" data-avatar="${a}">${a}</button>`).join('')}</fieldset>
 <div class="field"><label for="profilePhoto">Or upload a small photo</label><input id="profilePhoto" type="file" accept="image/jpeg,image/png,image/webp"><span class="note">Photo is cropped to a square and compressed before saving.</span></div>
 <div class="btn-row"><button class="btn btn-primary" data-act="saveMemberProfile" ${state.photoBusy?'disabled':''}>Save profile</button><button class="btn btn-line" data-act="cancelMemberProfile">Cancel</button></div></section>`;
}
async function readAvatar(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG or WebP photo.');
 if(file.size>10*1024*1024)throw Error('Choose a photo smaller than 10 MB.');
 const url=URL.createObjectURL(file),img=new Image();
 try{await new Promise((ok,fail)=>{img.onload=ok;img.onerror=()=>fail(Error('Could not read this photo.'));img.src=url});
 const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const ctx=canvas.getContext('2d'),side=Math.min(img.naturalWidth,img.naturalHeight);ctx.fillStyle='#fff';ctx.fillRect(0,0,96,96);ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,96,96);const data=canvas.toDataURL('image/jpeg',0.72);if(F.avatar(data)!==data)throw Error('Photo could not be compressed. Try another photo.');return data;
 }finally{URL.revokeObjectURL(url)}
}
function renderMembers(){
 if(!familyToken){setPage('home');return}
 layout(`<div class="eyebrow">FAMILY SETTINGS</div><h1>Family members</h1><p class="lede">Personal links, familiar faces, and an easier way to invite everyone.</p>
 <div class="card"><h2>Add a member</h2><div class="field"><label for="newMemberName">Name</label><input id="newMemberName" maxlength="60" placeholder="e.g. Charlotte"></div><button class="btn btn-primary btn-full" data-act="addMember">＋ Add family member</button></div>
 ${memberEditor()}<div class="card"><h2>${members.length} members</h2>${members.map(m=>`<div class="member-profile-row"><div class="member-identity">${memberAvatar(m)}<div><strong>${esc(m.name)}</strong><div class="subtle">${m.phone?'📱 Text number saved':'Personal voting link'}</div></div></div><div class="btn-row"><button class="btn btn-quiet btn-sm" data-act="copyMember" data-id="${esc(m.id)}">Copy link</button><button class="btn btn-primary btn-sm" data-act="editMemberProfile" data-id="${esc(m.id)}">Edit profile</button><button class="btn btn-line btn-sm" data-act="editMember" data-id="${esc(m.id)}">Link / remove</button></div></div>`).join('')||'<p>No family members yet.</p>'}</div><p class="note">Only the organizer can edit profiles and phone numbers. Reset a personal link if it is shared accidentally.</p><details class="card organizer-backup"><summary>🔑 Organizer access backup</summary><p class="note">This private link gives full organizer access. Save it for yourself or another organizer. Invite voters with their personal links above.</p><button class="btn btn-line btn-full" data-act="familyLink">Copy private organizer link</button></details>`)
}
function renderRestaurants(){
 if(!familyToken){setPage('home');return}
 const editR=state.editingId?family.restaurants.find(r=>r.id===state.editingId):null;
 const search=state.search.toLowerCase().trim(),restaurants=(family.restaurants||[]).filter(r=>(r.name+' '+r.category+' '+r.address).toLowerCase().includes(search));
 layout(`<div class="eyebrow">OUR GO-TO SPOTS</div><div class="between"><div><h1>Our restaurants.</h1><p class="lede">Your family's personal shortlist. Add any place you like.</p></div><span class="count">${family.restaurants.length} saved</span></div>
 ${editR?`<div class="card restaurant-edit-card"><div class="eyebrow">CUSTOMIZE RESTAURANT</div><h2>Edit ${esc(editR.name)}</h2>
<div class="field"><label for="editName">Restaurant name</label><input id="editName" maxlength="120" value="${esc(editR.name)}"></div>
<div class="field"><label for="editCategory">Category</label><input id="editCategory" maxlength="80" value="${esc(editR.category||'')}"></div>
<div class="field"><label for="editAddress">Address</label><input id="editAddress" maxlength="240" value="${esc(editR.address||'')}"></div>
${appearanceFields('edit',editR)}
<div class="logo-preview-line"><span>Current</span><div class="foodicon">${icon(editR.category,editR.name,editR)}</div><span>Preview</span><div id="logoPreview" class="foodicon">${icon(editR.category,editR.name,editR)}</div></div>
<div class="btn-row"><button class="btn btn-line" data-act="previewRestaurant">Preview logo</button><button class="btn btn-line" data-act="cancelRestaurant">Cancel</button><button class="btn btn-primary" data-act="saveRestaurant">Save changes</button></div></div>`:''}
 <div class="card"><div class="between"><h2 style="margin:0">Find something good</h2><button class="btn btn-primary btn-sm" data-act="toggleAdd">＋ Add</button></div>
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
 </div><div class="card"><div class="field" style="margin-top:0"><label for="restaurantSearch">Filter your list</label><input id="restaurantSearch" value="${esc(state.search)}" placeholder="Search saved restaurants…"></div>
 ${restaurants.length?restaurants.map(r=>restaurantRow(r,{remove:true})).join(''):`<div class="empty"><span class="empty-emoji">🥗</span><h3>No matching restaurants</h3><p>Add a favorite or change your search.</p></div>`}</div>`)
}
function methodName(m){return {approval:'Approval',swipe:'Swipe / Consensus',ranked:'Ranked choice'}[m]||m}
function pollChoices(){
 const query=state.pollSearch.trim().toLowerCase();
 return (family.restaurants||[]).map(r=>({...r,distance:state.pollCenter&&Number.isFinite(r.latitude)&&Number.isFinite(r.longitude)?geodistance(state.pollCenter.lat,state.pollCenter.lon,r.latitude,r.longitude):null}))
 .filter(r=>(!query||[r.name,r.category,r.address].join(' ').toLowerCase().includes(query))&&(!state.pollCenter||!state.pollRadius||(r.distance!==null&&r.distance<=Number(state.pollRadius))))
 .sort((a,b)=>state.pollCenter?(a.distance??Infinity)-(b.distance??Infinity)||a.name.localeCompare(b.name):a.name.localeCompare(b.name));
}
function renderCreate(){
 if(!familyToken){setPage('home');return}
 const choices=pollChoices();
 layout(`<div class="eyebrow">MAKE A DECISION</div><h1>Start a vote.</h1><p class="lede">Choose what's on the menu, then invite everyone.</p>
 <div class="card"><div class="field-row"><div class="field" style="margin-top:0"><label for="meal">Meal</label><select id="meal"><option ${state.meal==='Dinner'?'selected':''}>Dinner</option><option ${state.meal==='Lunch'?'selected':''}>Lunch</option></select></div><div class="field" style="margin-top:0"><label for="voters">How many voters?</label><select id="voters">${Array.from({length:12},(_,i)=>i+1).map(n=>`<option value="${n}" ${state.expected===n?'selected':''}>${n} ${n===1?'person':'people'}</option>`).join('')}</select></div></div>
 <div class="between"><h2 style="margin:8px 0 0">Pick the contenders</h2><span class="count">${state.selected.size} selected</span></div><p class="subtle">Select 2–20 restaurants. Tap a restaurant row to select it.</p>
 <div class="field"><label for="pollSearch">Filter by name, category or town</label><input id="pollSearch" value="${esc(state.pollSearch)}" placeholder="Restaurant or town…"></div>
 <div class="btn-row"><button class="btn btn-quiet btn-sm" data-act="pollLocation">📍 Closest to me</button><button class="btn btn-line btn-sm" data-act="resetPollFilters">Reset filters</button></div>
 ${state.pollCenter?`<div class="field"><label for="pollRadius">Distance from you</label><select id="pollRadius">${[['','Any distance'],['5','Within 5 miles'],['10','Within 10 miles'],['20','Within 20 miles']].map(([v,label])=>`<option value="${v}" ${state.pollRadius===v?'selected':''}>${label}</option>`).join('')}</select></div><p class="note">Nearest first · straight-line distance, not driving distance. Restaurants without coordinates appear last and are excluded by a distance limit.</p>`:''}
 <div class="btn-row" style="margin:15px 0"><button class="btn btn-quiet btn-sm" data-act="selectAll">Select all shown (up to 20)</button><button class="btn btn-line btn-sm" data-act="clear">Clear selection</button></div>
 <p class="note">${choices.length} shown · ${[...state.selected].filter(id=>!choices.some(r=>r.id===id)).length} selected outside these filters. Select all adds shown restaurants to your selection.</p>
 ${choices.length?choices.map(r=>restaurantRow(r,{select:true})).join(''):`<div class="empty"><span class="empty-emoji">🍽️</span><h3>No matching restaurants</h3><p>Reset the filters or add restaurants to your family list.</p><button class="btn btn-quiet" data-act="nav" data-page="restaurants">Add restaurants</button></div>`}
 ${choices.length?`<div class="btn-row" style="margin-top:15px"><button class="btn btn-quiet btn-sm" data-act="random">🎲 Pick 5 for me</button><button class="btn btn-line btn-sm" data-act="clear">Clear selection</button></div>`:''}</div>
 <div class="card"><h2>How should we vote?</h2><p class="note">Try a practice ballot before you choose. Previews never save votes.</p><div class="btn-row">${['approval','swipe','ranked'].map(m=>`<button class="btn btn-quiet btn-sm" data-act="previewMode" data-method="${m}">🧪 ${methodName(m)}</button>`).join('')}</div>
 ${[['approval','✅','Approval vote','Everyone picks up to 2 places they’d be happy eating.'],['swipe','👉','Swipe / consensus','Yes or no on each restaurant. The highest positive percentage wins.'],['ranked','🥇','Ranked choice','Rank your top 3. Instant-runoff counting breaks clear ties.']].map(([id,emoji,title,desc])=>`<label class="method ${state.method===id?'checked':''}"><input type="radio" name="method" value="${id}" ${state.method===id?'checked':''}><span class="methodmark">${emoji}</span><span><strong>${title}</strong><small>${desc}</small></span></label>`).join('')}
 <p class="note">Results stay hidden until all expected voters finish, or you close the poll early.</p><button class="btn btn-primary btn-full" data-act="createPoll" ${state.selected.size<2?'disabled':''}>Create ${esc(state.meal.toLowerCase())} vote →</button></div>`)
}
function renderHistory(){
 layout(`<div class="eyebrow">THE DECISIONS WE MADE</div><h1>Vote history.</h1><p class="lede">Every delicious decision, all in one place.</p>
 ${(family.polls||[]).length?family.polls.map(q=>`<div class="card"><div class="between"><div><strong>${esc(q.meal)} · ${methodName(q.method)}</strong><div class="subtle">${timeAgo(q.created_at)} · ${q.voted_count}/${q.expected_voters} family votes</div></div>${pill(q)}</div><button class="btn btn-quiet btn-sm" style="margin-top:13px" data-act="openpoll" data-id="${esc(q.id)}">View poll →</button></div>`).join(''):`<div class="card empty"><span class="empty-emoji">🍜</span><h3>No votes yet</h3><p>Start a poll and it will appear here.</p></div>`}`)
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
 const closed=poll.status==='closed',summary=closed?F.result(poll,window.GoodnightsVoting.tally(poll),resultsUrl()):'';
 return `<section class="card sharing-card"><div class="eyebrow">${closed?'📣 DINNER IS DECIDED':'💌 INVITE THE FAMILY'}</div><h2>${closed?'Share the results':'Invite family to this vote'}</h2><p class="note">${closed?'Group-safe results include the winner and voting stats.':'Send each personal invitation only to that person.'} Text opens a draft; you choose when to send. Share opens your device’s app picker. If your text app omits the draft, use Copy message and paste it.</p>
 ${closed?`<pre class="message-preview">${esc(summary)}</pre><div class="btn-row"><a class="btn btn-primary" href="${esc(smsUrl(null,summary))}">💬 Text results</a><button class="btn btn-quiet" data-act="shareResultsMessage">↗ Share results</button><button class="btn btn-line" data-act="copyResultsMessage">📋 Copy message</button></div>`:''}
 ${!live?'<p class="note">Sharing is available in the connected family app.</p>':state.memberLoadError?'<p>Could not load family links.</p><button class="btn btn-quiet" data-act="retryMembers">Retry</button>':members.length?members.map(m=>`<details class="member-invite"><summary>${memberAvatar(m)}<strong>${esc(m.name)}</strong><span>${closed?'Results':'Invitation'} ✉️</span></summary><pre class="message-preview">${esc(pollMessage(m))}</pre><div class="btn-row"><a class="btn btn-primary btn-sm" href="${esc(smsUrl(m,pollMessage(m)))}">💬 Text ${esc(m.name)}</a><button class="btn btn-quiet btn-sm" data-act="shareMemberPoll" data-id="${esc(m.id)}">↗ Share message</button><button class="btn btn-line btn-sm" data-act="copyMemberMessage" data-id="${esc(m.id)}">📋 Copy message</button>${!closed?`<button class="btn btn-line btn-sm" data-act="copyMemberPoll" data-id="${esc(m.id)}">Copy link</button>`:''}</div></details>`).join(''):'<p>No members yet.</p><button class="btn btn-quiet" data-act="nav" data-page="members">Add family members</button>'}
 </section>`;
}
function memberPollUrl(m){const u=new URL(memberUrl(m.token));u.searchParams.set('poll',poll.id);return u.href}
function renderPoll(){
 if(!poll){layout(`<div class="card empty"><span class="empty-emoji">⏳</span><p>Loading family vote…</p></div>`,{nav:false});return}
 const voter=state.preview?{id:'preview-voter',name:'Practice voter',avatar:'🧑‍🍳'}:member;
 const open=poll.status==='open',already=voter?!!poll.voted_member_ids?.includes(voter.id)&&!state.editingVote:localStorage.getItem('gw_voted_'+poll.id)==='1';
 if(!open)return renderResults();
 let voting='';
 if(already){voting=`<div class="card empty"><span class="empty-emoji">🎉</span><h2>You're all voted!</h2><p>Results are hidden until everyone has voted. This page updates automatically.</p><button class="btn btn-quiet" data-act="resetVote">Change my vote</button><p class="note">You can update your vote until voting finishes.</p></div>`}
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
 ${Array.from({length:count},(_,i)=>`<div class="rankoption"><label for="rank${i}">${['🥇 First choice','🥈 Second choice','🥉 Third choice'][i]}</label><select id="rank${i}" data-rank="${i}"><option value="">Choose restaurant…</option>${poll.options.map(r=>`<option value="${esc(r.id)}" ${state.rank[i]===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</select></div>`).join('')}</div>`;
 }
 const ballotReady=poll.method==='approval'?state.approvals.size>=1&&state.approvals.size<=2:poll.method==='swipe'?Object.keys(state.swipes).length===poll.options.length:state.rank.slice(0,Math.min(3,poll.options.length)).filter(Boolean).length===Math.min(3,poll.options.length)&&new Set(state.rank).size===Math.min(3,poll.options.length);
 const pending=poll.method==='swipe'&&Object.keys(state.swipes).length!==poll.options.length;
 layout(`${member&&!state.preview?'<button class="btn btn-line btn-sm" style="margin-bottom:16px" data-act="goHome">← My votes</button>':''}<div class="eyebrow">IT'S TIME TO VOTE</div><h1>${esc(poll.meal)} plans?</h1><p class="lede">${methodName(poll.method)} · ${poll.voted_count} of ${poll.expected_voters} votes in</p>
 ${voter?memberIdentity(voter):''}<div class="card"><div class="between"><strong>Family vote</strong>${pill(poll)}</div><div class="progress"><span style="width:${100*poll.voted_count/poll.expected_voters}%"></span></div><p class="note">Your family's choices stay secret until the vote finishes.</p></div>
 ${familyToken&&!state.preview?pollSharing():''}
 ${state.editingVote?'<div class="muted-box" role="status">✏️ Editing your saved vote. Your previous choices still count until you save changes.</div>':''}
 ${voting}
 ${!already?voter?`<div class="card"><p class="subtle">Voting as <strong>${esc(voter.name)}</strong></p><button class="btn btn-primary btn-full" data-act="submitVote" ${!ballotReady||pending?'disabled':''}>${state.editingVote?'Save vote changes ✓':'Submit my vote ✓'}</button>${state.editingVote?'<button class="btn btn-line btn-full" style="margin-top:10px" data-act="cancelVoteEdit">Keep my saved vote</button>':''}</div>`:`<div class="card"><p class="note">Use your personal family member link to submit a vote. Ask the family owner for yours.</p></div>`:''}
 ${state.preview?'':familyToken?`<div class="card"><p class="subtle">Family organizer controls</p><div class="btn-row"><button class="btn btn-quiet btn-sm" data-act="copyPoll">Copy vote link</button><button class="btn btn-line btn-sm" data-act="closePoll">Close voting early</button></div></div>`:`<button class="btn btn-line btn-full" data-act="copyPoll">Copy voting link</button>`}
 `,{nav:false});
}
function clearResultsCard(){if(state.resultCard)URL.revokeObjectURL(state.resultCard.url);state.resultCard=null}
function resultCardHtml(){
 const card=state.resultCard;
 return `<section class="card"><h2>🖼️ A little dinner announcement</h2><p class="note">Make a shareable picture with the winner, restaurant visuals and voting stats.</p>${card&&card.pollId===poll.id?`<img class="results-share-image" src="${card.url}" alt="Dinner results card"><div class="btn-row"><a class="btn btn-quiet" href="${card.url}" download="goodnights-results.png">⬇ Save image</a>${card.canShare?'<button class="btn btn-primary" data-act="shareResultsCard">↗ Share image</button>':''}</div><p class="note">If your messaging app shares only the image, send the results link with Copy message above.</p>`:`<button class="btn btn-quiet btn-full" data-act="prepareResultsCard" ${state.cardBusy?'disabled':''}>${state.cardBusy?'Making your card…':'✨ Make results image'}</button>`}</section>`;
}
function loadCardImage(src){return new Promise(resolve=>{const img=new Image();let done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value)};const timer=setTimeout(()=>finish(null),1800);img.crossOrigin='anonymous';img.referrerPolicy='no-referrer';img.onload=()=>finish(img);img.onerror=()=>finish(null);img.src=src})}
async function makeResultsCard(snapshot){
 const tally=window.GoodnightsVoting.tally(snapshot),options=snapshot.options||[],winners=options.filter(r=>tally.winners.includes(r.id));
 const canvas=document.createElement('canvas');canvas.width=960;canvas.height=1060;const ctx=canvas.getContext('2d');
 const box=(x,y,w,h,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()};
 const text=(value,x,y,size=30,color='#23221f',weight='600')=>{ctx.fillStyle=color;ctx.font=weight+' '+size+'px system-ui';ctx.fillText(value,x,y)};
 const fit=(value,size,maxWidth)=>{ctx.font='700 '+size+'px system-ui';let t=String(value);while(ctx.measureText(t).width>maxWidth&&t.length>1)t=t.slice(0,-2)+'…';return t};
 box(0,0,960,1060,0,'#fdf8ee');box(42,42,876,976,36,'#fffefa');text('🍽️  goodnights',84,115,38);text('WHAT’S FOR '+snapshot.meal.toUpperCase()+'?',84,158,19,'#ad4926');
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
  const stat=snapshot.method==='swipe'?Math.round(100*tally.scores[r.id]/Math.max(1,snapshot.voted_count))+'% yes':tally.scores[r.id]+(snapshot.method==='ranked'?' votes in final round':' approvals');
  text((tally.winners.includes(r.id)?'⭐ ':'')+stat,184,y+77,22,'#776b5c');
 }
 text(fit(tally.details,23,790),84,897,23,'#776b5c');text('Dinner, decided together. 🧡',84,952,27);text('Goodnights • family restaurant voting',84,984,18,'#776b5c');
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Could not create the image.')),'image/png'));
 const file=new File([blob],'goodnights-results.png',{type:'image/png'});let canShare=false;try{canShare=!!navigator.canShare?.({files:[file]})}catch{}
 return {pollId:snapshot.id,url:URL.createObjectURL(blob),file,canShare};
}
function renderResults(){
 const {scores,winners,details}=window.GoodnightsVoting.tally(poll);
 const all=poll.options||[],win=all.filter(o=>winners.includes(o.id));
 const maximum=Math.max(1,...Object.values(scores));
 const desc=win.length===1?`${icon(win[0].category,win[0].name,win[0])} ${esc(win[0].name)}`:win.length>1?`It's a tie! (${win.length} places)`:'No winner yet';
 layout(`${member&&!state.preview?memberIdentity(member):''}<div class="eyebrow">THE FAMILY HAS SPOKEN</div><div class="card winner"><div class="trophy">🏆</div><div class="eyebrow">${poll.meal.toUpperCase()} RESULTS</div><h1>${desc}</h1><p class="subtle">${esc(details)}</p></div>
 <div class="card"><div class="between"><h2>The results</h2><span class="count">${poll.voted_count} votes</span></div>
 ${[...all].sort((a,b)=>scores[b.id]-scores[a.id]||a.name.localeCompare(b.name)).map(r=>`<div class="resultbar"><div class="bar-head"><span>${icon(r.category,r.name,r)} ${esc(r.name)}</span><span>${poll.method==='swipe'?Math.round(100*scores[r.id]/Math.max(1,poll.voted_count))+'%':scores[r.id]+' '+(poll.method==='ranked'?'first-choice votes':'votes')}</span></div><div class="bar-track"><div class="bar-fill" style="width:${100*scores[r.id]/maximum}%"></div></div></div>`).join('')}
 <p class="note">${win.length>1?'A tie is never broken at random. Start a runoff to decide.':poll.method==='ranked'?'Ranked-choice totals show the final elimination round.':'Each voter can approve up to two places or vote yes/no as configured.'}</p></div>
 ${win.length>1&&familyToken&&!state.preview?`<button class="btn btn-primary btn-full" data-act="runoff">🗳️ Start a runoff between tied restaurants</button>`:''}
 ${familyToken&&!state.preview?pollSharing()+resultCardHtml():''}
 ${state.preview?'':`<div class="btn-row" style="margin-top:13px"><button class="btn btn-quiet" data-act="shareResultsMessage">Share results</button><button class="btn btn-line" data-act="goHome">${member?'Back to my votes':'Back to family'}</button></div>`}
 `,{nav:false})
}
async function safe(fn){try{state.busy=true;await fn()}catch(e){toast(e.message||'Something went wrong');console.error(e)}finally{state.busy=false}}
async function openPoll(id){state.editingVote=false;clearResultsCard();state.preview=false;state.approvals=new Set();state.swipes={};state.swipeIndex=0;state.rank=[];poll=null;state.page='poll';history.replaceState(null,'',pollUrl(id));window.scrollTo({top:0});render();await safe(async()=>{await loadPoll(id);if(familyToken&&live){try{await loadMembers();state.memberLoadError=false}catch{members=[];state.memberLoadError=true}}render();clearInterval(pollTimer);if(poll.status==='open')pollTimer=setInterval(async()=>{try{const prev=poll;const next=await rpc('gw_get_poll',{p_poll_id:id});poll=next;if(memberToken&&member){const voted=await rpc('gw_member_has_voted',{p_poll_id:id,p_member_token:memberToken});poll.voted_member_ids=voted?[member.id]:[]}if(prev.voted_count!==next.voted_count||prev.status!==next.status)render();if(next.status==='closed'){clearInterval(pollTimer);if(prev.status!=='closed'&&familyToken)toast('🏆 Results are in! Share them with your family below.')}}catch{}},8000)})}
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
const ownerActions=new Set(['createPoll','addMember','saveMemberProfile','editMemberProfile','editMember','copyMember','familyLink','editRestaurant','saveRestaurant','archive','addManual','saveGoogle','addNearby','newFamily','closePoll','runoff']);
async function doAction(act,button){
 if(ownerActions.has(act)&&!familyToken&&act!=='newFamily'){toast('Use your organizer link to manage the family.');return}

 if(act==='prepareResultsCard'){
  if(!familyToken||!poll||poll.status!=='closed'||state.preview||state.cardBusy)return;
  const snapshot=poll;state.cardBusy=true;render();
  try{const card=await makeResultsCard(snapshot);if(poll!==snapshot||state.preview){URL.revokeObjectURL(card.url);return}clearResultsCard();state.resultCard=card}finally{state.cardBusy=false;render()}return;
 }
 if(act==='shareResultsCard'){
  const card=state.resultCard;if(!card?.canShare||card.pollId!==poll?.id)return;
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
  const name=$('profileName').value.trim(),phone=F.phone($('profilePhone').value);if(!name)throw Error('Enter a name');
  await safe(async()=>{await rpc('gw_update_member_profile',{p_token:familyToken,p_member_id:state.editingMember,p_name:name,p_avatar:state.avatarDraft,p_phone:phone});await loadMembers();state.editingMember=null;render();toast('Profile saved!')});return;
 }

 if(act==='nav'){if(button.dataset.page==='members')await safe(loadMembers);setPage(button.dataset.page);return}
 if(act==='demo'){demoInit();await safe(async()=>{await loadFamily();render()});return}
 if(act==='newFamily'){
  const name=prompt('What should we call your family?','Goodnight Family');if(name===null)return;
  await safe(async()=>{const t=token();await rpc('gw_create_family',{p_name:name.trim()||'Goodnight Family',p_token:t});familyToken=t;localStorage.setItem(familyKey,t);await loadFamily();render();toast('Family created. Save your organizer link in Members.')});return;
 }
 if(act==='join'){
  const raw=$('joinToken').value.trim();let t=raw;
  try{const u=new URL(raw);t=u.searchParams.get('family')||raw}catch{}
  if(!/^[a-f0-9]{48}$/.test(t))throw Error('Paste a valid Goodnights family invite link.');
  await safe(async()=>{familyToken=t;await loadFamily();localStorage.setItem(familyKey,t);render();toast('Joined your family!')});return;
 }
 if(act==='familyLink'){await copy(familyUrl());return}
 if(act==='addMember'){const n=$('newMemberName')?.value.trim();if(!n)throw Error('Enter a name');await safe(async()=>{await rpc('gw_add_member',{p_token:familyToken,p_name:n});await loadMembers();render();toast('Member added')});return}
 if(act==='copyMember'){const m=members.find(x=>x.id===button.dataset.id);if(m)copy(memberUrl(m.token));return}
 if(act==='editMember'){const m=members.find(x=>x.id===button.dataset.id);if(!m)return;const v=prompt('New name, RESET to replace personal link, or REMOVE to disable member',m.name);if(v===null)return;await safe(async()=>{if(v.toUpperCase()==='RESET'){if(!confirm('Replace personal link? The previous link will stop working.'))return;await rpc('gw_rotate_member',{p_token:familyToken,p_member_id:m.id})}else if(v.toUpperCase()==='REMOVE'){if(!confirm('Remove '+m.name+'?'))return;await rpc('gw_remove_member',{p_token:familyToken,p_member_id:m.id})}else await rpc('gw_rename_member',{p_token:familyToken,p_member_id:m.id,p_name:v.trim()});await loadMembers();render();toast('Member updated')});return}
 if(act==='editRestaurant'){state.editingId=button.dataset.id;render();window.scrollTo({top:0,behavior:'smooth'});return}
 if(act==='cancelRestaurant'){state.editingId=null;render();return}
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
 if(act==='selectAll'){for(const r of pollChoices()){if(state.selected.size>=20)break;state.selected.add(r.id)}render();return}
 if(act==='resetPollFilters'){state.pollSearch='';state.pollCenter=null;state.pollRadius='';render();return}
 if(act==='pollLocation'){
  if(!navigator.geolocation)throw Error('Location is unavailable. Filter by town instead.');
  await safe(async()=>{const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,()=>reject(Error('Could not get your location. Allow location access or filter by town.')),{timeout:12000}));state.pollCenter={lat:pos.coords.latitude,lon:pos.coords.longitude};render()});return;
 }
 if(act==='clear'){
state.selected.clear();render();return}
 if(act==='createPoll'){
  if(state.page!=='create')return;
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
   if(!memberToken||!member)throw Error('Use your personal member link to vote');
   const editing=state.editingVote;
   await rpc('gw_vote_as_member',{p_poll_id:poll.id,p_member_token:memberToken,p_ballot:ballot});
   state.editingVote=false;poll.voted_member_ids=[member.id];
   localStorage.setItem('gw_name',state.name);localStorage.setItem('gw_voted_'+poll.id,'1');
   try{await loadPoll(poll.id);if(familyToken)await loadFamily()}catch{render();toast('Your vote was saved. Refresh for the latest status.');return}
   render();toast(editing?'Your vote has been updated!':'Your vote is in!');
  });return;
 }
 if(act==='runoff'){
  const scores=window.GoodnightsVoting.tally(poll).winners;if(scores.length<2)throw Error('No runoff needed.');
  state.meal=poll.meal;await safe(()=>makePoll(scores,'ranked',poll.expected_voters));return;
 }
 if(act==='goHome'){await safe(async()=>{if(familyToken||memberToken)await loadFamily();setPage('home')});return}
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
 if(t.dataset.select){if(t.checked&&state.selected.size>=20){t.checked=false;toast('Choose up to 20 restaurants.');return}t.checked?state.selected.add(t.dataset.select):state.selected.delete(t.dataset.select);render()}
 else if(t.dataset.approval){
  if(t.checked&&state.approvals.size>=2){t.checked=false;toast('Choose up to 2 restaurants.');return}
  t.checked?state.approvals.add(t.dataset.approval):state.approvals.delete(t.dataset.approval);render();
 }else if(t.dataset.rank!==undefined){
  const i=Number(t.dataset.rank);state.rank[i]=t.value;
  if(t.value)state.rank=state.rank.map((v,j)=>j!==i&&v===t.value?'':v);render();
 }else if(t.name==='method'){state.method=t.value;render()}
 else if(t.id==='pollRadius'){state.pollRadius=t.value;render()}
 else if(t.id==='meal')state.meal=t.value;
 else if(t.id==='voters')state.expected=Number(t.value);
});
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
 if(params.get('poll')){if(memberToken)try{await loadFamily()}catch(e){toast(e.message)}await openPoll(params.get('poll'));return}
 try{await loadFamily();render()}catch(e){toast(e.message);family=null;renderWelcome()}
}
document.getElementById('brand').addEventListener('click',async e=>{e.preventDefault();if(state.pendingAction)return;if(familyToken||memberToken){await safe(async()=>{await loadFamily();setPage('home')})}else setPage('home')});
init();
})();
