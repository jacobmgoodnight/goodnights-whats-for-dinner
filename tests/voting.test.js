const assert=require('node:assert/strict');
const {tally}=require('../voting.js');
const options=['a','b','c'].map(id=>({id,name:id}));
const poll=(method,ballots)=>({method,options,ballots});
// Approval: one vote per checked restaurant, no more than two per ballot.
assert.deepEqual(tally(poll('approval',[['a','b'],['a'],['b','c'],['a']])).winners,['a']);
assert.deepEqual(tally(poll('approval',[['a'],['b']])).winners,['a','b']);
// Consensus: highest yes percentage is equivalent to most yes votes with same voters.
assert.deepEqual(tally(poll('swipe',[{a:true,b:false,c:false},{a:true,b:true,c:false},{a:false,b:true,c:false}])).winners,['a','b']);
// Instant-runoff: 'a' eliminated, next-choice transfers to 'b', which wins 3-2.
assert.deepEqual(tally(poll('ranked',[
 ['a','b','c'],['b','c','a'],['b','c','a'],['c','b','a'],['c','b','a']
])).winners,['b']);
assert.deepEqual(tally(poll('ranked',[])).winners,[]);
console.log('All voting logic tests passed.');

const test=require('node:test');
for(const [method,ballots] of [['approval',[['a'],['b']]],['swipe',[{a:true,b:false,c:false},{a:false,b:true,c:false}]],['ranked',[['a','b','c'],['b','a','c']]]]){
 test(method+': saved random resolution selects only a tied leader and preserves scores',()=>{
  const original=poll(method,ballots),before=tally(original),resolved=tally({...original,tie_winner_id:'b'});
  assert.deepEqual(before.winners,['a','b']);assert.deepEqual(resolved.winners,['b']);assert.deepEqual(resolved.scores,before.scores);
  assert.deepEqual(resolved.tiedWinners,['a','b']);assert.equal(resolved.randomlyResolved,true);assert.match(resolved.details,/randomly.*2 tied leaders/);
  assert.deepEqual(tally({...original,tie_winner_id:'c'}).winners,['a','b']);
 });
}
test('a saved draw cannot override a clear winner or an empty ballot collection',()=>{
 assert.deepEqual(tally({...poll('approval',[['a'],['a']]),tie_winner_id:'b'}).winners,['a']);
 assert.deepEqual(tally({...poll('approval',[]),tie_winner_id:'a'}).winners,[]);
});
