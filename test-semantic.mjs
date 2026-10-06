import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { LiteResponseEngine, splitSentences } from './src/lite-response-engine.js';
import { SemanticLiteClient } from './src/semantic/client.js';
import { decodeHead, classifyEmbedding } from './src/semantic/core.js';
import { installSemanticPanel } from './src/semantic/panel.js';
import { createSemanticController } from './src/semantic/controller.js';
import { downloadSemanticAsset } from './src/semantic/download.js';
// Browser fetch decodes gzip but preserves the compressed Content-Length.
const decoded = Uint8Array.from([1,2,3,4,5]);
const compressedResponse = () => Promise.resolve(new Response(decoded, {headers:{'content-encoding':'gzip','content-length':'3'}}));
assert.deepEqual(new Uint8Array(await downloadSemanticAsset('/asset',5,null,compressedResponse)),decoded);
await assert.rejects(downloadSemanticAsset('/asset',6,null,compressedResponse),/途中/);
await assert.rejects(downloadSemanticAsset('/asset',4,null,compressedResponse),/サイズ/);
const baseline=new LiteResponseEngine().respond('お風呂に入ろうね','Hana');
const semantic=new LiteResponseEngine().respond('お風呂に入ろうね','Hana',{topic:'sleep',mode:'semantic'});
assert.equal(semantic.scene,'sleep');assert.equal(semantic.ruleScene,'bath');assert.equal(semantic.semanticUsed,true);assert.equal(splitSentences(semantic.english).length,3);
assert.equal(new LiteResponseEngine().respond('お風呂に入ろうね','Hana',{topic:'sleep',mode:'guard'}).english,baseline.english);
assert.equal(new LiteResponseEngine().respond('あたたかくしよう','',{topic:'bath',mode:'lite'}).scene,'generic');
assert.equal(new LiteResponseEngine().respond('分類できない普通の話だよ','',{topic:'bath',mode:'guard'}).scene,'bath');
assert.equal(new LiteResponseEngine().respond('お風呂に入ろうね','',{topic:'generic',mode:'semantic'}).scene,'generic');
assert.equal(new LiteResponseEngine().respond('お風呂に入ろうね','',{topic:'not-a-topic',mode:'semantic'}).scene,'bath');
const context=new LiteResponseEngine();context.respond('普通の話だよ','',{topic:'milk',mode:'semantic'});assert.equal(context.respond('どうかな').scene,'milk');context.resetConversationContext();assert.equal(context.respond('どうかな').scene,'generic');
const config={shape:[2,385],classes:['milk','generic']};const matrix=new Float32Array(770);matrix[384]=2;const head=decodeHead(matrix.buffer,config);assert.equal(classifyEmbedding(new Float32Array(384),{topic:head},{threshold:0,margin:.05}).topic.id,'milk');assert.throws(()=>decodeHead(new ArrayBuffer(4),config));
let workers=[];
class FakeWorker { constructor(){this.sent=[];this.terminated=false;workers.push(this);}postMessage(data){this.sent.push(data);}terminate(){this.terminated=true;}reply(id,result={}){this.onmessage({data:{type:'result',requestId:id,result}});} }
const client=new SemanticLiteClient({workerFactory:()=>new FakeWorker()});const init=client.prepare();workers[0].reply(workers[0].sent[0].requestId);await init;assert.equal(client.ready,true);
const old=client.predict('ミルク');await Promise.resolve();client.cancel();const retry=client.prepare();await assert.rejects(old);workers[0].onerror();assert.equal(client.worker,workers[1]);workers[1].reply(workers[1].sent[0].requestId);await retry;assert.equal(client.ready,true);client.cancel();assert.equal(client.pending.size,0);
const dom=new JSDOM('<article id="semanticPanel"></article>',{url:'https://example.test/'});globalThis.document=dom.window.document;const storage=dom.window.localStorage;let rejectMode=false,finish;
const engine=new LiteResponseEngine();const fake={ready:true,prepare:async()=>{},cancel(){},cancelPending(){},async predict(){if(rejectMode)throw Error('model failure');return {topic:{id:'sleep',probability:.9,margin:.8},intent:{id:'invitation'},state:{id:'future'},elapsedMs:10};}};
const panel=installSemanticPanel({engine,storage,clientFactory:()=>fake});assert.equal(panel.enabled,true);
document.querySelector('[data-semantic="enabled"]').checked=true;assert.equal((await panel.respond('お風呂に入ろうね','')).scene,'sleep');rejectMode=true;assert.equal((await panel.respond('お風呂に入ろうね','')).scene,'bath');assert.equal(panel.enabled,false);
rejectMode=false;document.querySelector('[data-semantic="prepare"]').click();await new Promise(r=>setTimeout(r,0));assert.equal(panel.enabled,true);
fake.predict=()=>new Promise(resolve=>finish=resolve);const pending=panel.respond('ミルク','',{isCurrent:()=>false});await Promise.resolve();finish({topic:{id:'milk'},intent:{id:'observation'},state:{id:'ongoing'},elapsedMs:1});assert.equal(await pending,null);
console.log('Semantic policies, catalog rendering, invalid data, cancellation/retry, failed-model fallback and stale reply checks passed.');

// Semantic context consumes, rather than continually resets, six follow-up turns.
const clear=(topic)=>({topic,mode:'semantic',probability:.95,margin:.8});
const generic={topic:'generic',mode:'semantic',probability:.8,margin:.7};
const held=new LiteResponseEngine();held.respond('ミルクを飲もうか','',clear('milk'));
for(let i=0;i<6;i++){const r=held.respond('いいね','',generic);assert.equal(r.scene,'milk');assert.equal(r.contextUsed,true);assert.equal(held.activeSceneTurnsRemaining,5-i);}
assert.equal(held.respond('どうかな','',generic).scene,'generic');
held.respond('ミルクを飲もうか','',clear('milk'));
assert.equal(held.respond('もっと？','',{topic:'book',mode:'semantic',probability:.4,margin:.1}).scene,'milk');
assert.equal(held.activeSceneTurnsRemaining,5);
assert.equal(held.respond('いい感じですね','',clear('smile')).scene,'milk');assert.equal(held.activeSceneTurnsRemaining,4);
assert.equal(held.respond('もう少し飲む？','',clear('drink')).scene,'milk');assert.equal(held.activeSceneTurnsRemaining,3);
assert.equal(held.respond('お水を飲もう','',clear('drink')).scene,'drink');assert.equal(held.activeSceneTurnsRemaining,6);
assert.equal(held.respond('眠る時間だよ','',clear('sleep')).scene,'sleep');assert.equal(held.activeSceneTurnsRemaining,6);
assert.equal(held.respond('お風呂入ろうね','',generic).scene,'bath');assert.equal(held.activeSceneTurnsRemaining,6);
held.resetConversationContext();assert.equal(held.respond('どうかな','',generic).scene,'generic');
const firstWeak=new LiteResponseEngine();assert.equal(firstWeak.respond('見てみよう','',{topic:'book',mode:'semantic',probability:.4,margin:.1}).scene,'book');assert.equal(firstWeak.activeSceneTurnsRemaining,6);
// Default-on does not download anything until first setup, startup or explicit testing.
const isolated=new JSDOM('',{url:'https://prefs.test/'}).window.localStorage;
let prepares=0,predicts=0;
const noAuto={ready:false,prepare:async()=>{prepares++;},cancel(){},cancelPending(){},predict:async()=>{predicts++;return {topic:{id:'milk',probability:.99,margin:.98}};}};
const ctrl=createSemanticController({engine:new LiteResponseEngine(),storage:isolated,clientFactory:()=>noAuto,mode:'semantic'});
assert.equal(ctrl.enabled,true);assert.equal(prepares,0);await ctrl.setEnabled(false);await ctrl.prepare();await ctrl.respond('ミルク');assert.equal(prepares,0);assert.equal(predicts,0);
const persisted=createSemanticController({engine:new LiteResponseEngine(),storage:isolated,clientFactory:()=>noAuto});assert.equal(persisted.enabled,false);
isolated.setItem('emma_semantic_enabled','true');isolated.setItem('emma_semantic_mode','lite');
const main=createSemanticController({engine:new LiteResponseEngine(),storage:isolated,clientFactory:()=>noAuto,mode:'semantic'});assert.equal(main.enabled,true);assert.equal(main.snapshot.mode,'semantic');
console.log('Semantic default-on/opt-out, lazy preparation, six follow-ups, weak/clear topic changes, reset and late worker error checks passed.');

// Execute the actual first-setup functions with audio/mic stubs, avoiding model
// downloads while checking permission order and the previously missing epoch.
const appSource=readFileSync(new URL('./src/app.js',import.meta.url),'utf8');
const setupFunction=appSource.slice(appSource.indexOf('async function prepareFirstRun()'),appSource.indexOf('async function startEmma('));
const semanticSetup=appSource.slice(appSource.indexOf('async function prepareSemanticForConversation()'),appSource.indexOf('async function stopEmma()'));
for(const highPerformance of [true,false]) {
 const calls=[],values=new Map();
 const semanticStub={
  requested:true,
  async setEnabled(value){this.requested=!!value;},
  subscribe(fn){fn({status:{message:'ready',ready:true}});return()=>{};},
  prepare:async()=>{calls.push('semantic');return true;}
 };
 const sandbox={conversationEpoch:0,CURRENT_SETUP_REVISION:'setup-test',STORAGE:{asrModel:'asr',startTiny:'tiny',highPerformance:'performance',setupRevision:'emma_web_setup_revision'},
  ui:{prepareEmmaButton:{disabled:false},onboardingHighPerformance:{checked:highPerformance},asrModel:{value:''}},
  localStorage:{setItem:(k,v)=>values.set(k,v)},navigator:{storage:{persist:async()=>true}},
  requestMicrophonePermission:async()=>calls.push('microphone'),ensureMoonshineIsolation:async()=>true,
  clearObsoleteModelCaches:async()=>{},initWorkers:async()=>calls.push('audio'),
  semanticPanel:semanticStub,
  showOnboardingProgress(){},showProgress(){},setBusy(){},showScreen(){},setState(){},updateAsrModelStatus(){},startTutorial:()=>calls.push('tutorial'),friendlyError:e=>e.message,console};
 runInNewContext(setupFunction+semanticSetup+'globalThis.runSetup=prepareFirstRun;',sandbox);
 await sandbox.runSetup();
 assert.deepEqual(calls,highPerformance ? ['microphone','audio','semantic','tutorial'] : ['microphone','audio','tutorial']);
 assert.equal(values.get('asr'),highPerformance ? 'small' : 'tiny');
 assert.equal(values.get('tiny'),String(!highPerformance));
 assert.equal(values.get('performance'),String(highPerformance));
 assert.equal(semanticStub.requested,highPerformance);
 assert.equal(values.get('emma_web_setup_revision'),'setup-test');
}
console.log('Actual first-setup permission/audio/Semantic order and opt-out checks passed.');
// A cached ASR may be ready before the new Semantic stage. Capture must ignore
// speech until all conversation preparation finishes, and ignore stale epochs.
let captureOptions,utterances=0;
const captureSandbox={mic:null,conversationEpoch:1,running:true,workersReady:true,preparingConversation:true,processing:false,speaking:false,
 EmmaMicrophone:class{constructor(options){captureOptions=options;}async start(){}async stop(){}},setState(){},getAiName:()=> 'Emma',handleCapturedUtterance:()=>utterances++};
const captureFunction=appSource.slice(appSource.indexOf('async function startMoonshineCapture()'),appSource.indexOf('async function initWorkers()'));
runInNewContext(captureFunction+'globalThis.startCapture=startMoonshineCapture;',captureSandbox);await captureSandbox.startCapture();
assert.equal(captureOptions.shouldIgnore(),true);captureOptions.onUtterance([]);assert.equal(utterances,0);
captureSandbox.preparingConversation=false;assert.equal(captureOptions.shouldIgnore(),false);captureOptions.onUtterance([]);assert.equal(utterances,1);
captureSandbox.conversationEpoch=2;assert.equal(captureOptions.shouldIgnore(),true);captureOptions.onUtterance([]);assert.equal(utterances,1);
console.log('Capture waits for Semantic startup and rejects stale session audio.');
// Opening/editing settings only registers the cache worker. Isolation reloads
// are reserved for ASR startup and must respect a cancelled conversation epoch.
let onLoad,registrations=0,isolationCalls=0;
const registrationSandbox={window:{addEventListener:(event,fn)=>onLoad=fn},navigator:{serviceWorker:{register:async()=>{registrations++;}}},ensureMoonshineIsolation:async()=>{isolationCalls++;},console};
runInNewContext(appSource.slice(appSource.lastIndexOf("window.addEventListener('load'")),registrationSandbox);onLoad();await Promise.resolve();assert.equal(registrations,1);assert.equal(isolationCalls,0);
let current=true,reloads=0;
const isoSandbox={window:{crossOriginIsolated:false},navigator:{serviceWorker:{register:async()=>({update:async()=>{current=false;}})}},location:{reload(){reloads++;}},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},delay:async()=>{},SharedArrayBuffer};
const isolationSource=appSource.slice(appSource.indexOf('async function ensureMoonshineIsolation('),appSource.lastIndexOf("window.addEventListener('load'"));
runInNewContext(isolationSource+'globalThis.isolate=ensureMoonshineIsolation;',isoSandbox);assert.equal(await isoSandbox.isolate({isCurrent:()=>current}),false);assert.equal(reloads,0);
console.log('Background registration does not reload editors; cancelled ASR startup cannot reload.');

// A conversation-triggered isolation reload must not auto-start the microphone
// after navigation, because Android may require a fresh user gesture for permission.
let reloadsWithGesture=0;
const isolationStore=new Map();
const gestureIsoSandbox={
 window:{crossOriginIsolated:false},
 navigator:{serviceWorker:{register:async()=>({update:async()=>{}})}},
 location:{reload(){reloadsWithGesture++;}},
 sessionStorage:{getItem:key=>isolationStore.get(key)||null,setItem:(key,value)=>isolationStore.set(key,value),removeItem:key=>isolationStore.delete(key)},
 delay:async()=>{},
 SharedArrayBuffer
};
runInNewContext(isolationSource+'globalThis.isolate=ensureMoonshineIsolation;',gestureIsoSandbox);
assert.equal(await gestureIsoSandbox.isolate({manualStartAfterReload:true}),false);
assert.equal(reloadsWithGesture,1);
assert.equal(isolationStore.get('emma_coi_manual_start'),'1');
assert.equal(isolationStore.get('emma_coi_reload_count'),'1');
console.log('Isolation reload requires a fresh manual microphone gesture after navigation.');

// Microphone startup must fail instead of waiting forever on a suspended
// AudioContext or AudioWorklet load.
const audioCaptureSource=readFileSync(new URL('./src/audio-capture.js',import.meta.url),'utf8');
assert.match(audioCaptureSource,/withTimeout\(\s*this\.context\.resume\(\),\s*5000/);
assert.match(audioCaptureSource,/withTimeout\(\s*context\.audioWorklet\.addModule[\s\S]*?15000/);
console.log('Microphone AudioContext and worklet startup are bounded by timeouts.');
