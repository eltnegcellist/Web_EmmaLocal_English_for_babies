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
      const researchMode=data.researchBenchmark==='s25-same-audio';
      const language=researchMode && data.language==='en' ? 'en' : 'ja';
      let pthreadMainScript=null;
      if(researchMode){
        // The benchmark's Service Worker controls its own folder, not src/vendor.
        // Blob pthread workers inherit the controlling research Worker's isolation.
        // The ordinary Mitsukotoba app never enters this branch.
        self.postMessage({type:'stage',stage:'pthread-bridge',
          message:'本番ASR Workerを再利用：pthreadスクリプトを分離環境に配置'});
        const url=new URL('./vendor/moonshine/moonshine.mjs',import.meta.url);
        const res=await fetch(url);
        if(!res.ok)throw Error('Moonshine pthread JS fetch failed: HTTP '+res.status);
        pthreadMainScript=new Blob([await res.text()],{type:'text/javascript'});
      }
      const wasmStarted=performance.now();
      const module=await loadEmmaMoonshineModule({pthreadMainScript});
      self.postMessage({type:'diagnostic',kind:'wasmInitMs',durationMs:performance.now()-wasmStarted});
      const selected=data.model==='tiny'?'tiny':'small';
      const architecture=selected==='tiny'?ModelArch.TinyStreaming:ModelArch.SmallStreaming;
      const manifest=module.sttDependencies(language,String(architecture),false);
      self.postMessage({type:'manifest',manifest,label:selected==='tiny'?'Tiny':'Small'});
      // Preserve the main-thread manifest cache inventory BEFORE downloading.
      await new Promise(resolve=>{resumeInitialization=resolve;});
      self.postMessage({type:'stage',stage:'catalog',message:language==='en'?'英語音声認識モデルを準備しています…':'日本語音声認識モデルを準備しています…'});
      const started=performance.now();
      const next=await Transcriber.load({
        module,language,modelArch:architecture,
        // Silero has already cut the utterance; a second VAD can drop speech.
        options:{vad_threshold:'0',vad_max_segment_duration:'1000',max_tokens_per_second:'13.0'},
        onProgress:(loaded,total,file,detail)=>self.postMessage({type:'progress',loaded,total,file,detail}),
        onAssetEvent:event=>self.postMessage({type:'asset-event',event}),
        onDiagnostic:event=>self.postMessage({type:'diagnostic',kind:event.kind,durationMs:event.durationMs})
      });
      transcriber?.close?.();
      transcriber=next;
      self.postMessage({type:'ready',kind:'moonshine',engine:'moonshine',model:selected+'-streaming-'+language,architecture:selected+'_streaming',license:'MIT',device:'wasm-cpu',worker:'dedicated',initMs:performance.now()-started,manifest});
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
