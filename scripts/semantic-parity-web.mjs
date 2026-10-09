import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRuriTokenizer } from '../src/semantic/tokenize.js';
import { classifyEmbedding, decodeHead } from '../src/semantic/core.js';
import { Tokenizer, ort } from '../semantic-assets/runtime-ort1.30.0-tokenizers0.2.0/runtime.mjs';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const args=new Map();
for(let i=2;i<process.argv.length;i+=2) args.set(process.argv[i],process.argv[i+1]);
const casesPath=resolve(root,args.get('--cases')||'shared/semantic-parity-cases.json');
const outputPath=resolve(root,args.get('--output')||'.semantic-parity/web.json');
const assetDir=resolve(root,'semantic-assets/ruri70-int8-bd500193');
const runtimeDir=resolve(root,'semantic-assets/runtime-ort1.30.0-tokenizers0.2.0');

const cases=JSON.parse(await readFile(casesPath,'utf8'));
const tokenizerJson=JSON.parse(await readFile(join(assetDir,'tokenizer.json'),'utf8'));
const tokenizerConfig=JSON.parse(await readFile(join(assetDir,'tokenizer_config.json'),'utf8'));
const headsConfig=JSON.parse(await readFile(join(assetDir,'heads-config.json'),'utf8'));
const tokenizer=createRuriTokenizer(Tokenizer,tokenizerJson,tokenizerConfig);
const topicConfig=headsConfig.heads.topic;
const headBytes=await readFile(join(assetDir,topicConfig.filename));
const headBuffer=headBytes.buffer.slice(headBytes.byteOffset,headBytes.byteOffset+headBytes.byteLength);
const topicHead=decodeHead(headBuffer,topicConfig);

ort.env.wasm.numThreads=1;
ort.env.wasm.wasmPaths=runtimeDir + '/';
const model=new Uint8Array(await readFile(join(assetDir,'model.onnx')));
const session=await ort.InferenceSession.create(model,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
const results=[];
try{
  for(const item of cases.cases){
    const tokenIds=tokenizer(item.text);
    if(tokenIds.length>headsConfig.max_length) throw new Error(`Case too long: ${item.id}`);
    const tokens=BigInt64Array.from(tokenIds,BigInt);
    const mask=BigInt64Array.from(tokenIds,()=>1n);
    const output=await session.run({
      input_ids:new ort.Tensor('int64',tokens,[1,tokenIds.length]),
      attention_mask:new ort.Tensor('int64',mask,[1,tokenIds.length]),
    });
    try{
      const embedding=Array.from(output.sentence_embedding.data,Number);
      const topic=classifyEmbedding(embedding,{topic:topicHead},headsConfig.topic_thresholds).topic;
      results.push({
        id:item.id,
        text:item.text,
        tokenIds,
        embedding,
        topic:{
          id:topic.id,
          rawId:topic.rawId,
          probability:topic.probability,
          margin:topic.margin,
        },
      });
    } finally {
      for(const tensor of Object.values(output)) tensor.dispose?.();
    }
  }
} finally {
  await session.release?.();
}
await mkdir(dirname(outputPath),{recursive:true});
await writeFile(outputPath,JSON.stringify({
  version:1,
  runtime:'onnxruntime-web-wasm-1.30.0',
  modelSha:'bd500193003fdeaba8c5422a47b974b40b49a5e0c91285c76f6bd949d2205264',
  cases:results,
},null,2)+'\n');
console.log(`Semantic Web parity output: ${outputPath} (${results.length} cases)`);
