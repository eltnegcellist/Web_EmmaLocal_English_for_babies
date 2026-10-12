// Request-id-aware Moonshine worker bridge. A stale recognition can finish
// without blocking the microphone or replacing a more recent utterance.
export class MoonshineAsrClient {
  constructor({workerFactory=()=>new Worker(new URL('./asr-worker.js', import.meta.url),{type:'module'}),onEvent=()=>{}}={}) {
    this.worker=workerFactory();
    this.onEvent=onEvent;
    this.requests=new Map();
    this.sequence=0;
    this.closed=false;
    this.initialization=null;
    this.worker.onmessage=({data})=>{
      if(this.closed)return;
      if(data.type==='ready'){
        this.initialization?.resolve(data);
        this.initialization=null;
      } else if(data.type==='error'){
        if(data.id!=null){
          const pending=this.requests.get(data.id);
          if(pending){this.requests.delete(data.id);pending.reject(Error(data.message));}
        } else {this.initialization?.reject(Error(data.message));this.initialization=null;}
      } else if(data.type==='transcript'){
        const pending=this.requests.get(data.id);
        if(pending){this.requests.delete(data.id);pending.resolve(data.text);}
      } else this.onEvent(data);
    };
    this.worker.onerror=(error)=>{
      const failure=Error(error?.message||'Moonshine Worker error');
      this.initialization?.reject(failure);
      this.initialization=null;
      for(const pending of this.requests.values())pending.reject(failure);
      this.requests.clear();
    };
  }
  init({model='small',keyterms=[]}={}) {
    if(this.closed)return Promise.reject(Error('Moonshine worker was closed'));
    if(this.initialization)return this.initialization.promise;
    let resolve,reject;
    const promise=new Promise((a,b)=>{resolve=a;reject=b;});
    this.initialization={resolve,reject,promise};
    this.worker.postMessage({type:'init',model,keyterms});
    return promise;
  }
  resumeInit() {
    if(!this.closed)this.worker.postMessage({type:'resume-init'});
  }
  transcribe(audio) {
    if(this.closed)return Promise.reject(Error('Moonshine worker was closed'));
    const id=++this.sequence;
    const copy=audio.slice(); // Keep original PCM for potential continuation/retry.
    return new Promise((resolve,reject)=>{
      this.requests.set(id,{resolve,reject});
      try{this.worker.postMessage({type:'transcribe',id,audio:copy.buffer},[copy.buffer]);}
      catch(error){this.requests.delete(id);reject(error);}
    });
  }
  close() {
    if(this.closed)return;
    this.closed=true;
    this.worker.terminate();
    const error=Error('Moonshine worker closed');
    this.initialization?.reject(error);
    this.initialization=null;
    for(const pending of this.requests.values())pending.reject(error);
    this.requests.clear();
  }
}
