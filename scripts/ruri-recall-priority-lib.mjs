// Research only; no production imports this module.
import {baselinePolicy,decide,responseFor} from './ruri-reevaluation-lib.mjs';
export {responseFor};
export function recallPolicies() {
 const all=[];
 for(const margin of [.05,.10]){
  for(const topic of [.5,.45,.4,.35,.3])for(const interaction of [.5,.45,.4])
   all.push({id:`T${topic}_I${interaction}_M${margin}`,mode:'uniform',topic,interaction,margin});
  for(const topic of [.45,.4]){
   all.push({id:`C_topic${topic}_M${margin}`,mode:'both_generic',topic,interaction:.5,margin});
   all.push({id:`C_both${topic}_M${margin}`,mode:'both_generic',topic,interaction:topic,margin});
   all.push({id:`D_topic${topic}_M${margin}`,mode:'topic_rescue',topic,interaction:.5,margin});
  }
 }
 return all;
}
export const currentId='T0.5_I0.5_M0.05';
// Follow-up proposed by the user; kept separate from the frozen 42-policy study.
export const guarded30Policy=Object.freeze({id:'C_topic0.3_M0.1',mode:'both_generic',topic:.3,interaction:.5,margin:.1});
export const recallDecision=(scores,p)=>decide(scores,p);
export function retrievalMetrics(rows,p){
 const m={n:rows.length,topic_positive:0,topic_correct:0,topic_missed:0,topic_wrong:0,interaction_positive:0,interaction_correct:0,interaction_missed:0,interaction_wrong:0,joint_acceptable:0,both_generic:0,new_wrong_topics:0,gained_topics:0,lost_topics:0,changed:0};
 for(const x of rows){const a=decide(x.scores,p),b=decide(x.scores,baselinePolicy),ts=x.acceptable_topics??[x.expected_topic],is=x.acceptable_interactions??[x.expected_interaction];
  const tc=ts.includes(a.topic),bc=ts.includes(b.topic),ic=is.includes(a.interaction),positive=ts.some(v=>v!==null);
  if(positive){m.topic_positive++;if(a.topic===null)m.topic_missed++;else if(tc)m.topic_correct++;}
  if(a.topic!==null&&!tc)m.topic_wrong++;
  if(!is.includes(null)){m.interaction_positive++;if(a.interaction===null)m.interaction_missed++;else if(ic)m.interaction_correct++;}
  if(a.interaction!==null&&!ic)m.interaction_wrong++;
  if(tc&&ic)m.joint_acceptable++;
  if(!a.topic&&!a.interaction)m.both_generic++;
  if(a.topic!==b.topic||a.interaction!==b.interaction)m.changed++;
  if(a.topic!==b.topic&&a.topic!==null&&!tc)m.new_wrong_topics++;
  if(positive&&!bc&&tc&&a.topic!==null)m.gained_topics++;
  if(positive&&bc&&!tc)m.lost_topics++;
 }
 m.topic_recall=m.topic_positive?m.topic_correct/m.topic_positive:null;
 return m;
}
export function englishMetrics(rows,p,ledger){
 const found=rows.map(x=>{const axes=decide(x.scores,p),english=responseFor(axes,x.text).english;return ledger.find(v=>v.id===x.id&&v.english===english);});
 const counts={appropriate:0,generic_miss:0,minor_mismatch:0,unsupported_claim:0,contradiction:0,off_topic:0,undecidable:0,unreviewed:0};
 for(const v of found){if(!v||!Object.hasOwn(counts,v.verdict))counts.unreviewed++;else counts[v.verdict]++;}
 return {n:rows.length,...counts,human_approved:found.filter(x=>x?.human_approved).length};
}
export function expectedLoss(metrics,weights,badCost=2,minorCost=.25){
 let loss=0;
 for(const [stratum,w] of Object.entries(weights)){
  if(!w)continue;
  const m=metrics[stratum];
  if(!m||!m.n||m.unreviewed||m.undecidable)return null;
  loss+=w*(m.generic_miss+minorCost*m.minor_mismatch+badCost*(m.unsupported_claim+m.contradiction+m.off_topic))/m.n;
 }
 return loss;
}
export function ordinaryWeights(absence,routine){
 if(absence<0||routine<0||absence+routine>1)throw Error('Invalid scenario weights');
 return {ordinary:1-absence-routine,routine_context:routine,plausible_absence:absence};
}
export function breakEvenAbsence(base,candidate,{routine=.1,badCost=2,minorCost=.25}={}){
 // Exact linear mixture, not a fitted prevalence estimate. Positive delta means
 // candidate has higher expected loss. Cost ratios are user preference scenarios.
 const delta=q=>{const a=expectedLoss(candidate,ordinaryWeights(q,routine),badCost,minorCost),b=expectedLoss(base,ordinaryWeights(q,routine),badCost,minorCost);return a===null||b===null?NaN:a-b;};
 const intercept=delta(0),slope=delta(1-routine)-intercept;
 if(!Number.isFinite(intercept)||!Number.isFinite(slope))return {status:'incomplete_review'};
 if(Math.abs(slope)<1e-12)return {status:'constant',delta_at_zero:intercept,absence_fraction:null};
 const q=-(1-routine)*intercept/slope;
 return {status:q>=0&&q<=1-routine?'crossing':'no_crossing_in_range',delta_at_zero:intercept,absence_fraction:q,slope_per_unit_absence:slope/(1-routine)};
}
