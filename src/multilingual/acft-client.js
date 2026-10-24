import {readImportedAcftModel} from './acft-model-store.js';
import {planAdaptiveWindows,mergeSegmentTexts} from './acft-window-policy.js';
import {speechLanguage} from './core.js';

// Explicitly experimental ASR backend. Keeps native WASM outside the E5 Worker,
// uses one imported on-device ACFT Small model for BOTH 5s and 10s windows.
export class AdaptiveAcftClient {
  constructor({onStatus=()=>{},workerFactory=()=>new Worker(new URL('./acft-native-worker.js',import.meta.url))}={}){
    this.onStatus=onStatus;this.workerFactory=workerFactory;this.worker=null;
    this.seq=0;this.pending=new Map();this.ready=false;this.preparing=null;
  }
  request(type,payload={},transfer=[],timeout=120000){
    if(!this.worker){
      const worker=this.worker=this.workerFactory();
      worker.onmessage=({data})=>{
        if(worker!==this.worker)return;
        if(data.kind==='native-log'){this.onStatus({stage:'native-log',text:data.text});return;}
        const job=this.pending.get(data.id);if(!job)return;
        clearTimeout(job.timer);this.pending.delete(data.id);
        if(data.kind==='error')job.reject(Error(data.error));
        else job.resolve(data.result);
      };
      worker.onerror=e=>this.cancel(e.message||'ACFT native worker error');
    }
    return new Promise((resolve,reject)=>{
      const id=++this.seq;
      const timer=setTimeout(()=>this.cancel('ACFT native ASR timed out'),timeout);
      this.pending.set(id,{resolve,reject,timer});
      try{this.worker.postMessage({type,id,...payload},transfer);}
      catch(e){clearTimeout(timer);this.pending.delete(id);reject(e);}
    });
  }
  prepare(){
    if(this.ready)return Promise.resolve();
    if(this.preparing)return this.preparing;
    const task=(async()=>{
      this.onStatus({stage:'loading-acft'});
      const model=await readImportedAcftModel();
      await this.request('init',{model},[model],120000);
      this.ready=true;this.onStatus({stage:'acft-ready'});
    })();
    this.preparing=task.catch(error=>{this.cancel(error.message);throw error;})
      .finally(()=>{this.preparing=null;});
    return this.preparing;
  }
  async transcribe(audio,requestedLanguage,{threads=4}={}){
    await this.prepare();
    const pcm=audio instanceof Float32Array?audio:new Float32Array(audio);
    const plan=planAdaptiveWindows(pcm);
    const started=performance.now();
    let spoken=requestedLanguage==='en-fixed'?'en':speechLanguage(requestedLanguage);
    let languagePass=!spoken;
    const texts=[],chunks=[];
    let encoderPasses=0,encoderTotalMs=0;
    for(let i=0;i<plan.length;i++){
      const part=plan[i];
      const buffer=pcm.slice(part.start,part.end).buffer;
      const requested=spoken||'auto';
      this.onStatus({stage:requested==='auto'?'detecting-language':'transcribing',
        segment:i+1,segmentCount:plan.length,windowSeconds:part.windowSeconds});
      const result=await this.request('transcribe',{
        audio:buffer,windowSeconds:part.windowSeconds,
        language:requested,threads
      },[buffer],120000);
      texts.push(result.text);
      chunks.push({...part,asrMs:result.timings.asrMs,
        encoderPasses:result.timings.encoderPasses,
        nativeTimings:result.timings.nativeTimings,
        detectedLanguage:result.detectedLanguage});
      if(Number.isFinite(result.timings.encoderPasses))encoderPasses+=result.timings.encoderPasses;
      if(Number.isFinite(result.timings.encoderTotalMs))encoderTotalMs+=result.timings.encoderTotalMs;
      if(!spoken && /^[a-z]{2,3}(?:-[a-z]+)?$/i.test(result.detectedLanguage||'')){
        spoken=result.detectedLanguage;
      }
    }
    const totalMs=Math.round(performance.now()-started);
    const timings={
      audioSeconds:Number((pcm.length/16000).toFixed(2)),totalMs,
      realTimeFactor:Number((totalMs/(pcm.length/16)).toFixed(2)),
      // Auto language detection is part of the first native decode; separate
      // detection-only timing was not instrumented, so do not mislabel it.
      languageMs:null,
      transcribeMs:totalMs,
      spokenLanguage:spoken||'und',
      languagePass,threads,
      model:'futo-acft-whisper-small-q8-whispercpp-wasm',
      windowsUsed:plan.map(part=>part.windowSeconds),segments:chunks.length,
      encoderPasses,encoderTotalMs:Number(encoderTotalMs.toFixed(2)),
      chunks
    };
    this.onStatus({stage:'asr-timing',timings});
    return {text:mergeSegmentTexts(texts),detectedLanguage:spoken||null,timings};
  }
  cancel(message='ACFT native ASR cancelled'){
    this.worker?.terminate();this.worker=null;this.ready=false;this.preparing=null;
    for(const job of this.pending.values()){clearTimeout(job.timer);job.reject(Error(message));}
    this.pending.clear();
  }
}
