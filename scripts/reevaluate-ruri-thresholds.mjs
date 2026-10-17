/** RESEARCH ONLY. node scripts/reevaluate-ruri-thresholds.mjs [--refresh]
 * No model, production policy, English bank, or audio asset is modified.
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
import {interactionLabels,baselinePolicy,policies,decide,responseFor,summarize,fitTopicThresholds} from './ruri-reevaluation-lib.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),dir=join(root,'research/ruri-reevaluation-20261017');
const asset=join(root,'semantic-assets/ruri70-int8-bd500193'),runtime=join(root,'semantic-assets/runtime-ort1.30.0-tokenizers0.2.0');
const json=async f=>JSON.parse(await readFile(f,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex');
const cfg=await json(join(asset,'heads-config.json'));
const legacy=await json(join(root,'research/interaction-ruri-qa-probes-20261013.json'));
const dataset=await json(join(dir,'evaluation.json')),training=await json(join(dir,'head-training.json'));
const bytes=Object.fromEntries(await Promise.all(['model.onnx','head-topic.f32','head-interaction.f32','tokenizer.json','tokenizer_config.json','heads-config.json'].map(async f=>[f,await readFile(join(asset,f))])));
const hashes=Object.fromEntries(Object.entries(bytes).map(([k,v])=>[k,hash(v)]));
for(const f of ['runtime.mjs','ort-wasm-simd-threaded.wasm'])hashes['runtime/'+f]=hash(await readFile(join(runtime,f)));
for(const f of ['src/semantic/core.js','src/semantic/tokenize.js','src/interaction/ruri-routing.js','src/lite-response-engine.js','src/interaction/diversity.js'])hashes[f]=hash(await readFile(join(root,f)));
const head=(f,def)=>decodeHead(bytes[f].buffer.slice(bytes[f].byteOffset,bytes[f].byteOffset+bytes[f].byteLength),def);
const heads={topic:head('head-topic.f32',cfg.heads.topic),interaction:head('head-interaction.f32',{shape:[15,385],classes:interactionLabels})};
const inputs=[...legacy.cases.map(x=>({...x,source:'legacy67',score_topic:true,score_interaction:true})),...dataset.cases.map(x=>({...x,source:'new150'})),...training.cases.map(x=>({...x,source:'head_training'}))];
const cacheKey=hash(JSON.stringify({hashes,inputs})),cacheDir=join(root,'.semantic-research'),cacheFile=join(cacheDir,'reevaluation-cache.json');
let cache;try{cache=await json(cacheFile);}catch{}
if(process.argv.includes('--refresh')||cache?.key!==cacheKey){
 const tokenize=createRuriTokenizer(Tokenizer,JSON.parse(bytes['tokenizer.json']),JSON.parse(bytes['tokenizer_config.json']));
 ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=runtime+'/';
 const session=await ort.InferenceSession.create(new Uint8Array(bytes['model.onnx']),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
 const embeddings={};
 try{for(const [i,x] of inputs.entries()){
  if(embeddings[x.text])continue;
  const ids=tokenize(x.text),out=await session.run({input_ids:new ort.Tensor('int64',BigInt64Array.from(ids,BigInt),[1,ids.length]),attention_mask:new ort.Tensor('int64',BigInt64Array.from(ids,()=>1n),[1,ids.length])});
  try{embeddings[x.text]={embedding:Array.from(out.sentence_embedding.data),tokenIds:ids};}finally{Object.values(out).forEach(o=>o.dispose?.());}
  if(i%40===0)console.log('Real ONNX inference',i,'/',inputs.length);
 }}finally{await session.release?.();}
 cache={key:cacheKey,hashes,embeddings};await mkdir(cacheDir,{recursive:true});await writeFile(cacheFile,JSON.stringify(cache)+'\n');
}
const scored=inputs.map(x=>({...x,scores:classifyEmbedding(cache.embeddings[x.text].embedding,heads,cfg.topic_thresholds)}));
const evaluation=scored.filter(x=>x.source!=='head_training'),newRows=evaluation.filter(x=>x.source==='new150');
// Production route and first English must agree exactly at the baseline.
for(const x of evaluation){const axes=selectRuriAxes(x.scores.topic,x.scores.interaction,true),ours=decide(x.scores,baselinePolicy);
 if(JSON.stringify(axes)!==JSON.stringify(ours))throw Error('Baseline policy mismatch '+x.id);
 const real=new LiteResponseEngine().respondRuri(x.text,'',x.scores.topic,x.scores.interaction,true),adapted=responseFor(ours,x.text);
 if(real.english!==adapted.english||real.scene!==adapted.scene)throw Error('Downstream projection mismatch '+x.id);
}
const fitted=fitTopicThresholds(newRows.filter(x=>x.split==='calibration'&&!x.overlaps_legacy67),cfg.heads.topic.classes),variants=policies(fitted.thresholds);
let ledger=[];try{ledger=(await json(join(dir,'english-meaning-review.json'))).rows;}catch{}
const subsets={legacy67:evaluation.filter(x=>x.source==='legacy67'),new150:newRows,independent_new_holdout:newRows.filter(x=>x.split==='holdout'&&!x.overlaps_legacy67),calibration:newRows.filter(x=>x.split==='calibration'&&!x.overlaps_legacy67)};
const summaries=Object.fromEntries(Object.entries(subsets).map(([k,rows])=>[k,variants.map(p=>summarize(rows,p,ledger))]));
const classImpact={};
for(const axis of ['topic','interaction'])classImpact[axis]=Object.fromEntries((axis==='topic'?cfg.heads.topic.classes:interactionLabels).map(c=>[c,variants.map(p=>summarize(subsets.independent_new_holdout.filter(x=>x[`score_${axis}`]!==false&&(x[`expected_${axis}`]??(axis==='topic'?'generic':'none'))===c),p,ledger))]));
const classImpact_new150={};
for(const axis of ['topic','interaction'])classImpact_new150[axis]=Object.fromEntries((axis==='topic'?cfg.heads.topic.classes:interactionLabels).map(c=>[c,variants.map(p=>{const s=summarize(newRows.filter(x=>x[`score_${axis}`]!==false&&(x[`expected_${axis}`]??(axis==='topic'?'generic':'none'))===c),p,ledger);return {policy:p.id,...s[axis]};})]));
const criticalTexts=['今は眠くないんだね','泣いてはいないんだよ','笑っていないみたいだね','ご機嫌ななめだね','ミルクを飲んだらお風呂に入ろうね','まだ終わっていないね'];
const predictions=evaluation.map(x=>({...x,outcomes:Object.fromEntries(variants.map(p=>{const axes=decide(x.scores,p),r=responseFor(axes,x.text);return [p.id,{...axes,route:r.scene,english:r.english,selectionReason:r.selectionReason}];}))}));
const reviews=predictions.flatMap(x=>[...new Set(Object.values(x.outcomes).map(v=>v.english))].map(english=>({id:x.id,text:x.text,english,contradiction:null,semantic_reversal:null,human_approved:false})));
const metadata={status:'RESEARCH_ONLY_SYNTHETIC_PROVISIONAL_NOT_FIELD_ACCURACY',web_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,platform:process.platform,arch:process.arch,backend:'WASM SIMD, one thread',hashes,cache_key:cacheKey,labels:{topic:cfg.heads.topic.classes,interaction:interactionLabels},subsets:Object.fromEntries(Object.entries(subsets).map(([k,v])=>[k,v.length])),human_adjudicated_cases:0,warning:'All labels and machine meaning reviews unapproved. No Galaxy S25, caregiver audio or Moonshine ASR evaluated.'};
await writeFile(join(dir,'raw-scores.json'),JSON.stringify({metadata,rows:evaluation},null,2)+'\n');
await writeFile(join(dir,'comparison.json'),JSON.stringify({metadata,policies:variants,per_topic_calibration:fitted,summaries,classImpact,classImpact_new150},null,2)+'\n');
await writeFile(join(dir,'predictions.json'),JSON.stringify({metadata,rows:predictions},null,2)+'\n');
await writeFile(join(dir,'critical-cases.json'),JSON.stringify({status:metadata.status,rows:predictions.filter(x=>criticalTexts.includes(x.text))},null,2)+'\n');
await writeFile(join(cacheDir,'english-review-template.json'),JSON.stringify({status:'UNREVIEWED',rows:reviews},null,2)+'\n');
const fields=['subset','policy','n','topic_denominator','topic_exact','topic_correct_adopted','topic_gains','topic_losses','topic_new_wrong','interaction_denominator','interaction_exact','interaction_gains','interaction_losses','joint_denominator','joint_exact','joint_gains','joint_losses','both_generic','interaction_only','english_reviewed','english_contradictions','semantic_reversals','english_unreviewed'];
const csv=[fields.join(',')];for(const [subset,ms] of Object.entries(summaries))for(const m of ms)csv.push([subset,m.policy,m.n,m.topic.denominator,m.topic.exact,m.topic.correct_adopted,m.topic.gains,m.topic.losses,m.topic.new_wrong_adopted,m.interaction.denominator,m.interaction.exact,m.interaction.gains,m.interaction.losses,m.joint_denominator,m.joint_exact,m.joint_gains,m.joint_losses,m.both_generic,m.interaction_only,m.english_review.machine_provisional_reviewed,m.english_review.contradictions??'',m.english_review.semantic_reversals??'',m.english_review.unreviewed].join(','));
await writeFile(join(dir,'comparison.csv'),csv.join('\n')+'\n');
// Complete synthetic Web fixture for the existing Android JVM parity host.
await writeFile(join(cacheDir,'android-web-input.json'),JSON.stringify({modelSha:hashes['model.onnx'],runtime:'onnxruntime-web-1.30.0',cases:newRows.map(x=>({id:x.id,text:x.text,...cache.embeddings[x.text],topic:x.scores.topic}))})+'\n');
console.log(JSON.stringify({subsets:metadata.subsets,legacy:summaries.legacy67[0],holdout:summaries.independent_new_holdout.filter(x=>x.policy==='A50_m05'||x.policy.endsWith('_m0.05'))},null,2));
