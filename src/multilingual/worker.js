import {prepareAssets,digest} from './assets.js';
import {classifyE5,decodeE5Heads,speechLanguage} from './core.js';
import {resolveWhisperThreads} from './performance.js';
let recognizer,extractor,heads,runtime,preparing,effectiveThreads=1;
let queue=Promise.resolve();
const progress=data=>self.postMessage({type:'progress',...data});
async function initialize({threadPreference='auto',researchWhisperOnly=false}={}) {
  // The normal Mitsukotoba app continues loading Whisper + E5 and both heads.
  // Research-only ASR speed tests can skip the unused semantic model.
  const whisperOnly=researchWhisperOnly===true;
  const response=await fetch(new URL('./assets.json',import.meta.url));
  if(!response.ok)throw Error('Multilingual model manifest is missing');
  const manifest=await response.json();
  const asrManifest=whisperOnly
    ? {...manifest,assets:manifest.assets.filter(asset=>asset.model==='whisper')}
    : manifest;
  progress({stage:'assets-start',whisperOnly,
    assetCount:asrManifest.assets.length,
    totalBytes:asrManifest.assets.reduce((sum,asset)=>sum+asset.bytes,0)});
  const cache=await prepareAssets(asrManifest,{progress:data=>progress({...data,stage:'assets'})});
  progress({stage:'assets-ready',whisperOnly});
  runtime=await import(new URL('../../multilingual-assets/runtime/transformers.mjs',import.meta.url));
  const {env,pipeline}=runtime;
  env.allowLocalModels=true;env.allowRemoteModels=false;env.useBrowserCache=false;env.useFSCache=false;
  env.localModelPath=new URL('../../multilingual-assets/unavailable/',import.meta.url).href;
  env.useCustomCache=true;
  const allowed=new Set(asrManifest.assets.map(m=>m.url));
  env.customCache={match:async key=>allowed.has(String(key))?(await cache.match(String(key)))||undefined:undefined,
    put:async()=>{throw Error('Unexpected model asset request');}};
  env.backends.onnx.wasm.wasmPaths=new URL('../../multilingual-assets/runtime/',import.meta.url).href;
  effectiveThreads=resolveWhisperThreads(threadPreference,{
    hardwareConcurrency:self.navigator?.hardwareConcurrency??1,
    crossOriginIsolated:self.crossOriginIsolated===true,
    sharedArrayBuffer:typeof SharedArrayBuffer==='function'
  });
  env.backends.onnx.wasm.numThreads=effectiveThreads;
  // Already running inside an application-owned Worker; ONNX proxy adds another.
  env.backends.onnx.wasm.proxy=false;
  progress({stage:'runtime-policy',threads:effectiveThreads,
    threadPreference,isolated:self.crossOriginIsolated===true});
  const opt=key=>({revision:manifest.models[key].revision,device:'wasm',dtype:'q8',local_files_only:true});
  progress({stage:'whisper-pipeline-start',threads:effectiveThreads});
  recognizer=await pipeline('automatic-speech-recognition',manifest.models.whisper.id,opt('whisper'));
  progress({stage:'whisper-pipeline-ready',threads:effectiveThreads});
  if(whisperOnly){
    progress({stage:'whisper-asr-ready',note:'E5 semantics intentionally skipped for ASR-only benchmark'});
    return;
  }
  progress({stage:'e5-pipeline-start'});
  extractor=await pipeline('feature-extraction',manifest.models.e5.id,opt('e5'));
  progress({stage:'e5-pipeline-ready'});
  const base=new URL('../../multilingual-assets/heads/',import.meta.url);
  const config=await (await fetch(new URL('config.json',base))).json(),buffers={};
  for(const [name,meta]of Object.entries(config.heads)){
    const r=await fetch(new URL(meta.file,base));if(!r.ok)throw Error('E5 head missing');
    const bytes=await r.arrayBuffer();if(await digest(bytes)!==meta.sha256)throw Error('E5 head integrity check failed');buffers[name]=bytes;
  }
  heads=decodeE5Heads(buffers,config);
  progress({stage:'e5-heads-ready'});
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
  preparing ||= initialize({threadPreference:data.threads,researchWhisperOnly:data.researchWhisperOnly}).catch(error=>{preparing=null;throw error;});await preparing;
  if(data.type==='init')return {provider:'wasm',source:data.researchWhisperOnly?'whisper-small-asr-only':'whisper-small-e5',ready:true,
    threads:effectiveThreads,isolated:self.crossOriginIsolated===true};
  if(data.type==='transcribe'){
    const audio=new Float32Array(data.audio);
    if(!audio.length||audio.some(x=>!Number.isFinite(x)))throw Error('Invalid audio');
    const audioSeconds=audio.length/16000;
    const asrStarted=performance.now();
    const specified=data.language==='en-fixed'?'en':speechLanguage(data.language);
    if(!specified)progress({stage:'detecting-language'});
    const language=specified||await detectLanguage(audio);
    const languageMs=performance.now()-asrStarted;
    progress({stage:'transcribing',detectedLanguage:language,audioSeconds,languageMs});
    // Measure decoding independently from the optional language-detection pass.
    // Timings include preprocessing/encoding/generation for the pipeline call,
    // and do not claim to separate its internal ONNX graph operations.
    const decodeStarted=performance.now();
    // Short caregiver utterances should not spend minutes generating a long
    // hallucinated transcript on mobile CPU; allow up to 80 tokens.
    const result=await recognizer(audio,{language,task:'transcribe',max_new_tokens:80,return_timestamps:false});
    const transcribeMs=performance.now()-decodeStarted;
    const timings={
      audioSeconds:Number(audioSeconds.toFixed(2)),
      languageMs:Math.round(languageMs),
      transcribeMs:Math.round(transcribeMs),
      totalMs:Math.round(performance.now()-asrStarted),
      realTimeFactor:Number(((performance.now()-asrStarted)/1000/audioSeconds).toFixed(2)),
      spokenLanguage:language,
      languagePass:!specified,
      threads:effectiveThreads,
      model:`whisper-small-q8-wasm-${effectiveThreads}-thread`
    };
    progress({stage:'asr-timing',timings});
    return {text:result.text.trim(),detectedLanguage:language,timings};
  }
  if(data.type==='predict'){
    if(!extractor||!heads)throw Error('E5 semantics were not initialized in ASR-only benchmark');
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
