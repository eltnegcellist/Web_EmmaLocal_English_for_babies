// Experimental, separate from the production Whisper worker. CPU-only.
// Real ACFT encode signature on synthetic log-mel data: not a speech transcript.
import {getSpec,checkedEncoderInput,sampleMel,median} from './acft-encoder-benchmark.js';
const notify=message=>self.postMessage(message);
self.onmessage=async({data})=>{
  if(data?.action!=='benchmark')return;
  let model=null;
  const tick=()=>performance.now(),start=tick();
  try{
    const spec=getSpec(data.model);
    notify({type:'status',text:'LiteRT.js WASM CPUを準備しています'});
    const {loadLiteRt,loadAndCompile,Tensor}=await import('https://cdn.jsdelivr.net/npm/@litertjs/core@2.5.3/+esm');
    await loadLiteRt('https://cdn.jsdelivr.net/npm/@litertjs/core@2.5.3/wasm/');
    notify({type:'status',text:data.bytes?'ローカルのACFTモデルをコンパイル中':`ACFT ${spec.tier} ${spec.seconds}s を取得・コンパイル中（約${spec.approxMB}MB）`});
    const loadStart=tick();
    model=await loadAndCompile(data.bytes?new Uint8Array(data.bytes):spec.url,{accelerator:'wasm'});
    const loadingMs=Math.round(tick()-loadStart);
    const runner=model.signatures?.encode;
    if(!runner)throw Error('The model does not provide an encode signature');
    const input=checkedEncoderInput(runner.getInputDetails(),spec.frames);
    const feature=sampleMel(spec.frames),samples=[];
    notify({type:'status',text:'ウォームアップ1回＋計測5回を開始'});
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
      type:'complete',build:'20261023-acft-encoder-v1',
      model:spec.id,windowSeconds:spec.seconds,
      backend:'LiteRT.js 2.5.3 WASM CPU',
      encoderInputShape:input.shape,
      loadingMs,sampleMs:samples,medianMs:Math.round(median(samples)),
      totalMs:Math.round(tick()-start),
      device:self.navigator.userAgent,
      hardwareConcurrency:self.navigator.hardwareConcurrency||null,
      note:'Encoder ONLY. Synthetic mel input. No ASR, language detection, or decoder timing.'
    });
  }catch(e){notify({type:'error',error:String(e?.stack||e)});}
  finally{try{model?.delete();}catch{}}
};
