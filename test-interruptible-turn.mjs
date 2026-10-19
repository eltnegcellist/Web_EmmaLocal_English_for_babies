import assert from 'node:assert/strict';
import { TurnRevisions } from './src/turn-revisions.js';
import { MoonshineAsrClient } from './src/asr-client.js';
import { LiteResponseEngine } from './src/lite-response-engine.js';

const turn=new TurnRevisions({maxSamples:10});
const first=turn.append(Float32Array.of(1,2,3));
assert(turn.isCurrent(first.version));
assert.deepEqual([...first.audio],[1,2,3]);
assert(turn.speechStart(),'new speech invalidates speculative replies');
assert(!turn.isCurrent(first.version));
const second=turn.append(Float32Array.of(4,5));
assert.deepEqual([...second.audio],[1,2,3,4,5]);
assert(!turn.isCurrent(first.version));
assert(turn.isCurrent(second.version));
assert(turn.speechStart());
const third=turn.append(Float32Array.of(6));
assert.deepEqual([...third.audio],[1,2,3,4,5,6]);
turn.reset();
assert(!turn.isCurrent(third.version));
assert(!turn.hasAudio);
assert.deepEqual([...turn.append(Float32Array.of(7)).audio],[7]);

// Candidate turns must not spend one of the already-earned topic/name turns.
const engine=new LiteResponseEngine();
engine.respond('お風呂に入ろうね');
const before=engine.snapshotTurnState();
engine.respond('今日も');
engine.restoreTurnState(before);
assert.deepEqual(engine.snapshotTurnState(),before);

class StubWorker {
  postMessage(message){this.messages.push(message);}
  terminate(){this.terminated=true;}
  messages=[];
}
const worker=new StubWorker();
const client=new MoonshineAsrClient({workerFactory:()=>worker});
const init=client.init({model:'small'});
assert.deepEqual(worker.messages[0],{type:'init',model:'small'});
worker.onmessage({data:{type:'ready',model:'small-streaming-ja'}});
assert.equal((await init).model,'small-streaming-ja');
const pcm=Float32Array.of(0.5,0.25);
const request1=client.transcribe(pcm),request2=client.transcribe(pcm);
assert.deepEqual([...pcm],[.5,.25],'transferred PCM must not detach the replay buffer');
worker.onmessage({data:{type:'transcript',id:2,text:'今日も元気だね'}});
worker.onmessage({data:{type:'transcript',id:1,text:'今日も'}});
assert.equal(await request1,'今日も');
assert.equal(await request2,'今日も元気だね');
client.close();assert(worker.terminated);
console.log('Interruptible turns, stale revisions, PCM merging, and ASR worker protocol: OK');
