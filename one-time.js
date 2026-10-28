/* One-time polls: small, dependency-free form helpers. No saved family preferences. */
((root)=>{
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
 function names(raw){
  const list=(Array.isArray(raw)?raw:String(raw).split(/\r?\n/)).map(clean).filter(Boolean);
  if(list.length<2||list.length>20)throw Error('Enter between 2 and 20 restaurant names, one per line.');
  if(list.some(n=>Array.from(n).length>120)||new Set(list.map(n=>n.toLowerCase())).size!==list.length)throw Error('Use different restaurant names, each up to 120 characters.');
  return list;
 }
 function draft(d){
  const places=names(d.names),expected=Number(d.expected),title=String(d.title||'').trim();
  if(!Number.isInteger(expected)||expected<1||expected>20)throw Error('Choose between 1 and 20 voters, including yourself.');
  if(!['Lunch','Dinner'].includes(d.meal)||!['approval','swipe','ranked'].includes(d.method)||Array.from(title).length>80)throw Error('Check the meal, voting method and title.');
  return {p_place_names:places,p_expected_voters:expected,p_meal:d.meal,p_method:d.method,p_title:title};
 }
 function form(d={}){return `<div class="eyebrow">VISITING FAMILY OR TRYING SOMEWHERE NEW?</div><h1>A one-time vote.</h1><p class="lede">Type a few places, then send one invitation. Guests enter their own names.</p><section class="card"><div class="field"><label for="oneTimePlaces">Restaurant names · one per line</label><textarea id="oneTimePlaces" rows="4" maxlength="2500" placeholder="The pizza place\nTacos on Main\nGrandma’s favorite café">${esc(d.names||'')}</textarea><span class="note">2–20 choices. No addresses needed. Add a town or short label if two places share a name.</span></div><div class="field"><label for="oneTimeExpected">How many people will vote?</label><input id="oneTimeExpected" type="number" inputmode="numeric" min="1" max="20" value="${esc(d.expected||4)}"><span class="note">Include yourself. Results appear after this many votes; you can close voting early.</span></div><details class="one-time-options"><summary>Meal, voting method & optional title</summary><div class="field"><label for="oneTimeMethod">Voting method</label><select id="oneTimeMethod">${[['approval','Favorites · choose up to two'],['swipe','Consensus · yes or no to each'],['ranked','Ranked · top choices']].map(([v,label])=>`<option value="${v}" ${d.method===v?'selected':''}>${label}</option>`).join('')}</select></div><div class="field"><label for="oneTimeMeal">Meal</label><select id="oneTimeMeal"><option ${d.meal!=='Lunch'?'selected':''}>Dinner</option><option ${d.meal==='Lunch'?'selected':''}>Lunch</option></select></div><div class="field"><label for="oneTimeTitle">Title (optional)</label><input id="oneTimeTitle" maxlength="80" value="${esc(d.title||'')}" placeholder="Dinner with the cousins"></div></details><button type="button" class="btn btn-primary btn-full" data-act="createOneTime">Create & get invitation →</button><p class="note">These choices stay in this poll’s history. Guests don’t become permanent members, and places aren’t added to your saved library.</p></section>`}
 function guest(name=''){return `<section class="card"><h2>Join this one-time vote 👋</h2><p class="subtle">Enter your own name. No account or permanent family membership needed.</p><div class="field"><label for="guestName">Your name</label><input id="guestName" autocomplete="nickname" maxlength="60" value="${esc(name)}" placeholder="First name · add an initial if needed"></div><button type="button" class="btn btn-primary btn-full" data-act="joinGuest">Join this vote</button><p class="note">Share only with trusted family: anyone with this invitation can see guest names and vote under a name. Each guest gets one ballot, which cannot be edited after submission.</p></section>`}
 root.GoodnightsOneTime={names,draft,form,guest};
})(typeof window!=='undefined'?window:globalThis);
