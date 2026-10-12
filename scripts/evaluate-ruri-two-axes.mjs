// Non-blocking actual-ONNX diagnosis. Synthetic prompts are hand-selected
// and do NOT constitute independent field accuracy or human gold labels.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRuriTokenizer} from '../src/semantic/tokenize.js';
import {classifyEmbedding,decodeHead} from '../src/semantic/core.js';
import {selectRuriAxes,combinedCandidates} from '../src/interaction/ruri-routing.js';
import {Tokenizer,ort} from '../semantic-assets/runtime-ort1.30.0-tokenizers0.2.0/runtime.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const asset=join(root,'semantic-assets/ruri70-int8-bd500193');
const runtime=join(root,'semantic-assets/runtime-ort1.30.0-tokenizers0.2.0');
const cfg=JSON.parse(await readFile(join(asset,'heads-config.json'),'utf8'));
const tokenizer=createRuriTokenizer(Tokenizer,JSON.parse(await readFile(join(asset,'tokenizer.json'),'utf8')),JSON.parse(await readFile(join(asset,'tokenizer_config.json'),'utf8')));
async function readHead(filename,settings){const b=await readFile(join(asset,filename));return decodeHead(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),settings)}
const topic=await readHead('head-topic.f32',cfg.heads.topic);
const labels=['affection','praise','achievement','effort','encouragement','invitation','start','finish','finish_check','care','inquiry','reassurance','repeat','pause','none'];
const interaction=await readHead('head-interaction.f32',{shape:[15,385],classes:labels});
const expectedSmokeRoutes = new Map([
 ['かわいいね','interaction:affection'],
 ['よくできたね','interaction:praise'],
 ['頑張ってるね','interaction:effort'],
 ['ミルクを上手に飲めたね','combined:milk:praise'],
 ['ミルク飲もうか','combined:milk:invitation'],
 ['ミルク終わったかな','combined:milk:finish_check'],
 ['おむつ替え終わったかな','combined:diaper:finish_check'],
 ['絵本読もうか','combined:book:invitation'],
 ['泣いてるね、大丈夫だよ','combined:cry:reassurance'],
 ['できなかったね','generic'],
 ['眠くないね','generic'],
 ['もう一回','interaction:repeat']
]);
const cases=[
'かわいいね','よくできたね','できたね','頑張ってるね','頑張ってね','どうしたの？','大丈夫？','大丈夫だよ','お疲れさま',
'ミルク飲もうか','ミルクを上手に飲めたね','ミルク終わったかな','おむつ替え終わったね','おむつ替え終わったかな',
'お風呂入ろうか','絵本読もうか','歌をもう一回','泣いてるね、大丈夫だよ','雨が降ってきたね','おててを動かしたね',
'まだ終わってないね','できなかったね','眠くないね','笑ったね','眠いかな','起きたね','ただいま',
'今日はいい天気だね','もう一回','ちょっと待ってね','寝返りできたね','ミルク'
];
// Pinned actual-model guard cases. These are a small synthetic regression suite,
// not an unbiased estimate of speech recognition quality.
const expectedRoutes=new Map([
  ['かわいいね','interaction:affection'],
  ['よくできたね','interaction:praise'],
  ['できたね','interaction:achievement'],
  ['頑張ってるね','interaction:effort'],
  ['大丈夫？','interaction:inquiry'],
  ['ミルク飲もうか','combined:milk:invitation'],
  ['ミルクを上手に飲めたね','combined:milk:praise'],
  ['ミルク終わったかな','combined:milk:finish_check'],
  ['おむつ替え終わったね','combined:diaper:finish'],
  ['おむつ替え終わったかな','combined:diaper:finish_check'],
  ['絵本読もうか','combined:book:invitation'],
  ['泣いてるね、大丈夫だよ','combined:cry:reassurance'],
  ['まだ終わってないね','generic'],
  ['できなかったね','generic'],
  ['眠くないね','generic'],
  ['笑ったね','smile'],
  ['眠いかな','sleep']
]);
let guarded=0;
ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=runtime+'/';
const session=await ort.InferenceSession.create(new Uint8Array(await readFile(join(asset,'model.onnx'))),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
try {
 for(const text of cases){
  const ids=tokenizer(text),ids64=BigInt64Array.from(ids,BigInt),mask=BigInt64Array.from(ids,()=>1n);
  const out=await session.run({input_ids:new ort.Tensor('int64',ids64,[1,ids.length]),attention_mask:new ort.Tensor('int64',mask,[1,ids.length])});
  try{
   const embedding=Array.from(out.sentence_embedding.data);
   const scores=classifyEmbedding(embedding,{topic,interaction},cfg.topic_thresholds);
   const axes=selectRuriAxes(scores.topic,scores.interaction,true);
   const paired=!!(axes.topic&&axes.interaction&&combinedCandidates(axes.topic,axes.interaction));
   const route=paired?'combined:'+axes.topic+':'+axes.interaction:axes.topic||axes.interaction&&'interaction:'+axes.interaction||'generic';
   if (expectedSmokeRoutes.has(text) && expectedSmokeRoutes.get(text) !== route) {
     throw Error('Experimental Ruri-only route mismatch: '+text+' expected '+expectedSmokeRoutes.get(text)+' got '+route);
   }
   if(expectedRoutes.has(text)){assert.equal(route,expectedRoutes.get(text),`real Ruri route regression: ${text}`);guarded++;}
   console.log(JSON.stringify({text,topic:scores.topic.id,tp:+scores.topic.probability.toFixed(3),tm:+scores.topic.margin.toFixed(3),
    interaction:scores.interaction.id,ip:+scores.interaction.probability.toFixed(3),im:+scores.interaction.margin.toFixed(3),
    route,paired}));
  }finally{for(const o of Object.values(out))o.dispose?.();}
 }
}finally{await session.release?.();}
assert.equal(guarded,expectedRoutes.size);
console.log('Measured real Ruri ONNX heads on '+cases.length+' Japanese prompts, '+guarded+' protected routes. NOT a field accuracy score.');
