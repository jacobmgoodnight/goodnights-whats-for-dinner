const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('Home Screen entry is credential-free and all declared PNG icons ship at the required sizes',()=>{
 const root=path.join(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
 for(const key of ['id','start_url','scope'])assert.equal(manifest[key],'./');assert.equal(manifest.display,'standalone');
 for(const [name,size] of [['icon-192.png',192],['icon-512.png',512],['apple-touch-icon.png',180]]){
  const png=fs.readFileSync(path.join(root,'icons',name));assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
 }
 assert.ok(manifest.icons.some(i=>i.sizes==='192x192'&&i.type==='image/png'));assert.ok(manifest.icons.some(i=>i.sizes==='512x512'&&i.type==='image/png'));
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(html,/apple-touch-icon.*icons\/apple-touch-icon.png/);assert.match(html,/class="brandmark"><img src="icon.svg/);assert.doesNotMatch(html,/✳/);
});
