// Paired sensitivity analysis. Unknown actual usage frequencies are never filled
// from the synthetic case counts. Changed English is explicitly reviewed.
import {readFile,writeFile} from 'node:fs/promises';
import {recallPolicies,recallDecision,responseFor,currentId,expectedLoss,ordinaryWeights} from './ruri-recall-priority-lib.mjs';
const dir=new URL('../research/ruri-recall-priority-20261017/',import.meta.url),json=async f=>JSON.parse(await readFile(new URL(f,dir),'utf8'));
const old=JSON.parse(await readFile(new URL('../research/ruri-reevaluation-20261017/raw-scores.json',import.meta.url),'utf8'));
const fresh=await json('comparison.json'),policies=recallPolicies(),base=policies.find(p=>p.id===currentId),review=(await json('reference-english-review.json')).rows;
const seen=new Set(),reference=[];
for(const x of old.rows){
 if(x.source==='legacy67'&&x.category==='negative'||x.source==='new150'&&(!x.score_topic||!x.score_interaction)||seen.has(x.text))continue;
 seen.add(x.text);
 reference.push({...x,base:{...recallDecision(x.scores,base),...responseFor(recallDecision(x.scores,base),x.text)},outputs:policies.map(p=>{const axes=recallDecision(x.scores,p),r=responseFor(axes,x.text);return {policy:p.id,...axes,route:r.scene,english:r.english};})});
}
function cost(v,badCost,minorCost){
 if(v==='appropriate')return 0;
 if(v==='generic_miss')return 1;
 if(v==='minor_mismatch')return minorCost;
 if(['off_topic','unsupported_claim','contradiction'].includes(v))return badCost;
 return null;
}
const changes=policies.map(p=>({policy:p.id,n:reference.length,rows:reference.flatMap(x=>{
 const a=x.outputs.find(v=>v.policy===p.id);if(a.english===x.base.english)return [];
 const r0=review.find(v=>v.id===x.id&&v.english===x.base.english),r1=review.find(v=>v.id===x.id&&v.english===a.english);
 if(!r0||!r1)throw Error('Changed reference pair not reviewed: '+x.id+' '+p.id);
 return [{id:x.id,text:x.text,before:x.base.english,after:a.english,before_verdict:r0.verdict,after_verdict:r1.verdict}];
})}));
const referenceDelta=(p,badCost,minorCost)=>changes.find(x=>x.policy===p).rows.reduce((s,x)=>s+cost(x.after_verdict,badCost,minorCost)-cost(x.before_verdict,badCost,minorCost),0)/reference.length;
const englishByPolicy=Object.fromEntries(policies.map(p=>[p.id,Object.fromEntries(['ordinary','routine_context','plausible_absence'].map(s=>[s,fresh.metrics[p.id][s].english]))]));
const mixtures=[];
for(const mix of [0,.25,.5,.75,1])for(const absence of [0,.01,.03,.05,.10,.20])for(const routine of [0,.05,.10,.20])for(const badCost of [1,2,5,10])for(const minorCost of [.25,.5]){
 const weights=ordinaryWeights(absence,routine),b=englishByPolicy[currentId],outcomes=policies.map(p=>{
  const a=englishByPolicy[p.id];let delta=0;
  for(const [s,w] of Object.entries(weights)){
   if(s==='ordinary')delta+=w*((1-mix)*(expectedLoss(a,{ordinary:1},badCost,minorCost)-expectedLoss(b,{ordinary:1},badCost,minorCost))+mix*referenceDelta(p.id,badCost,minorCost));
   else delta+=w*(expectedLoss(a,{[s]:1},badCost,minorCost)-expectedLoss(b,{[s]:1},badCost,minorCost));
  }
  return {policy:p.id,expected_loss_delta:delta};
 }).sort((a,b)=>a.expected_loss_delta-b.expected_loss_delta||a.policy.localeCompare(b.policy));
 const best=outcomes[0].expected_loss_delta;
 mixtures.push({retrospective_reference_share_within_ordinary:mix,absence_assumption:absence,routine_assumption:routine,badCost,minorCost,best_policies:outcomes.filter(x=>Math.abs(x.expected_loss_delta-best)<1e-12).map(x=>x.policy),outcomes});
}
const budgets=[];
for(const absence of [0,.01,.03,.05,.10,.20])for(const policy of ['C_topic0.45_M0.05','C_topic0.4_M0.05','C_topic0.4_M0.1'])for(const badCost of [1,2,5,10]){
 const weights=ordinaryWeights(absence,.1),baseLoss=expectedLoss(englishByPolicy[currentId],weights,badCost,.25),candidateLoss=expectedLoss(englishByPolicy[policy],weights,badCost,.25),gain=baseLoss-candidateLoss;
 budgets.push({policy,absence_assumption:absence,routine_assumption:.1,badCost,gain_per_1000:1000*gain,additional_bad_events_per_1000_at_break_even:1000*gain/badCost,note:'Conservative: each extra bad event costs badCost relative to an otherwise appropriate baseline. This is a hypothetical rate, NOT an estimated occurrence rate.'});
}
const sentinels=policies.filter(p=>p.margin===.05).map(p=>({policy:p.id,rows:old.rows.filter(x=>x.source==='new150'&&['new073','new085'].includes(x.id)).map(x=>({id:x.id,text:x.text,before:responseFor(recallDecision(x.scores,base),x.text).english,after:responseFor(recallDecision(x.scores,p),x.text).english,changed:responseFor(recallDecision(x.scores,base),x.text).english!==responseFor(recallDecision(x.scores,p),x.text).english}))}));
await writeFile(new URL('reference-ordinary.json',dir),JSON.stringify({status:'RETROSPECTIVE_REFERENCE_NOT_FRESH_VALIDATION',selection:'All legacy67 non-negative-category cases + prior150 single-label cases, exact texts deduplicated; no outcome-based filtering.',rows:reference},null,2)+'\n');
await writeFile(new URL('reference-paired-changes.json',dir),JSON.stringify({status:'PROVISIONAL_REVIEWED_PAIRED_DIFFERENCES_NOT_ABSOLUTE_ACCURACY',changes},null,2)+'\n');
await writeFile(new URL('sampling-cost-sensitivity.json',dir),JSON.stringify({status:'ASSUMPTION_SCENARIOS_NOT_MEASURED_PREVALENCE',unit:'expected loss relative to baseline, one missed useful response = 1',reference_n:reference.length,scenarios:mixtures},null,2)+'\n');
await writeFile(new URL('additional-error-budget.json',dir),JSON.stringify({status:'HYPOTHETICAL_BREAK_EVEN_NOT_RATE_ESTIMATE',budgets,sentinels},null,2)+'\n');
console.log(JSON.stringify({reference_n:reference.length,mixture_scenarios:mixtures.length,baseline_never_best:mixtures.every(x=>!x.best_policies.includes(currentId)),default_slices:mixtures.filter(x=>x.absence_assumption===.05&&x.routine_assumption===.1&&x.minorCost===.25).map(x=>({mix:x.retrospective_reference_share_within_ordinary,badCost:x.badCost,best:x.best_policies,selected:x.outcomes.filter(v=>['C_topic0.4_M0.05','C_topic0.45_M0.05',currentId].includes(v.policy))}))},null,2));
