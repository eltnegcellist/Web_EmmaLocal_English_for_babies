// Actual-ONNX smoke evaluation on semantic contrast pairs.
// Deliberately NOT part of the held-out metric or training threshold selection.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Tokenizer,ort} from '../semantic-assets/runtime-ort1.30.0-tokenizers0.2.0/runtime.mjs';
import {createRuriTokenizer} from '../src/semantic/tokenize.js';
import {decodeHead,classifyEmbedding} from '../src/semantic/core.js';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const asset=join(root,'semantic-assets/ruri70-int8-bd500193');
const runtime=join(root,'semantic-assets/runtime-ort1.30.0-tokenizers0.2.0');
const cfg=JSON.parse(await readFile(join(asset,'heads-config.json'),'utf8'));
const hcfg=JSON.parse(await readFile(join(root,'research/interaction-head/artifacts/head-config.json'),'utf8'));
const headBytes=await readFile(join(root,'research/interaction-head/artifacts/head-interaction.f32'));
const head=decodeHead(headBytes.buffer.slice(headBytes.byteOffset,headBytes.byteOffset+headBytes.byteLength),hcfg);
const tokenizer=createRuriTokenizer(Tokenizer,JSON.parse(await readFile(join(asset,'tokenizer.json'),'utf8')),JSON.parse(await readFile(join(asset,'tokenizer_config.json'),'utf8')));
const cases=[
 ['かわいいね','affection'],['よくできたね','praise'],['頑張ってるね','effort'],['頑張ってね','encouragement'],
 ['できたね','achievement'],['できたかな','finish_check'],['できなかったね','none'],
 ['終わったね','finish'],['終わったかな','finish_check'],['まだ終わってないね','none'],
 ['おしまいじゃないよ','none'],['始めるよ','start'],['一緒にやろうか','invitation'],
 ['もう一回やろう','repeat'],['ちょっと待ってね','pause'],['どうしたの','inquiry'],
 ['大丈夫だよ','reassurance'],['大丈夫？','inquiry'],['お疲れ様','care'],
 ['眠いかな','none'],['眠くないよ','none'],['起きたね','none'],['泣いてるね','none'],
 ['泣いてないよ','none'],['笑ったね','none'],['笑ってないね','none'],
 ['ミルク飲もうか','none'],['ミルク終わったね','none'],['おむつ終わったね','none'],
 ['お風呂に入ろうか','none'],['寝返りできたね','achievement']
];
ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=runtime+'/';
const session=await ort.InferenceSession.create(new Uint8Array(await readFile(join(asset,'model.onnx'))),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
const results=[];
try {
 for(const [text,expected] of cases){
  const ids=tokenizer(text);
  if(ids.length>cfg.max_length)throw Error('Long input');
  const out=await session.run({input_ids:new ort.Tensor('int64',BigInt64Array.from(ids,BigInt),[1,ids.length]),attention_mask:new ort.Tensor('int64',BigInt64Array.from(ids,()=>1n),[1,ids.length])});
  try {
   const raw=classifyEmbedding(Array.from(out.sentence_embedding.data),{interaction:head},cfg.topic_thresholds).interaction;
   const predicted=raw.probability>=hcfg.thresholds.threshold&&raw.margin>=hcfg.thresholds.margin?raw.id:'none';
   results.push({text,expected_interaction:expected,predicted_interaction:predicted,raw_top:raw.rawId,probability:+raw.probability.toFixed(4),match:predicted===expected});
  }finally{for(const obj of Object.values(out))obj.dispose?.();}
 }
}finally{await session.release?.();}
const matched=results.filter(c=>c.match).length;
await writeFile(join(root,'research/interaction-head/artifacts/contrast-report.json'),JSON.stringify({
 status:'DIAGNOSTIC_ONLY_NOT_INDEPENDENT_TEST',accuracy_on_handchosen_contrasts:matched+'/'+results.length,
 caveat:'Includes phrases already in train, dev or test. NOT an independent accuracy metric. The correct legacy Topic route must be evaluated separately.',results
},null,2)+'\n');
console.log('Hard contrasts',matched+'/'+results.length);
for(const r of results.filter(x=>!x.match))console.log('UNMATCHED',JSON.stringify(r));
