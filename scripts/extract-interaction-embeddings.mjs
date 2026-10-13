// Extract actual ruri-v3-70m INT8 ONNX embeddings on CI; NO guessed/simulated vectors.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRuriTokenizer} from '../src/semantic/tokenize.js';
import {Tokenizer,ort} from '../semantic-assets/runtime-ort1.30.0-tokenizers0.2.0/runtime.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const asset=join(root,'semantic-assets/ruri70-int8-bd500193');
const runtime=join(root,'semantic-assets/runtime-ort1.30.0-tokenizers0.2.0');
const cfg=JSON.parse(await readFile(join(asset,'heads-config.json'),'utf8'));
const tokenizer=createRuriTokenizer(Tokenizer,JSON.parse(await readFile(join(asset,'tokenizer.json'),'utf8')),JSON.parse(await readFile(join(asset,'tokenizer_config.json'),'utf8')));
const dataset=JSON.parse(await readFile(join(root,'research/interaction-head/experimental-dataset.json'),'utf8'));
ort.env.wasm.numThreads=1;
ort.env.wasm.wasmPaths=runtime+'/';
const model=new Uint8Array(await readFile(join(asset,'model.onnx')));
const session=await ort.InferenceSession.create(model,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
const vectors=[];
try {
 for (const [i,item] of dataset.items.entries()) {
  const ids=tokenizer(item.text);
  if(ids.length>cfg.max_length)throw Error('Too many tokens: '+item.id);
  const tokens=BigInt64Array.from(ids,BigInt);
  const mask=BigInt64Array.from(ids,()=>1n);
  const out=await session.run({input_ids:new ort.Tensor('int64',tokens,[1,ids.length]),attention_mask:new ort.Tensor('int64',mask,[1,ids.length])});
  try {
   const v=Array.from(out.sentence_embedding.data,Number);
   if(v.length!==384 || !v.every(Number.isFinite))throw Error('Invalid 384D Ruri vector: '+item.id);
   vectors.push({id:item.id,label:item.label,split:item.split,text:item.text,family:item.family,embedding:v});
  } finally {for(const t of Object.values(out))t.dispose?.();}
  if ((i+1)%25===0)console.log('Extracted actual Ruri embeddings',i+1,'/',dataset.items.length);
 }
} finally {await session.release?.();}
await mkdir(join(root,'.interaction-experiment'),{recursive:true});
await writeFile(join(root,'.interaction-experiment/embeddings.json'),JSON.stringify({model:'ruri-v3-70m-int8',model_sha256:'bd500193003fdeaba8c5422a47b974b40b49a5e0c91285c76f6bd949d2205264',items:vectors})+'\n');
console.log('Saved real embedding matrix',vectors.length,'rows');
