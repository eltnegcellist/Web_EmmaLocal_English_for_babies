import assert from 'node:assert/strict';
import{readFile}from'node:fs/promises';
import{JSDOM}from'jsdom';
import{resolveLanguage,browserLanguages,modelRoute,speechLanguage,meaningfulSpeech,selectE5Axes,LANGUAGES,LANGUAGE_KEY,LANGUAGE_MODE_KEY}from'./src/multilingual/core.js';
import{installLanguageUI}from'./src/multilingual/ui.js';
import{prepareAssets,digest,MODEL_CACHE,openChunkStore}from'./src/multilingual/assets.js';
import{indexedDB as fakeIndexedDB}from'fake-indexeddb';
import{MultilingualClient}from'./src/multilingual/client.js';
import{WHISPER_THREAD_KEY,WHISPER_LANGUAGE_MODE_KEY,normalizeThreads,normalizeLanguageDetection,
 resolveWhisperThreads}from'./src/multilingual/performance.js';
import{installWhisperPerformanceControls}from'./src/multilingual/performance-controls.js';
import{selectRuriAxes}from'./src/interaction/ruri-routing.js';
import{CATALOG,translate}from'./src/multilingual/translations.js';
import{renderLocalizedAbout,ABOUT_LOCALES}from'./src/multilingual/about-page.js';
import{replyDisplayHint,explainReplyContext}from'./src/reply-display-hint.js';
assert(CATALOG.every(row=>row.length===6&&row.every(v=>typeof v==='string')));
assert.equal(translate('選んだ声を端末に準備しています…','en'),'Preparing recorded audio on your device…');
assert.equal(translate('みつことばの声を準備しています…','en'),'Preparing English audio…');
assert.equal(translate('選んだ声を準備しています… 350/1202 (32.6 MB)','en'),'Preparing recorded audio… 350/1202 (32.6 MB)');
assert(!translate('選んだ声を準備しています… 350/1202 (32.6 MB)','de').includes('選んだ声'));
assert(!translate('選んだ声を準備しています… 350/1202 (32.6 MB)','ko').includes('選んだ声'));
assert.equal(translate('選んだ声を準備しています… 350/1202 (32.6 MB)','ja'),'選んだ声を準備しています… 350/1202 (32.6 MB)');

assert.match(translate('3件選択中','en'),/3 selected/);
assert.match(translate('1 / 3　Emmaと会おう','en'),/Meet Emma/);
assert.equal(translate('みつことば','en'),'CooTrio');
assert.equal(translate('みつことば','de'),'CooTrio');
assert.equal(translate('みつことば','fr'),'CooTrio');
assert.equal(translate('みつことば','ko'),'CooTrio');
assert.equal(translate('みつことば','th'),'CooTrio');
for(const language of LANGUAGES.filter(x=>x!=='ja')){
  assert(!/[ぁ-んァ-ン一-龯]/u.test(translate('Whisperで音声を認識しています。',language)));
  assert(!/[ぁ-んァ-ン一-龯]/u.test(translate('音声認識が時間内に完了しませんでした。通常のブラウザタブか短い発話で再試行してください。',language)));
  assert(!/[ぁ-んァ-ン一-龯]/u.test(translate('Moonshineに必要なブラウザ分離を有効にできませんでした。通常のブラウザタブで開き直してください。',language)));
  assert(!/[ぁ-んァ-ン一-龯]/u.test(translate('選択した言語で赤ちゃんに話しかけてください。',language)));
}

assert(!translate('みつことばの使い方','en').includes('Mitsukotoba'));

assert.deepEqual(resolveLanguage({saved:'ko',languages:['ja-JP']}),{language:'ko',needsChoice:false,source:'saved'});
assert.equal(resolveLanguage({languages:['de-AT','en-US']}).language,'de');
assert.equal(resolveLanguage({languages:['zh-CN'],region:'TH'}).language,'th');
assert.deepEqual(resolveLanguage({languages:['zh-CN']}),{language:'en',needsChoice:false,source:'fallback'});
assert.deepEqual(browserLanguages({languages:['fr-CA','en-US'],language:'ja-JP'}),['fr-CA','en-US','ja-JP']);
assert.deepEqual(browserLanguages({languages:[],language:'ja-JP'}),['ja-JP']);
assert.equal(resolveLanguage({languages:browserLanguages({languages:[],language:'ja-JP'})}).language,'ja');
assert.equal(resolveLanguage({languages:['xx-XX','fr-FR','de-DE']}).language,'fr');
assert.equal(resolveLanguage({languages:['de-AT'],saved:'ko'}).language,'ko');
assert.equal(modelRoute('ja'),'japanese');for(const l of LANGUAGES.filter(l=>l!=='ja'))assert.equal(modelRoute(l),'multilingual');
assert.equal(speechLanguage('en'),null);assert.equal(speechLanguage('ko'),'ko');
assert.equal(normalizeThreads('9'),'auto');
assert.equal(normalizeThreads('4'),'4');
assert.equal(normalizeLanguageDetection(null),'once');
assert.equal(normalizeLanguageDetection('every'),'every');
assert.equal(normalizeLanguageDetection('fixed'),'fixed');
assert.equal(resolveWhisperThreads('auto',{hardwareConcurrency:8,crossOriginIsolated:true,sharedArrayBuffer:true}),4);
assert.equal(resolveWhisperThreads('2',{hardwareConcurrency:8,crossOriginIsolated:true,sharedArrayBuffer:true}),2);
assert.equal(resolveWhisperThreads('1',{hardwareConcurrency:8,crossOriginIsolated:true,sharedArrayBuffer:true}),1);
assert.equal(resolveWhisperThreads('4',{hardwareConcurrency:2,crossOriginIsolated:true,sharedArrayBuffer:true}),2);
assert.equal(resolveWhisperThreads('4',{hardwareConcurrency:8,crossOriginIsolated:false,sharedArrayBuffer:true}),1);
assert.equal(resolveWhisperThreads('4',{hardwareConcurrency:8,crossOriginIsolated:true,sharedArrayBuffer:false}),1);
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
 const visualLabel=dom.window.document.querySelector('#visualCueEnabled').closest('label').querySelector('span').textContent;
 assert.equal(visualLabel,translate('英語の内容を表すイラストを表示する',lang));
 assert.equal(dom.window.document.querySelector('#englishIllustrationSettings h2').textContent,translate('英語のイラスト',lang));
 if(lang!=='ja'){
  assert(!/[ぁ-んァ-ン一-龯]/u.test(visualLabel));
  assert(!/[ぁ-んァ-ン一-龯]/u.test(dom.window.document.querySelector('#visualCueHelp').textContent));
 }
 assert.equal(dom.window.document.title,lang==='ja'?'みつことば':'CooTrio');
 assert(dom.window.document.querySelector('link[rel="manifest"]').getAttribute('href').includes(
   lang==='ja'?'manifest.webmanifest':'manifest.intl.webmanifest'));
 const research=dom.window.document.querySelector('#aboutScreen .screen-content');
 const localized=research.querySelector('.localized-about-content');
 if(lang==='ja'){
   assert.equal(localized,null,'The complete original Japanese page should remain visible');
   assert(!research.querySelector(':scope > h1').hidden);
 }else{
   assert(localized,'A translated research page must be rendered');
   assert.equal(localized.querySelectorAll('article.card').length,16,'8 research sections, example, limitations and 6 references');
   assert.equal(localized.querySelectorAll('article.reference-card a[href]').length,6);
   assert.equal(localized.querySelectorAll('.citation-link[href^="#localized-ref-"]').length>=4,true);
   assert.equal(localized.querySelector('h1').textContent,ABOUT_LOCALES[lang].title);
   assert.equal(localized.hidden,false);
   assert.equal(research.querySelector(':scope > h1').hidden,true,'Do not show untranslated Japanese research');
 }

 assert.equal(ui.mode,'auto','First visit must use the browser locale');
 assert.equal(dom.window.document.querySelectorAll('.language-picker select').length,2);
 assert.equal(dom.window.document.querySelector('#homeLanguage'),null,'Never show language selector on conversation home');
 assert.equal(dom.window.document.querySelector('#explanationLanguage'),null,'Remove the obsolete explanation language selector');
 const settingsBody=dom.window.document.querySelector('#settingsScreen .settings-content');
 assert.equal(settingsBody.lastElementChild,dom.window.document.querySelector('.language-settings'),'Language must be the last Settings card');
 const redetectButton=dom.window.document.getElementById('redetectSpeechLanguage');
 assert(redetectButton,'Settings should provide a speech-language redetection control');
 assert.equal(redetectButton.hidden,lang!=='en','Only English multilingual mode shows the redetection button');
 assert.equal(redetectButton.textContent,translate('音声言語を再判定',lang));
 assert.equal(ui.explanationLanguage,lang);
 assert.equal(dom.window.document.querySelector('#replyJapanese').hidden,lang==='en');
 assert.equal(dom.window.document.querySelector('#onboardingLanguage').value,'auto');
 assert(!dom.window.document.querySelector('#prepareEmmaButton').disabled);
 assert.equal(ui.confirm(),true);
 assert.equal(dom.window.localStorage.getItem(LANGUAGE_KEY),lang);
 assert.equal(dom.window.localStorage.getItem(LANGUAGE_MODE_KEY),'auto');
 assert.equal(dom.window.document.querySelector('#prepareEmmaButton').disabled,false);
 // Legacy explanation-language preferences no longer change display behavior.
 dom.window.localStorage.setItem('mitsukotoba_explanation_language_v1','none');
 ui.apply();
 assert.equal(ui.explanationLanguage,lang);
 assert.equal(dom.window.document.querySelector('#replyJapanese').hidden,lang==='en');
 await ui.choose('ko');assert.equal(dom.window.localStorage.getItem(LANGUAGE_KEY),'ko');
 const korean=research.querySelector('.localized-about-content');
 assert(korean && korean.querySelector('h1').textContent===ABOUT_LOCALES.ko.title);
 assert.equal(korean.querySelectorAll('article.reference-card').length,6);

 assert.equal(dom.window.localStorage.getItem(LANGUAGE_MODE_KEY),'manual');
 assert.equal(dom.window.document.querySelector('#onboardingScreen .brand-wordmark').textContent,'CooTrio');
 assert.equal(dom.window.document.querySelector('#homeScreen .home-brand h1').textContent,'CooTrio');
 assert.equal(dom.window.document.title,'CooTrio');
 assert.equal(history.textContent,'親','Language changes must not translate the user’s original history text');
 assert.equal(dom.window.document.querySelector('#settingsLanguage').value,'ko');
 await ui.choose('ja');assert.match(dom.window.document.querySelector('.welcome-hero h1').textContent,/いつもの日本語/);
 assert.equal(dom.window.document.title,'みつことば');
 assert(dom.window.document.querySelector('link[rel="manifest"]').getAttribute('href').includes('manifest.webmanifest'));
 await ui.choose('auto');assert.equal(ui.language,lang);
 assert.equal(ui.mode,'auto');
 assert.equal(dom.window.localStorage.getItem(LANGUAGE_MODE_KEY),'auto');
 await ui.choose('ja');
 assert.equal(dom.window.document.querySelector('#onboardingScreen .brand-wordmark').textContent.replace(/\s/g,''),'みつことば');
 assert.equal(dom.window.document.querySelector('#onboardingScreen .brand-wordmark').children.length,5);
 assert(research.querySelector('.localized-about-content').hidden,'Original Japanese research should be restored');
 assert.equal(research.querySelector(':scope > h1').hidden,false);

 ui.dispose();dom.window.close();
}
assert(!html.includes('id="onboardingAiIntro"'),'Emma introduction should appear only in the tutorial');
 assert(html.includes('Bath time is here! Is the water warm? Splash, splash!'),'The first-page bath example should match a real reply');
 const unsupported=new JSDOM(html,{url:'https://unknown.test'});globalThis.MutationObserver=unsupported.window.MutationObserver;
const unknown=installLanguageUI({document:unsupported.window.document,storage:unsupported.window.localStorage,languages:['zh-CN']});
assert.equal(unknown.language,'en');
assert.equal(unknown.mode,'auto');
assert.equal(unknown.needsChoice,false);
assert.equal(unsupported.window.document.querySelector('#prepareEmmaButton').disabled,false);
unknown.dispose();unsupported.window.close();
const existing=new JSDOM(html,{url:'https://legacy.test'});globalThis.MutationObserver=existing.window.MutationObserver;
existing.window.localStorage.setItem(LANGUAGE_KEY,'de');
const legacy=installLanguageUI({document:existing.window.document,storage:existing.window.localStorage,languages:['ja-JP'],onChange:async(_,c)=>c.commit()});
assert.equal(legacy.language,'de','Legacy saved selection is retained');
assert.equal(legacy.mode,'manual');
await legacy.choose('auto');assert.equal(legacy.language,'ja');
assert.equal(existing.window.localStorage.getItem(LANGUAGE_MODE_KEY),'auto');
legacy.dispose();existing.window.close();
const auto=new JSDOM(html,{url:'https://autodetect.test'});globalThis.MutationObserver=auto.window.MutationObserver;
auto.window.localStorage.setItem(LANGUAGE_KEY,'de');
auto.window.localStorage.setItem(LANGUAGE_MODE_KEY,'auto');
let retried;
const redetect=installLanguageUI({document:auto.window.document,storage:auto.window.localStorage,languages:['fr-FR'],
 onChange:async(next,{commit})=>{retried=next;commit();}});
assert.equal(redetect.language,'fr','Browser locale changes are honored while in auto mode');
assert.equal(redetect.mode,'auto');
assert.equal(auto.window.document.getElementById('redetectSpeechLanguage').hidden,true);
await redetect.choose('auto');
assert.equal(retried,'fr');
assert.equal(redetect.mode,'auto','Browser language reselection must preserve automatic mode');
assert.equal(auto.window.localStorage.getItem(LANGUAGE_MODE_KEY),'auto');
redetect.dispose();auto.window.close();
const multilingualDom=new JSDOM(html,{url:'https://speech-redetect.test'});globalThis.MutationObserver=multilingualDom.window.MutationObserver;
let redetectCalls=0,languageChanges=0;
const multilingualUI=installLanguageUI({document:multilingualDom.window.document,storage:multilingualDom.window.localStorage,languages:['en-US'],
 onChange:async()=>{languageChanges++;},onRedetectSpeechLanguage:()=>{redetectCalls++;}});
const redetectSpeechButton=multilingualDom.window.document.getElementById('redetectSpeechLanguage');
assert.equal(redetectSpeechButton.hidden,false);
redetectSpeechButton.click();
assert.equal(redetectCalls,1,'Redetection must invoke the cache-reset action');
assert.equal(languageChanges,0,'Redetection must not trigger model preparation or change the UI locale');
assert.equal(multilingualUI.language,'en');assert.equal(multilingualUI.mode,'auto');
assert.equal(multilingualDom.window.document.getElementById('languageModelStatus').textContent,
 translate('次の発話で音声言語を自動判定します。','en'));
multilingualUI.dispose();multilingualDom.window.close();
for(const savedExplanation of ['zh','none']){
 const migrated=new JSDOM(html,{url:'https://explanation-migration.test'});
 globalThis.MutationObserver=migrated.window.MutationObserver;
 migrated.window.localStorage.setItem('mitsukotoba_explanation_language_v1',savedExplanation);
 const migratedUI=installLanguageUI({document:migrated.window.document,storage:migrated.window.localStorage,languages:['ko-KR']});
 assert.equal(migratedUI.explanationLanguage,'ko');
 assert.equal(migrated.window.document.querySelector('#replyJapanese').hidden,false);
 migratedUI.dispose();migrated.window.close();
}
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
 
const topicRoutes=['bath','milk','sleep','wake','diaper','clothes','hug','hands','feet','smile',
 'cry','voice','tummy','play','outside','rain','sun','food','book','music','drink'];
const interactionRoutes=['affection','praise','achievement','effort','encouragement','invitation',
 'start','finish','finish_check','care','inquiry','reassurance','repeat','pause'].map(x=>'interaction:'+x);
for(const route of [...topicRoutes,...interactionRoutes,'combined:bath:praise','generic']){
 const hint=replyDisplayHint(route);
 assert.equal(hint.noteParts.join(' '),hint.japaneseNote);
 for(const lang of ['de','fr','ko','th']){
  const display=explainReplyContext(hint,lang,k=>translate(k,lang));
  assert(display.length>1&& !/[ぁ-んァ-ン一-龯]/u.test(display),'Untranslated note for '+route+' in '+lang+': '+display);
  const title=translate(hint.topicLabel,lang);
  assert(title.length>=1&&!/[ぁ-んァ-ン一-龯]/u.test(title),'Untranslated topic for '+route+' in '+lang+': '+title);
 }
 assert(/\p{Script=Han}/u.test(explainReplyContext(hint,'zh')),'Chinese note missing for '+route);
 assert.equal(explainReplyContext(hint,'en',k=>translate(k,'en')),'');
}
// Developer comparisons change only Whisper CPU thread and language policy.
const developerDom=new JSDOM(html,{url:'https://whisper-controls.test'});
const actions=[];
const devControls=installWhisperPerformanceControls({
 document:developerDom.window.document,storage:developerDom.window.localStorage,
 onChange:options=>actions.push(options),onForgetLanguage:()=>actions.push('reset')
});
assert.equal(devControls.threads.value,'auto');
assert.equal(devControls.detection.value,'once');
devControls.threads.value='4';
devControls.threads.dispatchEvent(new developerDom.window.Event('change'));
assert.equal(developerDom.window.localStorage.getItem(WHISPER_THREAD_KEY),'4');
assert.deepEqual(actions.at(-1),{threads:'4',languageDetection:'once'});
devControls.detection.value='every';
devControls.detection.dispatchEvent(new developerDom.window.Event('change'));
assert.equal(developerDom.window.localStorage.getItem(WHISPER_LANGUAGE_MODE_KEY),'every');
assert.deepEqual(actions.at(-1),{threads:'4',languageDetection:'every'});
devControls.apply('ja');assert.equal(developerDom.window.document.getElementById('whisperPerformanceControls').hidden,true);
devControls.apply('en');assert.equal(developerDom.window.document.getElementById('whisperPerformanceControls').hidden,false);
developerDom.window.document.querySelector('#whisperPerformanceControls button').click();
assert.equal(actions.at(-1),'reset');
developerDom.window.close();

const cacheWorkers=[];
const sticky=new MultilingualClient({threads:'4',languageDetection:'once',workerFactory:()=>{
 const w={postMessage(data){this.last=data;},terminate(){this.closed=true;}};
 cacheWorkers.push(w);return w;
}});
const initSticky=sticky.prepare();
// The adaptive client checks persisted model metadata asynchronously before
// choosing native ACFT vs legacy ONNX, so wait for Worker creation.
for(let tick=0;tick<50&&!cacheWorkers.length;tick++)await new Promise(resolve=>setImmediate(resolve));
assert(cacheWorkers.length,'Multilingual Worker should be created after model selection');
assert.equal(cacheWorkers[0].last.threads,'4');
assert.equal(cacheWorkers[0].last.asrBackend,'legacy');
cacheWorkers[0].onmessage({data:{type:'result',requestId:cacheWorkers[0].last.requestId,
 result:{ready:true,threads:4,isolated:true}}});
await initSticky;
assert.equal(sticky.runtimeInfo.threads,4);
const voice=new Float32Array([0.25,-0.1]);
const firstSpeech=sticky.transcribe(voice,'en');
await Promise.resolve();
const firstRequest=cacheWorkers[0].last;
assert.equal(firstRequest.language,'en','First utterance should detect spoken language');
cacheWorkers[0].onmessage({data:{type:'result',requestId:firstRequest.requestId,
 result:{text:'Hello',detectedLanguage:'en'}}});
await firstSpeech;
assert.equal(sticky.cachedSpokenLanguage,'en');
const secondSpeech=sticky.transcribe(voice,'en');
await Promise.resolve();
const secondRequest=cacheWorkers[0].last;
assert.equal(secondRequest.language,'en-fixed','Cached English must not repeat autodetection');
cacheWorkers[0].onmessage({data:{type:'result',requestId:secondRequest.requestId,
 result:{text:'Hi',detectedLanguage:'en'}}});
await secondSpeech;
sticky.resetSpeechLanguage();
assert.equal(sticky.cachedSpokenLanguage,null);
const retrySpeech=sticky.transcribe(voice,'en');await Promise.resolve();
const retryRequest=cacheWorkers[0].last;
assert.equal(retryRequest.language,'en','Manual redetection must use Whisper language inference again');
cacheWorkers[0].onmessage({data:{type:'result',requestId:retryRequest.requestId,
 result:{text:'Bonjour',detectedLanguage:'fr'}}});
await retrySpeech;
assert.equal(sticky.cachedSpokenLanguage,'fr','Redetection must store the newly inferred language');
const inFlight=sticky.transcribe(voice,'en');await Promise.resolve();
const inFlightRequest=cacheWorkers[0].last;
assert.equal(inFlightRequest.language,'fr');
sticky.resetSpeechLanguage();
cacheWorkers[0].onmessage({data:{type:'result',requestId:inFlightRequest.requestId,
 result:{text:'Bonjour',detectedLanguage:'fr'}}});
await inFlight;
assert.equal(sticky.cachedSpokenLanguage,null,'An in-flight response must not restore a cleared language cache');
const nextSpeech=sticky.transcribe(voice,'en');await Promise.resolve();
const nextRequest=cacheWorkers[0].last;
assert.equal(nextRequest.language,'en','Language detection must run on the first utterance after reset');
cacheWorkers[0].onmessage({data:{type:'result',requestId:nextRequest.requestId,
 result:{text:'Hello',detectedLanguage:'en'}}});
await nextSpeech;
sticky.setPerformance({threads:'4',languageDetection:'every'});
const allSpeech=sticky.transcribe(voice,'en');await Promise.resolve();
const eachRequest=cacheWorkers[0].last;
assert.equal(eachRequest.language,'en','Every-turn mode must force a fresh detection');
cacheWorkers[0].onmessage({data:{type:'result',requestId:eachRequest.requestId,
 result:{text:'Hello',detectedLanguage:'en'}}});
await allSpeech;
sticky.setPerformance({threads:'4',languageDetection:'fixed'});
const fixedSpeech=sticky.transcribe(voice,'en');await Promise.resolve();
const fixedRequest=cacheWorkers[0].last;
assert.equal(fixedRequest.language,'en-fixed','Fixed language must omit detection altogether');
cacheWorkers[0].onmessage({data:{type:'result',requestId:fixedRequest.requestId,
 result:{text:'Hello',detectedLanguage:'en'}}});
await fixedSpeech;
sticky.setPerformance({threads:'2',languageDetection:'once'});
assert.equal(cacheWorkers[0].closed,true,'Changing CPU pool must restart worker');
assert.equal(sticky.ready,false);
const reinit=sticky.prepare();
assert.equal(cacheWorkers[1].last.threads,'2');
cacheWorkers[1].onmessage({data:{type:'result',requestId:cacheWorkers[1].last.requestId,
 result:{ready:true,threads:2,isolated:true}}});
await reinit;
sticky.cancel();
const workers=[];const c=new MultilingualClient({workerFactory:()=>{const w={postMessage(data,transfer){this.last=data;this.transfer=transfer;},terminate(){this.closed=true;}};workers.push(w);return w;}});
const first=c.prepare();const firstHandled=first.catch(e=>e.message);c.cancel();const next=c.prepare();
workers[1].onmessage({data:{type:'result',requestId:workers[1].last.requestId,result:{ready:true}}});
await next;await firstHandled;assert(c.ready);assert.equal(workers[1].closed,undefined);
const samples=new Float32Array([0.1,-0.2,0.3,0.4]);
const transcribing=c.transcribe(samples,'en');
await Promise.resolve();
const request=workers[1].last;
assert.equal(request.type,'transcribe');
assert.equal(request.language,'en');
assert.equal(request.audio.byteLength,samples.byteLength);
assert.equal(workers[1].transfer[0],request.audio,'Audio PCM must be transferred rather than cloned');
workers[1].onmessage({data:{type:'result',requestId:request.requestId,result:{text:'Hello',detectedLanguage:'en'}}});
assert.equal((await transcribing).text,'Hello');
c.cancel();
const appSource=await readFile(new URL('./src/app.js',import.meta.url),'utf8');
const switchFlow=appSource.slice(appSource.indexOf('languageUI=installLanguageUI'),appSource.indexOf('initUi();'));
assert(switchFlow.indexOf("if(next==='ja' && changedRoute)")>=0);
assert(switchFlow.indexOf('await ensureMoonshineIsolation')<switchFlow.indexOf('await initWorkers()'));
assert(appSource.includes('multilingualAsrDiagnostic'),'Audio diagnosis must report private-mode ASR state');
const workerSource=await readFile(new URL('./src/multilingual/worker.js',import.meta.url),'utf8');
assert(workerSource.includes("progress({stage:'asr-timing',timings})"),'Worker must report separate language and decode timing');
for(const key of ['audioSeconds','languageMs','transcribeMs','totalMs','realTimeFactor','languagePass']){
 assert(workerSource.includes(key),'Whisper runtime must capture '+key);
 assert(appSource.includes('multilingual.'+key+'='),'Diagnostic export must include '+key);
}
assert(appSource.includes("if(data.stage==='asr-timing')"),'ASR timing progress must not show model download state');
assert(appSource.includes("if(nonJapanese)return true"),'Unavailable browser isolation must fall back to 1-thread foreign Whisper');
assert(appSource.includes("multilingual?.resetSpeechLanguage()"),'Conversation start/stop must invalidate language cache');
assert(appSource.includes("WHISPER_THREAD_KEY"),'Application must persist CPU thread preference');
assert(workerSource.includes('env.backends.onnx.wasm.numThreads=effectiveThreads'),'Worker must enable ONNX multi-thread runtime');
assert(workerSource.includes("data.language==='en-fixed'"),'Worker must bypass detection for cached English');


console.log('PASS: locale precedence, fallback setup, six UI languages, switch persistence, routing, short foreign speech, verified cache repair/reuse, stale worker cancellation.');
