import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {VISUAL_CUE_CATALOG as catalog} from './src/visual-cue-catalog.js';
import {normalizeCueText} from './src/visual-cue-controller.js';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const {report,rows}=await read('shared/visual-cue-trial-data.json');
const source=await read('shared/visual-cue-phrases.json');
const bank=await read('assets/voice-1202/manifest.json');
const art=await read('assets/visual-cue/artwork/manifest.json');
assert.equal(rows.length,1091);assert.equal(new Set(rows.map(r=>normalizeCueText(r.text))).size,rows.length);
assert.equal(source.rows.length,914);assert.equal(report.uniqueReplySets,913);assert.equal(report.singleSentences,178);
assert.equal(rows.length,Object.keys(catalog.bindings).length);
const counts={animation:0,background:0,still:0,baseline:0};
for(const row of rows){
 const binding=catalog.bindings[normalizeCueText(row.text)];assert(binding);
 const voice=bank.entries.find(e=>normalizeCueText(e.text)===normalizeCueText(row.text));
 assert.equal(row.audioSHA256,voice.sha256);assert.equal(row.audio,'assets/voice-1202/'+voice.file);
 let category;
 if(binding.type==='asset'){
  const a=art.assets.find(a=>a.id===binding.assetId);assert.equal(a.status,'accepted');
  assert.notEqual(a.id,'cup-sip');assert.notEqual(a.id,'wake-daylight');
  category=a.kind==='animation'?'animation':'still';assert.equal(row.target,a.id);
 }else category=['calm','celebrate'].includes(binding.state)?'background':'baseline';
 assert.equal(row.category,category);counts[category]++;
}
assert.deepEqual(counts,{animation:174,background:123,still:520,baseline:274});
assert.equal(report.noAddedAnimation.count,counts.still+counts.baseline);assert.equal(report.noAddedAnimation.percent,72.78);
assert.equal(report.noObjectAnimation.count,rows.length-counts.animation);assert.equal(report.noObjectAnimation.percent,84.05);
for(const movie of report.animations)assert.equal(movie.count,rows.filter(r=>r.category==='animation'&&r.target===movie.id).length);
assert.equal(report.animations.filter(a=>a.status==='accepted').length,20);
assert.equal(report.animations.filter(a=>a.status==='accepted'&&a.count>0).length,12);
assert.equal(report.animations.find(a=>a.id==='cup-sip').count,0);
assert.equal(report.voiceBankReference.total,1105);assert.equal(report.voiceBankReference.outsideResponseCorpus.length,14);
assert.equal(report.voiceBankReference.noAddedAnimation,808);
console.log('Coverage: all 1091 exact bindings independently tallied; 20 approved movies including 8 zero-use, held exclusions, unique units and AAC hashes PASS');
