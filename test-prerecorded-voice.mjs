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
await bank.init();assert.equal((await bank.audioFor(spaced)).size,audio.length);
assert.equal(await bank.audioFor('Different text.'),null);assert.equal(downloads,2);
const offline=new PrerecordedVoiceBank({manifestUrl:'https://example.test/app/manifest.json',fetcher:async()=>{throw Error('offline');},cacheStorage});
await assert.rejects(offline.init(),/最新版の音声一覧/);
const broken=new PrerecordedVoiceBank({manifestUrl:'https://example.test/other/manifest.json',cacheStorage:null,fetcher:async url=>String(url).endsWith('.json')?new Response(JSON.stringify(manifest)):new Response('corrupt audio')});
await assert.rejects(broken.init(),/検証/);
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
assert.equal(refreshes,1);
assert.deepEqual(Buffer.from(await (await updated.audioFor(entry.text)).arrayBuffer()),repaired);
assert.equal(refreshes,1,'Repaired recording must be reused from its verified cache');
// Trial init lists the bank without downloading every recording, but every
// played AAC still passes the same length/hash checks as the ordinary app.
let trialDownloads=0;
const lazy=new PrerecordedVoiceBank({manifestUrl:'https://example.test/trial/manifest.json',cacheStorage:null,fetcher:async url=>{
  if(String(url).endsWith('.json'))return new Response(JSON.stringify(manifest));
  trialDownloads++;return new Response(audio);
}});
await lazy.init(()=>{},{preload:false});assert.equal(trialDownloads,0);
assert.equal((await lazy.audioFor(entry.text)).size,audio.length);assert.equal(trialDownloads,1);
assert.equal((await lazy.audioFor(entry.text)).size,audio.length);assert.equal(trialDownloads,1);
console.log('Prerecorded voice: real AAC lookup, whitespace, verified cache, complete offline reload and corruption rejection PASS');
