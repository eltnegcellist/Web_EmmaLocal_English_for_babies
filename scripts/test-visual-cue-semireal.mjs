import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const manifest=JSON.parse(read('shared/visual-cue-semireal-study.json'));
const ids=['action.sip','action.turn-page','action.clap','action.kick'];
assert.equal(manifest.schemaVersion,1);
assert.equal(manifest.entries.length,4);
assert.deepEqual(manifest.entries.map(x=>x.cueId),ids);
assert.equal(manifest.isProduction,false);
const expected={ 'action.sip':['bottlePivot','lip'],'action.turn-page':['pagePivot'],'action.clap':['leftPalm','rightPalm'],'action.kick':['legLeft','legRight']};
for(const cue of manifest.entries){
 assert.ok(cue.seconds>=2&&cue.seconds<=4);
 assert.equal(cue.new,'assets/visual-cue/semireal/'+cue.cueId.replace('.','-')+'.svg');
 assert.ok(existsSync(new URL(cue.new,root)));
 assert.ok(existsSync(new URL(cue.old,root)));
 const src=read(cue.new);
 assert.match(src,/<svg\b/);
 assert.match(src,/<title\b/);
 assert.match(src,/<desc\b/);
 assert.match(src,/@keyframes/);
 assert.match(src,/prefers-reduced-motion/);
 assert.ok(!/<script\b/i.test(src),'SVG script forbidden');
 assert.ok(!/https?:\/\//i.test(src.replace('http://www.w3.org/2000/svg','')),'external dependency forbidden');
 for(const group of expected[cue.cueId]){
  assert.ok(src.includes('id="'+group+'"'),'Missing articulated SVG group '+group);
  assert.ok(src.includes('#'+group+'{transform-origin:'),'Missing group motion CSS '+group);
 }
}
assert.ok(read('visual-cue-motion-study.html').includes('id="motionToggle"'));
assert.ok(read('src/visual-cue-motion-study.js').includes("loadedSvgDocuments"));
assert.ok(!read('src/app.js').includes('visual-cue-motion-study'),'Do not connect prototypes to production runtime');
execFileSync('python3',['scripts/verify-visual-cue-semireal-svg.py'],{stdio:'inherit'});
console.log('Visual Cue: four independent semireal scenes, articulated motion and reduced-motion settings OK');
