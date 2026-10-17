// Run after the real ONNX and learned-head experiments. Tests safeguard the
// research conclusions; known product meaning errors are NOT marked resolved.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decide,baselinePolicy,responseFor} from './ruri-reevaluation-lib.mjs';
const dir=new URL('../research/ruri-reevaluation-20261017/',import.meta.url),json=async f=>JSON.parse(await readFile(new URL(f,dir),'utf8'));
const raw=await json('raw-scores.json'),c=await json('comparison.json'),pred=await json('predictions.json'),learned=await json('head-evaluation.json'),train=await json('head-training.json'),data=await json('evaluation.json'),review=await json('english-meaning-review.json');
const find=text=>raw.rows.find(x=>x.source==='new150'&&x.text===text),policy=id=>c.policies.find(x=>x.id===id);
test('exact model and production routing fingerprints match measured artifacts',async()=>{
 for(const f of ['head-topic.f32','head-interaction.f32'])assert.equal(createHash('sha256').update(await readFile(new URL('../semantic-assets/ruri70-int8-bd500193/'+f,import.meta.url))).digest('hex'),raw.metadata.hashes[f]);
 assert.equal(createHash('sha256').update(await readFile(new URL('../src/interaction/ruri-routing.js',import.meta.url))).digest('hex'),raw.metadata.hashes['src/interaction/ruri-routing.js']);
 assert.equal(raw.metadata.labels.topic.length,22);assert.equal(raw.metadata.labels.interaction.length,15);
});
test('legacy67 observed results reproduce the prior report',()=>{
 const m=c.summaries.legacy67[0];assert.deepEqual([m.n,m.topic.exact,m.interaction.exact,m.joint_exact],[67,63,59,56]);
});
test('real sleep paraphrase rejected by probability, not margin',()=>{
 const x=find('ぐっすり寝てるね');assert.ok(Math.abs(x.scores.topic.probability-.45184531619496915)<1e-7);
 assert.ok(x.scores.topic.margin>.32);assert.equal(x.scores.topic.rawId,'sleep');
 assert.equal(decide(x.scores,baselinePolicy).topic,null);assert.equal(decide(x.scores,policy('C0.45_m0.05')).topic,'sleep');
 assert.equal(decide(find('寝てるね').scores,baselinePolicy).topic,'sleep');
});
test('threshold rescue exposes a NEW negated voice assertion and is not safe to ship',()=>{
 const x=pred.rows.find(x=>x.id==='new085');assert.equal(x.outcomes.A50_m05.route,'generic');
 assert.equal(x.outcomes['C0.45_m0.05'].english,"I hear your voice! Tell me more. I'm listening!");
 const r=review.rows.find(v=>v.id===x.id&&v.english===x.outcomes['C0.45_m0.05'].english);assert.equal(r.contradiction,true);assert.equal(r.human_approved,false);
 assert.ok(c.summaries.independent_new_holdout.find(x=>x.policy==='C0.45_m0.05').english_review.new_contradictions>0);
});
test('six required safety inputs retain actual selected English and repeated history',async()=>{
 const trace=await json('critical-repeated-replies.json');assert.equal(new Set(trace.rows.map(x=>x.text)).size,6);
 assert.equal(trace.rows.length,30);assert.ok(trace.rows.every(x=>x.turns.length===20));
 const cry=trace.rows.find(x=>x.text==='泣いてはいないんだよ'&&x.policy==='A50_m05');
 assert.equal(cry.turns[0].english,"I hear you crying. I'm right here. Come for a cuddle.");
 const bath=trace.rows.find(x=>x.text==='ミルクを飲んだらお風呂に入ろうね'&&x.policy==='A50_m05');
 assert.ok(bath.turns.some(x=>x.english==="We're taking a bath. Listen to the water. Splash, splash!"));
});
test('new data, training and legacy remain separate and ambiguity is excluded',async()=>{
 assert.ok(data.cases.length>=100);assert.equal(new Set(data.cases.map(x=>x.text)).size,data.cases.length);
 const old=new Set(raw.rows.filter(x=>x.source==='legacy67').map(x=>x.text));
 assert.ok(train.cases.every(x=>!old.has(x.text)&&!data.cases.some(y=>y.text===x.text)));
 const excluded=await json('family-exclusions.json');assert.equal(excluded.rows.length,7);
 assert.ok(excluded.rows.every(x=>!train.cases.some(y=>y.text===x.text)));
 const families=new Set(train.cases.filter(x=>x.split==='train').map(x=>x.family));
 assert.ok(train.cases.filter(x=>x.split==='development').every(x=>!families.has(x.family)));
 const cal=new Set(data.cases.filter(x=>x.split==='calibration').map(x=>x.family));
 assert.ok(data.cases.filter(x=>x.split==='holdout').every(x=>!cal.has(x.family)));
 assert.equal(c.summaries.new150[0].topic.denominator,data.cases.filter(x=>x.score_topic).length);
 assert.equal(c.metadata.subsets.independent_new_holdout,124);
 assert.ok(data.cases.every(x=>!x.adjudicated));
});
test('class tables include every label and unsupported per-topic tuning stays at 50%',()=>{
 assert.equal(Object.keys(c.classImpact.topic).length,22);assert.equal(Object.keys(c.classImpact.interaction).length,15);
 assert.ok(Object.values(c.per_topic_calibration.support).every(x=>x<5));assert.ok(Object.values(c.per_topic_calibration.thresholds).every(x=>x===.5));
});
test('learned head dev improvement does not conceal held-out regression',()=>{
 const a=c.summaries.independent_new_holdout[0],b=learned.summaries.independent_new_holdout;
 assert.ok(b.joint_exact<a.joint_exact);assert.ok(b.topic.losses>0);assert.equal(learned.selection.human_adjudicated_training,0);
});
test('all policy summaries are recomputable from stored full-precision scores',()=>{
 for(const x of raw.rows)for(const p of c.policies){const actual=pred.rows.find(v=>v.id===x.id).outcomes[p.id],axes=decide(x.scores,p);assert.equal(actual.topic,axes.topic);assert.equal(actual.interaction,axes.interaction);assert.equal(actual.english,responseFor(axes,x.text).english);}
});
test('native comparison records observed failure without claiming device parity',async()=>{
 const parity=await json('android-topic-parity.json'),both=await json('android-comparison.json');
 assert.equal(parity.caseCount,150);assert.ok(parity.failures.length>0);assert.equal(both.tokenizer_mismatches,0);assert.equal(both.selected_english_differences,2);
});
test('unknown English reviews are not reported as zero contradictions',()=>{
 assert.ok(c.summaries.new150[0].english_review.unreviewed>0);assert.equal(c.summaries.new150[0].english_review.human_approved,0);
});
