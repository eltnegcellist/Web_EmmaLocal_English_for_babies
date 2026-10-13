// Build a reproducible, deliberately PROVISIONAL labeled classifier experiment.
// Real parent-speech frequency and independently adjudicated labels are NOT available here.
// Production certification requires reviewed examples and independent audio/ASR evaluation.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';

const taxonomy=JSON.parse(await readFile(new URL('../shared/interaction-taxonomy-draft.json',import.meta.url),'utf8'));
const contract=JSON.parse(await readFile(new URL('../shared/lite-topic-contract.json',import.meta.url),'utf8'));
const mixed=JSON.parse(await readFile(new URL('../shared/interaction-mixed-training-draft.json',import.meta.url),'utf8'));
const labels=taxonomy.labels.map(l=>l.id);
const items=[], seen=new Set();
const add=(label,text,family,split,source)=>{
  const norm=String(text||'').trim().normalize('NFKC');
  if(!norm)return;
  if(seen.has(norm))return;
  seen.add(norm);
  items.push({id:'p'+String(items.length+1).padStart(4,'0'),label,text:norm,family,split,source});
};
// The last four seed utterances were reserved as smoke holdouts in taxonomy.
// Two kept for dev, two for test; positive_seed reserved for train.
for(const x of taxonomy.labels) {
  x.positive_seed.forEach((text,i)=>add(x.id,text,x.id+':seed:'+i,'train','synthetic-verified-meaning-not-gold'));
  x.smoke_holdout.slice(0,2).forEach((text,i)=>add(x.id,text,x.id+':dev:'+i,'dev','synthetic-holdout-not-natural'));
  x.smoke_holdout.slice(2,4).forEach((text,i)=>add(x.id,text,x.id+':test:'+i,'test','synthetic-holdout-not-natural'));
}
// Compound utterances must be labeled for BOTH axes. A Topic word does
// not make the Interaction label 'none'. Last two examples per class are
// distinct dev/test smoke checks; this is still NOT independent natural ASR.
for (const [label,examples] of Object.entries(mixed.examples)) {
  if(!labels.includes(label) || examples.length<5)throw Error('Invalid compound labels: '+label);
  examples.forEach((value,i)=>add(
    label,value,'compound:'+label+':'+i,
    i===examples.length-1?'test':i===examples.length-2?'dev':'train',
    'synthetic-two-axis-not-independently-reviewed'
  ));
}
// Competing legacy topics must suppress false Interaction responses, but the current
// topic contract also includes intentionally generic praise examples ('かわいいね').
// We therefore only use explicit NON-generic legacy childcare topic examples.
const legacyCases=(contract.cases||[]).filter(c=>c&&typeof c==='object');
const exclusion=new Set([
  ...labels.flatMap(x=>taxonomy.labels.find(l=>l.id===x).positive_seed.concat(taxonomy.labels.find(l=>l.id===x).smoke_holdout)),
  ...Object.values(mixed.examples).flat()
].map(s=>s.trim().normalize('NFKC')));
const topicPool=[];
for(const c of legacyCases) {
  const text=c.text||c.utterance||c.input||c.japanese;
  const topic=c.scene||c.topic||c.expectedScene||c.expected_topic||c.expectedTopic||c.expected;
  if(typeof text!=='string'||!text.trim()||exclusion.has(text.trim().normalize('NFKC')))continue;
  if(!topic||topic==='generic'||topic==='none')continue;
  topicPool.push({text,topic});
}
for(const top of contract.topics||[]) {
  for(const text of top.examples||[]) if(!exclusion.has(text.trim().normalize('NFKC')))
    topicPool.push({text,topic:top.scene||top.id});
}
for(const [i,c] of topicPool.entries()) {
  // Deterministic source-index partition; labels are not empirically frequency-weighted.
  const h=parseInt(createHash('sha256').update(c.topic+'|'+c.text).digest('hex').slice(0,8),16)%10;
  add('none',c.text,'legacy:'+c.topic+':'+i,h<2?'test':h<4?'dev':'train','existing-childcare-topic');
}
const otherNone=[
  '眠いかな','眠いね','そろそろ眠たいね','起きたね','目が覚めたね','泣いてるね','泣いちゃったね','笑ったね','にこにこだね','暑いね','寒いね',
  'ミルク飲もうか','ミルク終わったね','おむつ終わったね','お風呂に入ろうか','絵本読もうか','おててを握ってるね',
  'こんにちは','ありがとう','おはよう','おやすみ','お腹すいたね','ばたばたしてるね','今日は雨だね','明日は晴れるね',
  '眠くないよ','泣いてないよ','笑ってないね','まだ起きてないよ','終わってないよ','まだおしまいじゃないよ','できなかったね','まだできないね',
  '暑くないね','寒くないね','今は違うよ','これは何','水を飲むかな','服を着ようね','歌が聞こえるね','お外を見ようね'
];
otherNone.forEach((s,i)=>add('none',s,'explicit-none:'+i,i%5===0?'test':i%5===1?'dev':'train','manual-negative-control'));
const counts=Object.fromEntries([...labels,'none'].map(l=>[l,Object.fromEntries(['train','dev','test'].map(s=>[s,items.filter(x=>x.label===l&&x.split===s).length]))]));
for(const [id,c] of Object.entries(counts))if(!c.train||!c.dev||!c.test)throw Error('No samples in split: '+id+JSON.stringify(c));
const duplicates=new Map();
for(const i of items) {
  const prev=duplicates.get(i.text);
  if(prev&&prev!==i.split)throw Error('Duplicate between splits: '+i.text);
  duplicates.set(i.text,i.split);
}
const out={schema_version:1,source:'Hand-crafted PR-A taxonomy + 98 Topic×Interaction utterances + existing topic contract; NOT field data',status:'experimental_provisional_no_independent_human_adjudication',split:'design seeds vs distinct synthetic smoke; not a true out-of-distribution benchmark',labels:[...labels,'none'],counts,items};
await mkdir('research/interaction-head',{recursive:true});
await writeFile('research/interaction-head/experimental-dataset.json',JSON.stringify(out,null,2)+'\n');
console.log('Provisional dataset:',items.length,'rows',JSON.stringify(counts));
