import {prepareAssets,digest} from './assets.js';
import {classifyE5,decodeE5Heads,speechLanguage} from './core.js';
let recognizer,extractor,heads,runtime,preparing;
let queue=Promise.resolve();
const progress=data=>self.postMessage({type:'progress',...data});
async function initialize() {
  const response=await fetch(new URL('./assets.json',import.meta.url));
  if(!response.ok)throw Error('Multilingual model manifest is missing');
  const manifest=await response.json();
  const cache=await prepareAssets(manifest,{progress});
  runtime=await import(new URL('../../multilingual-assets/runtime/transformers.mjs',import.meta.url));
  const {env,pipeline}=runtime;
  env.allowLocalModels=true;env.allowRemoteModels=false;env.useBrowserCache=false;env.useFSCache=false;
  env.localModelPath=new URL('../../multilingual-assets/unavailable/',import.meta.url).href;
  env.useCustomCache=true;
  const allowed=new Set(manifest.assets.map(m=>m.url));
  env.customCache={match:async key=>allowed.has(String(key))?(await cache.match(String(key)))||undefined:undefined,
    put:async()=>{throw Error('Unexpected model asset request');}};
  env.backends.onnx.wasm.wasmPaths=new URL('../../multilingual-assets/runtime/',import.meta.url).href;
  env.backends.onnx.wasm.numThreads=1;env.backends.onnx.wasm.proxy=false;
  const opt=key=>({revision:manifest.models[key].revision,device:'wasm',dtype:'q8',local_files_only:true});
  progress({stage:'loading'});
  recognizer=await pipeline('automatic-speech-recognition',manifest.models.whisper.id,opt('whisper'));
  extractor=await pipeline('feature-extraction',manifest.models.e5.id,opt('e5'));
  const base=new URL('../../multilingual-assets/heads/',import.meta.url);
  const config=await (await fetch(new URL('config.json',base))).json(),buffers={};
  for(const [name,meta]of Object.entries(config.heads)){
    const r=await fetch(new URL(meta.file,base));if(!r.ok)throw Error('E5 head missing');
    const bytes=await r.arrayBuffer();if(await digest(bytes)!==meta.sha256)throw Error('E5 head integrity check failed');buffers[name]=bytes;
  }
  heads=decodeE5Heads(buffers,config);
}
function disposeTensors(value,seen=new Set()) {
  if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
  if(typeof value.dispose==='function'){value.dispose();return;}
  for(const item of Object.values(value))disposeTensors(item,seen);
}
async function detectLanguage(audio) {
  // Transformers.js 3.8.1 defaults an unspecified language to English.
  // Execute Whisper's start token and restrict the next logit to language IDs.
  const features=await recognizer.processor(audio),model=recognizer.model;
  let out,ids;
  try{
    ids=new runtime.Tensor('int64',BigInt64Array.of(BigInt(model.generation_config.decoder_start_token_id)),[1,1]);
    out=await model({...features,decoder_input_ids:ids});
    const data=out.logits.data,vocab=out.logits.dims.at(-1),offset=data.length-vocab;
    const languages=model.generation_config.lang_to_id;let language=null,best=-Infinity;
    for(const [token,id]of Object.entries(languages)){const score=data[offset+id];if(score>best){best=score;language=token.slice(2,-2);}}
    if(!language||!Number.isFinite(best))throw Error('Language detection failed');
    return language;
  }finally{disposeTensors(out);disposeTensors(features);ids?.dispose();}
}
async function handle(data) {
  preparing ||= initialize().catch(error=>{preparing=null;throw error;});await preparing;
  if(data.type==='init')return {provider:'wasm',source:'whisper-small-e5',ready:true};
  if(data.type==='transcribe'){
    const audio=new Float32Array(data.audio);
    if(!audio.length||audio.some(x=>!Number.isFinite(x)))throw Error('Invalid audio');
    const language=speechLanguage(data.language)||await detectLanguage(audio);
    const result=await recognizer(audio,{language,task:'transcribe',max_new_tokens:128,return_timestamps:false});
    return {text:result.text.trim(),detectedLanguage:language};
  }
  if(data.type==='predict'){
    const start=performance.now();
    const features=await extractor('query: '+String(data.text),{pooling:'mean',normalize:true,truncation:true,max_length:512});
    try{return {...classifyE5(Array.from(features.data),heads),elapsedMs:performance.now()-start,
      ...(data.diagnostics?{embedding:Array.from(features.data),tokenIds:Array.from(extractor.tokenizer('query: '+String(data.text),{truncation:true,max_length:512}).input_ids.data,Number)}:{})};}finally{features.dispose();}
  }
  throw Error('Unsupported multilingual request');
}
self.onmessage=({data})=>{queue=queue.catch(()=>{}).then(async()=>{
  try{self.postMessage({type:'result',requestId:data.requestId,result:await handle(data)});}
  catch(error){self.postMessage({type:'error',requestId:data.requestId,message:error?.message||String(error)});}
});};
