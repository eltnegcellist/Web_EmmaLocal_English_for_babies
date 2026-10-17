// Synthetic repeated-input histories expose the actual diversity-selected lines.
import {readFile,writeFile} from 'node:fs/promises';
import {LiteResponseEngine} from '../src/lite-response-engine.js';
import {baselinePolicy,decide,responseFor} from './ruri-reevaluation-lib.mjs';
const dir=new URL('../research/ruri-reevaluation-20261017/',import.meta.url);
const json=async f=>JSON.parse(await readFile(new URL(f,dir),'utf8'));
const input=await json('critical-cases.json'),comparison=await json('comparison.json'),learned=await json('head-evaluation.json');
const unique=[...new Map(input.rows.map(x=>[x.text,x])).values()];
const rows=[];
for(const x of unique){
 for(const id of ['A50_m05','B0.3_m0.05','C0.45_m0.05','C0.4_m0.05','learned_heads']){
  const p=comparison.policies.find(x=>x.id===id)||baselinePolicy,scores=id==='learned_heads'?learned.rows.find(r=>r.id===x.id).scores:x.scores;
  const axes=decide(scores,p),engine=new LiteResponseEngine(),turns=[];
  for(let turn=1;turn<=20;turn++)turns.push({turn,...responseFor(axes,x.text,engine)});
  rows.push({id:x.id,text:x.text,policy:id,axes,turns});
 }
}
await writeFile(new URL('critical-repeated-replies.json',dir),JSON.stringify({status:'UNAPPROVED_SYNTHETIC_REPEAT_TRACE_NOT_FIELD_DIALOGUE',note:'20 repeats from empty history per policy/input; no human/audio review. Not included in first-reply contradiction counts.',rows},null,2)+'\n');
console.log('Critical repeated reply traces',rows.length,'x 20 turns');
