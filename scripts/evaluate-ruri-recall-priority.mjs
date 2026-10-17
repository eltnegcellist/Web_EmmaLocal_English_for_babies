/** Research-only frequency/cost sensitivity, using actual pinned ONNX scores.
 * node scripts/evaluate-ruri-recall-priority.mjs [--refresh]
 * Does not change production policy, heads, English or audio.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createRuriTokenizer} from '../src/semantic/tokenize.js';
import {classifyEmbedding,decodeHead} from '../src/semantic/core.js';
import {selectRuriAxes} from '../src/interaction/ruri-routing.js';
import {LiteResponseEngine} from '../src/lite-response-engine.js';
import {Tokenizer,ort} from '../semantic-assets/runtime-ort1.30.0-tokenizers0.2.0/runtime.mjs';
import {interactionLabels} from './ruri-reevaluation-lib.mjs';
import {recallPolicies,recallDecision,responseFor,retrievalMetrics,englishMetrics,ordinaryWeights,expectedLoss,breakEvenAbsence,currentId} from './ruri-recall-priority-lib.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),dir=join(root,'research/ruri-recall-priority-20261017'),asset=join(root,'semantic-assets/ruri70-int8-bd500193'),runtime=join(root,'semantic-assets/runtime-ort1.30.0-tokenizers0.2.0');
const json=async p=>JSON.parse(await readFile(p,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex');
const dataset=await json(join(dir,'natural-evaluation.json')),design=await json(join(dir,'design.json'));
const bytes=Object.fromEntries(await Promise.all(['model.onnx','head-topic.f32','head-interaction.f32','heads-config.json','tokenizer.json','tokenizer_config.json'].map(async f=>[f,await readFile(join(asset,f))])));
const hashes=Object.fromEntries(Object.entries(bytes).map(([f,b])=>[f,hash(b)]));
for(const f of ['runtime.mjs','ort-wasm-simd-threaded.wasm','ort-wasm-simd-threaded.mjs'])hashes['runtime/'+f]=hash(await readFile(join(runtime,f)));
for(const f of ['src/semantic/core.js','src/semantic/tokenize.js','src/interaction/ruri-routing.js','src/lite-response-engine.js','src/interaction/diversity.js'])hashes[f]=hash(await readFile(join(root,f)));
const cfg=JSON.parse(bytes['heads-config.json']);
const readHead=(f,def)=>decodeHead(bytes[f].buffer.slice(bytes[f].byteOffset,bytes[f].byteOffset+bytes[f].byteLength),def);
const heads={topic:readHead('head-topic.f32',cfg.heads.topic),interaction:readHead('head-interaction.f32',{shape:[15,385],classes:interactionLabels})};
const cacheFile=join(root,'.semantic-research/recall-priority-cache.json'),key=hash(JSON.stringify({hashes,cases:dataset.cases}));
let cache;try{cache=await json(cacheFile);}catch{}
if(cache?.key!==key||process.argv.includes('--refresh')){
 const tokenize=createRuriTokenizer(Tokenizer,JSON.parse(bytes['tokenizer.json']),JSON.parse(bytes['tokenizer_config.json']));
 ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=runtime+'/';
 const session=await ort.InferenceSession.create(new Uint8Array(bytes['model.onnx']),{executionProviders:['wasm'],graphOptimizationLevel:'all'}),embeddings={};
 try{for(const [i,x] of dataset.cases.entries()){
  const ids=tokenize(x.text),out=await session.run({input_ids:new ort.Tensor('int64',BigInt64Array.from(ids,BigInt),[1,ids.length]),attention_mask:new ort.Tensor('int64',BigInt64Array.from(ids,()=>1n),[1,ids.length])});
  try{embeddings[x.id]={embedding:Array.from(out.sentence_embedding.data),tokenIds:ids};}finally{Object.values(out).forEach(x=>x.dispose?.());}
  if(i%50===0)console.log('Fresh real ONNX',i,'/',dataset.cases.length);
 }}finally{await session.release?.();}
 cache={key,embeddings};await mkdir(join(root,'.semantic-research'),{recursive:true});await writeFile(cacheFile,JSON.stringify(cache)+'\n');
}
const policies=recallPolicies(),rows=dataset.cases.map(x=>({...x,scores:classifyEmbedding(cache.embeddings[x.id].embedding,heads,cfg.topic_thresholds)}));
const base=policies.find(p=>p.id===currentId);
for(const x of rows){
 const axes=selectRuriAxes(x.scores.topic,x.scores.interaction,true),ours=recallDecision(x.scores,base),r=new LiteResponseEngine().respondRuri(x.text,'',x.scores.topic,x.scores.interaction,true);
 if(JSON.stringify(axes)!==JSON.stringify(ours)||r.english!==responseFor(ours,x.text).english)throw Error('Baseline projection differs '+x.id);
}
const strata=['ordinary','routine_context','plausible_absence'];
let ledger=[];try{ledger=(await json(join(dir,'english-review.json'))).rows;}catch{}
const metrics=Object.fromEntries(policies.map(p=>[p.id,Object.fromEntries([...strata,'all'].map(s=>{const xs=s==='all'?rows:rows.filter(x=>x.stratum===s);return [s,{retrieval:retrievalMetrics(xs,p),english:englishMetrics(xs,p,ledger)}];}))]));
const predictions=rows.map(x=>{const outcomes=[],indexByPolicy={};for(const p of policies){const axes=recallDecision(x.scores,p),r=responseFor(axes,x.text),value={...axes,route:r.scene,english:r.english};let i=outcomes.findIndex(v=>JSON.stringify(v)===JSON.stringify(value));if(i<0){i=outcomes.length;outcomes.push(value);}indexByPolicy[p.id]=i;}return {...x,outcomes,indexByPolicy};});
const template=predictions.flatMap(x=>x.outcomes.map(o=>({id:x.id,text:x.text,stratum:x.stratum,...o,verdict:null,note:'',human_approved:false})));
const englishByPolicy=Object.fromEntries(policies.map(p=>[p.id,Object.fromEntries(strata.map(s=>[s,metrics[p.id][s].english]))]));
const scenarios=[];
for(const absence of design.absence_prevalence_scenarios)for(const routine of design.routine_prevalence_scenarios)for(const badCost of design.bad_reply_costs_relative_to_one_miss)for(const minorCost of design.minor_mismatch_costs){
 const weights=ordinaryWeights(absence,routine),outcomes=policies.map(p=>({policy:p.id,expected_loss:expectedLoss(englishByPolicy[p.id],weights,badCost,minorCost)}));
 const available=outcomes.filter(x=>x.expected_loss!==null).sort((a,b)=>a.expected_loss-b.expected_loss||a.policy.localeCompare(b.policy));
 const best=available[0]?.expected_loss??null;
 scenarios.push({absence_prevalence_assumption:absence,routine_prevalence_assumption:routine,bad_reply_cost:badCost,minor_cost:minorCost,loss_unit:'one missed useful reply',best_policies:best===null?[]:available.filter(x=>Math.abs(x.expected_loss-best)<1e-12).map(x=>x.policy),outcomes});
}
const breakEven=[];for(const p of policies)for(const badCost of design.bad_reply_costs_relative_to_one_miss)breakEven.push({policy:p.id,badCost,routine_assumption:.1,...breakEvenAbsence(englishByPolicy[currentId],englishByPolicy[p.id],{badCost})});
const metadata={status:'SYNTHETIC_PROVISIONAL_FREQUENCY_COST_SCENARIOS_NOT_FIELD_ACCURACY',web_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),upstream_main:execFileSync('git',['rev-parse','origin/main'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,platform:process.platform,arch:process.arch,hashes,cache_key:key,dataset_sha256:hash(await readFile(join(dir,'natural-evaluation.json'))),case_count:rows.length,policies:policies.length,human_reviewed:0,frequency_measured:false,policy_note:'No per-error veto. Negated mentions retain topic; review actual reply. Topical observations may receive short on-topic invitations. Actual usage frequencies and acceptable cost ratio require user/field evidence.'};
await writeFile(join(dir,'raw-scores.json'),JSON.stringify({metadata,rows},null,2)+'\n');
await writeFile(join(dir,'comparison.json'),JSON.stringify({metadata,policies,metrics,breakEven},null,2)+'\n');
await writeFile(join(dir,'predictions.json'),JSON.stringify({metadata,rows:predictions},null,2)+'\n');
await writeFile(join(dir,'frequency-cost-scenarios.json'),JSON.stringify({metadata,scenarios},null,2)+'\n');
await writeFile(join(root,'.semantic-research/recall-priority-review-template.json'),JSON.stringify({status:'UNREVIEWED',rows:template},null,2)+'\n');
await writeFile(join(root,'.semantic-research/recall-priority-android-web-input.json'),JSON.stringify({modelSha:hashes['model.onnx'],runtime:'onnxruntime-web-1.30.0',cases:rows.map(x=>({id:x.id,text:x.text,...cache.embeddings[x.id],topic:x.scores.topic}))})+'\n');
const csv=['policy,stratum,n,topic_positive,topic_correct,topic_missed,topic_wrong,gained_topics,lost_topics,interaction_wrong,joint_acceptable,generic,appropriate,generic_miss,minor_mismatch,bad_or_contradiction,unreviewed'];
for(const p of policies)for(const s of [...strata,'all']){const {retrieval:r,english:e}=metrics[p.id][s];csv.push([p.id,s,r.n,r.topic_positive,r.topic_correct,r.topic_missed,r.topic_wrong,r.gained_topics,r.lost_topics,r.interaction_wrong,r.joint_acceptable,r.both_generic,e.appropriate,e.generic_miss,e.minor_mismatch,e.off_topic+e.contradiction+e.unsupported_claim,e.unreviewed+e.undecidable].join(','));}
await writeFile(join(dir,'comparison.csv'),csv.join('\n')+'\n');
console.log(JSON.stringify({metadata,selected:policies.filter(p=>p.margin===.05&&p.interaction===.5).map(p=>({policy:p.id,...metrics[p.id].ordinary.retrieval,english:metrics[p.id].ordinary.english}))},null,2));
