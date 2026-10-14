/* Goodnights restaurant visual helpers: actual image URL, website favicon, or SVG. */
(function(root){'use strict';
const labels={restaurant:'Restaurant',pizza:'Pizza',burger:'Burger',taco:'Tacos',sandwich:'Sandwich',pasta:'Pasta',steak:'Steak',chicken:'Chicken',breakfast:'Breakfast',coffee:'Coffee',dessert:'Dessert',icecream:'Ice cream',sushi:'Sushi',seafood:'Seafood',healthy:'Healthy'};
const paths={
restaurant:'<path d="M4 3v8m4-8v8M4 7h4M6 11v10M17 3v18M17 3c-5 3-5 8 0 9"/>',
pizza:'<path d="M3 3h18l-9 18L3 3Z"/><path d="M5.5 8c4-2 9-2 13 0"/><circle cx="11" cy="9" r="1"/><circle cx="14" cy="14" r="1"/><circle cx="8" cy="13" r="1"/>',
burger:'<path d="M4 11V9a8 8 0 0 1 16 0v2M3 11h18M3 15h18M4 18c0 2 2 3 4 3h8c2 0 4-1 4-3H4Z"/><path d="M8 7h.1M12 6h.1M16 7h.1"/>',
taco:'<path d="M2.5 17a9.5 9.5 0 0 1 19 0H2.5Z"/><path d="M4 13l3-2 3 2 3-2 3 2 3-2"/>',
sandwich:'<path d="m4 6 8-3 8 3v5l-8 3-8-3V6ZM4 15l8 3 8-3M4 11v4l8 3 8-3v-4M4 18l8 3 8-3v-3"/>',
pasta:'<path d="M3 12h18M5 12l2 9h10l2-9M7 6c2 2 0 3 2 5M12 4c-2 3 2 4 0 7M17 5c-1 2 2 3 0 6"/>',
steak:'<path d="M18 4c4 2 4 7 1 10-3 4-6 6-11 6-5 0-7-4-5-8C5 6 13 1 18 4Z"/><path d="M14 8c2 1 2 4 0 5-3 2-6 0-6-2 0-3 4-4 6-3Z"/>',
chicken:'<path d="M9 15c-5 0-7-3-6-7 1-4 6-6 9-4 4 2 5 6 3 9l-2 2M14 14l3 3"/><circle cx="19" cy="19" r="3"/>',
breakfast:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2"/>',
coffee:'<path d="M4 8h13v7a6 6 0 0 1-12 0V8ZM17 9h2a3 3 0 0 1 0 6h-2M3 21h16M8 3v2M13 3v2"/>',
dessert:'<path d="M4 11h16l-2 10H6L4 11ZM5 11c-2-4 2-7 5-4 1-5 8-4 8 1 3-2 6 1 2 3"/>',
icecream:'<path d="M7 10h10l-5 11-5-11ZM7 10a5 5 0 1 1 10 0H7ZM9 5c-1-4 5-4 5 0"/>',
sushi:'<rect x="3" y="8" width="18" height="10" rx="5"/><rect x="8" y="9" width="8" height="8" rx="4"/><path d="M5 6l7-4 7 4"/>',
seafood:'<path d="M2 12c5-7 12-7 18 0-6 7-13 7-18 0ZM20 12l3-3v6l-3-3Z"/><circle cx="7" cy="12" r="1"/>',
healthy:'<path d="M12 20C4 19 2 12 4 4c8 0 14 6 15 12-1 3-4 4-7 4ZM7 8c4 5 8 8 13 13"/>'
};
const brands=[
[/chick[\s-]*fil[\s-]*a/i,'chick-fil-a.com'],[/\bculver['’]?s?\b/i,'culvers.com'],[/\bchipotle\b/i,'chipotle.com'],[/\bqdoba\b/i,'qdoba.com'],[/\bpanera\b/i,'panerabread.com'],[/\bolive garden\b/i,'olivegarden.com'],[/\btexas roadhouse\b/i,'texasroadhouse.com'],[/\btaco bell\b/i,'tacobell.com'],[/\bmcdonald['’]?s\b/i,'mcdonalds.com'],[/\bwendy['’]?s\b/i,'wendys.com'],[/\bburger king\b/i,'bk.com'],[/\bsubway\b/i,'subway.com'],[/\bdomino['’]?s\b/i,'dominos.com'],[/\bpizza hut\b/i,'pizzahut.com'],[/\bstarbucks\b/i,'starbucks.com'],[/\bdunkin\b/i,'dunkindonuts.com'],[/\bpopeyes\b/i,'popeyes.com'],[/\bkfc\b/i,'kfc.com'],[/\barby['’]?s\b/i,'arbys.com'],[/\bapplebee['’]?s\b/i,'applebees.com'],[/\bfive guys\b/i,'fiveguys.com'],[/\braising cane['’]?s\b/i,'raisingcanes.com'],[/\bdairy queen\b/i,'dairyqueen.com'],[/\bcrumbl\b/i,'crumblcookies.com']
];
function domain(value){
 let s=String(value||'').trim();
 if(s.length>250||!s)return '';
 if(/^https?:\/\//i.test(s)){try{s=new URL(s).hostname}catch{return ''}}
 else if(/^[a-z]+:\/\//i.test(s))return '';
 else s=s.split('/')[0].split('?')[0].split('#')[0];
 s=s.toLowerCase().replace(/\.$/,'').replace(/^www\./,'');
 return /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(s)?s:'';
}
function imageURL(value){
 try {const u=new URL(String(value||'').trim());return u.protocol==='https:'&&!u.username&&!u.password&&u.href.length<=500?u.href:''}catch{return ''}
}
function autoDomain(name){return brands.find(([re])=>re.test(String(name||'')))?.[1]||''}
function keyFor(name,category){
 const s=(String(category||'')+' '+String(name||'')).toLowerCase();
 for(const [key,re] of [
 ['pizza',/pizza/],['taco',/taco|mexican|burrito|qdoba|chipotle/],['burger',/burger|culver|grill|diner/],
 ['sandwich',/sandwich|sub|deli|panera/],['pasta',/italian|pasta|spaghetti|olive garden/],
 ['steak',/steak|bbq|barbecue|roadhouse/],['chicken',/chicken|chick|popeye|wings/],
 ['breakfast',/brunch|breakfast|pancake|waffle/],['coffee',/coffee|cafe|espresso/],
 ['dessert',/dessert|cookie|bakery|donut/],['icecream',/ice.?cream|frosty|dairy queen/],
 ['sushi',/sushi|japanese|thai|asian/],['seafood',/seafood|fish/],['healthy',/salad|vegetarian|vegan/]
 ])if(re.test(s))return key;
 return 'restaurant';
}
function svg(key){return '<svg class="logo-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[key in paths?key:'restaurant']+'</svg>'}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function details(r){
 const mode=r?.icon_mode||'auto',value=String(r?.icon_value||'').trim();
 let key=keyFor(r?.name,r?.category),url='';
 if(mode==='builtin'&&value in labels)key=value;
 if(mode==='logo_url')url=imageURL(value);
 if(mode==='website'||mode==='auto'){
  const host=mode==='auto'?autoDomain(r?.name):domain(value);
  if(host)url='https://www.google.com/s2/favicons?domain='+encodeURIComponent(host)+'&sz=128';
 }
 return {key,url};
}
function render(r){
 const {key,url}=details(r);
 if(!url)return svg(key);
 return '<img class="restaurant-brand-image" data-restaurant-logo alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" src="'+esc(url)+'">'+
 '<span class="restaurant-logo-fallback" hidden>'+svg(key)+'</span>';
}
function options(selected){return Object.entries(labels).map(([key,label])=>'<option value="'+key+'"'+(selected===key?' selected':'')+'>'+label+'</option>').join('')}
root.GoodnightsLogos={labels,domain,imageURL,autoDomain,keyFor,details,render,options,svg};
if(typeof module!=='undefined'&&module.exports)module.exports=root.GoodnightsLogos;
})(typeof window!=='undefined'?window:{});