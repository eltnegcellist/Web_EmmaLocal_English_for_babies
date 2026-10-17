// Evaluate selected research heads with unchanged runtime acceptance constants.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {classifyEmbedding,decodeHead} from '../src/semantic/core.js';
import {interactionLabels,baselinePolicy,decide,responseFor,summarize} from './ruri-reevaluation-lib.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),dir=join(root,'research/ruri-reevaluation-20261017');
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const original=await json(join(dir,'raw-scores.json')),cache=await json(join(root,'.semantic-research/reevaluation-cache.json'));
if(original.metadata.cache_key!==cache.key)throw Error('Stale ONNX embeddings');
const config=await json(join(root,'semantic-assets/ruri70-int8-bd500193/heads-config.json'));
const heads={};for(const axis of ['topic','interaction']){const b=await readFile(join(dir,`experimental-head-${axis}.f32`));heads[axis]=decodeHead(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),{shape:[axis==='topic'?22:15,385],classes:axis==='topic'?config.heads.topic.classes:interactionLabels});}
let ledger=[];try{ledger=(await json(join(dir,'english-meaning-review.json'))).rows;}catch{}
const rows=original.rows.map(x=>{const scores=classifyEmbedding(cache.embeddings[x.text].embedding,heads,config.topic_thresholds),axes=decide(scores,baselinePolicy),reply=responseFor(axes,x.text);return {...x,scores,original_scores:x.scores,axes,english:reply.english,route:reply.scene};});
const subsets={legacy67:rows.filter(x=>x.source==='legacy67'),new150:rows.filter(x=>x.source==='new150'),independent_new_holdout:rows.filter(x=>x.source==='new150'&&x.split==='holdout'&&!x.overlaps_legacy67)};
const summaries={};for(const [name,subset] of Object.entries(subsets)){
 const m=summarize(subset,baselinePolicy,ledger);
 // summarize() compares thresholds within one set of scores. For retraining,
 // overwrite deltas by comparing the actual original and learned heads.
 for(const axis of ['topic','interaction']){
  const eligible=subset.filter(x=>x[`score_${axis}`]!==false),target=x=>x[`expected_${axis}`],a=x=>x.axes[axis],b=x=>decide(x.original_scores,baselinePolicy)[axis];
  Object.assign(m[axis],{gains:eligible.filter(x=>b(x)!==target(x)&&a(x)===target(x)).length,losses:eligible.filter(x=>b(x)===target(x)&&a(x)!==target(x)).length,new_wrong_adopted:eligible.filter(x=>a(x)!==null&&a(x)!==target(x)&&a(x)!==b(x)).length});
 }
 const joint=subset.filter(x=>x.score_topic!==false&&x.score_interaction!==false),correct=(x,s)=>{const d=decide(s,baselinePolicy);return d.topic===x.expected_topic&&d.interaction===x.expected_interaction;};
 m.joint_gains=joint.filter(x=>!correct(x,x.original_scores)&&correct(x,x.scores)).length;
 m.joint_losses=joint.filter(x=>correct(x,x.original_scores)&&!correct(x,x.scores)).length;
 const reviewed=subset.map(x=>({a:ledger.find(v=>v.id===x.id&&v.english===x.english),b:ledger.find(v=>v.id===x.id&&v.english===responseFor(decide(x.original_scores,baselinePolicy),x.text).english)})).filter(x=>typeof x.a?.contradiction==='boolean'&&typeof x.b?.contradiction==='boolean');
 Object.assign(m.english_review,{paired_reviewed:reviewed.length,new_contradictions:reviewed.filter(x=>x.a.contradiction&&!x.b.contradiction).length,resolved_contradictions:reviewed.filter(x=>!x.a.contradiction&&x.b.contradiction).length});
 summaries[name]=m;
}
const result={status:'RESEARCH_ONLY_SYNTHETIC_UNADJUDICATED_DO_NOT_SHIP',source_metadata:original.metadata,selection:await json(join(dir,'head-training-result.json')),summaries,rows};
await writeFile(join(dir,'head-evaluation.json'),JSON.stringify(result,null,2)+'\n');
const reviewTemplate=await json(join(root,'.semantic-research/english-review-template.json'));
for(const x of rows)if(!reviewTemplate.rows.some(v=>v.id===x.id&&v.english===x.english))reviewTemplate.rows.push({id:x.id,text:x.text,english:x.english,contradiction:null,semantic_reversal:null,human_approved:false,head_experiment:true});
await writeFile(join(root,'.semantic-research/english-review-template.json'),JSON.stringify(reviewTemplate,null,2)+'\n');
console.log(JSON.stringify(summaries,null,2));
