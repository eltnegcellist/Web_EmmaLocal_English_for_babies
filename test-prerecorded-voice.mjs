import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash, webcrypto} from 'node:crypto';
import {PrerecordedVoiceBank, normalizeVoiceText} from './src/prerecorded-voice.js';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const fixture=JSON.parse(await readFile(new URL('./tests/fixtures/prerecorded-sample.json',import.meta.url),'utf8'));
const audio=await readFile(new URL('./tests/fixtures/prerecorded-sample.m4a',import.meta.url));
const id='a'.repeat(24),sha256=fixture.sha256;
assert.equal(createHash('sha256').update(audio).digest('hex'),sha256);
const entry={text:fixture.text,file:`clips/${id}.m4a`,bytes:audio.length,sha256};
const manifest={schemaVersion:1,generationSeed:1202,entries:[entry]};
const stores=new Map();
const cacheStorage={async open(name){if(!stores.has(name))stores.set(name,new Map());const map=stores.get(name);return {async match(key){return map.get(String(key))?.clone();},async put(key,value){map.set(String(key),value.clone());},async delete(key){return map.delete(String(key));}};}};
let downloads=0;
const fetcher=async url=>{downloads++;return String(url).endsWith('.json')?new Response(JSON.stringify(manifest)):new Response(audio);};
const bank=new PrerecordedVoiceBank({manifestUrl:'https://example.test/app/manifest.json',fetcher,cacheStorage});
const spaced='  '+entry.text.split(' ').join('\n  ')+'  ';
assert.equal(normalizeVoiceText(spaced),entry.text);
await bank.init();assert.equal(downloads,1,'Initial setup fetches only manifest');
assert.equal((await bank.audioFor(spaced)).size,audio.length);
assert.equal(await bank.audioFor('Different text.'),null);assert.equal(downloads,2);
const offline=new PrerecordedVoiceBank({manifestUrl:'https://example.test/app/manifest.json',fetcher:async()=>{throw Error('offline');},cacheStorage});
await assert.rejects(offline.init(),/最新版の音声一覧/);
const broken=new PrerecordedVoiceBank({manifestUrl:'https://example.test/other/manifest.json',cacheStorage:null,fetcher:async url=>String(url).endsWith('.json')?new Response(JSON.stringify(manifest)):new Response('corrupt audio')});
await assert.rejects(broken.audioFor(entry.text),/検証/);
// A repaired recording keeps its text-based URL. Expire the verified cache
// and bypass the browser HTTP cache when the new manifest changes its hash.
const repaired=Buffer.from(audio);
repaired[repaired.length-1]^=1;
const revised={...entry,sha256:createHash('sha256').update(repaired).digest('hex')};
let refreshes=0;
const updated=new PrerecordedVoiceBank({manifestUrl:'https://example.test/app/manifest.json',cacheStorage,
  fetcher:async(url,options)=>{
    if(String(url).endsWith('.json'))return new Response(JSON.stringify({...manifest,entries:[revised]}));
    assert.equal(options?.cache,'no-store');refreshes++;
    return new Response(repaired);
  }});
await updated.init();
assert.equal(refreshes,0,'Reload must not eagerly fetch audio');
assert.deepEqual(Buffer.from(await (await updated.audioFor(entry.text)).arrayBuffer()),repaired);
assert.equal(refreshes,1,'Repaired recording must be reused from its verified cache');
// The full cache fill begins only on explicit request, and survives future playback.
const backgroundStore=new Map();
const backgroundCacheStorage={async open(){return {
  async match(key){return backgroundStore.get(String(key))?.clone();},
  async put(key,value){backgroundStore.set(String(key),value.clone());},
  async delete(key){return backgroundStore.delete(String(key));}
};}};
const entries=Array.from({length:3},(_,i)=>({...entry,text:`Background ${i}.`,
  file:`clips/${String(i+1).repeat(24)}.m4a`}));
let backgroundRequests=0;
const background=new PrerecordedVoiceBank({manifestUrl:'https://example.test/bank/manifest.json',
  cacheStorage:backgroundCacheStorage,fetcher:async url=>{
    if(String(url).endsWith('.json'))return new Response(JSON.stringify({...manifest,entries}));
    backgroundRequests++;
    return new Response(audio);
  }});
await background.init();
assert.equal(backgroundRequests,0,'No bulk download while onboarding');
const statuses=[];
await background.prefetchAll(status=>statuses.push(status));
assert.equal(backgroundRequests,3);
assert.equal(statuses.at(-1).stage,'complete');
await background.audioFor(entries[2].text);
assert.equal(backgroundRequests,3,'Finished clips are reused from cache');
await background.prefetchAll();
assert.equal(backgroundRequests,3,'Completing the bank should not restart a full scan');
console.log('Prerecorded voice: manifest-only first run, requested clips and progressive cache fill PASS');
