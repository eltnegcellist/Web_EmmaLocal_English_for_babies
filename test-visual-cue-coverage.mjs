import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {VISUAL_CUE_CATALOG as catalog} from './src/visual-cue-catalog.js';
import {normalizeCueText} from './src/visual-cue-controller.js';
import {createTrialStorage} from './src/visual-cue-trial-storage.js';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const {report,rows}=await read('shared/visual-cue-trial-data.json');
const source=await read('shared/visual-cue-phrases.json');
const bank=await read('assets/voice-1202/manifest.json');
const art=await read('assets/visual-cue/artwork/manifest.json');
const motion=await read('assets/visual-cue/motion-variants/manifest.json');
const baseline=await read('shared/visual-cue-animation-baseline-20261020.json');
const conversions=await read('shared/visual-cue-static-animation-overrides.json');
assert.equal(rows.length,1091);assert.equal(new Set(rows.map(r=>normalizeCueText(r.text))).size,rows.length);
assert.equal(source.rows.length,914);assert.equal(report.uniqueReplySets,913);assert.equal(report.singleSentences,178);
assert.equal(rows.length,Object.keys(catalog.bindings).length);
const counts={animation:0,motionCandidate:0,background:0,still:0,baseline:0};
for(const row of rows){
 const binding=catalog.bindings[normalizeCueText(row.text)];assert(binding);
 const voice=bank.entries.find(e=>normalizeCueText(e.text)===normalizeCueText(row.text));
 assert.equal(row.audioSHA256,voice.sha256);assert.equal(row.audio,'assets/voice-1202/'+voice.file);
 let category;
 if(binding.type==='asset'){
  const a=[...art.assets,...motion.assets].find(a=>a.id===binding.assetId);assert(['accepted','motion-candidate'].includes(a.status));
  assert.notEqual(a.id,'cup-sip');assert.notEqual(a.id,'wake-daylight');
  category=a.status==='motion-candidate'?'motionCandidate':a.kind==='animation'?'animation':'still';assert.equal(row.target,a.id);
 }else category=['calm','celebrate'].includes(binding.state)?'background':'baseline';
 assert.equal(row.category,category);counts[category]++;
}
assert.deepEqual(counts,{animation:408,motionCandidate:141,background:123,still:145,baseline:274});
assert.equal(report.noAddedAnimation.count,counts.still+counts.baseline);assert.equal(report.noAddedAnimation.percent,38.41);
assert.equal(report.noObjectAnimation.count,rows.length-counts.animation);assert.equal(report.noObjectAnimation.percent,62.6);
for(const movie of report.animations)assert.equal(movie.count,rows.filter(r=>['animation','motionCandidate'].includes(r.category)&&r.target===movie.id).length);
assert.equal(report.animations.filter(a=>a.status==='accepted').length,20);
assert.equal(report.animations.filter(a=>a.status==='accepted'&&a.count>0).length,19);
assert.equal(report.motionCandidateCount,6);
assert.equal(conversions.rows.length,520);assert.equal(conversions.rows.filter(r=>r.changed).length,375);
for(const r of conversions.rows){
 const key=normalizeCueText(r.text);assert.deepEqual(baseline.bindings[key],{type:'asset',assetId:r.assetId});
 assert.deepEqual(catalog.bindings[key],{type:'asset',assetId:r.afterAssetId});assert(r.reason);
}
const changed=new Set(conversions.rows.filter(r=>r.changed).map(r=>normalizeCueText(r.text)));
for(const [text,binding] of Object.entries(baseline.bindings))if(!changed.has(text))assert.deepEqual(catalog.bindings[text],binding,'non-converted binding changed: '+text);
assert.equal(report.animations.find(a=>a.id==='wake-daylight').count,0);
assert.equal(report.animations.find(a=>a.id==='cup-sip').count,0);
assert.equal(report.voiceBankReference.total,1105);assert.equal(report.voiceBankReference.outsideResponseCorpus.length,14);
assert.equal(report.voiceBankReference.noAddedAnimation,433);
const stored=new Map([['emma_visual_cue_mode','emma'],['emma_history_enabled','true']]);
const raw={get length(){return stored.size;},key:i=>[...stored.keys()][i]??null,getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)};
const trial=createTrialStorage(raw);assert.equal(trial.getItem('emma_visual_cue_mode'),null);
trial.setItem('emma_visual_cue_mode','visual');assert.equal(raw.getItem('emma_visual_cue_mode'),'emma');
assert.equal(trial.length,1);assert.equal(trial.key(0),'emma_visual_cue_mode');
trial.clear();assert.equal(raw.getItem('emma_visual_cue_mode'),'emma');assert.equal(raw.getItem('emma_history_enabled'),'true');
console.log('Coverage: 1091 exact bindings, 375 explicit static conversions, 19/20 approved movies, 6 unapproved motion candidates, held/paused/finished exclusions and AAC hashes PASS');
