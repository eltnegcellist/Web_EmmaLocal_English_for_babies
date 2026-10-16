import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexedDB } from 'fake-indexeddb';
import { JSDOM } from 'jsdom';
import { ConversationHistory, createHistoryEntry, historyEnabled } from './src/conversation-history.js';
import { installFeatureScreens, nextPhrase, allTopicPhrases, singleSentencePhrases, phrasesForSentenceCount, localHistoryStamp } from './src/feature-screens.js';
import { appHistoryState, resolveAppPopScreen, shouldUseBrowserBack } from './src/app-navigation.js';
import { replyDisplayHint } from './src/reply-display-hint.js';
import { canonicalMoonshineModelAssetKey } from './src/vendor/moonshine/asset-downloader.js';
const topics=JSON.parse(readFileSync(new URL('./shared/play-topics.json',import.meta.url)));
// Emma occupies the same large avatar panel. The former permanent name badge
// is now the single live status chip, and ordinary spoken text appears only
// in the compact English card.
{
  const markup=readFileSync(new URL('./index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('./src/app.js',import.meta.url),'utf8');
  const uiDom=new JSDOM(markup).window.document;
  assert.equal(uiDom.getElementById('aiNameBadge'),null,'permanent Emma name badge must be removed');
  assert(uiDom.getElementById('tutorialStatusTarget')?.closest('.avatar-wrap'),'voice state must occupy the old Emma name location');
  assert.equal(uiDom.querySelectorAll('#statusTitle').length,1,'only one voice state title');
  assert.equal(uiDom.querySelectorAll('#reply').length,1,'only one English reply block');
  assert(uiDom.getElementById('reply').closest('#emmaBubble'),'reply belongs to compact card');
  assert(uiDom.getElementById('statusDetail').classList.contains('hidden'),'status detail must start hidden');
  assert(app.includes("ui.statusDetail.classList.toggle('hidden',!needsNotice)"),'normal status detail is hidden');
  assert(!app.includes("setState('speaking','AIが話しています',text)"),'no second copy of the English speech');
}

// Guard against accidentally reviving Android/Full promotional UI on the standalone Web app.
const publicHtml=readFileSync(new URL('./index.html',import.meta.url),'utf8');
assert(!publicHtml.includes('Android版について'));
assert(!publicHtml.includes('Android版を見る'));
assert(!publicHtml.includes('android-full-card'));
assert(!publicHtml.includes('Android_English_character_for_baby'));
// Guard the public callout labels as well as the removed Android promotion.
assert(publicHtml.includes('id="mainButton" class="primary-button">呼びかけを始める</button>'));
assert(publicHtml.includes('id="stopButton" class="outline-button hidden">呼びかけを止める</button>'));
assert(!publicHtml.includes('>会話を始める</button>'));
assert(!publicHtml.includes('>会話を止める</button>'));
const publicAppSource=readFileSync(new URL('./src/app.js',import.meta.url),'utf8');
assert(publicAppSource.includes("ui.tutorialTitle.textContent='ここから呼びかけを始めます'"));
assert(publicAppSource.includes('「呼びかけを始める」'));
assert(!publicAppSource.includes('「会話を始める」'));
assert(!publicAppSource.includes('ここから会話を始めます'));
// Home should prioritize the character, not repeat a persistent privacy notice.
assert(!publicHtml.includes('class="privacy-card"'));
assert(!publicHtml.includes('端末内で処理'));
assert(!publicHtml.includes('id="parentBubble"'), 'ASR transcript must not be shown as a chat bubble');
assert(publicHtml.includes('id="replyTopic"') && publicHtml.includes('id="replyJapanese"'));
assert.equal(replyDisplayHint('combined:milk:affection').topicLabel, 'ミルク・授乳');
assert.match(replyDisplayHint('combined:milk:affection').japaneseNote, /大好き/);
assert.equal(replyDisplayHint('interaction:praise').topicLabel, 'ほめる');
assert.equal(replyDisplayHint('generic').topicLabel, 'ふだんのことば');
// Keep the onboarding explanation so users can still find the privacy promise.
assert(publicHtml.includes('会話処理は端末内。クラウドAIへ音声を送りません。'));

assert.deepEqual(appHistoryState('settings'),{mitsukotobaScreen:'settings'});
assert.equal(resolveAppPopScreen('settings','home',null),'home');
assert.equal(resolveAppPopScreen('about','home',null),'home');
assert.equal(resolveAppPopScreen('about','onboarding',null),'onboarding');
assert.equal(resolveAppPopScreen('about','settings',{mitsukotobaScreen:'settings'}),'settings');
assert.equal(shouldUseBrowserBack('settings',{mitsukotobaScreen:'settings'}),true);
assert.equal(shouldUseBrowserBack('settings',null),false);
assert.equal(
  canonicalMoonshineModelAssetKey('https://download-a.example/model/small-streaming-ja/rev1/encoder.ort?sig=one'),
  canonicalMoonshineModelAssetKey('https://download-b.example/model/small-streaming-ja/rev1/encoder.ort?sig=two'),
  'CDN host/query changes should keep the same model cache identity'
);
assert.notEqual(
  canonicalMoonshineModelAssetKey('https://download.example/model/small-streaming-ja/rev1/encoder.ort'),
  canonicalMoonshineModelAssetKey('https://download.example/model/small-streaming-ja/rev2/encoder.ort'),
  'model revision path changes must not reuse old cache entries'
);

// The auto-reply toggle is a setting, never a control below Emma.
{
  const ui = new JSDOM(readFileSync(new URL('./index.html',import.meta.url),'utf8')).window.document;
  const toggle=ui.getElementById('autoRespond');
  assert(toggle, 'auto-reply preference must still exist');
  assert(toggle.closest('#settingsScreen'),'auto-reply preference belongs in Settings');
  assert.equal(ui.querySelector('#homeScreen .auto-reply-card'),null,'home must not show auto-reply controls');
  assert.equal(ui.querySelectorAll('#autoRespond').length,1,'single saved auto-reply preference');
  const css=readFileSync(new URL('./styles.css',import.meta.url),'utf8');
  assert(css.includes('.reply-topic::before'),'topic chip should have a subtle decorative accent');
  assert(css.includes('.emma-bubble .reply-english'),'single English card must remain present');
  assert(css.includes('.emma-bubble .reply-japanese'),'Japanese hint must remain in the same card');
}

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
const allSingles=singleSentencePhrases(mixed);assert(allSingles.length>=170 && allSingles.length<=330, 'one-sentence pool should remain broad after phrase updates');assert(allSingles.every(text=>(text.match(/[.!?]+/g)||[]).length===1));
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
await history.deleteMany([stored[1].id,stored[2].id]);assert.equal((await history.list()).length,997,'batch deletion removes only selected entries');
// Explicit OFF preserves old entries.
assert.equal(historyEnabled(storage),false);assert.equal((await history.list()).length,997);
await history.delete();assert.deepEqual(await history.list(),[]);
await assert.rejects(new ConversationHistory(null).list());
const $=id=>document.getElementById(id);
assert($('replyTopic').closest('.avatar-wrap'), 'topic badge must sit in Emma avatar frame');
assert($('replyJapanese').closest('#emmaBubble'), 'Japanese hint stays in the compact English panel');
assert.equal($('parentBubble'), null, 'parent transcript is not shown on the live screen');
assert($('onboardingHighPerformance'),'first-run performance toggle must exist');
assert.equal($('onboardingHighPerformance').checked,true,'high-performance preset should default on');
assert.equal($('onboardingStartTiny'),null,'legacy Tiny toggle should not appear in first-run UI');
assert.equal($('onboardingSemanticOff'),null,'legacy Semantic-off toggle should not appear in first-run UI');
assert.match($('onboardingHighPerformance').closest('label').textContent,/高性能モデルを使う/);
assert($('copyDiagnosticsButton'),'hidden developer tools should expose diagnostic copy');
assert($('downloadDiagnosticsButton'),'hidden developer tools should expose diagnostic TXT download');
assert($('clearDiagnosticsButton'),'hidden developer tools should expose diagnostic reset');
assert($('webTimingDiagnostics'),'hidden developer tools should expose TTS timing');
assert($('storageProtectionStatus'),'settings must show storage protection separately');
assert($('modelCacheStatus'),'settings must show actual Moonshine cache separately');
assert($('modelCacheHistoryStatus'),'settings must show prior Moonshine cache observation');
assert.equal($('enableAudioButton'),null,'redundant audio-enable CTA must not compete with conversation start');
for(const href of ['./semantic-test.html','./model-lab.html','./coexistence-diagnostic.html']){
  assert($('developerTools').querySelector(`a[href="${href}"]`),`missing developer link ${href}`);
}
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

const historyEntryA=createHistoryEntry('history-a','今日はいい天気だね','What a lovely day!','sun');
const historyEntryB=createHistoryEntry('history-b','おはよう','Good morning!','general');
await history.append(historyEntryA);await history.append(historyEntryB);
$('historyButton').click();await settle();await settle();
let historyCards=$('featureBody').querySelectorAll('.history-card');
assert.equal(historyCards.length,2);
assert.equal(historyCards[0].querySelectorAll('button').length,1,'one icon button per history row');
let replayButton=historyCards[0].querySelector('.history-replay');
assert.equal(replayButton.textContent,'▶');
replayButton.click();await settle();
assert.equal(replayButton.textContent,'■','replay button changes to stop during playback');
replayButton.click();await settle();
assert.equal(replayButton.textContent,'▶','stopping restores play icon');
assert.equal((await history.list()).length,2,'replaying does not create history');
$('featureBody').querySelector('.history-toolbar button').click();await settle();await settle();
historyCards=$('featureBody').querySelectorAll('.history-card');
assert.equal(historyCards.length,2);
assert.equal($('featureBody').querySelectorAll('.history-replay').length,0,'delete mode replaces replay buttons with selectors');
const checkboxes=$('featureBody').querySelectorAll('.history-select');
checkboxes[0].click();
const deleteSelected=[...$('featureBody').querySelectorAll('.history-toolbar button')].find(x=>x.textContent==='1件を削除');
assert(deleteSelected&&!deleteSelected.disabled);
deleteSelected.click();await settle();await settle();await settle();await settle();
assert.equal((await history.list()).length,1,'batch-delete UI must not remove unselected rows');
$('featureClose').click();await settle();
await history.delete();

assert(!$('settingsScreen').querySelector('#playButton'),'play entry is on main');
console.log('Features: play selector outside card, 1/3 sentence switching, speaking state, topic change, history isolation OK');

// Exercise the actual app's decode/start boundary: cancelling during decoding must
// prevent both sound and history, while a started response commits exactly once.
const {runInNewContext}=await import('node:vm');
const {TurnRevisions}=await import('./src/turn-revisions.js');
let decodedResolve,starts=0,commits=0,lastRequest,micStops=0,micRestores=0;
const audioBuffer={length:128,sampleRate:24000,numberOfChannels:1,getChannelData:()=>new Float32Array(128).fill(.3)};
const context={state:'running',decodeAudioData:()=>new Promise(resolve=>decodedResolve=resolve),
  createBufferSource:()=>({connect(node){return node;},start(){starts++;queueMicrotask(()=>this.onended?.());},stop(){this.onended?.();}}),
  createGain:()=>({gain:{value:1},connect(node){return node;}}),
  createAnalyser:()=>({connect(){},getByteTimeDomainData(data){data.fill(128);}}),destination:{}};
let source=readFileSync(new URL('./src/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('import.meta.url',"'https://example.test/src/app.js'").replace('\ninitUi();','\n');
assert(source.includes("const highPerformance = ui.onboardingHighPerformance?.checked !== false;"));
assert(source.includes("const firstRunAsr = highPerformance ? 'small' : 'tiny';"));
assert(source.includes("await semanticPanel.setEnabled(highPerformance,{prepare:false,mode:'semantic'});"));
assert(source.includes('async function buildWebDiagnosticReport()'));
assert(source.includes('lastTtsFirstAudioMillis'));
assert(source.includes('runtimeDiagnosticEvents'));
assert(source.includes('unhandledrejection'));
assert(source.includes('diagnosticNow'));
assert(source.includes("detail.source==='cache'"));
assert(source.includes("'端末から読み込んでいます'"));
assert(source.includes("'ダウンロードしています'"));
assert(source.includes('asr.cacheReadMs='));
assert(source.includes('asr.networkDownloadMs='));
assert(source.includes('asr.wasmInitMs='));
assert(source.includes('asr.modelBuildMs='));
assert(source.includes('asr.totalInitMs='));
assert(source.includes('asr.cacheMisses='));
assert(source.includes('storage.persisted='));
assert(source.includes('storage.persistenceState='));
assert(source.includes('modelCache.status='));
assert(source.includes('modelCache.missingFiles='));
assert(source.includes('modelCache.previousSnapshot='));
assert(source.includes('modelCache.lastLoss='));
assert(source.includes('detectModelCacheLoss'));
assert(source.includes('recordModelCacheObservation'));
assert(source.includes('renderModelCacheHistoryStatus'));
assert(source.includes('emma_moonshine_cache_snapshot_v1'));
assert(source.includes('emma_moonshine_cache_loss_v1'));
assert(source.includes('inspectMoonshineManifestCache'));
assert(source.includes('refreshSelectedMoonshineCache'));
assert(source.includes('ensurePersistentModelStorage'));
assert(source.includes("sessionStorage.getItem('emma_mic_session_granted')==='1'"));
assert(source.includes("permission!=='granted'"));
assert(source.includes('画面を一度タップすると音声を再開します'));
source+=`\ngetTtsNameHints=()=>[];waitForPlaybackAudio=async()=>{}; setState=()=>{};renderAvatarFrame=()=>{};setBusy=()=>{};
  audioContext=testAudio;ttsWorker={postMessage(message){captureRequest(message.requestId);}};
  history.append=async()=>{commitHistory();};
  globalThis.appTest={
    speakResponse,stopEmma,enqueueAudio,
    complete(id){const q=audioQueues.get(id);if(q){q.generationDone=true;q.generationResolve?.();pumpAudio(id);}},
    appendTurn(audio){running=true;return turnRevisions.append(audio);},
    continueTurn(){return turnRevisions.speechStart();},
    useTestMic(){mic={stop:async()=>{}};}
  };
  releaseMicrophoneForEmmaVoice=async()=>{if(!mic)return false;mic=null;captureMicStop();return true;};
  restoreMicrophoneAfterEmmaVoice=async()=>{captureMicRestore();};`;
const sandbox={document,window,localStorage:storage,location:window.location,URL,URLSearchParams,console,crypto,
  ConversationHistory,historyEnabled,createHistoryEntry,TurnRevisions,LiteResponseEngine:class{},testAudio:context,captureRequest:id=>lastRequest=id,commitHistory:()=>commits++,
  requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},setTimeout,clearTimeout,navigator:{},Blob,Float32Array,Uint8Array,captureMicStop:()=>micStops++,captureMicRestore:()=>micRestores++};
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
const beforeSpecStarts=starts,beforeSpecCommits=commits;
app.useTestMic();
const firstTurn=app.appendTurn(Float32Array.of(.1));
speech=app.speakResponse('First partial reply',{entry:candidate,revision:firstTurn.version});
app.enqueueAudio({requestId:lastRequest,index:0,blob:new Blob(['audio'])});
await settle();
assert.equal(micStops,0,'mic must remain open during TTS generation');
assert.equal(starts,beforeSpecStarts,'speculative sound must not play before generation completes');
assert(app.continueTurn(),'speech-start must invalidate the old candidate');
app.complete(lastRequest);
await speech;
assert.equal(starts,beforeSpecStarts,'interrupted candidate must never play');
assert.equal(commits,beforeSpecCommits,'interrupted candidate must never enter history');
assert.equal(micStops,0,'interrupted candidate must not release the microphone');

const continued=app.appendTurn(Float32Array.of(.2));
speech=app.speakResponse('Complete merged reply',{entry:candidate,revision:continued.version});
app.enqueueAudio({requestId:lastRequest,index:0,blob:new Blob(['audio'])});
await settle();
assert.equal(starts,beforeSpecStarts);
assert.equal(micStops,0);
app.complete(lastRequest);
await settle();
assert.equal(micStops,1,'mic should be released only after TTS finishes generating');
decodedResolve(audioBuffer);
await speech;
assert.equal(starts,beforeSpecStarts+1);
assert.equal(commits,beforeSpecCommits+1);
assert.equal(micRestores,1);
await app.stopEmma();
console.log('Speculative TTS: continued speech cancels generation and history; mic stays live until playback OK');
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
