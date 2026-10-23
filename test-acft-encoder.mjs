import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getSpec,checkedEncoderInput,sampleMel,median} from './src/multilingual/acft-encoder-benchmark.js';
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
const worker=await readFile('./src/multilingual/acft-encoder-worker.js','utf8');
const page=await readFile('./src/multilingual/acft-encoder-page.js','utf8');
assert(page.includes("{type:'classic'}"),'LiteRT requires classic Web Worker');
assert(!page.includes("{type:'module'}"),'Module workers cannot call importScripts');
assert(!/^\\s*import\\s+(?!\\()/m.test(worker),'Classic worker entry cannot use static import declarations');
assert(worker.includes("await import('./acft-encoder-benchmark.js')"),'Helper should use dynamic import in classic Worker');
assert(worker.includes("typeof self.importScripts==='function'"),'Must expose actual runtime support');
const html=await readFile('./whisper-acft-benchmark.html','utf8');
assert(worker.includes("accelerator:'wasm'"));
assert(!worker.includes("accelerator:'webgpu'"));
assert(worker.includes("model.signatures?.encode"));
assert(worker.includes("runner.run({[input.name]:tensor})"));
assert(html.includes('文字起こし・言語判定・Decoderの測定ではありません'));
console.log('ACFT CPU-only encoder benchmark scaffolding PASS');
