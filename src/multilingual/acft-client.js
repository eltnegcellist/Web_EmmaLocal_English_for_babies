import {readImportedAcftModel} from './acft-model-store.js';
import {planAdaptiveWindows,mergeSegmentTexts} from './acft-window-policy.js';
import {speechLanguage} from './core.js';

// Experimental: load the proven ACFT whisper.cpp WASM binary in a browser page
// (the native backend itself launches pthread workers). The extra nested
// classic-Worker shell did not pass browser initialization CI and is not used.
const MODEL='small_acft_q8_0.bin';
let singleton=null,nativeModelLoaded=false,nativeModelPreparing=null;
async function loadNativeWasm(){
  if(singleton)return singleton;
  const pending=new Promise((resolve,reject)=>{
    if(typeof document==='undefined')return reject(Error('ACFT WASM requires a browser document'));
    if(globalThis.crossOriginIsolated!==true||typeof SharedArrayBuffer!=='function'){
      return reject(Error('ACFT WASM pthreads require crossOriginIsolated'));
    }
    const module={
      print:()=>{},printErr:()=>{},
      onRuntimeInitialized:()=>{
        if(typeof module.acft_detected_language!=='function'){
          reject(Error('New ACFT WASM runtime is missing detected-language export'));
          return;
        }
        resolve(module);
      }
    };
    globalThis.Module=module;
    const script=document.createElement('script');
    script.src=new URL('../../multilingual-assets/runtime/acft-whispercpp.js',import.meta.url).href;
    script.async=true;
    script.onerror=()=>reject(Error('Failed to load ACFT whisper.cpp WASM bundle'));
    document.head.append(script);
  });
  singleton=pending.catch(error=>{singleton=null;throw error;});
  return singleton;
}

export class AdaptiveAcftClient {
  constructor({onStatus=()=>{}}={}){
    this.onStatus=onStatus;this.preparing=null;this.ready=false;
    this.module=null;this.generation=0;
  }
  prepare(){
    if(this.ready)return Promise.resolve();
    if(this.preparing)return this.preparing;
    const generation=this.generation;
    const task=(async()=>{
      this.onStatus({stage:'loading-acft'});
      const wasm=await loadNativeWasm();
      if(generation!==this.generation)throw Error('ACFT preparation cancelled');
      if(!nativeModelLoaded){
        nativeModelPreparing ||= (async()=>{
          const bytes=await readImportedAcftModel();
          try{wasm.FS_unlink('/'+MODEL);}catch{}
          wasm.FS_createDataFile('/',MODEL,new Uint8Array(bytes),true,true);
          if(!wasm.acft_init(MODEL))throw Error('ACFT Small model initialization failed');
          nativeModelLoaded=true;
        })().catch(error=>{nativeModelPreparing=null;throw error;});
        await nativeModelPreparing;
      }
      if(generation!==this.generation)throw Error('ACFT preparation cancelled');
      this.module=wasm;this.ready=true;
      this.onStatus({stage:'acft-ready'});
    })();
    this.preparing=task.finally(()=>{this.preparing=null});
    return this.preparing;
  }
  async runChunk(samples,language,threads,windowSeconds){
    const generation=this.generation,wasm=this.module;
    if(!wasm||!this.ready)throw Error('ACFT WASM is not initialized');
    if(samples.length>windowSeconds*16000)throw Error('Audio exceeds the selected ACFT window');
    const start=performance.now();
    const code=wasm.acft_run(samples,language,threads,windowSeconds*50);
    if(code!==0)throw Error('ACFT inference rejected: '+code);
    await new Promise((resolve,reject)=>{
      const check=()=>{
        const state=wasm.acft_status();
        if(state===0){setTimeout(check,80);return;}
        if(state===1)resolve();
        else reject(Error('Native ACFT inference failed: '+state));
      };
      check();
    });
    if(generation!==this.generation)throw Error('ACFT task cancelled');
    let nativeTimings={};
    try{nativeTimings=JSON.parse(wasm.acft_timings()||'{}')}catch{}
    return {
      text:wasm.acft_result().trim(),
      detectedLanguage:wasm.acft_detected_language()||'',
      timings:{
        asrMs:Math.round(performance.now()-start),
        audioSeconds:Number((samples.length/16000).toFixed(2)),
        windowSeconds,
        encoderPasses:nativeTimings.encodeRuns??null,
        encoderTotalMs:nativeTimings.encodeTotalMs??null,
        nativeTimings
      }
    };
  }
  async transcribe(audio,requestedLanguage,{threads=4}={}){
    await this.prepare();
    const pcm=audio instanceof Float32Array?audio:new Float32Array(audio);
    const windows=planAdaptiveWindows(pcm),started=performance.now();
    let spoken=requestedLanguage==='en-fixed'?'en':speechLanguage(requestedLanguage);
    const languagePass=!spoken,texts=[],chunks=[];
    let encoderPasses=0,encoderTotalMs=0;
    for(let i=0;i<windows.length;i++){
      const part=windows[i],requested=spoken||'auto';
      this.onStatus({stage:requested==='auto'?'detecting-language':'transcribing',
        segment:i+1,segmentCount:windows.length,windowSeconds:part.windowSeconds});
      const result=await this.runChunk(pcm.subarray(part.start,part.end),
        requested,threads,part.windowSeconds);
      texts.push(result.text);
      chunks.push({...part,asrMs:result.timings.asrMs,
        encoderPasses:result.timings.encoderPasses,
        nativeTimings:result.timings.nativeTimings,
        detectedLanguage:result.detectedLanguage});
      if(Number.isFinite(result.timings.encoderPasses))encoderPasses+=result.timings.encoderPasses;
      if(Number.isFinite(result.timings.encoderTotalMs))encoderTotalMs+=result.timings.encoderTotalMs;
      if(!spoken&&/^[a-z]{2,3}(?:-[a-z]+)?$/i.test(result.detectedLanguage||'')){
        spoken=result.detectedLanguage;
      }
    }
    const totalMs=Math.round(performance.now()-started);
    const timings={
      audioSeconds:Number((pcm.length/16000).toFixed(2)),totalMs,
      realTimeFactor:Number((totalMs/(pcm.length/16)).toFixed(2)),
      languageMs:null,transcribeMs:totalMs,spokenLanguage:spoken||'und',
      languagePass,threads,model:'futo-acft-whisper-small-q8-whispercpp-wasm',
      windowsUsed:windows.map(x=>x.windowSeconds),segments:chunks.length,
      encoderPasses,encoderTotalMs:Number(encoderTotalMs.toFixed(2)),
      chunks
    };
    this.onStatus({stage:'asr-timing',timings});
    return {text:mergeSegmentTexts(texts),detectedLanguage:spoken||null,timings};
  }
  cancel(){
    // Native inference is not interruptible within the page at this stage.
    // Ignore its result, but never free native state while a pthread is running.
    this.generation++;
    this.ready=false;
  }
}
