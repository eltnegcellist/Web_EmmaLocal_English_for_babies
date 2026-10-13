// Offline-only inventory. No audio, user utterances, or runtime telemetry.
import {allLiteReplyGroupsForPhonemeAudit} from '../src/lite-response-engine.js';
import {INTERACTION_REPLIES} from '../src/interaction/response.js';
import {COMBINED_REPLIES} from '../src/interaction/ruri-routing.js';
import {readFile} from 'node:fs/promises';
const play=JSON.parse(await readFile(new URL('../shared/play-topics.json',import.meta.url),'utf8'));
const rows=[];
function add(kind,scene,phrases){
 if(!Array.isArray(phrases))throw Error('bad phrases '+scene);
 phrases.forEach((english,i)=>{
  if(typeof english!=='string'||!english.trim())throw Error('empty phrase '+scene+'#'+i);
  rows.push({kind,scene,id:`${kind}:${scene}:${i+1}`,english});
 });
}
for(const [scene,phrases] of Object.entries(allLiteReplyGroupsForPhonemeAudit()))add('topic',scene,phrases);
for(const [scene,phrases] of Object.entries(INTERACTION_REPLIES))add('interaction',scene,phrases);
for(const [scene,phrases] of Object.entries(COMBINED_REPLIES))add('combined',scene,phrases);
for(const t of play.topics)add('press',t.id,t.phrases);
const counts=Object.fromEntries([...new Set(rows.map(r=>r.kind))].map(k=>[k,rows.filter(r=>r.kind===k).length]));
if(counts.topic!==197||counts.interaction!==112||counts.combined!==495||counts.press!==110)throw Error('unexpected release bank count '+JSON.stringify(counts));
console.log(JSON.stringify({schema_version:1,counts,rows}));
