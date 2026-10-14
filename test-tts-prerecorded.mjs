import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const fixture=JSON.parse(await readFile(new URL('./tests/fixtures/prerecorded-sample.json',import.meta.url),'utf8'));
const bytes=await readFile(new URL('./tests/fixtures/prerecorded-sample.m4a',import.meta.url));
const events=[],requests=[];
globalThis.self={postMessage:message=>events.push(message)};
globalThis.fetch=async url=>{
  requests.push(String(url));
  if(String(url).endsWith('/manifest.json'))return new Response(JSON.stringify({schemaVersion:1,generationSeed:1202,
    entries:[{text:fixture.text,file:'clips/'+'a'.repeat(24)+'.m4a',sha256:fixture.sha256,bytes:bytes.length}]}));
  assert.ok(String(url).endsWith('.m4a'),'Recorded playback must not fetch a synthesis model or CDN runtime');
  return new Response(bytes);
};
await import('./src/tts-worker.js');
await self.onmessage({data:{type:'init'}});
assert.equal(events.at(-1).type,'ready');assert.equal(events.at(-1).generationSeed,1202);
await self.onmessage({data:{type:'speak',requestId:7,text:fixture.text}});
const clip=events.find(event=>event.type==='audio');
assert.equal(clip.requestId,7);assert.equal(clip.engine,'qwen3-prerecorded');
assert.equal(clip.blob.type,'audio/mp4');
assert.deepEqual(new Uint8Array(await clip.blob.arrayBuffer()),new Uint8Array(bytes));
assert.deepEqual(events.at(-1),{type:'complete',requestId:7,total:1,engine:'qwen3-prerecorded',voice:'Mitsukotoba-1202'});
assert.equal(requests.length,2);
console.log('TTS worker: real adopted AAC, init/speak protocol, no Kitten/CDN dependency PASS');
