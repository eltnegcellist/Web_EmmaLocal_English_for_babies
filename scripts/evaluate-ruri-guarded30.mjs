// Research only. Reuse fingerprinted real ONNX scores; no training or production edits.
// node scripts/evaluate-ruri-guarded30.mjs
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {recallPolicies,guarded30Policy,recallDecision,responseFor,retrievalMetrics,englishMetrics,currentId} from './ruri-recall-priority-lib.mjs';
const dir=new URL('../research/ruri-recall-priority-20261017/',import.meta.url),json=async f=>JSON.parse(await readFile(new URL(f,dir),'utf8'));
const raw=await json('raw-scores.json'),reference=await json('reference-ordinary.json'),ledger=(await json('english-review.json')).rows,refLedger=(await json('reference-english-review.json')).rows;
const oldUrl=new URL('../research/ruri-reevaluation-20261017/raw-scores.json',import.meta.url),old=JSON.parse(await readFile(oldUrl,'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const input of [raw,old])for(const f of ['model.onnx','head-topic.f32','head-interaction.f32']){
 const actual=hash(await readFile(new URL('../semantic-assets/ruri70-int8-bd500193/'+f,import.meta.url)));
 if(actual!==input.metadata.hashes[f])throw Error('Pinned model or head changed: '+f);
}
const policies=[recallPolicies().find(x=>x.id===currentId),recallPolicies().find(x=>x.id==='C_topic0.4_M0.1'),guarded30Policy],base=policies[0],prev=policies[1];
const output=(x,p)=>{const axes=recallDecision(x.scores,p),r=responseFor(axes,x.text);return {...axes,route:r.scene,english:r.english};};
const changed=(rows,p,against,reviews=[])=>rows.flatMap(x=>{
 const before=output(x,against),after=output(x,p);if(before.english===after.english)return [];
 const lookup=o=>reviews.find(v=>v.id===x.id&&v.english===o.english);
 return [{id:x.id,text:x.text,stratum:x.stratum??null,topic_probability:x.scores.topic.probability,topic_margin:x.scores.topic.margin,before,after,before_verdict:lookup(before)?.verdict??null,after_verdict:lookup(after)?.verdict??null,human_approved:false}];
});
const fresh=policies.map(p=>({policy:p.id,metrics:Object.fromEntries(['ordinary','routine_context','plausible_absence','all'].map(s=>{
 const rows=raw.rows.filter(x=>s==='all'||x.stratum===s);
 const english=englishMetrics(rows,p,ledger);if(english.unreviewed||english.undecidable)throw Error('Unreviewed new English '+p.id);
 return [s,{retrieval:retrievalMetrics(rows,p),english}];
})),changes_vs50:changed(raw.rows,p,base,ledger),changes_vs40:changed(raw.rows,p,prev,ledger)}));
const paired=policies.map(p=>({policy:p.id,n:reference.rows.length,changes_vs50:changed(reference.rows,p,base,refLedger),changes_vs40:changed(reference.rows,p,prev,refLedger)}));
for(const p of paired)for(const x of [...p.changes_vs50,...p.changes_vs40])if(!x.before_verdict||!x.after_verdict)throw Error('Reference needs review: '+x.id);
// Keep all earlier cases visible, including ambiguous/negative cases outside reference131.
// Exact duplicate texts count once; do not silently discard known stress failures.
const unique=[...new Map(old.rows.map(x=>[x.text,x])).values()],referenceTexts=new Set(reference.rows.map(x=>x.text)),stress=unique.filter(x=>!referenceTexts.has(x.text));
const stressReview=(await json('guarded30-stress-review.json')).rows;
const stressChanges=policies.map(p=>({policy:p.id,n:stress.length,changes_vs50:changed(stress,p,base,stressReview),changes_vs40:changed(stress,p,prev,stressReview)}));
for(const x of stressChanges.at(-1).changes_vs50)if(!x.after_verdict)throw Error('Changed stress output needs explicit review: '+x.id);
const result={status:'FOLLOW_UP_USER_PROPOSAL_REAL_SCORES_PROVISIONAL_NOT_FIELD_ACCURACY',human_approved:false,production_changed:false,policies,provenance:{scoring:'Fingerprint-verified saved real ONNX outputs. No recomputed or manually assigned scores.',fresh202_file_sha256:hash(await readFile(new URL('raw-scores.json',dir))),legacy_file_sha256:hash(await readFile(oldUrl)),hashes:raw.metadata.hashes},fresh,reference:paired,additional_stress:stressChanges};
try{
 const native=await json('guarded30-android-two-axes.json');
 const rows=native.rows.map(n=>{const w=raw.rows.find(x=>x.id===n.id),web=output(w,guarded30Policy),axes=recallDecision({topic:n.topic,interaction:n.interaction},guarded30Policy),actual=n.researchTopicRescue30Margin10;
  if(!actual)throw Error('Native 30% policy missing');
  return {id:n.id,text:n.text,web,native:{...axes,...actual},topic_same:web.topic===axes.topic,interaction_same:web.interaction===axes.interaction,english_same:web.english===actual.english,token_ids_match:n.tokenIdsMatch};
 });
 result.android={status:'MAC_NATIVE_JVM_NOT_ANDROID_DEVICE',n:rows.length,topic_differences:rows.filter(x=>!x.topic_same).length,interaction_differences:rows.filter(x=>!x.interaction_same).length,english_differences:rows.filter(x=>!x.english_same).length,token_mismatches:rows.filter(x=>!x.token_ids_match).length,rows};
}catch(e){if(e.code!=='ENOENT')throw e;result.android={status:'NOT_RUN'};}
await writeFile(new URL('guarded30-comparison.json',dir),JSON.stringify(result,null,2)+'\n');
const csv=['policy,stratum,n,topic_correct,topic_missed,topic_wrong,interaction_wrong,appropriate,generic_miss,unsupported_claim,contradiction,off_topic'];
for(const p of fresh)for(const [s,{retrieval:r,english:e}] of Object.entries(p.metrics))csv.push([p.policy,s,r.n,r.topic_correct,r.topic_missed,r.topic_wrong,r.interaction_wrong,e.appropriate,e.generic_miss,e.unsupported_claim,e.contradiction,e.off_topic].join(','));
await writeFile(new URL('guarded30-comparison.csv',dir),csv.join('\n')+'\n');
console.log(JSON.stringify({fresh:fresh.map(p=>({policy:p.policy,ordinary:p.metrics.ordinary,changes_vs40:p.changes_vs40})),reference:paired.map(({changes_vs50,...x})=>x),stress:stressChanges.map(({changes_vs50,...x})=>x),android:result.android.status==='NOT_RUN'?result.android:((({rows,...x})=>x)(result.android))},null,2));
