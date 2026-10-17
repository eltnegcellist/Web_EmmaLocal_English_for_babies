import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {guarded30Policy,recallPolicies,recallDecision,responseFor,currentId} from './ruri-recall-priority-lib.mjs';
const dir=new URL('../research/ruri-recall-priority-20261017/',import.meta.url),json=async f=>JSON.parse(await readFile(new URL(f,dir),'utf8'));
const raw=await json('raw-scores.json'),result=await json('guarded30-comparison.json'),base=recallPolicies().find(x=>x.id===currentId);
const old=JSON.parse(await readFile(new URL('../research/ruri-reevaluation-20261017/raw-scores.json',import.meta.url),'utf8'));
const reference=await json('reference-ordinary.json');
test('user proposal keeps every already accepted axis and Interaction unchanged on all real inputs',()=>{
 for(const x of [...raw.rows,...old.rows]){const a=recallDecision(x.scores,base),b=recallDecision(x.scores,guarded30Policy);
  assert.equal(b.interaction,a.interaction);if(a.topic||a.interaction)assert.deepEqual(b,a);
 }
});
test('30% and 10pt are inclusive and both baseline axes must abstain',()=>{
 const s={topic:{rawId:'hands',probability:.3,margin:.1},interaction:{rawId:'none',probability:.7,margin:.1}};
 assert.equal(recallDecision(s,guarded30Policy).topic,'hands');
 assert.equal(recallDecision({...s,topic:{...s.topic,probability:.299999}},guarded30Policy).topic,null);
 assert.equal(recallDecision({...s,topic:{...s.topic,margin:.099999}},guarded30Policy).topic,null);
 assert.equal(recallDecision({...s,topic:{...s.topic,rawId:'generic'}},guarded30Policy).topic,null);
 const acceptedI={...s,interaction:{rawId:'affection',probability:.5,margin:0}};
 assert.deepEqual(recallDecision(acceptedI,guarded30Policy),{topic:null,interaction:'affection'});
 // The normal 50% decision still uses its original 5pt margin.
 assert.equal(recallDecision({...s,topic:{rawId:'hands',probability:.5,margin:.05}},guarded30Policy).topic,'hands');
});
test('ordinary170 gains three correct Topics without additional wrong Topics',()=>{
 const a=result.fresh.find(x=>x.policy===currentId).metrics.ordinary,b=result.fresh.find(x=>x.policy===guarded30Policy.id).metrics.ordinary;
 assert.deepEqual([a.retrieval.topic_correct,b.retrieval.topic_correct],[125,128]);
 assert.deepEqual([a.retrieval.topic_wrong,b.retrieval.topic_wrong],[4,4]);
 assert.deepEqual([a.english.generic_miss,b.english.generic_miss],[8,5]);
 assert.equal(b.english.unreviewed,0);assert.equal(b.english.human_approved,0);
});
test('new hands paraphrase and two retrospective paraphrases improve beyond guarded40',()=>{
 const f=result.fresh.find(x=>x.policy===guarded30Policy.id),r=result.reference.find(x=>x.policy===guarded30Policy.id);
 assert.deepEqual(f.changes_vs40.map(x=>x.text),['おててをぱあにしてみようね']);
 assert.deepEqual(r.changes_vs40.map(x=>x.text),['お口がにこっとしたね','あんよをばたばたさせてるね']);
 assert.ok([...f.changes_vs40,...r.changes_vs40].every(x=>x.after_verdict==='appropriate'));
});
test('accepted affection and low-margin sunshine remain protected',()=>{
 const affection=raw.rows.find(x=>x.text==='大好きだよ、ママの宝物だよ');
 assert.equal(recallDecision(affection.scores,guarded30Policy).topic,null);
 assert.equal(recallDecision(reference.rows.find(x=>x.text==='お外の景色が見えるね').scores,guarded30Policy).topic,null);
});
test('known new unsupported crying and smile reversal stay visible as failures',()=>{
 const risks=result.additional_stress.find(x=>x.policy===guarded30Policy.id).changes_vs40;
 const mom=risks.find(x=>x.text==='ママが寝不足だね'),smile=risks.find(x=>x.text==='笑っていないみたいだね');
 assert.equal(mom.after.topic,'cry');assert.ok(mom.after.english.startsWith('I hear you crying.'));
 assert.equal(smile.after.topic,'smile');assert.ok(smile.after.english.startsWith('What a smile!'));
 assert.equal(mom.after_verdict,'unsupported_claim');assert.equal(smile.after_verdict,'contradiction');
 assert.equal(mom.human_approved,false);
});
test('fresh saved changes reproduce actual unchanged Web reply selection',()=>{
 for(const p of result.fresh)for(const x of raw.rows){const axes=recallDecision(x.scores,result.policies.find(v=>v.id===p.policy)),r=responseFor(axes,x.text);
  const change=p.changes_vs50.find(v=>v.id===x.id);if(change)assert.equal(change.after.english,r.english);
 }
});
test('Mac Native compares all202 using actual 30% Android reply engine output',()=>{
 assert.equal(result.android.status,'MAC_NATIVE_JVM_NOT_ANDROID_DEVICE');assert.equal(result.android.n,202);
 assert.equal(result.android.topic_differences,0);assert.equal(result.android.token_mismatches,0);
});
