// Research only. This module is never imported by the product.
import {LiteResponseEngine} from '../src/lite-response-engine.js';
export const interactionLabels=['affection','praise','achievement','effort','encouragement','invitation','start','finish','finish_check','care','inquiry','reassurance','repeat','pause','none'];
export const baselinePolicy={id:'A50_m05',mode:'uniform',topic:0.5,interaction:0.5,margin:0.05};
export function accept(s,p,m,ignored){return s.rawId!==ignored&&s.probability>=p&&s.margin>=m?s.rawId:null;}
export function decide(scores,p){
 const base={topic:accept(scores.topic,.5,.05,'generic'),interaction:accept(scores.interaction,.5,0,'none')};
 if(p.mode==='uniform'||p.mode==='per_topic')return {topic:accept(scores.topic,p.thresholds?.[scores.topic.rawId]??p.topic,p.margin,'generic'),interaction:accept(scores.interaction,p.interaction,0,'none')};
 if(!base.topic&&!base.interaction)return {topic:accept(scores.topic,p.topic,p.margin,'generic'),interaction:accept(scores.interaction,p.interaction,0,'none')};
 if(p.mode==='topic_rescue'&&!base.topic&&base.interaction&&scores.interaction.probability>=.60)
  return {...base,topic:accept(scores.topic,p.topic,Math.max(.10,p.margin),'generic')};
 return base;
}
export function policies(thresholds){
 const out=[baselinePolicy];
 for(const margin of [0,.02,.05,.10])for(const t of [.45,.40,.35,.30])out.push({id:`B${t}_m${margin}`,mode:'uniform',topic:t,interaction:t,margin});
 for(const margin of [0,.02,.05,.10])for(const t of [.45,.40])for(const mode of ['both_generic','topic_rescue'])out.push({id:`${mode==='both_generic'?'C':'D'}${t}_m${margin}`,mode,topic:t,interaction:t,margin});
 out.push({id:'E_per_topic_m05',mode:'per_topic',topic:.5,interaction:.5,margin:.05,thresholds});
 return out;
}
export function responseFor(axes,text,engine=new LiteResponseEngine()){
 // Policy already selected axes from untouched real scores. Project selected
 // labels into the unchanged downstream engine; 1/1 here is an adapter sentinel,
 // NEVER a model score. Product acceptance constants remain unchanged.
 return engine.respondRuri(text,'',{id:axes.topic??'generic',probability:1,margin:1},{id:axes.interaction??'none',probability:1,margin:1},true);
}
export function summarize(rows,policy,ledger=[]){
 const n=rows.length, pred=x=>decide(x.scores,policy),base=x=>decide(x.scores,baselinePolicy);
 const result={n,policy:policy.id};
 for(const axis of ['topic','interaction']){
  const eligible=rows.filter(x=>x[`score_${axis}`]!==false),positive=eligible.filter(x=>x[`expected_${axis}`]!==null);
  const correct=x=>pred(x)[axis]===x[`expected_${axis}`],wasCorrect=x=>base(x)[axis]===x[`expected_${axis}`];
  result[axis]={denominator:eligible.length,positive_denominator:positive.length,exact:eligible.filter(correct).length,correct_adopted:positive.filter(correct).length,correct_adoption_rate:positive.length?positive.filter(correct).length/positive.length:null,misses:positive.filter(x=>pred(x)[axis]===null).length,wrong_adopted:eligible.filter(x=>pred(x)[axis]!==null&&!correct(x)).length,gains:eligible.filter(x=>!wasCorrect(x)&&correct(x)).length,losses:eligible.filter(x=>wasCorrect(x)&&!correct(x)).length,new_wrong_adopted:eligible.filter(x=>pred(x)[axis]!==null&&!correct(x)&&pred(x)[axis]!==base(x)[axis]).length};
 }
 const joint=rows.filter(x=>x.score_topic!==false&&x.score_interaction!==false);
 result.joint_denominator=joint.length;result.joint_exact=joint.filter(x=>pred(x).topic===x.expected_topic&&pred(x).interaction===x.expected_interaction).length;
 result.joint_gains=joint.filter(x=>(base(x).topic!==x.expected_topic||base(x).interaction!==x.expected_interaction)&&pred(x).topic===x.expected_topic&&pred(x).interaction===x.expected_interaction).length;
 result.joint_losses=joint.filter(x=>base(x).topic===x.expected_topic&&base(x).interaction===x.expected_interaction&&(pred(x).topic!==x.expected_topic||pred(x).interaction!==x.expected_interaction)).length;
 result.both_generic=rows.filter(x=>!pred(x).topic&&!pred(x).interaction).length;
 result.interaction_only=rows.filter(x=>!pred(x).topic&&pred(x).interaction).length;
 result.both_generic_rate=n?result.both_generic/n:null;result.interaction_only_rate=n?result.interaction_only/n:null;
 result.rejection={probability_only:0,margin_only:0,both:0,raw_generic:0};
 for(const x of rows){const s=x.scores.topic,t=policy.thresholds?.[s.rawId]??policy.topic;
  if(s.rawId==='generic'){result.rejection.raw_generic++;continue;}
  const lp=s.probability<t,lm=s.margin<policy.margin;
  if(lp&&lm)result.rejection.both++;else if(lp)result.rejection.probability_only++;else if(lm)result.rejection.margin_only++;
 }
 result.rejection_note='Raw topic gate diagnostic; rescue eligibility and generic/none are separate. Final both-generic is counted above.';
 result.explicit_forbidden_topic_routes=rows.filter(x=>x.forbidden_topics?.includes(pred(x).topic)).length;
 // Counts only explicit per-input + exact-output reviews, never topic proxies.
 const review=(x,d)=>ledger.find(v=>v.id===x.id&&v.english===responseFor(d,x.text).english);
 const reviews=rows.map(x=>review(x,pred(x)));
 const audited=reviews.filter(x=>x&&typeof x.contradiction==='boolean');
 result.english_review={machine_provisional_reviewed:audited.length,unreviewed:n-audited.length,contradictions:audited.length?audited.filter(x=>x.contradiction).length:null,semantic_reversals:audited.length?audited.filter(x=>x.semantic_reversal).length:null,human_approved:audited.filter(x=>x.human_approved===true).length};
 const paired=rows.map(x=>({a:review(x,pred(x)),b:review(x,base(x))})).filter(x=>typeof x.a?.contradiction==='boolean'&&typeof x.b?.contradiction==='boolean');
 Object.assign(result.english_review,{paired_reviewed:paired.length,new_contradictions:paired.filter(x=>x.a.contradiction&&!x.b.contradiction).length,resolved_contradictions:paired.filter(x=>!x.a.contradiction&&x.b.contradiction).length});
 return result;
}
export function fitTopicThresholds(calibration,classes){
 const thresholds={},support={};
 for(const c of classes){const positive=calibration.filter(x=>x.score_topic!==false&&x.expected_topic===c);support[c]=positive.length;thresholds[c]=.5;
  // Predeclared conservative support gate. Do not tune classes on 1-4 examples.
  if(c==='generic'||positive.length<5)continue;
  let best=0;
  for(const t of [.45,.40,.35,.30]){const p={...baselinePolicy,mode:'per_topic',thresholds:{[c]:t}};let gain=0,bad=0;
   for(const x of calibration.filter(x=>x.score_topic!==false)){const a=decide(x.scores,p).topic,b=decide(x.scores,baselinePolicy).topic;
    if(a!==b&&a!==null){if(a===x.expected_topic)gain++;else bad++;}}
   if(!bad&&gain>best){best=gain;thresholds[c]=t;}
  }
 }
 return {thresholds,support,minimum_positive_support:5,note:'Provisional calibration labels only; insufficient support defaults to 0.50. No holdout or legacy labels used.'};
}
