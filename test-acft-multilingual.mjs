import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SAMPLE_RATE,windowSecondsForSamples,planAdaptiveWindows,mergeSegmentTexts}
  from './src/multilingual/acft-window-policy.js';
import {ACFT_MODEL} from './src/multilingual/acft-model-store.js';
assert.equal(windowSecondsForSamples(1),5);
assert.equal(windowSecondsForSamples(SAMPLE_RATE*5),5);
assert.equal(windowSecondsForSamples(SAMPLE_RATE*5+1),10);
assert.equal(windowSecondsForSamples(SAMPLE_RATE*10),10);
assert.equal(windowSecondsForSamples(SAMPLE_RATE*10+1),null);
for(const seconds of [0.5,4.999,5,5.001,7.9,9.999,10,10.001,10.8,15,20,30,59]){
 const samples=new Float32Array(Math.round(SAMPLE_RATE*seconds));
 const windows=planAdaptiveWindows(samples);
 assert.equal(windows[0].start,0,seconds+' start');
 assert.equal(windows.at(-1).end,samples.length,seconds+' end');
 for(let i=0;i<windows.length;i++){
  const part=windows[i];
  assert(part.windowSeconds===5||part.windowSeconds===10);
  assert(part.end-part.start<=part.windowSeconds*SAMPLE_RATE,seconds+' exceeds context');
  if(i>0)assert(part.start<windows[i-1].end,seconds+' gap');
 }
 if(seconds<=5)assert.deepEqual(windows.map(x=>x.windowSeconds),[5]);
 if(seconds>5&&seconds<=10)assert.deepEqual(windows.map(x=>x.windowSeconds),[10]);
 if(seconds>10)assert(windows.length>1);
}
const voiced=new Float32Array(SAMPLE_RATE*30);
for(let i=0;i<voiced.length;i++)voiced[i]=Math.sin(i/30)*.2;
assert.equal(planAdaptiveWindows(voiced).at(-1).end,voiced.length);
assert.equal(mergeSegmentTexts(['こんにちは。','こんにちは。']),'こんにちは。');
assert.equal(mergeSegmentTexts(['お風呂に入ろう','入ろうね']),'お風呂に入ろうね');
assert.equal(mergeSegmentTexts(['Hello little','little baby']),'Hello little baby');
assert.equal(mergeSegmentTexts(['hello','world']),'hello world');
assert.equal(ACFT_MODEL.bytes,264464624);
assert.equal(ACFT_MODEL.sha256,'15ef255465a6dc582ecf1ec651a4618c7ee2c18c05570bbe46493d248d465ac4');
const worker=await readFile(new URL('./src/multilingual/worker.js',import.meta.url),'utf8');
assert(worker.includes("asrBackend==='acft'?manifest.assets.filter(item=>item.model==='e5')"),
  'Do not fetch legacy Whisper ONNX when native ACFT is active');
const app=await readFile(new URL('./src/app.js',import.meta.url),'utf8');
assert(app.includes('onImportAcftFile:async file=>'));
assert(app.includes("usingAcft?'acft-whisper-small':'whisper-small'"));
console.log('Adaptive ACFT multilingual window routing smoke passed');
