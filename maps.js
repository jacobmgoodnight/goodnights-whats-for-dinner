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
root.GoodnightsMaps={searchUrl,parsePaste};
if(typeof module!=='undefined'&&module.exports)module.exports=root.GoodnightsMaps;
})(typeof window!=='undefined'?window:{});