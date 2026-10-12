// Real 384D Ruri v3 INT8 embeddings, never simulated. Training corpus and
// 67 exploratory probes are kept separate; the latter are NOT fitted on.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRuriTokenizer} from '../src/semantic/tokenize.js';
import {Tokenizer,ort} from '../semantic-assets/runtime-ort1.30.0-tokenizers0.2.0/runtime.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const asset=join(root,'semantic-assets/ruri70-int8-bd500193');
const runtime=join(root,'semantic-assets/runtime-ort1.30.0-tokenizers0.2.0');
const training=JSON.parse(await readFile(join(root,'research/ruri-polarity/contrast-dataset.json'),'utf8'));
const qa=JSON.parse(await readFile(join(root,'research/interaction-ruri-qa-probes-20261013.json'),'utf8'));
const trainText=new Set(training.items.map(z=>z.text.normalize('NFKC')));
for(const probe of qa.cases)if(trainText.has(probe.text.normalize('NFKC')))throw Error('Training/QA text leakage: '+probe.text);
const tok=createRuriTokenizer(Tokenizer,JSON.parse(await readFile(join(asset,'tokenizer.json'),'utf8')),JSON.parse(await readFile(join(asset,'tokenizer_config.json'),'utf8')));
ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=runtime+'/';
const session=await ort.InferenceSession.create(new Uint8Array(await readFile(join(asset,'model.onnx'))),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
const vectors=[];
const texts=[
...training.items.map(z=>({...z,partition:'dataset'})),
...qa.cases.map(z=>({text:z.text,partition:'qa',label:z.category==='negative'?'negated':'affirmative',split:'qa',family:'qa:'+z.id,qa_id:z.id,category:z.category}))
];
try{
 for(const [i,item]of texts.entries()){
  const ids=tok(item.text),input=BigInt64Array.from(ids,BigInt),mask=BigInt64Array.from(ids,()=>1n);
  const result=await session.run({input_ids:new ort.Tensor('int64',input,[1,ids.length]),attention_mask:new ort.Tensor('int64',mask,[1,ids.length])});
  try{
   const embedding=Array.from(result.sentence_embedding.data,Number);
   if(embedding.length!==384||!embedding.every(Number.isFinite))throw Error('Invalid Ruri embedding: '+i);
   vectors.push({...item,embedding});
  }finally{for(const q of Object.values(result))q.dispose?.();}
  if((i+1)%25===0)console.log('Extracted real Ruri vectors',i+1,'/',texts.length);
 }
}finally{await session.release?.();}
await mkdir(join(root,'.ruri-polarity'),{recursive:true});
await writeFile(join(root,'.ruri-polarity/embeddings.json'),JSON.stringify({model_sha256:'bd500193003fdeaba8c5422a47b974b40b49a5e0c91285c76f6bd949d2205264',items:vectors})+'\n');
console.log('Saved 384D polarity probe matrix',vectors.length,'rows; QA never trained.');
