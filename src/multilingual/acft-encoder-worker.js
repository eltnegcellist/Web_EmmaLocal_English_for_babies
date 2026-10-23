// Experimental, separate from the production Whisper worker. CPU-only.
// Real ACFT encode signature on synthetic log-mel data: not a speech transcript.
// IMPORTANT: This entry must be a CLASSIC worker. LiteRT.js 2.5.x uses
// Emscripten importScripts() to load its WASM glue and module Workers forbid
// that API. Use dynamic import() (supported in dedicated classic workers)
// for our own ES module helper; do NOT add top-level static import here.
const WORKER_BUILD='20261023-acft-decoder-probe-v4';
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
  if(data?.action!=='benchmark' && data?.action!=='runtime-smoke')return;
  let model=null,stage='startup';
  const tick=()=>performance.now(),start=tick();
  try{
    if(typeof self.importScripts!=='function')throw Error('LiteRT.js requires a CLASSIC Worker (importScripts is unavailable)');
    const {getSpec,checkedEncoderInput,sampleMel,median}=await import('./acft-encoder-benchmark.js');
    const spec=getSpec(data.model);
    notify({type:'status',text:'LiteRT.js WASM CPUを準備しています'});
    stage='import-litert';
    const {loadLiteRt,loadAndCompile,Tensor}=await import('https://cdn.jsdelivr.net/npm/@litertjs/core@2.5.3/+esm');
    stage='verify-wasm-files';
    const {selectValidLiteRtWasm}=await import('./acft-wasm-source.js');
    const {base,locator}=await selectValidLiteRtWasm({
      onCandidate:base=>notify({type:'status',text:'WASMファイルの検証: '+base})
    });
    // The glue script is loaded using importScripts() but Emscripten may use
    // the Worker URL as its base for .wasm. Explicitly pass locateFile into
    // the upstream ModuleFactory via self.Module (wasm-utils createWasmLib).
    self.Module=locator;
    notify({type:'status',text:'WASMの実体を確認済み。バイナリ読込先: '+base});
    stage='init-wasm';
    await loadLiteRt(base);
    if(data.action==='runtime-smoke'){
      notify({type:'runtime-ready',build:WORKER_BUILD,wasmBase:base,
        classicImportScripts:typeof self.importScripts==='function'});
      return;
    }
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
    let decoderProbe=null;
    if(data.decoderProbe){
      stage='decoder-probe';
      let encoded=null,melTensor=null,maskTensor=null,tokensTensor=null;
      try{
        const {inspectDecoderSignature,fakeDecoderInputs}=
          await import('./acft-decoder-probe.js');
        const decoder=model.signatures?.decode;
        if(!decoder)throw Error('ACFT decode signature missing');
        const encodeOutDetails=runner.getOutputDetails();
        if(encodeOutDetails.length!==1)throw Error('Expected exactly one encoder output');
        const encodedShape=Array.from(encodeOutDetails[0].shape);
        const schema=inspectDecoderSignature(decoder.getInputDetails(),
          decoder.getOutputDetails(),encodedShape);
        notify({type:'status',text:'DecoderのWASM推論を開始（ウォームアップ1回＋3回）'});
        melTensor=new Tensor(feature,input.shape);
        encoded=await runner.run({[input.name]:melTensor});
        const encodedTensor=encoded[encodeOutDetails[0].name];
        if(!encodedTensor)throw Error('Encoder output name mismatch: '+
          JSON.stringify(Object.keys(encoded)));
        const fake=fakeDecoderInputs(schema);
        tokensTensor=new Tensor(fake.tokens,schema.tokens.shape);
        maskTensor=new Tensor(fake.mask,schema.mask.shape);
        const decoderInputs={
          [schema.audio.name]:encodedTensor,
          [schema.mask.name]:maskTensor,
          [schema.tokens.name]:tokensTensor
        };
        const decoderMs=[];
        for(let i=0;i<4;i++){
          let outputs=null;
          try{
            const t0=tick();
            outputs=await decoder.run(decoderInputs);
            const ms=Math.round((tick()-t0)*100)/100;
            if(i>0){
              decoderMs.push(ms);
              notify({type:'status',text:'Decoder計測 '+i+'/3: '+Math.round(ms)+' ms'});
            }
          }finally{
            for(const t of Object.values(outputs||{}))t.delete?.();
          }
        }
        decoderProbe={status:'complete',steps:3,
          sampleMs:decoderMs,medianMs:Math.round(median(decoderMs)),
          inputs:decoder.getInputDetails().map(d=>({name:d.name,dtype:d.dtype,shape:Array.from(d.shape)})),
          outputs:schema.outputs,encoderOutputShape:encodedShape};
      }catch(e){
        decoderProbe={status:'unsupported',reason:String(e?.message||e)};
        notify({type:'status',text:'Decoder計測をスキップ: '+decoderProbe.reason});
      }finally{
        for(const t of Object.values(encoded||{}))t.delete?.();
        tokensTensor?.delete();maskTensor?.delete();melTensor?.delete();
      }
    }
    notify({
      type:'complete',build:WORKER_BUILD,
      model:spec.id,windowSeconds:spec.seconds,
      backend:'LiteRT.js 2.5.3 WASM CPU',
      encoderInputShape:input.shape,
      loadingMs,sampleMs:samples,medianMs:Math.round(median(samples)),
      decoderProbe,totalMs:Math.round(tick()-start),
      device:self.navigator.userAgent,
      hardwareConcurrency:self.navigator.hardwareConcurrency||null,
      note:data.decoderProbe?
        'Synthetic mel + fixed decoder tokens only. Decoder 3 full-graph calls; NOT actual transcription or total ASR.':
        'Encoder ONLY. Synthetic mel input. No ASR, language detection, or decoder timing.'
    });
  }catch(e){notify({type:'error',build:WORKER_BUILD,stage,
    error:String(e?.stack||e),classicImportScripts:typeof self.importScripts==='function'});}
  finally{try{model?.delete();}catch{}}
};
