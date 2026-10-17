// Fresh real ONNX inference through the adopted production route, separate from
// historical research results. Synthetic inputs only; no caregiver recordings.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createRuriTokenizer} from '../src/semantic/tokenize.js';
import {decodeHead,classifyEmbedding} from '../src/semantic/core.js';
import {selectRuriAxes} from '../src/interaction/ruri-routing.js';
import {LiteResponseEngine} from '../src/lite-response-engine.js';
import {describeRuriTurn} from '../src/interaction/diagnostics.js';
import {guarded30Policy,recallDecision,responseFor,currentId,recallPolicies} from './ruri-recall-priority-lib.mjs';
import {interactionLabels} from './ruri-reevaluation-lib.mjs';
import {Tokenizer,ort} from '../semantic-assets/runtime-ort1.30.0-tokenizers0.2.0/runtime.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),dir=join(root,'research/ruri-adoption-20261018'),asset=join(root,'semantic-assets/ruri70-int8-bd500193'),runtime=join(root,'semantic-assets/runtime-ort1.30.0-tokenizers0.2.0');
const json=async p=>JSON.parse(await readFile(p,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex');
const fresh=await json(join(root,'research/ruri-recall-priority-20261017/raw-scores.json')),old=await json(join(root,'research/ruri-reevaluation-20261017/raw-scores.json'));
const inputs=[...fresh.rows,...new Map(old.rows.map(x=>[x.text,x])).values()];assert.equal(inputs.length,414);
const bytes=Object.fromEntries(await Promise.all(['model.onnx','head-topic.f32','head-interaction.f32','heads-config.json','tokenizer.json','tokenizer_config.json'].map(async f=>[f,await readFile(join(asset,f))])));
const hashes=Object.fromEntries(Object.entries(bytes).map(([f,b])=>[f,hash(b)]));
for(const f of ['model.onnx','head-topic.f32','head-interaction.f32'])for(const source of [fresh,old])assert.equal(hashes[f],source.metadata.hashes[f]);
const cfg=JSON.parse(bytes['heads-config.json']),head=(f,c)=>decodeHead(bytes[f].buffer.slice(bytes[f].byteOffset,bytes[f].byteOffset+bytes[f].byteLength),c);
const heads={topic:head('head-topic.f32',cfg.heads.topic),interaction:head('head-interaction.f32',{shape:[15,385],classes:interactionLabels})};
const tokenize=createRuriTokenizer(Tokenizer,JSON.parse(bytes['tokenizer.json']),JSON.parse(bytes['tokenizer_config.json']));
ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=runtime+'/';
const session=await ort.InferenceSession.create(new Uint8Array(bytes['model.onnx']),{executionProviders:['wasm'],graphOptimizationLevel:'all'}),rows=[],nativeInputs=[];
let maxScoreDrift=0;
try{for(const [index,x] of inputs.entries()){
 const ids=tokenize(x.text),out=await session.run({input_ids:new ort.Tensor('int64',BigInt64Array.from(ids,BigInt),[1,ids.length]),attention_mask:new ort.Tensor('int64',BigInt64Array.from(ids,()=>1n),[1,ids.length])});
 let embedding;try{embedding=Array.from(out.sentence_embedding.data);}finally{Object.values(out).forEach(v=>v.dispose?.());}
 const scores=classifyEmbedding(embedding,heads,cfg.topic_thresholds),axes=selectRuriAxes(scores.topic,scores.interaction,true),expected=recallDecision(scores,guarded30Policy);
 assert.deepEqual(axes,expected,x.text);
 const reply=new LiteResponseEngine().respondRuri(x.text,'',scores.topic,scores.interaction,true),projected=responseFor(expected,x.text);
 assert.equal(reply.english,projected.english,x.text);assert.equal(reply.scene,projected.scene,x.text);
 for(const axis of ['topic','interaction']){assert.equal(scores[axis].rawId,x.scores[axis].rawId,x.text);maxScoreDrift=Math.max(maxScoreDrift,Math.abs(scores[axis].probability-x.scores[axis].probability),Math.abs(scores[axis].margin-x.scores[axis].margin));}
 const before=recallDecision(scores,recallPolicies().find(p=>p.id===currentId));
 assert.equal(axes.interaction,before.interaction,x.text);if(before.topic||before.interaction)assert.deepEqual(axes,before,x.text);
 const audit=describeRuriTurn({prediction:scores,response:reply,at:'adoption-validation'});
 rows.push({id:x.id,text:x.text,source:index<fresh.rows.length?'fresh202':'retrospective212',scores,before,accepted:axes,route:reply.scene,english:reply.english,reason:audit.reason});
 nativeInputs.push({id:x.id,text:x.text,tokenIds:ids,embedding,topic:scores.topic});
 if(index%100===0)console.log('Adopted route real ONNX',index,'/',inputs.length);
}}finally{await session.release?.();}
assert.ok(maxScoreDrift<1e-7,'Model scores changed unexpectedly');
await mkdir(dir,{recursive:true});await mkdir(join(root,'.semantic-research'),{recursive:true});
const sources={};for(const f of ['src/interaction/ruri-routing.js','src/interaction/diagnostics.js'])sources[f]=hash(await readFile(join(root,f)));
await writeFile(join(dir,'web-validation.json'),JSON.stringify({status:'ADOPTED_POLICY_IMPLEMENTATION_VERIFIED_ON_SYNTHETIC_INPUTS_NOT_FIELD_ACCURACY',policy:guarded30Policy,hashes,sources,n:rows.length,max_score_drift:maxScoreDrift,human_meaning_approved:false,known_semantic_errors_resolved:false,main_merged:false,rows},null,2)+'\n');
await writeFile(join(root,'.semantic-research/adoption-android-web-input.json'),JSON.stringify({modelSha:hashes['model.onnx'],cases:nativeInputs})+'\n');
console.log(JSON.stringify({n:rows.length,max_score_drift:maxScoreDrift,changed_from50:rows.filter(x=>x.before.topic!==x.accepted.topic).length,all_match_approved_policy:true}));
