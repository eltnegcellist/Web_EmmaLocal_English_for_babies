import {readFile,writeFile} from 'node:fs/promises';
import {recallDecision,recallPolicies,currentId} from './ruri-recall-priority-lib.mjs';
const dir=new URL('../research/ruri-recall-priority-20261017/',import.meta.url),json=async f=>JSON.parse(await readFile(new URL(f,dir),'utf8'));
const native=await json('android-two-axes.json'),web=await json('predictions.json'),policies=recallPolicies();
const fields={[currentId]:null,'C_topic0.45_M0.05':'researchTopicRescue45','C_topic0.4_M0.05':'researchTopicRescue40','C_topic0.4_M0.1':'researchTopicRescue40Margin10'};
const records=Object.entries(fields).map(([id,field])=>{
 const p=policies.find(x=>x.id===id);
 const rows=native.rows.map(n=>{const w=web.rows.find(v=>v.id===n.id),expected=w.outcomes[w.indexByPolicy[id]],actual=field?n[field]:n,axes=recallDecision({topic:n.topic,interaction:n.interaction},p);return {id:n.id,text:n.text,stratum:w.stratum,tokenIdsMatch:n.tokenIdsMatch,web:expected,native:{...axes,route:actual.route,english:actual.english},english_same:actual.english===expected.english,topic_same:axes.topic===expected.topic,interaction_same:axes.interaction===expected.interaction};});
 return {policy:id,n:rows.length,token_mismatches:rows.filter(x=>!x.tokenIdsMatch).length,topic_differences:rows.filter(x=>!x.topic_same).length,interaction_differences:rows.filter(x=>!x.interaction_same).length,english_differences:rows.filter(x=>!x.english_same).length,rows};
});
const introduced=native.rows.filter(x=>x.researchTopicRescue40Margin10.english!==x.english).map(n=>({id:n.id,text:n.text,before:n.english,after:n.researchTopicRescue40Margin10.english,scores:{topic:n.topic,interaction:n.interaction}}));
await writeFile(new URL('android-comparison.json',dir),JSON.stringify({status:'MAC_NATIVE_JVM_NOT_ANDROID_DEVICE',records,proposed_native_changes:introduced},null,2)+'\n');
console.log(JSON.stringify({records:records.map(({rows,...s})=>s),introduced},null,2));
