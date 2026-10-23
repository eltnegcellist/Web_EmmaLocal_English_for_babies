import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getSpec,checkedEncoderInput,sampleMel,median} from './src/multilingual/acft-encoder-benchmark.js';
import {inspectDecoderSignature,fakeDecoderInputs} from './src/multilingual/acft-decoder-probe.js';
import {wasmMagic,wasmFileLocator,probeWasmFile,selectValidLiteRtWasm}
  from './src/multilingual/acft-wasm-source.js';
for(const id of ['base5','base10','small5','small10']){
 const s=getSpec(id);
 assert.equal(s.frames,s.seconds*100);
 assert(s.url.endsWith('/'+s.tier+'/acft_whisper_'+s.tier+'_'+s.seconds+'s_drq.tflite'));
 const shape=[1,80,s.frames];
 assert.deepEqual(checkedEncoderInput([{name:'x',shape,dtype:'float32'}],s.frames),{name:'x',shape});
 assert.equal(sampleMel(s.frames).length,80*s.frames);
 assert.throws(()=>checkedEncoderInput([{name:'x',shape:[1,80,3000],dtype:'float32'}],s.frames));
}
assert.throws(()=>getSpec('base.en5'));
assert.equal(median([8,2,4]),4);
assert.equal(median([4,1,3,2]),2.5);
const decodeSpec=inspectDecoderSignature([
 {name:'serving_default_mask:0',dtype:'float32',shape:[1,128,128]},
 {name:'serving_default_audio:0',dtype:'float32',shape:[1,250,512]},
 {name:'serving_default_tokens:0',dtype:'int32',shape:[1,128]}
],[{name:'logits',dtype:'float32',shape:[1,128,51865]}],[1,250,512]);
assert.equal(decodeSpec.audio.name,'serving_default_audio:0');
assert.equal(decodeSpec.tokens.name,'serving_default_tokens:0');
assert.equal(decodeSpec.mask.name,'serving_default_mask:0');
assert.equal(decodeSpec.outputs[0].shape[2],51865);
const realS25DecoderDetails=[
 {name:'args_2',dtype:'float32',shape:[1,1,128,128]},
 {name:'args_0',dtype:'float32',shape:[1,250,768]},
 {name:'args_1',dtype:'int32',shape:[1,128]}
];
const realS25Spec=inspectDecoderSignature(realS25DecoderDetails,
 [{name:'logits',dtype:'float32',shape:[1,128,51865]}],[1,250,768]);
assert.equal(realS25Spec.mask.name,'args_2');
assert.deepEqual(realS25Spec.mask.shape,[1,1,128,128]);
assert.equal(realS25Spec.audio.name,'args_0');
assert.equal(realS25Spec.tokens.name,'args_1');
const realS25Inputs=fakeDecoderInputs(realS25Spec);
assert.equal(realS25Inputs.mask.length,1*1*128*128);
assert.equal(realS25Inputs.mask[127*128+127],0);
assert.equal(realS25Inputs.mask[126*128+127],-1e9);
assert.deepEqual(Array.from(realS25Inputs.tokens.slice(0,4)),[50258,50259,50359,50363]);
assert.throws(()=>inspectDecoderSignature([
 {name:'args_2',dtype:'float32',shape:[1,2,128,128]},
 {name:'args_0',dtype:'float32',shape:[1,250,768]},
 {name:'args_1',dtype:'int32',shape:[1,128]}
],[],[1,250,768]),/Unrecognized/);
const dummy=fakeDecoderInputs(decodeSpec);
assert.deepEqual(Array.from(dummy.tokens.slice(0,4)),[50258,50259,50359,50363]);
assert.equal(dummy.mask[0],0);
assert.equal(dummy.mask[1],-1e9);
assert.equal(dummy.mask[128],0);
assert.throws(()=>inspectDecoderSignature([
 {name:'mask',dtype:'float32',shape:[1,128,128]},
 {name:'audio',dtype:'float32',shape:[1,1500,512]},
 {name:'tokens',dtype:'int32',shape:[1,128]}],[],[1,250,512]),/Unrecognized/);
const binary=new Uint8Array([0,97,115,109,1,0,0,0]);
assert(wasmMagic(binary));
assert(!wasmMagic(new TextEncoder().encode('<!DOCTYPE html>')));
assert.equal(wasmFileLocator('https://example.test/wasm/').locateFile('litert_wasm_internal.wasm'),
  'https://example.test/wasm/litert_wasm_internal.wasm');
await probeWasmFile('https://example.test/wasm/litert_wasm_internal.wasm',
  async()=>new Response(binary));
await assert.rejects(()=>probeWasmFile('https://example.test/bad.wasm',
  async()=>new Response('<!DOCTYPE html>')),/Invalid WASM magic 3c 21 44 4f/);
const touched=[];
const alternative=await selectValidLiteRtWasm({
 bases:['https://bad.test/wasm/','https://good.test/wasm/'],
 fetcher:async url=>{
   touched.push(String(url));
   return String(url).includes('bad.test')?new Response('<!DOCTYPE html>'):new Response(binary);
 }
});
assert.equal(alternative.base,'https://good.test/wasm/');
assert.equal(touched.length,3);
const worker=await readFile('./src/multilingual/acft-encoder-worker.js','utf8');
assert(worker.includes("self.Module=locator"),'Emscripten must resolve WASM relative to CDN, not GitHub Pages worker URL');
assert(worker.includes("selectValidLiteRtWasm"),'Validate fetched WASM file before runtime initialization');
assert(worker.includes("data.action==='runtime-smoke'"),'Real browser runtime-only check should not fetch models');
const page=await readFile('./src/multilingual/acft-encoder-page.js','utf8');
assert(page.includes("{type:'classic'}"),'LiteRT requires classic Web Worker');
assert(!page.includes("{type:'module'}"),'Module workers cannot call importScripts');
assert(!/^\s*import\s+(?!\()/m.test(worker),'Classic worker entry cannot use static import declarations');
assert(worker.includes("await import('./acft-encoder-benchmark.js')"),'Helper should use dynamic import in classic Worker');
assert(worker.includes("typeof self.importScripts==='function'"),'Must expose actual runtime support');
const html=await readFile('./whisper-acft-benchmark.html','utf8');
assert(worker.includes("accelerator:'wasm'"));
assert(!worker.includes("accelerator:'webgpu'"));
assert(worker.includes("model.signatures?.encode"));
assert(worker.includes("runner.run({[input.name]:tensor})"));
assert(worker.includes('inspectDecoderSignature'),'Optional Decoder probe must be wired');
assert(page.includes('probeDecoder'),'Decoder option must be explicitly opt-in');
assert(html.includes('文字起こし・言語判定・Decoderの測定ではありません'));
console.log('ACFT CPU-only encoder benchmark scaffolding PASS');
