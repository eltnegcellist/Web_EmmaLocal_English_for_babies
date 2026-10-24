// Whisper Small q8 using the exact pinned CooTrio multilingual model/runtime.
// E5 is deliberately not downloaded; this compares ASR only.
import {prepareAssets} from '../../src/multilingual/assets.js';
import {resolveWhisperThreads} from '../../src/multilingual/performance.js';
let recognizer=null,initPromise=null,threads=1;
async function initialize(){
  if(initPromise)return initPromise;
  initPromise=(async()=>{
    const manifestUrl=new URL('../../src/multilingual/assets.json',import.meta.url);
    const res=await fetch(manifestUrl,{cache:'no-cache'});
    if(!res.ok)throw Error('Whisper manifest missing: HTTP '+res.status);
    const entire=await res.json();
    const manifest={...entire,assets:entire.assets.filter(meta=>meta.model==='whisper')};
    if(manifest.assets.length<3)throw Error('No Whisper assets in pinned manifest');
    const cache=await prepareAssets(manifest,{progress:({loaded,total})=>{
      self.postMessage({type:'progress',loaded,total});
    }});
    const runtime=await import('../../multilingual-assets/runtime/transformers.mjs');
    const {env,pipeline}=runtime;
    env.allowLocalModels=true;env.allowRemoteModels=false;
    env.useBrowserCache=false;env.useFSCache=false;
    env.localModelPath=new URL('../../multilingual-assets/unavailable/',import.meta.url).href;
    env.useCustomCache=true;
    const allowed=new Set(manifest.assets.map(m=>m.url));
    env.customCache={
      match:async url=>allowed.has(String(url)) ? (await cache.match(String(url)))||undefined:undefined,
      put:async()=>{throw Error('Unexpected model asset write');}
    };
    env.backends.onnx.wasm.wasmPaths=new URL('../../multilingual-assets/runtime/',import.meta.url).href;
    threads=resolveWhisperThreads('auto',{
      hardwareConcurrency:self.navigator?.hardwareConcurrency??1,
      crossOriginIsolated:self.crossOriginIsolated===true,
      sharedArrayBuffer:typeof SharedArrayBuffer==='function'
    });
    env.backends.onnx.wasm.numThreads=threads;
    env.backends.onnx.wasm.proxy=false;
    const m=manifest.models.whisper;
    recognizer=await pipeline('automatic-speech-recognition',m.id,{
      revision:m.revision,device:'wasm',dtype:'q8',local_files_only:true
    });
  })().catch(e=>{initPromise=null;throw e;});
  return initPromise;
}
self.onmessage=async({data})=>{
  const{id,type}=data;
  try{
    if(type==='init'){
      await initialize();
      self.postMessage({type:'reply',id,ready:true,threads,engine:'Whisper Small q8'});
    }else if(type==='run'){
      await initialize();
      const audio=new Float32Array(data.audio);
      const t0=performance.now();
      const text=await recognizer(audio,{
        language:data.language==='ja'?'ja':'en',
        task:'transcribe',max_new_tokens:80,return_timestamps:false
      });
      self.postMessage({type:'reply',id,text:String(text?.text||'').trim(),
        internalMs:performance.now()-t0,threads});
    }else if(type==='dispose'){
      recognizer?.dispose?.();recognizer=null;initPromise=null;
      self.postMessage({type:'reply',id,disposed:true});
    }
  }catch(err){self.postMessage({type:'error',id,message:err?.message||String(err)});}
};
