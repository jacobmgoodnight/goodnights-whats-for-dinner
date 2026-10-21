/* Free Google Maps deep-link and pasted-text helpers; no Google API calls. */
(function(root){
'use strict';
function searchUrl(name,town){
  const term=String(name||'').trim()||'restaurants';
  const place=String(town||'').trim();
  const query=(term+(place?' '+place:'')).slice(0,300);
  return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);
}
function parsePaste(raw){
  const text=String(raw||'').trim().slice(0,3500);
  const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const urls=(text.match(/https?:\/\/[^\s<>"']+/gi)||[]).map(x=>x.replace(/[),.;]+$/,''));
  let name='',address='',shortLink=false;
  for(const entry of urls){
    try{
      const u=new URL(entry);
      const host=u.hostname.toLowerCase();
      if(host==='maps.app.goo.gl'){shortLink=true;continue}
      if(!/(^|\.)google\.(com|[a-z]{2,3}(?:\.[a-z]{2})?)$/.test(host))continue;
      const place=u.pathname.match(/\/maps\/place\/([^/?#]+)/i);
      if(place){
        name=decodeURIComponent(place[1]).replace(/\+/g,' ').trim();
        break;
      }
      const q=u.searchParams.get('query')||u.searchParams.get('q');
      if(q){name=q.trim();break}
    }catch{ /* Ignore malformed or shortened URLs. */ }
  }
  const other=lines.filter(x=>!/^https?:\/\//i.test(x)&&!/^(google maps|share|directions|website|open in maps)$/i.test(x));
  if(other.length){
    const first=other[0].replace(/^name:\s*/i,'');
    if(/^\d{1,6}\s+\S+/.test(first)){address=first}
    else{
      name=first;
      if(other[1])address=other[1].replace(/^address:\s*/i,'');
    }
  }
  return {name:name.slice(0,120),address:address.slice(0,240),shortLink};
}
// Conservative identity: preserve punctuation/accents. Loose names only suggest review.
function locationKey(value){return String(value||'').replace(/[A-Z]/g,c=>c.toLowerCase()).replace(/[\t\n\v\f\r ]+/g,' ').trim()}
function looseName(value){return locationKey(value).replace(/[^a-z0-9]/g,'')}
function locationMatches(saved,draft){
 const name=locationKey(draft.name),address=locationKey(draft.address),osm=locationKey(draft.osm_id);
 return saved.map(r=>{
  const sameSource=!!osm&&locationKey(r.osm_id)===osm;
  const sameManual=!osm&&!!address&&locationKey(r.name)===name&&locationKey(r.address)===address;
  const possible=locationKey(r.name)===name||!!looseName(name)&&looseName(r.name)===looseName(name)||!!address&&locationKey(r.address)===address;
  return {...r,match:sameSource||sameManual?'exact':possible?'possible':null};
 }).filter(r=>r.match).sort((a,b)=>(a.match==='exact'?0:1)-(b.match==='exact'?0:1));
}
function savedSuggestions(saved,query){const key=locationKey(query);return key?saved.filter(r=>r.active!==false&&locationKey([r.name,r.address].join(' ')).includes(key)).slice(0,5):[]}
root.GoodnightsMaps={searchUrl,parsePaste,locationKey,locationMatches,savedSuggestions};
if(typeof module!=='undefined'&&module.exports)module.exports=root.GoodnightsMaps;
})(typeof window!=='undefined'?window:{});
