import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {recallPolicies,recallDecision,responseFor,currentId,expectedLoss,ordinaryWeights,breakEvenAbsence} from './ruri-recall-priority-lib.mjs';
const dir=new URL('../research/ruri-recall-priority-20261017/',import.meta.url),json=async f=>JSON.parse(await readFile(new URL(f,dir),'utf8'));
const data=await json('natural-evaluation.json'),raw=await json('raw-scores.json'),pred=await json('predictions.json'),result=await json('comparison.json'),ledger=await json('english-review.json'),mixture=await json('sampling-cost-sensitivity.json'),reference=await json('reference-ordinary.json');
const policies=recallPolicies(),p=id=>policies.find(x=>x.id===id),out=(text,id)=>{const x=pred.rows.find(x=>x.text===text);return x.outcomes[x.indexByPolicy[id]];};
test('202 newly authored cases have frozen strata, no prior exact reuse or training',async()=>{
 assert.equal(data.cases.length,202);assert.equal(new Set(data.cases.map(x=>x.text)).size,202);
 assert.deepEqual(['ordinary','routine_context','plausible_absence'].map(s=>data.cases.filter(x=>x.stratum===s).length),[170,12,20]);
 const old=JSON.parse(await readFile(new URL('../research/ruri-reevaluation-20261017/raw-scores.json',import.meta.url),'utf8')).rows;
 const training=JSON.parse(await readFile(new URL('../research/ruri-reevaluation-20261017/head-training.json',import.meta.url),'utf8')).cases;
 const used=new Set([...old,...training].map(x=>x.text));assert.ok(data.cases.every(x=>!used.has(x.text)&&!x.adjudicated));
});
test('fingerprinted real ONNX and heads remain the pinned production files',async()=>{
 for(const f of ['model.onnx','head-topic.f32','head-interaction.f32'])assert.equal(createHash('sha256').update(await readFile(new URL('../semantic-assets/ruri70-int8-bd500193/'+f,import.meta.url))).digest('hex'),raw.metadata.hashes[f]);
 assert.equal(raw.metadata.dataset_sha256,createHash('sha256').update(await readFile(new URL('natural-evaluation.json',dir))).digest('hex'));
 assert.equal(policies.length,42);
});
test('negated everyday questions retain their subject and do not require generic',()=>{
 assert.equal(out('まだ寝てないのかな',currentId).topic,'sleep');
 assert.equal(out('あまりミルク飲みたくないのかな',currentId).topic,'milk');
 const id=pred.rows.find(x=>x.text==='まだ寝てないのかな').id;
 assert.equal(ledger.rows.find(x=>x.id===id).verdict,'appropriate');
});
test('topic-only rescue retains correct current axes and never invents an Interaction',()=>{
 const candidate=p('C_topic0.4_M0.1');
 for(const x of raw.rows){const a=recallDecision(x.scores,p(currentId)),b=recallDecision(x.scores,candidate);
  if(a.topic||a.interaction)assert.deepEqual(a,b);assert.equal(a.interaction,b.interaction);
 }
 const t='大好きだよ、ママの宝物だよ';assert.equal(out(t,'T0.4_I0.5_M0.05').topic,'hug');assert.equal(out(t,'C_topic0.4_M0.1').topic,null);
});
test('real 43.64% sleepy observation is rescued with sufficient margin',()=>{
 const x=raw.rows.find(x=>x.text==='うとうとしているね');assert.ok(x.scores.topic.probability>.43&&x.scores.topic.probability<.44);
 assert.equal(out(x.text,currentId).topic,null);assert.equal(out(x.text,'C_topic0.4_M0.1').topic,'sleep');
});
test('10-point rescue margin removes ordinary weather fabrication but rescues known sleep paraphrase',()=>{
 const sky=reference.rows.find(x=>x.text==='お外の景色が見えるね'),sleep=reference.rows.find(x=>x.text==='ぐっすり寝てるね');
 assert.equal(recallDecision(sky.scores,p('C_topic0.4_M0.05')).topic,'sun');assert.equal(recallDecision(sky.scores,p('C_topic0.4_M0.1')).topic,null);
 assert.equal(recallDecision(sleep.scores,p('C_topic0.4_M0.1')).topic,'sleep');
});
test('every unique selected first English has an explicit unapproved review',()=>{
 const keys=ledger.rows.map(x=>x.id+'\0'+x.english);assert.equal(new Set(keys).size,keys.length);assert.equal(keys.length,217);
 for(const x of pred.rows)for(const o of x.outcomes)assert.ok(keys.includes(x.id+'\0'+o.english));
 for(const m of Object.values(result.metrics))for(const s of Object.values(m)){assert.equal(s.english.unreviewed,0);assert.equal(s.english.undecidable,0);assert.equal(s.english.human_approved,0);}
});
test('unknown reviews are missing evidence, never zero loss or a false break-even',()=>{
 const bad={ordinary:{n:1,unreviewed:1,undecidable:0}};
 assert.equal(expectedLoss(bad,{ordinary:1}),null);assert.equal(breakEvenAbsence(bad,bad).status,'incomplete_review');
});
test('weighting with zero negative prevalence still improves ordinary recall',()=>{
 const a=result.metrics[currentId],b=result.metrics['C_topic0.4_M0.1'];
 assert.deepEqual([a.ordinary.english.generic_miss,b.ordinary.english.generic_miss],[8,6]);
 assert.equal(a.ordinary.english.off_topic,b.ordinary.english.off_topic);
 const e=x=>Object.fromEntries(['ordinary','routine_context','plausible_absence'].map(s=>[s,x[s].english]));
 assert.ok(expectedLoss(e(b),ordinaryWeights(0,.1),5)<expectedLoss(e(a),ordinaryWeights(0,.1),5));
});
test('reference mixture and error costs can reverse unguarded 40%, without a zero-error veto',()=>{
 const s=mixture.scenarios.find(x=>x.retrospective_reference_share_within_ordinary===1&&x.absence_assumption===.05&&x.routine_assumption===.1&&x.badCost===10&&x.minorCost===.25);
 assert.ok(s.outcomes.find(x=>x.policy==='C_topic0.4_M0.05').expected_loss_delta>0);
 assert.ok(s.outcomes.find(x=>x.policy==='C_topic0.4_M0.1').expected_loss_delta<0);
 assert.equal(mixture.scenarios.length,960);assert.ok(mixture.scenarios.every(x=>!x.best_policies.includes(currentId)));
});
test('all 42 policy outputs recompute from untouched raw scores and real reply selection',()=>{
 for(const x of raw.rows)for(const policy of policies){const a=recallDecision(x.scores,policy),r=responseFor(a,x.text),v=out(x.text,policy.id);assert.equal(v.topic,a.topic);assert.equal(v.interaction,a.interaction);assert.equal(v.english,r.english);}
});
test('Mac Native candidate keeps the same final Topic for all 202 examples',async()=>{
 const android=await json('android-comparison.json'),candidate=android.records.find(x=>x.policy==='C_topic0.4_M0.1');
 assert.equal(candidate.n,202);assert.equal(candidate.token_mismatches,0);assert.equal(candidate.topic_differences,0);
 assert.equal(android.status,'MAC_NATIVE_JVM_NOT_ANDROID_DEVICE');
});
