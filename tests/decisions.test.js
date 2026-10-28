const test=require('node:test'),assert=require('node:assert/strict'),D=require('../decisions.js'),{execFileSync}=require('node:child_process');
const places=['a','b','c','d'].map(id=>({id,name:'Synthetic '+id})),today='2026-10-28';
test('calendar dates reject normalization, timestamps and malformed values',()=>{for(const v of ['2026-02-30','2026-1-01','2026-10-28T00:00:00Z',null,'infinity'])assert.equal(D.day(v),null);assert.equal(D.day('2024-02-29')+1,D.day('2024-03-01'))});
test('local today and day differences survive opposing zones and DST',()=>{
 for(const [zone,expected] of [['America/Los_Angeles','2026-10-27'],['Pacific/Kiritimati','2026-10-28']]){
  const output=execFileSync(process.execPath,['-e',"console.log(require('./decisions.js').localDate(new Date('2026-10-28T02:00:00Z')))"],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,TZ:zone},encoding:'utf8'}).trim();assert.equal(output,expected);
 }assert.equal(D.day('2026-11-02')-D.day('2026-11-01'),1);
});
test('rotation prefers unrecorded then oldest; excludes only confirmed recent dates',()=>{
 const result=D.suggest(places,{today,lastEaten:{a:'2026-10-27',b:'2026-09-01',c:'2026-10-01'},count:3});assert.deepEqual(result.choices.map(x=>x.id),['d','b','c']);assert.equal(result.excludedRecent,1);assert.match(result.choices[0].reason,/No confirmed meals/);
});
test('same input/date is deterministic regardless of library order, and alternative rounds never repeat',()=>{
 const a=D.suggest(places,{today,count:3}),b=D.suggest([...places].reverse(),{today,count:3});assert.deepEqual(a.choices,b.choices);
 const seen=a.choices.map(x=>x.id),next=D.suggest(places,{today,seen,count:3});assert.equal(next.choices.length,1);assert.ok(!seen.includes(next.choices[0].id));assert.equal(D.suggest(places,{today,seen:[...seen,next.choices[0].id]}).choices.length,0);
});
test('hard exclusions are explicit; no silent fallback when all places were recent',()=>{
 const lastEaten=Object.fromEntries(places.map(r=>[r.id,today]));assert.equal(D.suggest(places,{today,lastEaten}).choices.length,0);assert.equal(D.suggest(places,{today,lastEaten,avoidRecent:false}).choices.length,1);
 assert.equal(D.suggest([{...places[0],active:false}],{today}).choices.length,0);
});
test('date labels describe records without claiming an unrecorded restaurant was never visited',()=>{assert.equal(D.lastEatenLabel('2026-10-07',today),'Last eaten 3 weeks ago');assert.equal(D.lastEatenLabel(null,today),'No confirmed meals yet');assert.equal(D.lastEatenLabel(today,today),'Last eaten today')});
test('a meal on a later local calendar date is shown as its date across zones',()=>{assert.equal(D.lastEatenLabel('2026-10-29',today),'Last eaten on 2026-10-29');assert.equal(D.lastEatenLabel('2025-10-28',today),'Last eaten 1 year ago')});
