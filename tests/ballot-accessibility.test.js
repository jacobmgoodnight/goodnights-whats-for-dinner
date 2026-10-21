const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');
test('release retains the existing Goodnights brand and text palette',()=>{
 for(const token of ['--ink:#23221f','--muted:#7b786f','--orange:#f66f40','--orange-dark:#d84b23'])assert.ok(css.includes(token));
 assert.ok(css.includes('.btn-primary{background:var(--orange);color:white}'));
 assert.ok(css.includes('.btn-primary:hover:not(:disabled){background:var(--orange-dark)}'));
 assert.ok(css.includes('.check:checked{background:var(--orange);border-color:var(--orange)}'));
});
test('new directional feedback uses text and retains the original palette',()=>{
 const added=css.split('/* Readable ballot details and restrained directional feedback. */')[1];
 assert.ok(!added.includes('[data-direction=\"yes\"]'));assert.ok(!added.includes('[data-direction=\"no\"]'));
 assert.deepEqual([...new Set(added.match(/#[0-9a-f]{6}/g))],['#ef9156']);
});
test('native fields and swipe backtracking have visible focus and comfortable detail controls',()=>{
 assert.match(css,/\.rankoption select:focus-visible,#swipeCard:focus-visible\{outline:3px solid #ef9156/);
 assert.match(css,/\.ballot-places summary\{[^}]*min-height:44px/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.votecard\{transform:none!important;transition:none!important/);
});
