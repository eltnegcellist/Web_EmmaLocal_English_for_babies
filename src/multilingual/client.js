import {normalizeThreads,normalizeLanguageDetection} from './performance.js';
export class MultilingualClient {
  constructor({workerFactory=()=>new Worker(new URL('./worker.js',import.meta.url),{type:'module'}),onStatus=()=>{},
    threads='auto',languageDetection='once'}={}) {
    this.workerFactory=workerFactory;this.onStatus=onStatus;this.worker=null;this.pending=new Map();this.seq=0;this.ready=false;this.preparing=null;this.generation=0;
    this.threadPreference=normalizeThreads(threads);
    this.languageDetection=normalizeLanguageDetection(languageDetection);
    this.cachedSpokenLanguage=null;this.runtimeInfo=null;
  }
  request(type,payload={},timeout=900000,transfer=[]) {
    if(!this.worker){const worker=this.worker=this.workerFactory();worker.onmessage=({data})=>{
      if(worker!==this.worker)return;
      if(data.type==='progress'){this.onStatus(data);return;}
      const p=this.pending.get(data.requestId);if(!p)return;clearTimeout(p.timer);this.pending.delete(data.requestId);
      data.type==='error'?p.reject(Error(data.message)):p.resolve(data.result);
    };worker.onerror=e=>{if(worker===this.worker)this.cancel(e.message||'Multilingual worker failed');};}
    return new Promise((resolve,reject)=>{const requestId=++this.seq;
      const timer=setTimeout(()=>this.cancel('Model preparation timed out. Retry.'),timeout);
      this.pending.set(requestId,{resolve,reject,timer});
      try{this.worker.postMessage({type,requestId,...payload},transfer);}catch(e){clearTimeout(timer);this.pending.delete(requestId);reject(e);}
    });
  }
  prepare(){if(this.ready)return Promise.resolve();if(this.preparing)return this.preparing;
    const token=this.generation;
    const op=this.request('init',{threads:this.threadPreference}).then(info=>{
      if(token!==this.generation)throw Error('Language operation cancelled');
      this.ready=true;this.runtimeInfo=info;this.onStatus({stage:'runtime-ready',...info});
    }).catch(e=>{if(token===this.generation)this.cancel(e.message);throw e;}).finally(()=>{if(this.preparing===op)this.preparing=null;});
    this.preparing=op;return op;
  }
  async predict(text,options={}){await this.prepare();return this.request('predict',{text,...options},60000);}
  async transcribe(audio,language){
    await this.prepare();
    // Transfer (rather than clone) a fresh PCM buffer to avoid doubling the
    // main-thread memory cost of each mobile Whisper transcription.
    const buffer=audio.buffer.slice(audio.byteOffset,audio.byteOffset+audio.byteLength);
    // 'en' is the multilingual UI mode. The first successful utterance detects
    // the spoken language. Subsequent ones reuse it for this conversation.
    // Other UI locales remain explicit language hints.
    const requested=language==='en' && this.languageDetection==='fixed'
      ? 'en-fixed'
      : language==='en' && this.languageDetection==='once' && this.cachedSpokenLanguage
        ? (this.cachedSpokenLanguage==='en'?'en-fixed':this.cachedSpokenLanguage) : language;
    const result=await this.request('transcribe',{audio:buffer,language:requested},90000,[buffer]);
    if(language==='en' && this.languageDetection==='once' && !this.cachedSpokenLanguage &&
       result?.text?.trim() && /^[a-z]{2,3}(?:-[a-z]+)?$/i.test(result.detectedLanguage||'')){
      this.cachedSpokenLanguage=result.detectedLanguage;
      this.onStatus({stage:'speech-language-cached',detectedLanguage:this.cachedSpokenLanguage});
    }
    return result;
  }
  resetSpeechLanguage(){this.cachedSpokenLanguage=null;}
  setPerformance({threads=this.threadPreference,languageDetection=this.languageDetection}={}){
    const nextThreads=normalizeThreads(threads),nextDetection=normalizeLanguageDetection(languageDetection);
    if(nextThreads!==this.threadPreference){
      this.cancel('Whisper thread configuration changed');
    }else if(nextDetection!==this.languageDetection){this.resetSpeechLanguage();}
    this.threadPreference=nextThreads;this.languageDetection=nextDetection;
  }
  cancel(message='Language operation cancelled'){
    this.resetSpeechLanguage();this.runtimeInfo=null;
    this.generation++;
    this.worker?.terminate();this.worker=null;this.ready=false;this.preparing=null;
    for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error(message));}this.pending.clear();
  }
  cancelPending(){if(this.pending.size)this.cancel();}
}
