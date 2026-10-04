import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexedDB } from 'fake-indexeddb';
import { JSDOM } from 'jsdom';
import { ConversationHistory, createHistoryEntry, historyEnabled } from './src/conversation-history.js';
import { installFeatureScreens, nextPhrase, allTopicPhrases, localHistoryStamp } from './src/feature-screens.js';
const topics=JSON.parse(readFileSync(new URL('./shared/play-topics.json',import.meta.url)));
for(const topic of topics.topics){
  assert.equal(new Set(topic.phrases).size,topic.phrases.length);
  for(const phrase of topic.phrases){assert(phrase.trim().split(/\s+/).length<=8);assert(!/you are|you have|you're/i.test(phrase));}
  for(let i=0;i<30;i++)assert.notEqual(nextPhrase(topic.phrases,topic.phrases[i%topic.phrases.length]),topic.phrases[i%topic.phrases.length]);
}
const mixed=allTopicPhrases(topics);assert.equal(mixed.length,new Set(mixed).size);assert(mixed.length>topics.topics[0].phrases.length);
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
let stops=0,spoken=[],busy=false,finish,preloads=0;
const features=installFeatureScreens({stop:async()=>{stops++;busy=false;finish?.();},prepare:async()=>{},preload:async()=>{preloads++;},history,isSpeaking:()=>busy,
  speak:async text=>{spoken.push(text);busy=true;await new Promise(resolve=>finish=resolve);busy=false;},avatar:()=>document.createElement('div')});
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
$('playButton').click();await settle();await settle();assert(features.isOpen());assert(stops>0);
let tap=$('featureBody').querySelector('.play-tap');assert(tap);assert.equal(tap.disabled,false);
assert.equal($('featureBody').querySelector('.play-topic-label').textContent,'すべての話題');
assert.equal(preloads,0,'opening play must not synthesize every phrase');
tap.click();tap.click();tap.click();await settle();assert.equal(spoken.length,1);assert.equal(tap.disabled,true);
finish();await settle();tap.click();await settle();assert.equal(spoken.length,2);assert.notEqual(spoken[0],spoken[1]);
finish();await settle();
[...$('featureBody').querySelectorAll('button')].find(el=>el.textContent==='話題を変更').click();await settle();
[...$('featureBody').querySelectorAll('button')].find(el=>el.textContent==='て・おてて').click();await settle();
tap=$('featureBody').querySelector('.play-tap');assert.equal($('featureBody').querySelector('.play-topic-label').textContent,'て・おてて');assert.equal(tap.disabled,false);
$('featureClose').click();await settle();assert.equal(features.isOpen(),false);assert(stops>=3);
assert.deepEqual(await history.list(),[],'play must not create history');
assert(!$('settingsScreen').querySelector('#playButton'),'play entry is on main');
console.log('Features: local date/time helper, all-topic direct play, no bulk preload, mode exit, repeated taps and no play history OK');

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
