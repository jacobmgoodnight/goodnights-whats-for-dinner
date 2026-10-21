const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../alerts.js'),'utf8');
function harness({ios=false,installed=false,permission='granted',configured=true,existing=false,failSave=false,failDisable=false}={}){
 const calls=[],effects=[];let granted=permission,sub=existing?subscription():null;
 function subscription(){return {endpoint:'https://web.push.apple.com/synthetic',toJSON:()=>({endpoint:'https://web.push.apple.com/synthetic',keys:{p256dh:'a'.repeat(87),auth:'b'.repeat(22)}}),async unsubscribe(){effects.push('unsubscribe');sub=null;return true}}}
 const registration={pushManager:{async getSubscription(){return sub},async subscribe(options){effects.push('subscribe');assert.equal(options.userVisibleOnly,true);sub=subscription();return sub}}};
 const root={isSecureContext:true,location:{href:'https://example.test/goodnights/'},atob:s=>Buffer.from(s,'base64').toString('binary'),PushManager:class{},matchMedia:()=>({matches:installed}),navigator:{userAgent:ios?'iPhone':'Desktop',standalone:installed,serviceWorker:{async getRegistration(){return registration},async register(file,options){effects.push('register');assert.equal(file,'./service-worker.js');assert.equal(options.scope,'./');return registration},ready:Promise.resolve(registration)}},Notification:{get permission(){return granted},async requestPermission(){effects.push('permission');return granted}}};
 const ctx={window:root,URL,Uint8Array};vm.createContext(ctx);vm.runInContext(source,ctx);
 const rpc=async(fn,p)=>{calls.push({fn,p});if(fn==='gw_push_status')return {configured,public_key:'a'.repeat(87),enabled:existing};if(fn==='gw_subscribe_push'&&failSave)throw Error('Synthetic save failure');if(fn==='gw_unsubscribe_push'&&failDisable)throw Error('Synthetic disable failure');return true};
 return {api:root.GoodnightsAlerts,calls,effects,options:{rpc,token:'synthetic-owner'},root,setPermission:p=>granted=p};
}
test('iOS alerts require Home Screen installation and do not request permission on inspection',async()=>{
 const h=harness({ios:true});assert.equal(h.api.availability().supported,false);await h.api.prepare(h.options);assert.deepEqual(h.calls,[]);assert.deepEqual(h.effects,[]);
 const ready=harness({ios:true,installed:true});await ready.api.prepare(ready.options);assert.equal(ready.api.availability().supported,true);assert.deepEqual(ready.effects,[]);
});
test('push enable is an explicit tap, saves only the current browser subscription and is idempotent',async()=>{
 const h=harness();await h.api.prepare(h.options);assert.deepEqual(h.effects,[]);await h.api.enable(h.options);
 assert.deepEqual(h.effects,['permission','register','subscribe']);assert.equal(h.api.status().enabled,true);
 assert.equal(h.calls.at(-1).fn,'gw_subscribe_push');assert.deepEqual(Object.keys(h.calls.at(-1).p).sort(),['p_subscription','p_token']);
 await h.api.enable(h.options);assert.equal(h.effects.filter(e=>e==='subscribe').length,1);
});
test('unconfigured or denied alerts do not subscribe or claim success',async()=>{
 const missing=harness({configured:false});await missing.api.prepare(missing.options);await assert.rejects(missing.api.enable(missing.options),/not ready/);assert.deepEqual(missing.effects,[]);
 const denied=harness({permission:'denied'});await denied.api.prepare(denied.options);await assert.rejects(denied.api.enable(denied.options),/blocked/);assert.deepEqual(denied.effects,['permission']);assert.equal(denied.api.status().enabled,false);
});
test('failed server registration rolls back a newly created browser subscription only',async()=>{
 const h=harness({failSave:true});await h.api.prepare(h.options);await assert.rejects(h.api.enable(h.options),/save failure/);assert.equal(h.effects.at(-1),'unsubscribe');assert.equal(h.api.status().enabled,false);
 const existing=harness({existing:true,failSave:true});await existing.api.prepare(existing.options);await assert.rejects(existing.api.enable(existing.options),/save failure/);assert.equal(existing.effects.includes('unsubscribe'),false);
});
test('disable revokes server delivery first and does not claim success when it fails',async()=>{
 const h=harness({existing:true});await h.api.prepare(h.options);await h.api.disable(h.options);assert.equal(h.calls.at(-1).fn,'gw_unsubscribe_push');assert.equal(h.effects.at(-1),'unsubscribe');assert.equal(h.api.status().enabled,false);
 const failed=harness({existing:true,failDisable:true});await failed.api.prepare(failed.options);await assert.rejects(failed.api.disable(failed.options),/disable failure/);assert.deepEqual(failed.effects,[]);assert.equal(failed.api.status().enabled,true);
});
function worker(){const listeners={},notifications=[],opened=[],focused=[];let windows=[];const self={registration:{scope:'https://example.test/goodnights/',async showNotification(title,options){notifications.push({title,options})}},clients:{async matchAll(){return windows},async openWindow(url){opened.push(url)}},addEventListener:(name,fn)=>listeners[name]=fn};const ctx={self,URL};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../service-worker.js'),'utf8'),ctx);return {listeners,notifications,opened,focused,setWindows(value){windows=value},async push(data){let pending;listeners.push({data:{json:()=>data},waitUntil:p=>pending=p});await pending},async click(data){let pending;listeners.notificationclick({notification:{data,close(){}},waitUntil:p=>pending=p});await pending}}}
test('notification payloads remain generic and click URLs cannot carry private links or leave app scope',async()=>{
 const h=worker(),id='00000000-0000-4000-8000-000000000001';assert.equal(h.listeners.fetch,undefined);
 await h.push({kind:'tie',pollId:id,eventId:id,body:'Secret family name',url:'https://evil.test/?family=secret'});assert.equal(h.notifications[0].title,'Goodnights');assert.match(h.notifications[0].options.body,/tiebreaker/);assert.equal(JSON.stringify(h.notifications).includes('Secret family'),false);
 await h.click({pollId:id,url:'https://evil.test/'});assert.deepEqual(h.opened,['https://example.test/goodnights/?poll='+id]);
 await h.click({pollId:'https://evil.test/?member=secret'});assert.equal(h.opened.at(-1),'https://example.test/goodnights/');
});
test('notification clicks focus a matching poll without navigating away from another ballot',async()=>{
 const h=worker(),id='00000000-0000-4000-8000-000000000001';let focus=0;
 h.setWindows([{url:'https://example.test/goodnights/?poll='+id,async focus(){focus++}},{url:'https://example.test/goodnights/?poll=another',async focus(){throw Error('wrong ballot')}}]);
 await h.click({pollId:id});assert.equal(focus,1);assert.deepEqual(h.opened,[]);
});
