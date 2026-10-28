const test=require('node:test'),assert=require('node:assert/strict'),F=require('../family.js');require('../one-time.js');const T=globalThis.GoodnightsOneTime;
test('one-time draft accepts names only, normalizes whitespace and bounds choices/voters',()=>{
 assert.deepEqual(T.draft({names:' Pizza  place\n Tacos \n\n',expected:'3',meal:'Dinner',method:'approval'}),{p_place_names:['Pizza place','Tacos'],p_expected_voters:3,p_meal:'Dinner',p_method:'approval',p_title:''});
 for(const names of ['One','Same\n same','a\n'+'b'.repeat(121),Array.from({length:21},(_,i)=>String(i)).join('\n')])assert.throws(()=>T.names(names));
 for(const expected of [0,21,2.5,'no'])assert.throws(()=>T.draft({names:'A\nB',expected,meal:'Dinner',method:'approval'}));
});
test('one-time forms escape names/titles and disclose temporary access without extra profiles',()=>{
 const html=T.form({names:'<script>\nPizza',title:'" autofocus onfocus=oops'});assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&quot; autofocus'));
 assert.match(T.guest('<b>Guest</b>'),/&lt;b&gt;Guest/);assert.match(T.guest(),/cannot be edited/);assert.match(html,/<details/);assert.match(html,/No addresses needed/);
});
test('one-time invitation asks guests to enter their own names and shares only supplied poll URL',()=>{
 const text=F.groupInvite({one_time:true,meal:'Dinner',method:'ranked',expected_voters:3,options:[{},{}]},'https://example.test/?poll=synthetic&join=synthetic');
 assert.match(text,/Enter your own name and vote once/);assert.doesNotMatch(text,/personal link|avatar\/name/);assert.match(text,/Rank your top choices/);
});
