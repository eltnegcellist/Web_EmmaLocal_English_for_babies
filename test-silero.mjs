import assert from 'node:assert/strict';
import {SileroEndpointPolicy,AnalysisResampler,RawPcmWindow} from './src/silero-endpoint.js';
import {SileroCaptureDetector} from './src/silero-capture.js';
import {AdaptiveEndpointDetector,EmmaMicrophone} from './src/audio-capture.js';
let policy=new SileroEndpointPolicy();
for(let i=0;i<4;i++)assert.equal(policy.push(.9),'none');assert.equal(policy.push(.9),'speech-start');
for(let i=0;i<20;i++)assert.equal(policy.push(.36),'none');
for(let i=0;i<34;i++)assert.equal(policy.push(0),'none');assert.equal(policy.push(0),'utterance');
policy=new SileroEndpointPolicy();for(let i=0;i<16;i++)policy.push(.9);
for(let i=0;i<30;i++)assert.equal(policy.push(0),'none');for(let i=0;i<10;i++)policy.push(.4);
for(let i=0;i<34;i++)assert.equal(policy.push(0),'none');assert.equal(policy.push(0),'utterance');
policy=new SileroEndpointPolicy();for(let i=0;i<5;i++)policy.push(.9);let cancellation=false;
for(let i=0;i<30;i++){const event=policy.push(0);assert.notEqual(event,'utterance');if(event==='cancel')cancellation=true;}assert(cancellation);
for(const rate of [16000,44100,48000]){
 const samples=Float32Array.from({length:5000},(_,i)=>Math.sin(i*.15));
 const whole=new AnalysisResampler(rate).push(samples),streamed=[];const stream=new AnalysisResampler(rate);
 for(let i=0;i<samples.length;i+=128)streamed.push(...stream.push(samples.slice(i,i+128)));
 assert.deepEqual(streamed,whole,'analysis resampling phase must not depend on AudioWorklet block boundaries');
}
const ring=new RawPcmWindow(5);const source=Float32Array.of(.1,.2,.3,.4);
ring.append(source);ring.append(Float32Array.of(.5,.6,.7));assert.deepEqual([...ring.slice(2)],[...source.slice(2),...Float32Array.of(.5,.6,.7)]);
assert.equal(source[0],Math.fround(.1),'VAD must not change captured samples');
class WorkerStub {
 postMessage(message){this.last=message;if(message.type==='init')queueMicrotask(()=>this.onmessage({data:{type:'ready'}}));}
 terminate(){this.closed=true;}
 reply(probability,epoch,endSample){this.onmessage({data:{type:'probability',probability,epoch,endSample}});}
}
const worker=new WorkerStub(),events=[];
const detector=await SileroCaptureDetector.create({sampleRate:16000,onResult:r=>events.push(r),workerFactory:()=>worker});
detector.push(new Float32Array(512));const epoch=detector.epoch;detector.resetSpeechOnly();worker.reply(.9,epoch,512);assert.equal(events.length,0,'old TTS/turn results must be ignored');
for(let i=0;i<16;i++){detector.push(new Float32Array(512).fill(.1));worker.reply(.9,detector.epoch,(i+1)*512);}
for(let i=0;i<35;i++){detector.push(new Float32Array(512));worker.reply(0,detector.epoch,(i+17)*512);}
assert.equal(events.filter(x=>x.event==='utterance').length,0,'post-roll must be captured before delivering the WAV');
for(let i=0;i<5;i++)detector.push(new Float32Array(512));assert.equal(events.filter(x=>x.event==='utterance').length,1);
assert(events.find(x=>x.event==='utterance').audio.some(x=>x===Math.fround(.1)));
detector.close();assert(worker.closed);
const waitingWorker={postMessage(){},terminate(){this.closed=true;}};
const abort=new AbortController();const cancelled=SileroCaptureDetector.create({sampleRate:16000,onResult(){},signal:abort.signal,workerFactory:()=>waitingWorker});
abort.abort();await assert.rejects(cancelled,/cancelled/);assert(waitingWorker.closed,'stop while initializing must terminate the worker');
let stopped=false;Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>stopped=true}]})}},configurable:true});
globalThis.AudioContext=class {constructor(){this.state='running';this.sampleRate=16000;}async close(){this.state='closed';}createGain(){return {gain:{},connect(){}};}createMediaStreamSource(){return {connect(){return this;}};}audioWorklet={addModule:async()=>{}};};
globalThis.AudioWorkletNode=class {constructor(){this.port={};}connect(){return {connect(){}};}disconnect(){}};
const mic=new EmmaMicrophone({endpointMode:'legacy'});await mic.start();assert(mic.vad instanceof AdaptiveEndpointDetector);await mic.stop();assert(stopped);
console.log('Silero policy, waveform retention, streaming resampling, stale results, post-roll, cleanup and legacy rollback: OK');
