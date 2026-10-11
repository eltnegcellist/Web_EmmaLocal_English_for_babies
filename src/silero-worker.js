import { ort } from '../semantic-assets/runtime-ort1.30.0-tokenizers0.2.0/runtime.mjs';
const MODEL_SHA='1a153a22f4509e292a94e67d6f9b85e8deb25b4988682b7e174c65279d8788e3';
let session,state,context;
function reset() { state=new Float32Array(256);context=new Float32Array(64); }
async function modelBytes() {
  const url=new URL('../assets/vad/silero_vad.onnx',import.meta.url).href;
  let cache;try { cache=await caches.open('mitsukotoba-silero-'+MODEL_SHA); } catch {}
  let response=await cache?.match(url);
  if(!response) { response=await fetch(url);if(!response.ok)throw Error('Sileroモデルを取得できませんでした。'); }
  const data=await response.clone().arrayBuffer();
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');
  if(actual!==MODEL_SHA) { await cache?.delete(url);throw Error('Sileroモデルの検証に失敗しました。'); }
  try { await cache?.put(url,response); } catch {}
  return data;
}
let serial=Promise.resolve();
self.onmessage=({data})=>{
  serial=serial.then(async()=>{
    if(data.type==='init') {
      ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
      ort.env.wasm.wasmPaths=new URL('../semantic-assets/runtime-ort1.30.0-tokenizers0.2.0/',import.meta.url).href;
      session=await ort.InferenceSession.create(await modelBytes(),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
      reset();self.postMessage({type:'ready'});
    } else if(data.type==='reset')reset();
    else if(data.type==='frame') {
      const input=new Float32Array(576);input.set(context);input.set(data.samples,64);
      const feeds={input:new ort.Tensor('float32',input,[1,576]),state:new ort.Tensor('float32',state,[2,1,128]),sr:new ort.Tensor('int64',BigInt64Array.of(16000n),[])};
      let output;
      try {
        output=await session.run(feeds);state=new Float32Array(output.stateN.data);context=data.samples.slice(448);
        self.postMessage({type:'probability',probability:output.output.data[0],epoch:data.epoch,endSample:data.endSample});
      } finally {
        for(const t of Object.values(feeds))t.dispose();if(output)for(const t of Object.values(output))t.dispose();
      }
    }
  }).catch(error=>self.postMessage({type:'error',message:error.message||String(error)}));
};
