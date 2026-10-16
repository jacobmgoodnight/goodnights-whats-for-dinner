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
 assert.equal(F.avatar('😎'),'😎');assert.equal(F.avatar('data:image/jpeg;base64,/9j/AA=='),'data:image/jpeg;base64,/9j/AA==');for(const a of ['https://example.test/photo','data:image/svg+xml,<svg onload=alert(1)>','<img src=x onerror=x>','data:image/jpeg;base64,'+'A'.repeat(24000)])assert.equal(F.avatar(a),'🙂');
});
