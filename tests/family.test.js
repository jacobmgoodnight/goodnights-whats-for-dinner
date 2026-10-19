const test=require('node:test'),assert=require('node:assert/strict'),F=require('../family.js'),Voting=require('../voting.js');
const options=[{id:'a',name:'Pizza 🍕'},{id:'b',name:'Tacos 🌮'}];
test('invitations explain the method and include only the supplied personal link',()=>{
 for(const method of ['approval','swipe','ranked']){const text=F.invite({method,meal:'Dinner'},'Sam','https://example.test/?member=personal&poll=vote');assert.match(text,/Sam/);assert.match(text,/personal/);assert.match(text,/🗳️/);assert.doesNotMatch(text,/undefined/)}
});
test('results describe winners, ties, zero ballots and correct mode stats',()=>{
 for(const [method,ballots,stat] of [['approval',[['a'],['a','b']],/2 approvals/],['swipe',[{a:true,b:false},{a:true,b:true}],/100% yes/],['ranked',[['a','b'],['a','b']],/final-round votes/]]){
  const poll={meal:'Dinner',method,options,ballots,voted_count:2};const text=F.result(poll,Voting.tally(poll),'https://example.test/?poll=vote');assert.match(text,/🏆 Pizza/);assert.match(text,stat);assert.doesNotMatch(text,/member=|family=/);
 }
 const tied={meal:'Lunch',method:'approval',options,ballots:[['a'],['b']],voted_count:2};assert.match(F.result(tied,Voting.tally(tied),'https://example.test/?poll=vote'),/tie/);
 const empty={...tied,ballots:[],voted_count:0};assert.match(F.result(empty,Voting.tally(empty),'https://example.test/?poll=vote'),/No winner/);
});
test('SMS drafts encode message content and validate phone recipients',()=>{
 const text='🍽️ Vote\nhttps://example.test/?member=a&poll=b';assert.equal(decodeURIComponent(F.sms('+1 (555) 123-4567',text).split('body=')[1]),text);assert.match(F.sms('',text,true),/^sms:&body=/);assert.throws(()=>F.phone('123?body=bad'));assert.throws(()=>F.phone('12'));assert.equal(F.phone(''),'');
});
test('avatars allow only chosen emojis and small JPEG data, with a safe fallback',()=>{
 assert.equal(F.avatar('😎'),'😎');assert.equal(F.avatar('data:image/jpeg;base64,/9j/AA=='),'data:image/jpeg;base64,/9j/AA==');for(const a of ['https://example.test/photo','data:image/svg+xml,<svg onload=alert(1)>','<img src=x onerror=x>','data:image/jpeg;base64,'+'A'.repeat(120000)])assert.equal(F.avatar(a),'🙂');
});

test('iMessage drafts accept email contacts and preserve private link encoding',()=>{assert.equal(F.contact(' family+test@icloud.com '),'family+test@icloud.com');assert.match(F.sms('family+test@icloud.com','Hi 👋',true),/^sms:family\+test@icloud.com&body=/);for(const value of ['bad@','x@host','x@y.com?body=bad','x\"@y.com'])assert.throws(()=>F.contact(value));assert.equal(F.contact('+1 (555) 123-4567'),'+15551234567')});
test('clearer uploaded avatars can exceed the previous 24k limit',()=>{const data='data:image/jpeg;base64,'+'A'.repeat(60000);assert.equal(F.avatar(data),data)});

test('group invitation messages use a shared entry link without personal tokens',()=>{const text=F.groupInvite({meal:'Dinner',method:'approval',expected_voters:4,options:[{id:'a'},{id:'b'}]},'https://example.test/?poll=vote');assert.match(text,/4 people invited/);assert.match(text,/2 places/);assert.match(text,/usual voting phone/);assert.doesNotMatch(text,/member=|family=/)});

test('result highlights are supported by ballots and shared summaries include the address without private identities',()=>{
 const poll={meal:'Dinner',method:'approval',options:[{...options[0],address:'123 Example St'},options[1]],ballots:[['a'],['a','b']],voted_count:2,expected_voters:2};const tally=Voting.tally(poll),stats=F.highlights(poll,tally);assert.ok(stats.some(s=>s.title==='A table full of yeses'));assert.ok(stats.some(s=>s.title==='Everyone’s in!'));
 const text=F.result({...poll,people:[{name:'Private person',phone:'private@icloud.com',token:'private-token'}]},tally,'https://example.test/?poll=vote');assert.match(text,/123 Example St/);assert.doesNotMatch(text,/Private person|private@|private-token|undefined/);
 assert.deepEqual(F.highlights({...poll,voted_count:0},tally),[]);
 const ranked={...poll,method:'ranked',options:[...options,{id:'c',name:'Burgers'}],ballots:[['a','b','c'],['a','b','c'],['b','a','c'],['b','a','c'],['c','a','b']],voted_count:5,expected_voters:5};const highlights=F.highlights(ranked,Voting.tally(ranked));assert.ok(highlights.some(s=>s.title==='Preferences found a home'&&s.detail.startsWith('1 vote transferred')));assert.ok(highlights.some(s=>s.title==='A close call!'));
});
