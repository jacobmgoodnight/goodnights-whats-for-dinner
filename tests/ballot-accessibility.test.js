const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');
const vars=Object.fromEntries([...css.matchAll(/--([\w-]+):(#[0-9a-f]{6})/g)].map(m=>[m[1],m[2]]));
function luminance(hex){const rgb=hex.slice(1).match(/../g).map(n=>parseInt(n,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722}
function ratio(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
const resolve=value=>value==='white'?'#ffffff':value.startsWith('var(')?vars[value.slice(6,-1)]:value;
test('ballot secondary text and accent labels exceed 4.5:1 on their cream surfaces',()=>{
 for(const bg of [vars.canvas,vars.paper,'#fff5e8','#fbf6ed','#fbf4e8'])for(const fg of [vars.muted,vars.ink,vars['orange-dark']])assert.ok(ratio(fg,bg)>=4.5,fg+' on '+bg);
});
test('enabled primary actions and checked approvals exceed 4.5:1',()=>{
 const primary=css.match(/\.btn-primary\{background:([^;]+);color:([^}]+)\}/);
 assert.ok(ratio(resolve(primary[1]),resolve(primary[2]))>=4.5);
 const selected=css.match(/\.check:checked\{background:([^;]+);/)[1];
 assert.ok(ratio(resolve(selected),'#ffffff')>=4.5);
});
test('focus ring and checkbox boundary remain visible at 3:1 or better',()=>{
 const focus=css.match(/button:focus-visible[^}]+outline:3px solid (#[0-9a-f]{6})/)[1];
 for(const bg of [vars.paper,vars.canvas,'#fff5e8'])assert.ok(ratio(focus,bg)>=3);
 const boundary=css.match(/\.check\{border-color:(#[0-9a-f]{6})/)[1];assert.ok(ratio(boundary,vars.paper)>=3);
});
