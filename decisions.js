/* Calendar-only confirmed meals and explained rotation. No requests or poll changes. */
(function(root){'use strict';
 const DAY=86400000;
 function localDate(now=new Date()){return now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0')}
 function day(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const [y,m,d]=value.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d));return date.toISOString().slice(0,10)===value?date.getTime()/DAY:null}
 function lastEatenLabel(value,today=localDate()){
  const a=day(value),b=day(today);if(a===null||b===null)return 'No confirmed meals yet';
  const n=b-a;if(n<0)return 'Last eaten on '+value;
  const years=Math.floor(n/365);return 'Last eaten '+(n===0?'today':n===1?'yesterday':n<14?n+' days ago':n<60?Math.floor(n/7)+' weeks ago':n<365?Math.floor(n/30)+' months ago':years+' year'+(years===1?'':'s')+' ago');
 }
 function hash(value){let n=2166136261;for(const c of value){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}return n>>>0}
 function suggest(restaurants,{lastEaten={},today=localDate(),avoidRecent=true,seen=[],count=1}={}){
  const now=day(today);if(now===null)throw Error('Invalid dinner date');
  const unique=new Map(restaurants.filter(r=>r.active!==false).map(r=>[r.id,r]));
  const available=[...unique.values()],recent=r=>{const last=day(lastEaten[r.id]);return last!==null&&now-last<14};
  const eligible=available.filter(r=>!avoidRecent||!recent(r)),visited=new Set(seen);
  const pool=eligible.filter(r=>!visited.has(r.id)).sort((a,b)=>{
   const ageA=day(lastEaten[a.id])??-Infinity,ageB=day(lastEaten[b.id])??-Infinity;
   return (ageA===ageB?0:ageA<ageB?-1:1)||hash(today+':'+a.id)-hash(today+':'+b.id)||String(a.id).localeCompare(String(b.id));
  });
  return {choices:pool.slice(0,Math.max(1,Math.min(3,count))).map(r=>({...r,reason:day(lastEaten[r.id])===null?'No confirmed meals yet.':lastEatenLabel(lastEaten[r.id],today)+'.'})),eligible:eligible.length,remaining:Math.max(0,pool.length-Math.max(1,Math.min(3,count))),excludedRecent:available.length-eligible.length,total:available.length};
 }
 root.GoodnightsDecisions={localDate,day,lastEatenLabel,suggest};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.GoodnightsDecisions;
})(typeof window!=='undefined'?window:{});
