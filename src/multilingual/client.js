export class MultilingualClient {
  constructor({workerFactory=()=>new Worker(new URL('./worker.js',import.meta.url),{type:'module'}),onStatus=()=>{}}={}) {
    this.workerFactory=workerFactory;this.onStatus=onStatus;this.worker=null;this.pending=new Map();this.seq=0;this.ready=false;this.preparing=null;this.generation=0;
  }
  request(type,payload={},timeout=900000) {
    if(!this.worker){const worker=this.worker=this.workerFactory();worker.onmessage=({data})=>{
      if(worker!==this.worker)return;
      if(data.type==='progress'){this.onStatus(data);return;}
      const p=this.pending.get(data.requestId);if(!p)return;clearTimeout(p.timer);this.pending.delete(data.requestId);
      data.type==='error'?p.reject(Error(data.message)):p.resolve(data.result);
    };worker.onerror=e=>{if(worker===this.worker)this.cancel(e.message||'Multilingual worker failed');};}
    return new Promise((resolve,reject)=>{const requestId=++this.seq;
      const timer=setTimeout(()=>this.cancel('Model preparation timed out. Retry.'),timeout);
      this.pending.set(requestId,{resolve,reject,timer});
      try{this.worker.postMessage({type,requestId,...payload});}catch(e){clearTimeout(timer);this.pending.delete(requestId);reject(e);}
    });
  }
  prepare(){if(this.ready)return Promise.resolve();if(this.preparing)return this.preparing;
    const token=this.generation;
    const op=this.request('init').then(()=>{if(token!==this.generation)throw Error('Language operation cancelled');this.ready=true;}).catch(e=>{if(token===this.generation)this.cancel(e.message);throw e;}).finally(()=>{if(this.preparing===op)this.preparing=null;});
    this.preparing=op;return op;
  }
  async predict(text,options={}){await this.prepare();return this.request('predict',{text,...options},60000);}
  async transcribe(audio,language){await this.prepare();return this.request('transcribe',{audio:audio.buffer.slice(audio.byteOffset,audio.byteOffset+audio.byteLength),language},180000);}
  cancel(message='Language operation cancelled'){
    this.generation++;
    this.worker?.terminate();this.worker=null;this.ready=false;this.preparing=null;
    for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error(message));}this.pending.clear();
  }
  cancelPending(){if(this.pending.size)this.cancel();}
}
