import assert from 'node:assert/strict';
import{readFile}from'node:fs/promises';
import{JSDOM}from'jsdom';
import{resolveLanguage,modelRoute,speechLanguage,meaningfulSpeech,selectE5Axes,LANGUAGES,LANGUAGE_KEY}from'./src/multilingual/core.js';
import{installLanguageUI}from'./src/multilingual/ui.js';
import{prepareAssets,digest,MODEL_CACHE,openChunkStore}from'./src/multilingual/assets.js';
import{indexedDB as fakeIndexedDB}from'fake-indexeddb';
import{MultilingualClient}from'./src/multilingual/client.js';
import{selectRuriAxes}from'./src/interaction/ruri-routing.js';
import{CATALOG,translate}from'./src/multilingual/translations.js';
assert(CATALOG.every(row=>row.length===6&&row.every(v=>typeof v==='string')));
assert.match(translate('3件選択中','en'),/3 selected/);
assert.match(translate('1 / 3　Emmaと会おう','en'),/Meet Emma/);
assert.equal(translate('みつことば','en'),'Three Voices');
assert.equal(translate('みつことば','de'),'Drei Stimmen');
assert.equal(translate('みつことば','fr'),'Trois voix');
assert.equal(translate('みつことば','ko'),'세 목소리');
assert.equal(translate('みつことば','th'),'สามเสียง');
assert(!translate('みつことばの使い方','en').includes('Mitsukotoba'));

assert.deepEqual(resolveLanguage({saved:'ko',languages:['ja-JP']}),{language:'ko',needsChoice:false,source:'saved'});
assert.equal(resolveLanguage({languages:['de-AT','en-US']}).language,'de');
assert.equal(resolveLanguage({languages:['zh-CN'],region:'TH'}).language,'th');
assert.equal(resolveLanguage({languages:['zh-CN']}).needsChoice,true);
assert.equal(modelRoute('ja'),'japanese');for(const l of LANGUAGES.filter(l=>l!=='ja'))assert.equal(modelRoute(l),'multilingual');
assert.equal(speechLanguage('en'),null);assert.equal(speechLanguage('ko'),'ko');
for(const text of ['물','นม','Ja','Yes','Lait'])assert(meaningfulSpeech(text));assert(!meaningfulSpeech('...'));
const topic={id:'milk',probability:.2,margin:.01},inter={id:'praise',probability:.15,margin:.02};
assert.deepEqual(selectRuriAxes(topic,inter),{topic:null,interaction:null});
assert.deepEqual(selectE5Axes(topic,inter),{topic:'milk',interaction:'praise'});
assert.deepEqual(selectE5Axes({id:'generic',probability:.8,margin:.5},{id:'none',probability:.8,margin:.5}),{topic:null,interaction:null});
assert.deepEqual(selectE5Axes(null,{id:'praise',probability:NaN,margin:.2}),{topic:null,interaction:null});
const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
for(const lang of LANGUAGES){
 const dom=new JSDOM(html,{url:'https://example.test'});globalThis.MutationObserver=dom.window.MutationObserver;
 const ui=installLanguageUI({document:dom.window.document,storage:dom.window.localStorage,languages:[lang],onChange:async(_,o)=>o.commit()});
 const history=dom.window.document.createElement('p');history.className='history-japanese';history.textContent='親';dom.window.document.body.append(history);
 assert.equal(dom.window.document.documentElement.lang,lang);
 assert.equal(dom.window.document.querySelectorAll('.language-picker select').length,3);
 assert.equal(dom.window.document.querySelector('#prepareEmmaButton').disabled,false);
 await ui.choose('ko');assert.equal(dom.window.localStorage.getItem(LANGUAGE_KEY),'ko');
 assert.equal(dom.window.document.querySelector('#onboardingScreen .brand-wordmark').textContent,'세 목소리');
 assert.equal(dom.window.document.querySelector('#homeScreen .home-brand h1').textContent,'세 목소리');
 assert.equal(dom.window.document.title,'세 목소리 Web');
 assert.equal(history.textContent,'親','Language changes must not translate the user’s original history text');
 assert.equal(dom.window.document.querySelector('#settingsLanguage').value,'ko');
 await ui.choose('ja');assert.match(dom.window.document.querySelector('.welcome-hero h1').textContent,/いつもの日本語/);
 assert.equal(dom.window.document.querySelector('#onboardingScreen .brand-wordmark').textContent.replace(/\s/g,''),'みつことば');
 assert.equal(dom.window.document.querySelector('#onboardingScreen .brand-wordmark').children.length,5);
 ui.dispose();dom.window.close();
}
assert(!html.includes('id="onboardingAiIntro"'),'Emma introduction should appear only in the tutorial');
 assert(html.includes('Bath time is here! Is the water warm? Splash, splash!'),'The first-page bath example should match a real reply');
 const unsupported=new JSDOM(html,{url:'https://unknown.test'});globalThis.MutationObserver=unsupported.window.MutationObserver;
const unknown=installLanguageUI({document:unsupported.window.document,storage:unsupported.window.localStorage,languages:['zh-CN']});
assert(unknown.needsChoice);assert(unsupported.window.document.querySelector('#prepareEmmaButton').disabled);unknown.dispose();unsupported.window.close();
let network=0;const store=new Map();const bytes=new TextEncoder().encode('verified test model'),meta={model:'test',file:'model.onnx',url:'https://models.test/pinned/model',bytes:bytes.length,sha256:await digest(bytes)};
store.set(meta.url,new Response('corrupt cache'));
const cache={match:async k=>store.get(k)?.clone(),put:async(k,v)=>store.set(k,v),delete:async k=>store.delete(k)};
const cacheStorage={open:async name=>{assert.equal(name,MODEL_CACHE);return cache;}};
const fetcher=async()=>{network++;return new Response(bytes);};
await prepareAssets({assets:[meta]},{fetcher,cacheStorage});await prepareAssets({assets:[meta]},{fetcher,cacheStorage});assert.equal(network,1);
 // Exercise real chunk transactions using the existing fake-indexeddb dev dependency.
 const chunks=await openChunkStore(fakeIndexedDB);
 await chunks.write(meta,bytes.buffer);
 const saved=await chunks.read(meta);
 assert.deepEqual(new Uint8Array(await saved.arrayBuffer()),bytes);
 assert.equal(await chunks.read({...meta,sha256:'invalid'}),null);
 // Reproduce Chrome's reported Cache.put("Unexpected internal error").
 let fallbackDownloads=0,fallbackWrites=0,stored=null,cachePutFailures=0;
 const failingCacheStorage={open:async()=>({match:async()=>null,delete:async()=>true,
   put:async()=>{cachePutFailures++;throw Error('Unexpected internal error');}})};
 const fallbackStore={write:async(_,data)=>{fallbackWrites++;stored=data.slice(0);},
   read:async()=>stored?new Response(stored.slice(0)):null};
 const options={cacheStorage:failingCacheStorage,chunkStore:fallbackStore,chunkThresholdBytes:1e9,
   fetcher:async()=>{fallbackDownloads++;return new Response(bytes.slice());}};
 const prepared=await prepareAssets({assets:[meta]},options);
 assert.equal(fallbackWrites,1);assert.equal(cachePutFailures,1);
 assert.equal((await prepared.match(meta.url)).ok,true);
 await prepareAssets({assets:[meta]},options);assert.equal(fallbackDownloads,1);
 // Prefer IndexedDB for large files, avoiding Cache.put entirely.
 stored=null;await prepareAssets({assets:[meta]},{...options,chunkThresholdBytes:0});
 assert.equal(cachePutFailures,1);
 
const workers=[];const c=new MultilingualClient({workerFactory:()=>{const w={postMessage(data){this.last=data;},terminate(){this.closed=true;}};workers.push(w);return w;}});
const first=c.prepare();const firstHandled=first.catch(e=>e.message);c.cancel();const next=c.prepare();
workers[1].onmessage({data:{type:'result',requestId:workers[1].last.requestId,result:{ready:true}}});
await next;await firstHandled;assert(c.ready);assert.equal(workers[1].closed,undefined);c.cancel();
console.log('PASS: locale precedence, fallback setup, six UI languages, switch persistence, routing, short foreign speech, verified cache repair/reuse, stale worker cancellation.');
