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
