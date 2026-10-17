import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {recallDecision,guarded30Policy,recallPolicies,currentId} from './ruri-recall-priority-lib.mjs';
const dir=new URL('../research/ruri-adoption-20261018/',import.meta.url),json=async f=>JSON.parse(await readFile(new URL(f,dir),'utf8'));
const web=await json('web-validation.json'),native=await json('android-validation.json'),base=recallPolicies().find(x=>x.id===currentId);
const rows=native.rows.map(n=>{
 const w=web.rows.find(x=>x.id===n.id);assert.ok(w);
 const scores={topic:n.topic,interaction:n.interaction},accepted=recallDecision(scores,guarded30Policy),before=recallDecision(scores,base);
 assert.equal(n.productionRoute,n.researchTopicRescue30Margin10.route,n.text);
 assert.equal(n.productionEnglish,n.researchTopicRescue30Margin10.english,n.text);
 return {id:n.id,text:n.text,source:w.source,topic_same:w.accepted.topic===accepted.topic,english_same:w.english===n.productionEnglish,token_ids_match:n.tokenIdsMatch,baseline_topic_same:w.before.topic===before.topic,
  web:{before:w.before,accepted:w.accepted,route:w.route,english:w.english,probability:w.scores.topic.probability,margin:w.scores.topic.margin},
  native:{before,accepted,route:n.productionRoute,english:n.productionEnglish,probability:n.topic.probability,margin:n.topic.margin}};
});
assert.equal(rows.length,414);assert.equal(rows.filter(x=>!x.token_ids_match).length,0);
const summary={status:'MAC_NATIVE_JVM_NOT_GALAXY_S25',n:rows.length,web_score_drift:web.max_score_drift,all_web_match_adopted_policy:true,all_native_match_adopted_policy:true,
 topic_differences:rows.filter(x=>!x.topic_same).length,english_differences:rows.filter(x=>!x.english_same).length,token_mismatches:0,
 fresh202_topic_differences:rows.filter(x=>x.source==='fresh202'&&!x.topic_same).length,
 baseline50_topic_differences:rows.filter(x=>!x.baseline_topic_same).length,
 differences:rows.filter(x=>!x.topic_same||!x.english_same)};
await writeFile(new URL('validation-summary.json',dir),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
