// Experimental, separate from the production Whisper worker. CPU-only.
// Real ACFT encode signature on synthetic log-mel data: not a speech transcript.
// IMPORTANT: This entry must be a CLASSIC worker. LiteRT.js 2.5.x uses
// Emscripten importScripts() to load its WASM glue and module Workers forbid
// that API. Use dynamic import() (supported in dedicated classic workers)
// for our own ES module helper; do NOT add top-level static import here.
const WORKER_BUILD='20261023-acft-classic-worker-v2';
const notify=message=>self.postMessage(message);
self.onmessage=async({data})=>{
  if(data?.action==='capabilities') {
    try {
      const helper=await import('./acft-encoder-benchmark.js');
      notify({type:'capabilities',build:WORKER_BUILD,classicImportScripts:typeof self.importScripts==='function',
        dynamicModuleImport:typeof helper.getSpec==='function'});
    }catch(e){notify({type:'error',stage:'capabilities',build:WORKER_BUILD,error:String(e?.stack||e)});}
    return;
  }
  if(data?.action!=='benchmark')return;
  let model=null,stage='startup';
  const tick=()=>performance.now(),start=tick();
  try{
    if(typeof self.importScripts!=='function')throw Error('LiteRT.js requires a CLASSIC Worker (importScripts is unavailable)');
    const {getSpec,checkedEncoderInput,sampleMel,median}=await import('./acft-encoder-benchmark.js');
    const spec=getSpec(data.model);
    notify({type:'status',text:'LiteRT.js WASM CPUを準備しています'});
    stage='import-litert';
    const {loadLiteRt,loadAndCompile,Tensor}=await import('https://cdn.jsdelivr.net/npm/@litertjs/core@2.5.3/+esm');
    stage='init-wasm';
    await loadLiteRt('https://cdn.jsdelivr.net/npm/@litertjs/core@2.5.3/wasm/');
    notify({type:'status',text:data.bytes?'ローカルのACFTモデルをコンパイル中':`ACFT ${spec.tier} ${spec.seconds}s を取得・コンパイル中（約${spec.approxMB}MB）`});
    const loadStart=tick();
    stage='load-model';
    model=await loadAndCompile(data.bytes?new Uint8Array(data.bytes):spec.url,{accelerator:'wasm'});
    const loadingMs=Math.round(tick()-loadStart);
    stage='check-encoder-signature';
    const runner=model.signatures?.encode;
    if(!runner)throw Error('The model does not provide an encode signature');
    const input=checkedEncoderInput(runner.getInputDetails(),spec.frames);
    const feature=sampleMel(spec.frames),samples=[];
    notify({type:'status',text:'ウォームアップ1回＋計測5回を開始'});
    stage='encoder-inference';
    for(let i=0;i<6;i++){
      const tensor=new Tensor(feature,input.shape);
      let outputs=null;
      try{
        const t0=tick();
        outputs=await runner.run({[input.name]:tensor});
        const ms=tick()-t0;
        if(i) {samples.push(Math.round(ms*100)/100);notify({type:'sample',sample:i,ms:Math.round(ms)});}
      }finally{
        for(const output of Object.values(outputs||{}))output.delete?.();
        tensor.delete();
      }
    }
    notify({
      type:'complete',build:WORKER_BUILD,
      model:spec.id,windowSeconds:spec.seconds,
      backend:'LiteRT.js 2.5.3 WASM CPU',
      encoderInputShape:input.shape,
      loadingMs,sampleMs:samples,medianMs:Math.round(median(samples)),
      totalMs:Math.round(tick()-start),
      device:self.navigator.userAgent,
      hardwareConcurrency:self.navigator.hardwareConcurrency||null,
      note:'Encoder ONLY. Synthetic mel input. No ASR, language detection, or decoder timing.'
    });
  }catch(e){notify({type:'error',build:WORKER_BUILD,stage,
    error:String(e?.stack||e),classicImportScripts:typeof self.importScripts==='function'});}
  finally{try{model?.delete();}catch{}}
};
