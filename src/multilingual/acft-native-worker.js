/* Classic worker: isolate FUTO Whisper ACFT Small GGML and whisper.cpp WASM
   away from the main UI and E5 embedding worker. Audio never leaves device. */
const MODEL='small_acft_q8_0.bin';
let initialized=false,failed=null,runtimePromise=null,active=false;
function fail(e){return String(e?.stack||e?.message||e)}
function ensureRuntime(){
  if(runtimePromise)return runtimePromise;
  runtimePromise=new Promise((resolve,reject)=>{
    try{
      self.Module={
        print:()=>{},printErr:(...args)=>postMessage({kind:'native-log',text:args.join(' ').slice(0,400)}),
        onRuntimeInitialized:()=>resolve()
      };
      // The Emscripten bundle uses SINGLE_FILE and pthreads; its native
      // runtime is frozen to the independently measured optimized WASM build.
      importScripts(new URL('../../multilingual-assets/runtime/acft-whispercpp.js',self.location.href).href);
    }catch(error){failed=error;reject(error);}
  });
  return runtimePromise;
}
async function handle(data){
  if(data.type==='init'){
    await ensureRuntime();
    if(initialized)return {ready:true,model:MODEL};
    if(!(data.model instanceof ArrayBuffer))throw Error('Missing verified ACFT model buffer');
    const bytes=new Uint8Array(data.model);
    if(bytes.byteLength!==264464624)throw Error('Invalid ACFT model byte count');
    self.Module.FS_createDataFile('/',MODEL,bytes,true,true);
    if(!self.Module.acft_init(MODEL))throw Error('ACFT Small native initialization failed (memory exhausted or invalid model)');
    initialized=true;
    return {ready:true,model:MODEL};
  }
  if(data.type==='transcribe'){
    if(!initialized)throw Error('ACFT Small model is not initialized');
    if(active)throw Error('Concurrent ASR request is not supported');
    const samples=new Float32Array(data.audio);
    if(!samples.length||samples.some(x=>!Number.isFinite(x)))throw Error('Invalid PCM input');
    if(samples.length>data.windowSeconds*16000)throw Error('Audio longer than selected ACFT window: refused to truncate');
    const nativeCtx=data.windowSeconds===5?250:data.windowSeconds===10?500:0;
    if(!nativeCtx)throw Error('Invalid ACFT window length');
    const lang=data.language==='auto'?'auto':String(data.language);
    active=true;
    try{
      const start=performance.now();
      const code=self.Module.acft_run(samples,lang,Number(data.threads)||1,nativeCtx);
      if(code!==0)throw Error('ACFT inference rejected with native code '+code);
      await new Promise((resolve,reject)=>{
        const check=()=>{
          const status=self.Module.acft_status();
          if(status===0){setTimeout(check,80);return;}
          if(status===1)resolve();
          else reject(Error('Native ACFT inference failed: '+status));
        };
        check();
      });
      let nativeTimings={};
      try{nativeTimings=JSON.parse(self.Module.acft_timings()||'{}')}catch{}
      const text=self.Module.acft_result().trim();
      const detectedLanguage=self.Module.acft_detected_language?.()||'';
      return {text,detectedLanguage,timings:{
        asrMs:Math.round(performance.now()-start),
        windowSeconds:data.windowSeconds,
        audioSeconds:Number((samples.length/16000).toFixed(2)),
        encoderPasses:nativeTimings.encodeRuns??null,
        encoderTotalMs:nativeTimings.encodeTotalMs??null,
        nativeTimings
      }};
    }finally{active=false;}
  }
  throw Error('Unsupported ACFT worker request');
}
self.onmessage=event=>{
  const {id,...data}=event.data;
  handle(data).then(result=>postMessage({kind:'result',id,result}))
    .catch(e=>postMessage({kind:'error',id,error:fail(e)}));
};
