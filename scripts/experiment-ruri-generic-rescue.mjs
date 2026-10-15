/**
 * RESEARCH ONLY: evaluate generic-only rescue on the actual, pinned Ruri ONNX.
 * Never changes production routing. Synthetic labels are not caregiver gold.
 * Run: node scripts/experiment-ruri-generic-rescue.mjs
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRuriTokenizer} from '../src/semantic/tokenize.js';
import {classifyEmbedding,decodeHead} from '../src/semantic/core.js';
import {selectRuriAxes} from '../src/interaction/ruri-routing.js';
import {LiteResponseEngine} from '../src/lite-response-engine.js';
import {Tokenizer,ort} from '../semantic-assets/runtime-ort1.30.0-tokenizers0.2.0/runtime.mjs';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const asset=join(root,'semantic-assets/ruri70-int8-bd500193');
const runtime=join(root,'semantic-assets/runtime-ort1.30.0-tokenizers0.2.0');
const config=JSON.parse(await readFile(join(asset,'heads-config.json'),'utf8'));
const qa=JSON.parse(await readFile(join(root,'research/interaction-ruri-qa-probes-20261013.json'),'utf8'));
const tokenizer=createRuriTokenizer(Tokenizer,
  JSON.parse(await readFile(join(asset,'tokenizer.json'),'utf8')),
  JSON.parse(await readFile(join(asset,'tokenizer_config.json'),'utf8')));
async function readHead(filename,definition) {
  const data=await readFile(join(asset,filename));
  return decodeHead(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),definition);
}
const topicHead=await readHead('head-topic.f32',config.heads.topic);
const labels=['affection','praise','achievement','effort','encouragement','invitation',
  'start','finish','finish_check','care','inquiry','reassurance','repeat','pause','none'];
const interactionHead=await readHead('head-interaction.f32',{shape:[15,385],classes:labels});

// Created from reported everyday failures, not verified gold. The "should"
// field is deliberately absent: a human must adjudicate any proposed mapping.
const fieldInspired=[
  '今日はご機嫌だね','ご機嫌だね','お機嫌だね','機嫌がいいね','ご機嫌ななめだね',
  '楽しそうだね','元気いっぱいだね','ニコニコしているね',
  'しゃっくりが出たね','しゃっくりしてるね','ひっくひっくしてるね','しゃっくり止まったかな',
  'さっくりしてるね','ミルク飲もうね','リルク飲もうね','みるくを飲もう',
  'おっぱい飲もうね','さっきミルク飲んだね',
  'シルクの洋服だね','泣いてはいないよ','寝返りしたね','くしゃみしたね','あくびが出たね',
].map((text,index)=>({id:'field-'+String(index+1).padStart(2,'0'),category:'field_inspired',text,
  expected_topic:null,expected_interaction:null,adjudicated:false}));
const contentRisk=[
  ['おてて冷たいね あっためようね','cold hands should not become good-morning greeting'],
  ['ミルクを飲んだら 少し休んでからお風呂に入ろうね','future bath must not be treated as current bath'],
  ['おむつ替えたらお散歩に行こうね','two-stage sequence must not be reduced to certain completion'],
  ['お外は雨が降っているから今日はおうちで一緒に遊ぼうね','rain outside, play indoors'],
  ['おむつを替えてからお気に入りのおもちゃで遊ぼうか','two-stage sequence'],
  ['ご機嫌ななめだね','negative mood is not smiling'],
  ['笑っていないみたいだね','negative smile'],
  ['泣いてはいないんだよ','not crying'],
  ['今は眠くないんだね','not sleepy'],
  ['しゃっくりが出たね','hiccup not burp'],
].map(([text,note],index)=>({id:'risk-'+index,category:'content_risk',text,
  expected_topic:null,expected_interaction:null,adjudicated:false,note}));


function accepted(score,p,minMargin,ignored) {
  return score.rawId!==ignored && score.probability>=p && score.margin>=minMargin ? score.rawId:null;
}
function baseline(scores) {
  // The runtime threshold is stricter than the head's internal margin only.
  return {
    topic:accepted(scores.topic,0.50,0.05,'generic'),
    interaction:accepted(scores.interaction,0.50,0,'none')
  };
}
function rescued(scores,threshold) {
  const original=baseline(scores);
  if(original.topic || original.interaction)return {...original,rescued:false};
  const topic=accepted(scores.topic,threshold.topic,threshold.margin,'generic');
  const interaction=accepted(scores.interaction,threshold.interaction,0,'none');
  return {topic,interaction,rescued:!!(topic||interaction)};
}
function metrics(rows,variant) {
  const subset=rows.filter(x=>x.category!=='field_inspired');
  const g=x=>!(x[variant].topic||x[variant].interaction);
  const baselineGeneric=subset.filter(x=>g({...x,[variant]:x.baseline})).length;
  const nowGeneric=subset.filter(g).length;
  const priorCorrect=subset.filter(x=>x.baseline.topic===x.expected_topic&&x.baseline.interaction===x.expected_interaction).length;
  const nowCorrect=subset.filter(x=>x[variant].topic===x.expected_topic&&x[variant].interaction===x.expected_interaction).length;
  const negative=subset.filter(x=>x.category==='negative'&&x.expected_topic===null&&x.expected_interaction===null);
  const falseAdded=negative.filter(x=>
    !(x.baseline.topic||x.baseline.interaction) && !!(x[variant].topic||x[variant].interaction)
  ).map(x=>({text:x.text,topic:x[variant].topic,interaction:x[variant].interaction}));
  return {qa_count:subset.length,baseline_generic:baselineGeneric,generic:nowGeneric,
    rescued:baselineGeneric-nowGeneric,baseline_exact:priorCorrect,exact:nowCorrect,
    full_negative_cases:negative.length,new_unwanted_negative_routes:falseAdded};
}

const scenarios=[
  {id:'baseline',topic:0.50,margin:0.05,interaction:0.50},
  ...[0.45,0.40,0.35,0.30,0.25].flatMap(topic=>
    [0.05,0.02].flatMap(margin=>
      [0.45,0.40].map(interaction=>({id:'t'+topic+'m'+margin+'i'+interaction,topic,margin,interaction}))))
];
const rows=[];
ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=runtime+'/';
const session=await ort.InferenceSession.create(new Uint8Array(await readFile(join(asset,'model.onnx'))),
  {executionProviders:['wasm'],graphOptimizationLevel:'all'});
try {
 for(const data of [...qa.cases,...fieldInspired,...contentRisk]) {
  const ids=tokenizer(data.text);
  const out=await session.run({
    input_ids:new ort.Tensor('int64',BigInt64Array.from(ids,BigInt),[1,ids.length]),
    attention_mask:new ort.Tensor('int64',BigInt64Array.from(ids,()=>1n),[1,ids.length])
  });
  try {
   const scores=classifyEmbedding(Array.from(out.sentence_embedding.data),
     {topic:topicHead,interaction:interactionHead},config.topic_thresholds);
   const row={id:data.id,category:data.category,text:data.text,
     expected_topic:data.expected_topic,expected_interaction:data.expected_interaction,
     topic_top:scores.topic.rawId,topic_top_p:+scores.topic.probability.toFixed(4),
     topic_margin:+scores.topic.margin.toFixed(4),
     topic_top2:scores.topic.candidates.map(x=>({id:x.id,p:+x.probability.toFixed(4)})),
     interaction_top:scores.interaction.rawId,interaction_top_p:+scores.interaction.probability.toFixed(4),
     interaction_top2:scores.interaction.candidates.map(x=>({id:x.id,p:+x.probability.toFixed(4)})),
     baseline:baseline(scores)};
   if(data.category==='content_risk'){
     const outcome=new LiteResponseEngine().respondRuri(data.text,'',scores.topic,scores.interaction,true);
     row.content_risk_note=data.note;
     row.baseline_selected_route=outcome.scene;
     row.baseline_selected_english=outcome.english;
     row.requires_human_meaning_review=true;
   }
   for(const scenario of scenarios) {
     if(scenario.id==='baseline')continue;
     row[scenario.id]=rescued(scores,scenario);
   }
   rows.push(row);
  } finally {for(const o of Object.values(out))o.dispose?.();}
 }
} finally {await session.release?.();}

const summary=scenarios.map(scenario=>{
 const name=scenario.id;
 const data=metrics(rows,name==='baseline'?'baseline':name);
 const fieldRows=rows.filter(x=>x.category==='field_inspired');
 return {...scenario,...data,field_generic:fieldRows.filter(x=>
  !(x[name==='baseline'?'baseline':name].topic || x[name==='baseline'?'baseline':name].interaction)).length};
}).sort((a,b)=>b.rescued-a.rescued || b.exact-a.exact);
const results={status:'RESEARCH_ONLY_UNADJUDICATED_SYNTHETIC_NOT_FOR_SHIPPING',
 source:'pinned Ruri v3 70M INT8; 67 pre-existing exploratory QA, everyday probes and content-risk prompts',
 warning:'No parent audio, ASR variants, independent gold, or S25 latencies were measured.',
 decisions:'Do not adopt a threshold on these cases alone; negative/false-claim review is mandatory.',
 cases:rows.length,scenarios:summary,rows};
await mkdir(join(root,'.semantic-parity'),{recursive:true});
const filename=join(root,'.semantic-parity/ruri-generic-rescue-sweep.json');
await writeFile(filename,JSON.stringify(results,null,2)+'\n');
console.log('GENERIC_RESCUE_SUMMARY '+JSON.stringify(summary));
console.log('FIELD_INSPIRED_BASELINE '+JSON.stringify(rows.filter(x=>x.category==='field_inspired').map(x=>({
 text:x.text,topic:x.topic_top,tp:x.topic_top_p,margin:x.topic_margin,
 interaction:x.interaction_top,ip:x.interaction_top_p,baseline:x.baseline
}))));
console.log('Unshipped experiment: '+filename);
