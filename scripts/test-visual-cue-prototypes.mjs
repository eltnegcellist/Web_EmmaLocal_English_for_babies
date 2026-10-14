// Independently validates prototype manifest, SVG references, and runtime isolation.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const load=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const manifest=JSON.parse(load('shared/visual-cue-prototype-manifest.json'));
const plan=JSON.parse(load('shared/visual-cue-asset-plan.json'));
const registry=JSON.parse(load('shared/visual-cue-namespaces.json'));
const html=load('visual-cue-prototypes.html');
const css=load('visual-cue-prototypes.css');
const js=load('src/visual-cue-prototype-preview.js');
assert.equal(manifest.schemaVersion,1);
assert.equal(manifest.entries.length,12);
assert.deepEqual(manifest.entries.map(e=>e.cueId),plan.firstPrototypes.map(e=>e.cueId),'Prototype selection drifted');
assert.equal(manifest.entries.filter(e=>e.mode==='illustration').length,8);
assert.equal(manifest.entries.filter(e=>e.mode==='emma').length,4);
assert.ok(html.includes('src/visual-cue-prototype-preview.js'));
assert.ok(html.includes('id="motionToggle"'));
assert.ok(css.includes('@media (prefers-reduced-motion:reduce)'));
assert.ok(js.includes('textContent')&&!js.includes('innerHTML'),'HTML must use textContent');
assert.ok(!load('src/app.js').includes('visual-cue-prototype-preview.js'),'Preview must not be loaded in production');
const ids=new Set(),assets=new Set(),cues=new Set(registry.cues.map(c=>c.id));
for(const item of manifest.entries){
 assert.equal(item.order,ids.size+1);
 assert.ok(cues.has(item.cueId),'Unknown prototype cue: '+item.cueId);
 assert.ok(!ids.has(item.cueId));
 ids.add(item.cueId);
 assert.match(item.title,/\S/);
 assert.equal(item.status,'prototype');
 assert.equal(item.reviewStatus,'design-review-needed');
 assert.ok(!/^https?:\/\//.test(item.image));
 assert.ok(!item.image.includes('..'));
 assert.ok(existsSync(new URL('../'+item.image,import.meta.url)),'Missing asset: '+item.image);
 assets.add(item.image);
}
assert.equal(assets.size,9,'Expected 8 new images plus 1 existing Emma face');
assert.ok(manifest.entries.filter(x=>x.mode==='emma').every(x=>x.image==='assets/emma-face/emma-face-idle-open.svg'));
execFileSync('python3',['scripts/test-visual-cue-svg.py'],{stdio:'inherit'});
console.log(JSON.stringify({prototypeCards:12,svgScenes:8,emmaCompositions:4,uniqueAssets:9,check:'ok'}));
