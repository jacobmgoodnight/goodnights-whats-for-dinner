const test=require('node:test');
const assert=require('node:assert/strict');
const Logos=require('../logos.js');

test('major chain names prefer recognizable website favicons',()=>{
 const r=Logos.details({name:"Culver's"});
 assert.match(r.url,/google\.com\/s2\/favicons/);
 assert.match(decodeURIComponent(r.url),/culvers\.com/);
 assert.match(Logos.details({name:'Chick-fil-A'}).url,/chick-fil-a\.com/);
});

test('unknown restaurants use a built-in vector icon',()=>{
 const output=Logos.render({name:'Local Pizza',category:'Pizza'});
 assert.match(output,/<svg/);
 assert.match(output,/class="logo-symbol"/);
 assert.doesNotMatch(output,/<img/);
});

test('manual built-in choice overrides auto selection',()=>{
 const result=Logos.details({name:'Local Pizza',category:'Pizza',icon_mode:'builtin',icon_value:'coffee'});
 assert.equal(result.key,'coffee');
 assert.equal(result.url,'');
});

test('website icons can use a pasted domain or official website URL',()=>{
 assert.equal(Logos.domain('https://www.example.com/menu'), 'example.com');
 assert.equal(Logos.domain('example.com'), 'example.com');
 assert.equal(Logos.domain('http://127.0.0.1'), '');
 assert.equal(Logos.domain('javascript:alert(1)'), '');
 assert.match(Logos.details({icon_mode:'website',icon_value:'example.com'}).url,/s2\/favicons/);
});

test('custom logos accept HTTPS but reject dangerous/non-HTTPS schemes',()=>{
 assert.equal(Logos.imageURL('javascript:alert(1)'), '');
 assert.equal(Logos.imageURL('data:image/svg+xml,test'), '');
 assert.equal(Logos.imageURL('http://example.com/logo.png'), '');
 assert.equal(Logos.imageURL('https://name:password@example.com/logo.png'), '');
 assert.equal(Logos.imageURL('https://example.com/logo.png'),'https://example.com/logo.png');
});

test('escaped image URLs cannot introduce HTML attributes',()=>{
 const html=Logos.render({icon_mode:'logo_url',icon_value:'https://example.com/logo.png?a=1&b=2'});
 assert.match(html,/<img/);
 assert.match(html,/&amp;/);
 assert.match(html,/restaurant-logo-fallback/);
});

test('all built-in icons have a rendered SVG and valid option',()=>{
 for(const key of Object.keys(Logos.labels)){
  assert.match(Logos.render({icon_mode:'builtin',icon_value:key}),/<svg/);
  assert.match(Logos.options(key),new RegExp('value="'+key+'" selected'));
 }
});
