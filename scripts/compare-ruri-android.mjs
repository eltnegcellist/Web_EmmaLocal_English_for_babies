import {readFile,writeFile} from 'node:fs/promises';
import {decide,baselinePolicy} from './ruri-reevaluation-lib.mjs';
const dir=new URL('../research/ruri-reevaluation-20261017/',import.meta.url),json=async f=>JSON.parse(await readFile(new URL(f,dir),'utf8'));
const native=await json('android-two-axes.json'),web=await json('predictions.json'),comparison=await json('comparison.json');
const drift={topic:0,interaction:0,topic_margin:0,interaction_margin:0};
const rows=native.rows.map(x=>{
 const w=web.rows.find(v=>v.source==='new150'&&v.id===x.id),scores={topic:x.topic,interaction:x.interaction},axes=decide(scores,baselinePolicy);
 for(const axis of ['topic','interaction']){drift[axis]=Math.max(drift[axis],Math.abs(x[axis].probability-w.scores[axis].probability));drift[axis+'_margin']=Math.max(drift[axis+'_margin'],Math.abs(x[axis].margin-w.scores[axis].margin));}
 return {id:x.id,text:x.text,tokenIdsMatch:x.tokenIdsMatch,web:w.outcomes[baselinePolicy.id],native:{...axes,route:x.route,english:x.english},topic_raw_same:x.topic.rawId===w.scores.topic.rawId,interaction_raw_same:x.interaction.rawId===w.scores.interaction.rawId,topic_adopted_same:axes.topic===w.outcomes[baselinePolicy.id].topic,interaction_adopted_same:axes.interaction===w.outcomes[baselinePolicy.id].interaction,english_same:x.english===w.outcomes[baselinePolicy.id].english};
});
const policyDifferences=comparison.policies.map(p=>({policy:p.id,topic_differences:native.rows.filter(x=>decide({topic:x.topic,interaction:x.interaction},p).topic!==decide(web.rows.find(w=>w.source==='new150'&&w.id===x.id).scores,p).topic).length,interaction_differences:native.rows.filter(x=>decide({topic:x.topic,interaction:x.interaction},p).interaction!==decide(web.rows.find(w=>w.source==='new150'&&w.id===x.id).scores,p).interaction).length}));
const summary={status:'MAC_JVM_NATIVE_VS_WEB_WASM_NOT_ANDROID_DEVICE',n:rows.length,tokenizer_mismatches:rows.filter(x=>!x.tokenIdsMatch).length,topic_raw_differences:rows.filter(x=>!x.topic_raw_same).length,interaction_raw_differences:rows.filter(x=>!x.interaction_raw_same).length,topic_adoption_differences:rows.filter(x=>!x.topic_adopted_same).length,interaction_adoption_differences:rows.filter(x=>!x.interaction_adopted_same).length,selected_english_differences:rows.filter(x=>!x.english_same).length,max_absolute_drift:drift,policyDifferences,rows};
await writeFile(new URL('android-comparison.json',dir),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({...summary,rows:undefined,policyDifferences:undefined},null,2));
