// Moonshine recognition runs off the UI thread so Silero and AudioWorklet
// keep receiving frames while a speculative turn is being transcribed.
const MOONSHINE_MODULE_URL = new URL('./moonshine-module.js', import.meta.url).href;
let transcriber = null;
let resumeInitialization = null;

self.onmessage = async ({data}) => {
  try {
    if(data.type==='resume-init') {resumeInitialization?.();resumeInitialization=null;return;}
    if(data.type==='init') {
      if(!self.crossOriginIsolated || typeof SharedArrayBuffer!=='function') {
        throw Error('Moonshineの実行に必要なブラウザ分離を有効にできませんでした。ページを再読み込みしてください。');
      }
      self.postMessage({type:'stage',stage:'runtime',message:'Moonshineの実行エンジンを準備しています…'});
      const {Transcriber,ModelArch,loadEmmaMoonshineModule}=await import(MOONSHINE_MODULE_URL);
      const wasmStarted=performance.now();
      const module=await loadEmmaMoonshineModule();
      self.postMessage({type:'diagnostic',kind:'wasmInitMs',durationMs:performance.now()-wasmStarted});
      const selected=data.model==='tiny'?'tiny':'small';
      const architecture=selected==='tiny'?ModelArch.TinyStreaming:ModelArch.SmallStreaming;
      const manifest=module.sttDependencies('ja',String(architecture),false);
      self.postMessage({type:'manifest',manifest,label:selected==='tiny'?'Tiny':'Small'});
      // Preserve the main-thread manifest cache inventory BEFORE downloading.
      await new Promise(resolve=>{resumeInitialization=resolve;});
      self.postMessage({type:'stage',stage:'catalog',message:'日本語音声認識モデルを準備しています…'});
      const started=performance.now();
      const next=await Transcriber.load({
        module,language:'ja',modelArch:architecture,
        options:{max_tokens_per_second:'13.0'},
        onProgress:(loaded,total,file,detail)=>self.postMessage({type:'progress',loaded,total,file,detail}),
        onAssetEvent:event=>self.postMessage({type:'asset-event',event}),
        onDiagnostic:event=>self.postMessage({type:'diagnostic',kind:event.kind,durationMs:event.durationMs})
      });
      // Reject only unsupported words instead of losing the entire childcare
      // vocabulary (the Japanese tokenizer rejects 喃語 on some builds).
      const accepted=[], skipped=[];
      for(const term of (data.keyterms||[])){
        try{next.setKeyterms([...accepted,term]);accepted.push(term);}
        catch(error){skipped.push(term);}
      }
      next.setKeyterms(accepted);
      self.postMessage({type:'diagnostic',kind:'keyterm-status',accepted:accepted.length,skipped});
      if(skipped.length)self.postMessage({type:'warning',message:'Moonshineで使用できない育児語を除外しました: '+skipped.join('、')});
      transcriber?.close?.();
      transcriber=next;
      self.postMessage({type:'ready',kind:'moonshine',engine:'moonshine',model:selected+'-streaming-ja',architecture:selected+'_streaming',license:'MIT',device:'wasm-cpu',worker:'dedicated',initMs:performance.now()-started,manifest});
      return;
    }
    if(data.type==='transcribe'){
      if(!transcriber)throw Error('Moonshine is not initialized');
      const audio=new Float32Array(data.audio);
      const result=transcriber.transcribe(audio,{sampleRate:16000});
      const text=Array.isArray(result?.lines)
        ? result.lines.map(line=>String(line?.text||'').trim()).filter(Boolean).join(' ').replace(/\s+/g,' ').trim()
        : '';
      self.postMessage({type:'transcript',id:data.id,text});
    }
  }catch(error){
    self.postMessage({type:'error',id:data.id,message:error?.message||String(error)});
  }
};
