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

// A transient HTTP failure or a corrupt response must be retried before a
// user-facing playback error; good audio must never be replaced by bad data.
let transientAttempts=0;
const transient=new PrerecordedVoiceBank({
  manifestUrl:'https://example.test/transient/manifest.json',cacheStorage,
  wait:async()=>{},
  fetcher:async url=>{
    if(String(url).endsWith('.json'))return new Response(JSON.stringify(manifest));
    transientAttempts++;
    if(transientAttempts===1)return new Response('temporary error',{status:503});
    if(transientAttempts===2)return new Response('truncated');
    return new Response(audio);
  }
});
await transient.init();
assert.equal((await transient.audioFor(entry.text)).size,audio.length);
assert.equal(transientAttempts,3,'Transient HTTP and checksum failures get bounded retries');
await transient.audioFor(entry.text);
assert.equal(transientAttempts,3,'The verified audio is reused after a successful retry');

// Reproduce "1104/1105": one broken file should leave the other files usable.
// The next prefetch pass only revisits missing files in the same Worker.
const retryCache=new Map();
const retryStorage={async open(){return {
  async match(k){return retryCache.get(String(k))?.clone();},
  async put(k,v){retryCache.set(String(k),v.clone());},
  async delete(k){return retryCache.delete(String(k));}
};}};
const flakyEntries=Array.from({length:3},(_,i)=>({...entry,text:'Recover '+i+'.',
  file:'clips/'+String(i+4).repeat(24)+'.m4a'}));
let missing=true,clipAttempts=0;
const recovery=new PrerecordedVoiceBank({
 manifestUrl:'https://example.test/recovery/manifest.json',cacheStorage:retryStorage,
 wait:async()=>{},
 fetcher:async url=>{
   if(String(url).endsWith('.json'))return new Response(JSON.stringify({...manifest,entries:flakyEntries}));
   clipAttempts++;
   if(missing && String(url).includes('/clips/'+String(6).repeat(24)+'.m4a'))
     return new Response('temporarily unavailable',{status:503});
   return new Response(audio);
 }
});
await recovery.init();
const statuses1=[];
await recovery.prefetchAll(status=>statuses1.push(status));
assert.equal(statuses1.at(-1).stage,'partial');
assert.equal(statuses1.at(-1).completed,2);
assert.equal(statuses1.at(-1).failed,1);
assert.match(statuses1.at(-1).reason,/503/);
assert.equal((await recovery.audioFor(flakyEntries[0].text)).size,audio.length,
  'Already downloaded voices must play despite missing clips');
const beforeRepair=clipAttempts;
missing=false;
const statuses2=[];
await recovery.prefetchAll(status=>statuses2.push(status));
assert.equal(statuses2.at(-1).stage,'complete');
assert.equal(statuses2.at(-1).completed,3);
assert.equal(statuses2.at(-1).failed,0);
assert.equal(clipAttempts,beforeRepair+1,'Only the failed file is downloaded again');
await recovery.prefetchAll();
assert.equal(clipAttempts,beforeRepair+1,'Fully completed bank must not redownload');

// A private-browser CacheStorage quota failure must be identified separately
// from a network error; on-demand playback must remain possible.
const quota=new PrerecordedVoiceBank({
 manifestUrl:'https://example.test/quota/manifest.json',wait:async()=>{},
 cacheStorage:{async open(){return {
  async match(){return null;},
  async put(){throw new DOMException('The quota has been exceeded','QuotaExceededError');},
  async delete(){return false;}
 };}},
 fetcher:async url=>String(url).endsWith('.json')
   ?new Response(JSON.stringify(manifest)):new Response(audio)
});
await quota.init();
const quotaStatus=[];
await quota.prefetchAll(status=>quotaStatus.push(status));
assert.equal(quotaStatus.at(-1).stage,'paused');
assert.match(quotaStatus.at(-1).message,/保存容量/);
assert.equal((await quota.audioFor(entry.text)).size,audio.length,
  'CacheStorage quota must not block on-demand speech');

console.log('Prerecorded voice: manifest-only first run, requested clips and progressive cache fill PASS');
