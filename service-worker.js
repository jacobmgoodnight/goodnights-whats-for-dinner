/* Notification handling only: deliberately no fetch handler or offline ballot cache. */
'use strict';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{}}catch{}
 const body=({decided:'Voting is finished. Your results are ready.',tie:'Your family vote needs a tiebreaker.','no-choice':'Nothing sounds good tonight. Open Goodnights to start again.',empty:'The vote closed without ballots.'})[data.kind]||'Open Goodnights to view your family vote.';
 event.waitUntil(self.registration.showNotification('Goodnights',{body,tag:uuid(data.eventId)?'gw-'+data.eventId:'goodnights-status',renotify:false,icon:new URL('icons/icon-192.png',self.registration.scope).href,data:{pollId:uuid(data.pollId)?data.pollId:null}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const url=new URL(self.registration.scope);if(uuid(event.notification.data?.pollId))url.searchParams.set('poll',event.notification.data.pollId);
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const same=windows.find(client=>{const current=new URL(client.url);return current.origin===url.origin&&current.pathname===url.pathname&&current.searchParams.get('poll')===url.searchParams.get('poll')});
  if(same)return same.focus();return self.clients.openWindow(url.href);
 })());
});
