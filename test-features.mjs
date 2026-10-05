import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexedDB } from 'fake-indexeddb';
import { JSDOM } from 'jsdom';
import { ConversationHistory, createHistoryEntry, historyEnabled } from './src/conversation-history.js';
import { installFeatureScreens, nextPhrase, allTopicPhrases, singleSentencePhrases, phrasesForSentenceCount, localHistoryStamp } from './src/feature-screens.js';
import { appHistoryState, resolveAppPopScreen, shouldUseBrowserBack } from './src/app-navigation.js';
const topics=JSON.parse(readFileSync(new URL('./shared/play-topics.json',import.meta.url)));

assert.deepEqual(appHistoryState('settings'),{mitsukotobaScreen:'settings'});
assert.equal(resolveAppPopScreen('settings','home',null),'home');
assert.equal(resolveAppPopScreen('about','home',null),'home');
assert.equal(resolveAppPopScreen('about','onboarding',null),'onboarding');
assert.equal(resolveAppPopScreen('about','settings',{mitsukotobaScreen:'settings'}),'settings');
assert.equal(shouldUseBrowserBack('settings',{mitsukotobaScreen:'settings'}),true);
assert.equal(shouldUseBrowserBack('settings',null),false);
assert.equal(topics.topics.length,22);
assert.equal(topics.topics.reduce((count,topic)=>count+topic.phrases.length,0),110);
for(const topic of topics.topics){
  assert.equal(new Set(topic.phrases).size,topic.phrases.length);
  for(const phrase of topic.phrases){
    assert(phrase.trim().split(/\s+/).length<=8);
    assert(!/you are|you have|you're/i.test(phrase));
    assert.equal((phrase.match(/[.!?]+/g)||[]).length,3);
  }
  for(let i=0;i<30;i++)assert.notEqual(nextPhrase(topic.phrases,topic.phrases[i%topic.phrases.length]),topic.phrases[i%topic.phrases.length]);
}
const mixed=allTopicPhrases(topics);assert.equal(mixed.length,110);assert.equal(mixed.length,new Set(mixed).size);assert(mixed.length>topics.topics[0].phrases.length);
const allSingles=singleSentencePhrases(mixed);assert.equal(allSingles.length,167);assert(allSingles.every(text=>(text.match(/[.!?]+/g)||[]).length===1));
const sampleBundles=['Bath time! Splash, splash! Here we go!','Hi there!'];
const sampleSingles=singleSentencePhrases(sampleBundles);
assert.deepEqual(sampleSingles,['Bath time!','Splash, splash!','Here we go!','Hi there!']);
assert.deepEqual(phrasesForSentenceCount(sampleBundles,1),sampleSingles);
assert.deepEqual(phrasesForSentenceCount(sampleBundles,3),sampleBundles);
assert(sampleSingles.some(text=>text.trim().split(/\s+/).length<=2));
const stamp=localHistoryStamp('2026-10-05T10:23:00+09:00');assert.match(stamp.key,/^\d{4}-\d{2}-\d{2}$/);assert.match(stamp.timeLabel,/\d{2}:\d{2}/);
const dom=new JSDOM(readFileSync(new URL('./index.html',import.meta.url),'utf8'),{url:'https://example.test/'});
const {window}=dom;globalThis.document=window.document;
const storage=window.localStorage;
assert.equal(historyEnabled(storage),true);storage.setItem('emma_history_enabled','false');assert.equal(historyEnabled(storage),false);
const history=new ConversationHistory(indexedDB);
const entries=Array.from({length:1002},(_,i)=>({...createHistoryEntry('session','足を見て','Hello, little feet!','feet'),createdAt:new Date(1700000000000+i).toISOString()}));
await Promise.all(entries.map(e=>history.append(e)));
let stored=await history.list();assert.equal(stored.length,1000);assert.equal(stored[0].id,entries[1001].id);assert(!stored.some(e=>e.id===entries[0].id));
assert.equal(stored[0].englishText,'Hello, little feet!');assert(!Object.keys(stored[0]).some(key=>/audio|blob/i.test(key)));
await history.delete(stored[0].id);assert.equal((await history.list()).length,999);
// Explicit OFF preserves old entries.
assert.equal(historyEnabled(storage),false);assert.equal((await history.list()).length,999);
await history.delete();assert.deepEqual(await history.list(),[]);
await assert.rejects(new ConversationHistory(null).list());
const $=id=>document.getElementById(id);
$('featureDialog').showModal=function(){this.open=true;};$('featureDialog').close=function(){this.open=false;};
globalThis.confirm=()=>true;globalThis.fetch=async()=>({ok:true,json:async()=>topics});
let stops=0,spoken=[],busy=false,finish,preloads=0,playCount=1;
const features=installFeatureScreens({stop:async()=>{stops++;busy=false;finish?.();},prepare:async()=>{},preload:async()=>{preloads++;},history,isSpeaking:()=>busy,
  playSentenceCount:()=>playCount,
  setPlaySentenceCount:count=>{playCount=count;storage.setItem('emma_play_sentence_count',String(count));},
  speak:async text=>{spoken.push(text);busy=true;await new Promise(resolve=>finish=resolve);busy=false;},avatar:()=>document.createElement('div')});
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
$('playButton').click();await settle();await settle();assert(features.isOpen());assert(stops>0);
let tap=$('featureBody').querySelector('.play-tap');assert(tap);assert.equal(tap.disabled,false);
assert.equal($('featureBody').querySelector('.play-topic-label').textContent,'すべての話題');
const sentenceToolbar=$('featureBody').querySelector('.play-sentence-toolbar');assert(sentenceToolbar);
assert.equal(tap.contains(sentenceToolbar),false,'sentence selector must stay outside the play card');
assert.equal($('settingsScreen').querySelector('#playSentenceCount'),null,'duplicate sentence setting must be removed from Settings');
assert.equal(preloads,0,'opening play must not synthesize every phrase');
tap.click();tap.click();tap.click();await settle();assert.equal(spoken.length,1);assert.equal(tap.disabled,true);
assert(tap.classList.contains('is-speaking'),'speaking card tint class must be active');
assert.equal(tap.querySelector('.play-action-label').textContent,'一緒に聞こう');
assert.equal((spoken[0].match(/[.!?]+/g)||[]).length,1,'default Tap to Listen mode should play one sentence');
finish();await settle();
assert.equal(tap.classList.contains('is-speaking'),false);
assert.equal(tap.querySelector('.play-action-label').textContent,'押して聞く');
const threeButton=[...sentenceToolbar.querySelectorAll('button')].find(el=>el.textContent==='3文');assert(threeButton);
threeButton.click();assert.equal(playCount,3);assert.equal(storage.getItem('emma_play_sentence_count'),'3');
tap.click();await settle();assert.equal(spoken.length,2);assert.equal((spoken[1].match(/[.!?]+/g)||[]).length,3,'3-sentence mode must play a three-sentence bundle');
finish();await settle();
[...$('featureBody').querySelectorAll('button')].find(el=>el.textContent==='話題を変更').click();await settle();
[...$('featureBody').querySelectorAll('button')].find(el=>el.textContent==='て・おてて').click();await settle();
tap=$('featureBody').querySelector('.play-tap');assert.equal($('featureBody').querySelector('.play-topic-label').textContent,'て・おてて');assert.equal(tap.disabled,false);
$('featureClose').click();await settle();assert.equal(features.isOpen(),false);assert(stops>=3);
assert.deepEqual(await history.list(),[],'play must not create history');
assert(!$('settingsScreen').querySelector('#playButton'),'play entry is on main');
console.log('Features: play selector outside card, 1/3 sentence switching, speaking state, topic change, history isolation OK');

// Exercise the actual app's decode/start boundary: cancelling during decoding must
// prevent both sound and history, while a started response commits exactly once.
const {runInNewContext}=await import('node:vm');
let decodedResolve,starts=0,commits=0,lastRequest;
const audioBuffer={length:128,sampleRate:24000,numberOfChannels:1,getChannelData:()=>new Float32Array(128).fill(.3)};
const context={state:'running',decodeAudioData:()=>new Promise(resolve=>decodedResolve=resolve),
  createBufferSource:()=>({connect(node){return node;},start(){starts++;queueMicrotask(()=>this.onended?.());},stop(){this.onended?.();}}),
  createGain:()=>({gain:{value:1},connect(node){return node;}}),
  createAnalyser:()=>({connect(){},getByteTimeDomainData(data){data.fill(128);}}),destination:{}};
let source=readFileSync(new URL('./src/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('import.meta.url',"'https://example.test/src/app.js'").replace('\ninitUi();','\n');
source+=`\ngetTtsNameHints=()=>[];waitForPlaybackAudio=async()=>{}; setState=()=>{};renderAvatarFrame=()=>{};setBusy=()=>{};
  audioContext=testAudio;ttsWorker={postMessage(message){captureRequest(message.requestId);}};
  history.append=async()=>{commitHistory();};
  globalThis.appTest={speakResponse,stopEmma,enqueueAudio,complete(id){const q=audioQueues.get(id);if(q){q.generationDone=true;pumpAudio(id);}}};`;
const sandbox={document,window,localStorage:storage,location:window.location,URL,URLSearchParams,console,crypto,
  ConversationHistory,historyEnabled,createHistoryEntry,LiteResponseEngine:class{},testAudio:context,captureRequest:id=>lastRequest=id,commitHistory:()=>commits++,
  requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},setTimeout,clearTimeout,navigator:{},Blob,Float32Array,Uint8Array};
runInNewContext(source,sandbox);
storage.setItem('emma_history_enabled','true');
const app=sandbox.appTest;
const candidate=createHistoryEntry('test','足を見て','Hello, little feet!','feet');
let speech=app.speakResponse(candidate.englishText,{entry:candidate});
app.enqueueAudio({requestId:lastRequest,index:0,blob:new Blob(['audio'])});await settle();
await app.stopEmma();decodedResolve(audioBuffer);await speech;await settle();
assert.equal(starts,0);assert.equal(commits,0);
speech=app.speakResponse(candidate.englishText,{entry:candidate});
app.enqueueAudio({requestId:lastRequest,index:0,blob:new Blob(['audio'])});await settle();
decodedResolve(audioBuffer);app.complete(lastRequest);await speech;
assert.equal(starts,1);assert.equal(commits,1);
// Playback without a conversation candidate (history replay or play) never saves.
speech=app.speakResponse('History replay phrase');
app.enqueueAudio({requestId:lastRequest,index:0,blob:new Blob(['audio'])});await settle();decodedResolve(audioBuffer);app.complete(lastRequest);await speech;
assert.equal(starts,2);assert.equal(commits,1);
console.log('Playback: stop during decode prevents late audio/history; first audio saves once; replay saves nothing OK');
// An unresolved microphone permission request must not reopen capture after entry
// into play/history (or after stopping while the browser prompt is visible).
const {EmmaMicrophone}=await import('./src/audio-capture.js');
let grant,trackStops=0,contexts=0;
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia:()=>new Promise(resolve=>grant=resolve)}},configurable:true});
globalThis.AudioContext=class{constructor(){contexts++;}};
const capture=new EmmaMicrophone({});const pendingStart=capture.start();await capture.stop();
grant({getTracks:()=>[{stop(){trackStops++;}}]});await pendingStart;
assert(trackStops>0);assert.equal(contexts,0);assert.equal(capture.stream,null);
console.log('Microphone: late permission after stop cannot reopen capture OK');
