import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { indexedDB } from 'fake-indexeddb';
import { JSDOM } from 'jsdom';
import { ConversationHistory, createHistoryEntry, historyEnabled } from './src/conversation-history.js';
import { installFeatureScreens, nextPhrase, allTopicPhrases, singleSentencePhrases, phrasesForSentenceCount, localHistoryStamp } from './src/feature-screens.js';
import { appHistoryState, resolveAppPopScreen, shouldUseBrowserBack } from './src/app-navigation.js';
import { canonicalMoonshineModelAssetKey } from './src/vendor/moonshine/asset-downloader.js';
import { createConfirmation } from './src/multilingual/confirmation.js';
const topics=JSON.parse(readFileSync(new URL('./shared/play-topics.json',import.meta.url)));
// Production home must have the same Emma-first UI that passed trial tests.
{
  const doc=new JSDOM(readFileSync(new URL('./index.html',import.meta.url),'utf8')).window.document;
  const code=readFileSync(new URL('./src/app.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('./styles.css',import.meta.url),'utf8');
  assert.equal(doc.querySelector('#reply')?.textContent,"Hi, I'm Emma.");
  assert.equal(doc.querySelector('#replyTopic')?.textContent,'ごあいさつ');
  assert.equal(doc.querySelector('#replyJapanese')?.textContent,'こんにちは、エマだよ。');
  assert(!doc.querySelector('#conversation')?.classList.contains('hidden'));
  assert(doc.querySelector('#homeScreen .app-actions #playButton'),'play shortcut is in header');
  assert.equal(doc.querySelector('#homeScreen .bottom-bar #playButton'),null);
  assert(doc.querySelector('#settingsScreen #autoRespond'),'automatic reply lives in settings');
  assert.equal(doc.querySelector('#homeScreen #autoRespond'),null);
  assert(doc.querySelector('#settingsScreen label.toggle-line .switch input#historyEnabled'),'save-history toggle uses the shared settings switch');
  assert(doc.querySelector('#mainButton .start-cta-hint'),'large first-talk invitation on idle screen');
  assert(code.includes('if(!emmaText)return;'),'do not wipe card on interim empty ASR');
  assert(!css.includes('content:"✦"'),'avoid sparkle marks on cards and topic tags');
}


// The intro card must be visible immediately (without any audio autoplay).
// Empty interim ASR events must not erase it while the first turn is pending.
{
  const document=new JSDOM(readFileSync(new URL('./preview-emma.html',import.meta.url),'utf8')).window.document;
  const script=readFileSync(new URL('./src/preview-emma-app.js',import.meta.url),'utf8');
  assert.equal(document.querySelector('#replyTopic')?.textContent,'ごあいさつ');
  assert.equal(document.querySelector('#reply')?.textContent,"Hi, I'm Emma.");
  assert.equal(document.querySelector('#replyJapanese')?.textContent,'こんにちは、エマだよ。');
  assert(!document.querySelector('#conversation')?.classList.contains('hidden'),'intro visible from first render');
  assert(!document.querySelector('#emmaBubble')?.classList.contains('hidden'));
  assert(script.includes('if(!emmaText)return;'),'intermediate empty replies must preserve last visible card');
  assert(script.includes('const played=await speakResponse("Hi, I\'m Emma.");'),'opening card agrees with tutorial audio');
}


// Eight-point Emma-first UI regression: startup CTA, manual-first recording
// controls, header play shortcut, no sparkle decoration, compact scroll,
// accessible history checkbox and untranslated hint without visible heading.
{
  const doc=new JSDOM(readFileSync(new URL('./preview-emma.html',import.meta.url),'utf8')).window.document;
  const code=readFileSync(new URL('./src/preview-emma-app.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('./preview-emma.css',import.meta.url),'utf8');
  assert.equal(doc.querySelectorAll('#playButton').length,1,'play entry must be unique');
  assert(doc.querySelector('#homeScreen .app-actions #playButton'),'play belongs in top-right shortcut');
  assert.equal(doc.querySelector('#homeScreen .bottom-bar #playButton'),null,'play removed from bottom controls');
  assert.equal(doc.querySelector('#aboutButton'),null,'header help shortcut replaced by play');
  assert(doc.querySelector('#settingsAboutButton'),'research/about remains available in settings');
  assert(doc.querySelector('#mainButton .start-cta-hint'),'idle calls to action must invite a first tap');
  assert.equal(doc.querySelector('#homeScreen').dataset.session,'stopped');
  assert(doc.querySelector('#manualReplyButton'),'manual reply should remain an explicit action');
  assert(doc.querySelector('#stopButton'),'stop remains accessible');
  assert(code.includes("ui.homeScreen.dataset.session=running?'active':'stopped'"),'CTA layout tracks running state');
  assert(code.includes("Emmaはおやすみ中"),'Emma rather than app sleeps');
  assert(code.includes('ui.replyJapanese.textContent=hint.japaneseNote;'),'Japanese hint displayed without prefix');
  assert(!css.includes('content:"✦"'),'Gemini-like sparkle decorations must be removed');
  assert(css.includes('.screen-content.home-content') && css.includes('132px'),'home padding must not reserve a huge blank scroll');
  assert(css.includes('#manualReplyButton') && css.includes('grid-column:1'),'manual reply is emphasized');
  assert(doc.querySelector('#settingsScreen label.history-save-toggle input#historyEnabled'),'history checkbox remains inside label');
  assert.equal(doc.querySelector('#settingsScreen label.history-save-toggle')?.lastElementChild?.id,'historyEnabled','history checkbox belongs to the right of text');
  assert(css.includes('.history-save-toggle input[type="checkbox"]'),'checkbox size must override generic full-width form inputs');
}

// Emma occupies the same large avatar panel. The former permanent name badge
// is now the single live status chip, and ordinary spoken text appears only
// in the compact English card.
{
  const markup=readFileSync(new URL('./preview-emma.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('./src/preview-emma-app.js',import.meta.url),'utf8');
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

const previewHtml=readFileSync(new URL('./preview-emma.html',import.meta.url),'utf8');
const previewCode=readFileSync(new URL('./src/preview-emma-app.js',import.meta.url),'utf8');
for (const appFile of ['./src/app.js', './src/preview-emma-app.js']) {
  const code=readFileSync(new URL(appFile,import.meta.url),'utf8');
  const first=code.indexOf("ui.tutorialPrimaryButton?.addEventListener('click'");
  const last=code.indexOf("window.addEventListener('resize'",first);
  const clickHandler=code.slice(first,last);
  assert(first>=0 && last>first, 'tutorial introduction click handler exists');
  assert(clickHandler.includes("if(played && tutorialStep===0)"), 'only completed introduction auto-advances');
  assert(clickHandler.includes("tutorialStep=1;"), 'completed introduction opens step 2');
  assert(code.includes("return startedPlayback && queue.next>0;"), 'introduction waits for audible completion');
}
assert(previewHtml.includes('src="./src/preview-emma-app.js'), 'trial must load an isolated app entrypoint');
assert(previewHtml.includes('id="replyTopic"') && previewHtml.includes('id="replyJapanese"'));
assert(!previewHtml.includes('id="parentBubble"'), 'do not display parent ASR transcript');
assert(previewCode.includes("tutorialStep=1;\n        tutorialIntroPlayed=true;"), 'COI reload must restore the tutorial');
assert(!previewCode.includes("if(tutorialStep===2){finishTutorial();return;}"), 'tutorial must not have a manual finish action');
assert(!previewCode.includes("ui.tutorialPrimaryButton.textContent='チュートリアルを完了'"), 'tutorial completion button must not be shown');
const captureStart=previewCode.indexOf('function handleCapturedUtterance(audio) {');
const captureEnd=previewCode.indexOf('\nfunction handleSpeechStartDuringPreparation()',captureStart);
assert(captureStart>0 && captureEnd>captureStart, 'trial capture handler should exist');
const captureFunction=previewCode.slice(captureStart,captureEnd);
function probeTutorialCapture(autoRespond) {
  const transcriptCalls=[];
  const manuallyShown=[];
  const state={
    running:true,preparingConversation:false,speaking:false,tutorialStep:2,tutorialUserSpoke:false,
    pendingUtterance:null,processing:false,
    ui:{autoRespond:{checked:autoRespond},manualReplyButton:{classList:{remove:v=>manuallyShown.push(v)}}},
    turnRevisions:{append:(audio)=>({version:1,audio})},
    transcribeUtterance:(audio,opts)=>{transcriptCalls.push({audio,opts});},
    setState:()=>{},scheduleTutorialSpotlightSync:()=>{},
  };
  vm.runInNewContext(captureFunction+'\nhandleCapturedUtterance([1,2]);',state);
  return {state,transcriptCalls,manuallyShown};
}
const automatic=probeTutorialCapture(true);
assert.equal(automatic.state.tutorialUserSpoke,true);
assert.equal(automatic.transcriptCalls.length,1,'automatic tutorial reply must reach speech recognition');
assert.equal(automatic.state.pendingUtterance,null,'automatic tutorial reply must not be held for manual confirmation');
const manual=probeTutorialCapture(false);
assert.equal(manual.transcriptCalls.length,0,'manual preference must remain manual');
assert.equal(manual.state.pendingUtterance.kind,'audio');
assert.equal(manual.manuallyShown.length,1);

// Regression: a speculative reply resets the utterance revision as soon as
// playback commits. Tutorial completion therefore belongs to the audio
// completion event, not the (now-invalid) post-playback ASR revision.
const speechStart=previewCode.indexOf('async function speakResponse(text,');
const speechEnd=previewCode.indexOf('\nfunction enqueueAudio(m)',speechStart);
assert(speechStart>=0 && speechEnd>speechStart, 'trial playback implementation exists');
const speechFunction=previewCode.slice(speechStart,speechEnd);
async function simulateTutorialPlayback({revision=null,haveAudio=true,cancel=false}={}) {
  const state={
    conversationEpoch:1,
    revisionValid:true,
    tutorialStep:2,
    tutorialUserSpoke:true,
    finished:0,
    running:true, mic:null, ttsWorker:{postMessage:()=>{throw new Error('Unexpected uncached speech');}},
    requestSeq:0, audioQueues:new Map(), preparedAudio:new Map([['cached',haveAudio?[{fakeAudio:true}]:[]]]),
    audioCacheKey:()=> 'cached', diagnosticNow:()=>100, updateWebTimingDiagnostics:()=>{},
    setState:()=>{},setBusy:()=>{},
    isLiveTurn:(rev,epoch)=>state.conversationEpoch===epoch && (rev===null||state.revisionValid),
    turnRevisions:{reset:()=>{state.revisionValid=false;}},
    pumpAudio:(id)=>{
      const queue=state.audioQueues.get(id);
      if(!queue||queue.deferPlayback)return;
      queue.next=queue.total;
      if(cancel)state.conversationEpoch++;
      queue.resolve?.();
    },
    finishTutorial:()=>{state.finished++;state.tutorialStep=null;},
  };
  const played=await vm.runInNewContext(speechFunction+'\nspeakResponse("Hi!",{revision:'+String(revision)+'});',state);
  return {...state,played};
}
const speculativePlayback=await simulateTutorialPlayback({revision:7});
assert.equal(speculativePlayback.revisionValid,false, 'speculative playback resets ASR revision');
assert.equal(speculativePlayback.finished,1,'tutorial must finish after successful speculative audio');
const directPlayback=await simulateTutorialPlayback();
assert.equal(directPlayback.finished,1,'tutorial must finish after successful manual audio');
assert.equal(directPlayback.played,true,'completed audio must allow introduction auto-advance');
const noAudioPlayback=await simulateTutorialPlayback({haveAudio:false});
assert.equal(noAudioPlayback.finished,0,'no audible response must not finish the tutorial');
assert.equal(noAudioPlayback.played,false,'empty audio must not advance introduction');
const cancelledPlayback=await simulateTutorialPlayback({cancel:true});
assert.equal(cancelledPlayback.finished,0,'cancelled/stopped sessions must not finish the tutorial');
assert.equal(cancelledPlayback.played,undefined,'cancelled audio must not advance introduction');


// Guard the public callout labels as well as the removed Android promotion.
assert(publicHtml.includes('id="mainButton" class="primary-button start-cta">'));
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
  const ui = new JSDOM(readFileSync(new URL('./preview-emma.html',import.meta.url),'utf8')).window.document;
  const toggle=ui.getElementById('autoRespond');
  assert(toggle, 'auto-reply preference must still exist');
  assert(toggle.closest('#settingsScreen'),'auto-reply preference belongs in Settings');
  assert.equal(ui.querySelector('#homeScreen .auto-reply-card'),null,'home must not show auto-reply controls');
  assert.equal(ui.querySelectorAll('#autoRespond').length,1,'single saved auto-reply preference');
  const css=readFileSync(new URL('./preview-emma.css',import.meta.url),'utf8');
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
const cueBegins=[],cueEnds=[];
const audioBuffer={length:128,sampleRate:24000,numberOfChannels:1,getChannelData:()=>new Float32Array(128).fill(.3)};
const context={state:'running',decodeAudioData:()=>new Promise(resolve=>decodedResolve=resolve),
  createBufferSource:()=>({connect(node){return node;},start(){starts++;queueMicrotask(()=>this.onended?.());},stop(){this.onended?.();}}),
  createGain:()=>({gain:{value:1},connect(node){return node;}}),
  createAnalyser:()=>({connect(){},getByteTimeDomainData(data){data.fill(128);}}),destination:{}};
let source=readFileSync(new URL('./src/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'').replaceAll('import.meta.url',"'https://example.test/src/app.js'").replace('\ninitUi();','\n');
// Multilingual setup always prepares semantic classification; Japanese Tiny
// remains a separate existing setting, not a first-run language substitute.
assert(source.includes("const highPerformance = true;"));
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
  visualCue={begin(text){captureCueBegin(text);return text;},end(token){captureCueEnd(token);},stop(){},preload(){}};
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
  createConfirmation:options=>createConfirmation({document,...options}),
  ConversationHistory,historyEnabled,createHistoryEntry,TurnRevisions,LiteResponseEngine:class{},testAudio:context,captureRequest:id=>lastRequest=id,commitHistory:()=>commits++,captureCueBegin:text=>cueBegins.push(text),captureCueEnd:token=>cueEnds.push(token),
  requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},setTimeout,clearTimeout,navigator:{},Blob,Float32Array,Uint8Array,captureMicStop:()=>micStops++,captureMicRestore:()=>micRestores++};
runInNewContext(source,sandbox);
storage.setItem('emma_history_enabled','true');
const app=sandbox.appTest;
const candidate=createHistoryEntry('test','足を見て','Hello, little feet!','feet');
let speech=app.speakResponse(candidate.englishText,{entry:candidate});
app.enqueueAudio({requestId:lastRequest,index:0,blob:new Blob(['audio'])});await settle();
await app.stopEmma();decodedResolve(audioBuffer);await speech;await settle();
assert.equal(starts,0);assert.equal(commits,0);assert.equal(cueBegins.length,0,'stopped decode must never show a cue');
speech=app.speakResponse(candidate.englishText,{entry:candidate});
app.enqueueAudio({requestId:lastRequest,index:0,blob:new Blob(['audio'])});await settle();
decodedResolve(audioBuffer);app.complete(lastRequest);await speech;
assert.equal(starts,1);assert.equal(commits,1);assert.deepEqual(cueBegins,[candidate.englishText]);assert.deepEqual(cueEnds,[candidate.englishText],'audio end releases the same cue token');
// Playback without a conversation candidate (history replay or play) never saves.
speech=app.speakResponse('History replay phrase');
app.enqueueAudio({requestId:lastRequest,index:0,blob:new Blob(['audio'])});await settle();decodedResolve(audioBuffer);app.complete(lastRequest);await speech;
assert.equal(starts,2);assert.equal(commits,1);
console.log('Playback: stop during decode prevents late audio/history; first audio saves once; replay saves nothing OK');
const beforeSpecStarts=starts,beforeSpecCommits=commits,beforeSpecCues=cueBegins.length;
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
assert.equal(cueBegins.length,beforeSpecCues,'speculative TTS must not display an unspoken cue');
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
// Diagnose missing microphone signal without retaining audio or changing the
// speech detector. Frames ignored during preparation still count as capture.
let detectorFrames=0;
const metered=new EmmaMicrophone({shouldIgnore:()=>false});
metered.context={sampleRate:16000,state:'running'};
metered.stream={getAudioTracks:()=>[{readyState:'live',muted:false}]};
metered.vad={push:()=>{detectorFrames++;return {event:'none'};},resetSpeechOnly:()=>{}};
metered.handleFrame(new Float32Array(160).fill(0));
metered.handleFrame(new Float32Array(160).fill(.25));
assert.equal(detectorFrames,2);
const levels=metered.getDiagnostics();assert.equal(levels.frames,2);assert.equal(levels.samples,320);
assert.equal(levels.peakRms,.25);assert.equal(levels.liveTracks,1);
assert(Object.values(levels).every(value=>typeof value==='string'||typeof value==='number'),'Diagnostic output must not expose PCM');
metered.shouldIgnore=()=>true;metered.handleFrame(new Float32Array(160));
assert.equal(detectorFrames,2);assert.equal(metered.getDiagnostics().frames,3);
console.log('Microphone: aggregate signal diagnostics preserve detector routing and expose no PCM OK');
