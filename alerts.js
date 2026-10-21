/* Organizer Web Push only. No offline cache, ballot queue, or automatic texting. */
(function(root){'use strict';
 let cached=null,identity='';
 function availability(){
  const nav=root.navigator||{},installed=nav.standalone||root.matchMedia?.('(display-mode: standalone)').matches;
  const ios=/iPad|iPhone|iPod/.test(nav.userAgent||'')||nav.platform==='MacIntel'&&nav.maxTouchPoints>1;
  if(ios&&!installed)return {supported:false,reason:'On iPhone or iPad, add Goodnights to your Home Screen in Safari, open it there, then enable alerts.'};
  if(!root.isSecureContext||!nav.serviceWorker||!root.PushManager||!root.Notification)return {supported:false,reason:'This browser does not support background alerts. Use the installed Home Screen app on a supported phone.'};
  return {supported:true,permission:root.Notification.permission};
 }
 async function existing(){const registration=await root.navigator.serviceWorker.getRegistration(new URL('./',root.location.href).href);return registration?await registration.pushManager.getSubscription():null}
 async function prepare({rpc,token}){
  if(identity!==token){identity=token;cached=null}
  if(!availability().supported)return null;
  try{const subscription=await existing();const result=await rpc('gw_push_status',{p_token:token,p_endpoint:subscription?.endpoint||null});if(identity!==token)return null;cached=result;return cached}catch{cached=null;return null}
 }
 function status(){return cached}
 function keyBytes(value){const text=value.replace(/-/g,'+').replace(/_/g,'/'),raw=root.atob(text+'='.repeat((4-text.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
 async function enable({rpc,token}){
  const available=availability();if(!available.supported)throw Error(available.reason);
  if(identity!==token||!cached?.configured)throw Error('Background delivery is not ready. Refresh organizer alerts and try again.');
  // This is the first awaited operation so the permission request retains the tap gesture.
  const permission=await root.Notification.requestPermission();
  if(permission!=='granted')throw Error(permission==='denied'?'Notifications are blocked. Enable them in your device settings, then try again.':'Alerts were not enabled. You can choose again later.');
  const registration=await root.navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});
  await root.navigator.serviceWorker.ready;
  let subscription=await registration.pushManager.getSubscription(),created=false;
  if(!subscription){subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(cached.public_key)});created=true}
  try{await rpc('gw_subscribe_push',{p_token:token,p_subscription:subscription.toJSON()})}
  catch(error){if(created)try{await subscription.unsubscribe()}catch{}throw error}
  cached={...cached,enabled:true};return 'Alerts enabled on this device. Your notification and Focus settings still apply.';
 }
 async function disable({rpc,token}){
  if(!availability().supported)throw Error(availability().reason);
  const subscription=await existing();
  if(subscription){await rpc('gw_unsubscribe_push',{p_token:token,p_endpoint:subscription.endpoint});try{await subscription.unsubscribe()}catch{cached={...cached,enabled:false};return 'Server alerts disabled. You can also remove notification permission in device settings.'}}
  cached={...cached,enabled:false};return 'Alerts are disabled on this device.';
 }
 root.GoodnightsAlerts={availability,prepare,status,enable,disable};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.GoodnightsAlerts;
})(typeof window!=='undefined'?window:{});
