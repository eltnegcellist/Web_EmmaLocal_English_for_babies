// Whisper Small q8 using the exact pinned CooTrio multilingual model/runtime.
// E5 is deliberately not downloaded; this compares ASR only.
// Lazy imports provide useful diagnostics instead of generic Worker startup failure.
let whisperUtilities;
async function getWhisperUtilities(){
  return whisperUtilities ||= Promise.all([
    import('../../src/multilingual/assets.js'),
    import('../../src/multilingual/performance.js')
  ]).then(([a,p])=>({prepareAssets:a.prepareAssets,resolveWhisperThreads:p.resolveWhisperThreads}))
    .catch(e=>{whisperUtilities=null;throw Error('Whisper module import failed: '+(e?.message||String(e)),{cause:e});});
}
let recognizer=null,initPromise=null,threads=1;
async function initialize(){
  if(initPromise)return initPromise;
  initPromise=(async()=>{
    self.postMessage({type:'stage',stage:'Importing Whisper app utilities'});
    const {prepareAssets,resolveWhisperThreads}=await getWhisperUtilities();
    self.postMessage({type:'stage',stage:'Fetching Whisper model manifest'});
    const manifestUrl=new URL('../../src/multilingual/assets.json',import.meta.url);
    const res=await fetch(manifestUrl,{cache:'no-cache'});
    if(!res.ok)throw Error('Whisper manifest missing: HTTP '+res.status);
    const entire=await res.json();
    const manifest={...entire,assets:entire.assets.filter(meta=>meta.model==='whisper')};
    if(manifest.assets.length<3)throw Error('No Whisper assets in pinned manifest');
    self.postMessage({type:'stage',stage:'Caching Whisper model assets'});
    const cache=await prepareAssets(manifest,{progress:({loaded,total})=>{
      self.postMessage({type:'progress',loaded,total});
    }});
    self.postMessage({type:'stage',stage:'Importing Whisper pinned transformer runtime'});
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
    self.postMessage({type:'stage',stage:'Creating Whisper ONNX pipeline'});
    recognizer=await pipeline('automatic-speech-recognition',m.id,{
      revision:m.revision,device:'wasm',dtype:'q8',local_files_only:true
    });
  })().catch(e=>{initPromise=null;throw e;});
  return initPromise;
}
self.onmessage=async({data})=>{
  const{id,type}=data;
  try{
    if(type==='ping'){
      self.postMessage({type:'reply',id,ready:true,worker:'whisper',isolated:self.crossOriginIsolated===true});
    }else if(type==='probe'){
      const utils=await getWhisperUtilities();
      if(typeof utils.prepareAssets!=='function'||typeof utils.resolveWhisperThreads!=='function')
        throw Error('Whisper app utility exports are incomplete');
      const runtime=await import('../../multilingual-assets/runtime/transformers.mjs');
      if(typeof runtime.pipeline!=='function')throw Error('Whisper runtime pipeline export is missing');
      self.postMessage({type:'reply',id,probed:true,engine:'whisper'});
    }else if(type==='init'){
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
