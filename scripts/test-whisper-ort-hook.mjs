// Integration test: patch an actual onnxruntime-web WASM InferenceSession.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as ort from 'onnxruntime-web';
import {attachWhisperSessionProfiler} from '../src/multilingual/whisper-profile.js';

ort.env.wasm.numThreads=1;
ort.env.wasm.proxy=false;
const silero=await readFile(new URL('../assets/vad/silero_vad.onnx',import.meta.url));
const session=await ort.InferenceSession.create(new Uint8Array(silero),{
  executionProviders:['wasm'],graphOptimizationLevel:'all'
});
const mockDecoder={async run(){return {token:1};}};
const profiler=attachWhisperSessionProfiler({sessions:{model:session,decoder_model_merged:mockDecoder}});
assert.equal(profiler.available,true,'Actual ORT session.run must be writable');
profiler.start();
const feeds={
  input:new ort.Tensor('float32',new Float32Array(576),[1,576]),
  state:new ort.Tensor('float32',new Float32Array(256),[2,1,128]),
  sr:new ort.Tensor('int64',BigInt64Array.of(16000n),[])
};
try{
  const result=await session.run(feeds);
  try{
    assert(result.output && result.stateN,'Actual WASM model must run');
  }finally{for(const value of Object.values(result))value.dispose();}
  assert.deepEqual(await mockDecoder.run(),{token:1});
  assert.deepEqual(await mockDecoder.run(),{token:1});
}finally{
  for(const value of Object.values(feeds))value.dispose();
}
const breakdown=profiler.stop();
assert.equal(breakdown.encoderRuns,1);
assert.equal(breakdown.decoderRuns,2);
assert(breakdown.encoderMs>=0);
assert(breakdown.decoderMs>=0);
await session.release();
console.log('PASS: actual ONNX Runtime WASM run is instrumented; encoder/decoder counters work');
