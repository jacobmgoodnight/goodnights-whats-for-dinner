/* Quick Pick: an explained, repeatable suggestion from saved restaurants. Pure: no requests, writes or meal records. */
(function(root){'use strict';
 // Local calendar date (never UTC midnight), so the daily order changes at the family's own midnight.
 function localDate(now=new Date()){return now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0')}
 function hash(value){let n=2166136261;for(const c of value){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}return n>>>0}
 // One stable shuffle per date: the same saved places give the same order all day on every phone, independent of list order.
 function dailyOrder(restaurants,today=localDate()){
  if(typeof today!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(today))throw Error('Invalid dinner date');
  const unique=new Map((restaurants||[]).filter(r=>r&&r.id&&r.active!==false).map(r=>[String(r.id),r]));
  return [...unique.values()].sort((a,b)=>hash(today+':'+a.id)-hash(today+':'+b.id)||String(a.id).localeCompare(String(b.id)));
 }
 // A window into today's order. "Try another" advances the window; nothing is ever silently repeated within a round.
 function suggest(restaurants,{today=localDate(),start=0,size=1}={}){
  const order=dailyOrder(restaurants,today),n=Math.max(1,Math.min(3,Math.floor(size)||1)),from=Math.max(0,Math.floor(start)||0);
  const choices=order.slice(from,from+n);
  return {choices,total:order.length,start:from,size:n,remaining:Math.max(0,order.length-from-choices.length)};
 }
 root.GoodnightsDecisions={localDate,dailyOrder,suggest};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.GoodnightsDecisions;
})(typeof window!=='undefined'?window:{});
