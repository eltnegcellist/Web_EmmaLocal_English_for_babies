import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import vm from 'node:vm';
import {installLanguageUI} from './src/multilingual/ui.js';
import {translate,describeError} from './src/multilingual/translations.js';
import {installFeatureScreens} from './src/feature-screens.js';
import {GRADIENT_DESCRIPTIONS,SOFT_PALETTES,VIVID_PALETTES,FILLED_PALETTES} from './src/emma-color-palettes.js';
import {appHistoryState,resolveAppPopScreen} from './src/app-navigation.js';
import {createConfirmation} from './src/multilingual/confirmation.js';
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const topics=JSON.parse(readFileSync(new URL('./shared/play-topics.json',import.meta.url),'utf8'));
const capture=readFileSync(new URL('./src/audio-capture.js',import.meta.url),'utf8');
const warning=capture.match(/this.onWarning\?\.\('([^']+)'\)/)[1];
const japanese=/[ぁ-んァ-ン一-龯]/u;
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
const stockText=root=>{
  const walker=root.ownerDocument.createTreeWalker(root,4);const values=[];let node;
  while(node=walker.nextNode()){
    const parent=node.parentElement;
    if(parent.closest('script,style,svg,.history-japanese,.history-english')&&!parent.closest('.history-label'))continue;
    values.push(node.textContent.trim());
  }
  for(const el of root.querySelectorAll('[aria-label],[title],[alt],[placeholder]'))for(const attr of ['aria-label','title','alt','placeholder'])values.push(el.getAttribute(attr)||'');
  return values.filter(Boolean);
};
for(const lang of ['en','de','fr','ko','th','ja']){
  const dom=new JSDOM(html,{url:'https://ui-audit.test'});
  globalThis.document=dom.window.document;globalThis.MutationObserver=dom.window.MutationObserver;
  const $=id=>document.getElementById(id);
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'));};
  const ui=installLanguageUI({document,storage:dom.window.localStorage,languages:[lang],onChange:async(_,change)=>change.commit()});
  const assertLocalized=root=>{if(lang!=='ja')assert.deepEqual(stockText(root).filter(value=>japanese.test(value)),[],`${lang}: untranslated product UI`);};
  // The actual first-run/home/settings/tutorial markup, including accessible
  // names. Language names and Japanese-only model controls are intentional.
  const excluded='.language-picker option,#replyJapanese,#onboardingHighPerformance,#asrModel,#asrModelStatus,#semanticEnabled,#storageProtectionStatus,#modelCacheStatus,#modelCacheHistoryStatus,#developerTools';
  const copy=document.body.cloneNode(true);
  for(const el of copy.querySelectorAll('#aboutScreen,script,style,svg'))el.remove();
  copy.querySelector('#onboardingHighPerformance')?.closest('.lite-compact-setting')?.remove();
  for(const el of copy.querySelectorAll(excluded)){
    if(el.matches('#asrModel,#onboardingHighPerformance,#semanticEnabled'))el.closest('label')?.remove();else el.remove();
  }
  // Additional Japanese-only model help is deliberately hidden outside ja.
  for(const el of copy.querySelectorAll('.small.muted'))if(el.textContent.includes('Small推奨'))el.remove();
  assertLocalized(copy);
  // Actual warning producer, not a separately maintained test translation.
  $('noticeBody').textContent=warning;
  $('noticeTitle').textContent='従来方式で会話します';
  for(const value of Object.values(GRADIENT_DESCRIPTIONS)){
    $('gradientDescription').textContent=value;await settle();assertLocalized($('gradientDescription'));
  }
  for(const palette of [...Object.values(SOFT_PALETTES),...Object.values(VIVID_PALETTES),...Object.values(FILLED_PALETTES)]){
    const option=document.createElement('option');option.textContent=palette.label;$('colorMode').append(option);
  }
  await settle();assertLocalized($('noticeBody'));assertLocalized($('colorMode'));
  assert.equal($('noticeBody').textContent,translate(warning,lang));
  // An attribute changed on an existing node must be translated too.
  $('playButton').setAttribute('aria-label','もう一度聞く');await settle();assertLocalized($('playButton'));
  let confirmation='',allowClose=false,preparations=0,failPreparation=true,failPlayback=true,deleted=0,spoken='';
  const confirmUI=createConfirmation({document,translate:ui.translate});
  const confirmAction=(message,options)=>{
    confirmation=message;
    const result=confirmUI(message,options);
    const dialog=$('appConfirmDialog');assert(dialog.open);assertLocalized(dialog);
    assert.equal(document.activeElement,dialog.querySelector('button'),'Cancel must have initial focus');
    dialog.querySelectorAll('button')[allowClose?1:0].click();
    return result;
  };
  $('playButton').focus();
  const escapeTest=confirmUI('おとなの方へ：遊びを終えて戻りますか？会話は自動で始まりません。');
  assert.equal(await confirmUI('確認'),false,'Concurrent confirmation must not replace the active one');
  $('appConfirmDialog').dispatchEvent(new dom.window.Event('cancel',{cancelable:true}));
  assert.equal(await escapeTest,false);assert.equal(document.activeElement,$('playButton'));assert.equal($('appConfirmDialog'),null);
  globalThis.fetch=async()=>({ok:true,json:async()=>topics});
  $('featureDialog').showModal=function(){this.open=true;};$('featureDialog').close=function(){this.open=false;};
  const features=installFeatureScreens({stop:async()=>{},prepare:async()=>{preparations++;if(failPreparation)throw {};},
    speak:async value=>{spoken=value;if(failPlayback)throw Error('音声を取得できません。接続を確認して再試行してください。');},
    translate:ui.translate,confirmAction,describeError:error=>describeError(error,ui.language),isSpeaking:()=>false,avatar:()=>document.createElement('div'),
    history:{list:async()=>[{id:'one',createdAt:'2026-10-20T01:02:00Z',japaneseText:'おはよう',englishText:'Good morning!'}],deleteMany:async()=>{deleted++;}}});
  $('playButton').click();await settle();await settle();assert(features.isOpen());
  assertLocalized($('featureDialog'));assert(!$('featureBody').textContent.includes('undefined'));
  assert.equal(preparations,1);
  failPreparation=false;
  [...$('featureBody').querySelectorAll('button')].find(el=>el.textContent===translate('再試行',lang)).click();
  await settle();await settle();assert.equal(preparations,2);
  const tap=$('featureBody').querySelector('.play-tap');assert(!tap.disabled);
  tap.click();await settle();await settle();assertLocalized($('featureDialog'));
  failPlayback=false;tap.click();await settle();await settle();assert(spoken);assertLocalized($('featureDialog'));
  const english=tap.querySelector('.play-english-text').textContent;assert(english&&english===spoken,'Recorded English stays English');
  $('featureClose').click();await settle();assert(features.isOpen(),'Cancel must stay in play mode');
  assert.equal(confirmation,translate('おとなの方へ：遊びを終えて戻りますか？会話は自動で始まりません。',lang));
  if(lang!=='ja')assert(!japanese.test(confirmation));
  allowClose=true;$('featureClose').click();await settle();assert(!features.isOpen());
  $('historyButton').click();await settle();await settle();assertLocalized($('featureDialog'));
  assert($('featureBody').querySelector('.history-japanese').textContent.endsWith('おはよう'),'Do not translate original transcripts');
  assert($('featureBody').querySelector('.history-english').textContent.endsWith('Good morning!'));
  $('featureBody').querySelector('.history-toolbar button').click();await settle();await settle();
  $('featureBody').querySelector('.history-select').click();await settle();assertLocalized($('featureDialog'));
  allowClose=false;
  [...$('featureBody').querySelectorAll('button')].find(el=>el.textContent===translate('1件を削除',lang)).click();await settle();
  assert.equal(confirmation,translate('選択した1件の履歴を削除しますか？',lang));assert.equal(deleted,0);
  // Restore original Japanese after successive language changes.
  await ui.choose('ja');await settle();assert.equal($('noticeBody').textContent,warning);
  ui.dispose();dom.window.close();
}
// Exercise actual application boundaries, including error paths that a
// real browser cannot reliably force without altering device permissions.
const app=readFileSync(new URL('./src/app.js',import.meta.url),'utf8');
const stopFunction=app.slice(app.indexOf('async function stopEmma('),app.indexOf('\nfunction handleCapturedUtterance('));
for(const ready of [true,false]){
  const statuses=[],progress=[];
  const buttons=()=>({classList:{add:()=>{},remove:()=>{}},disabled:false});
  const state={conversationEpoch:1,languageUI:{language:'en',setStatus:value=>statuses.push(value)},
    multilingual:{ready,pending:new Map(ready?[]:[[1,{}]])},semanticPanel:{cancelPending:()=>{}},
    showProgress:visible=>progress.push(visible),showOnboardingProgress:visible=>progress.push(visible),
    audioUnlockWaiters:[],running:true,preparingConversation:true,processing:false,speaking:false,pendingUtterance:null,
    restoreUnspokenTurn:()=>{},turnRevisions:{reset:()=>{}},audioQueues:new Map(),activeAudioSource:null,mic:null,wakeLock:null,lastMicrophoneDiagnostics:null,
    ui:{manualReplyButton:buttons(),stopButton:buttons(),mainButton:buttons()},setBusy:()=>{},setState:()=>{}};
  await vm.runInNewContext(stopFunction+'\nstopEmma();',state);
  assert.deepEqual(progress,[false,false]);
  assert.equal(statuses.at(-1),ready?'モデルの準備ができました':'準備を中断しました。準備するボタンで再開できます。');
}
const navigationFunction=app.slice(app.indexOf('function openSubpage('),app.indexOf('\nfunction backFromSubpage('));
const entries=[appHistoryState('settings')]; // stale entry after tutorial replay
const navigation={currentScreen:'home',location:{href:'https://ui-audit.test/'},appHistoryState,
  showScreen:name=>navigation.currentScreen=name,
  window:{history:{replaceState:value=>entries[entries.length-1]=value,pushState:value=>entries.push(value)}}};
vm.runInNewContext(navigationFunction+"\nopenSubpage('settings');",navigation);
entries.pop();
assert.equal(resolveAppPopScreen('settings','home',entries.at(-1)),'home','Back after tutorial replay must leave Settings');
const asrFunction=app.slice(app.indexOf('async function transcribeUtterance('),app.indexOf('\nasync function processTranscript('));
for(const failure of [false,true]){
  const statuses=[],transcripts=[];
  const state={conversationEpoch:1,processing:false,preparingConversation:false,speaking:false,
    multilingualAsrDiagnostic:{},isLiveTurn:()=>true,setBusy:()=>{},setState:()=>{},diagnosticNow:()=>10,
    languageUI:{language:'en',setStatus:value=>statuses.push(value)},
    moonshineTranscriber:{transcribe:async()=>{if(failure)throw Error('音声認識が時間内に完了しませんでした。');return 'Guten Morgen';}},
    withTimeout:promise=>promise,processTranscript:async value=>transcripts.push(value),
    friendlyError:error=>describeError(error,'en'),multilingual:{cancel:()=>{}},console:{error:()=>{}}};
  await vm.runInNewContext(asrFunction+'\ntranscribeUtterance(new Float32Array(16000));',state);
  assert.equal(statuses.at(-1),failure?'音声認識でエラーが発生しました':'モデルの準備ができました');
  assert.equal(state.multilingualAsrDiagnostic.stage,failure?'error':'complete');
  assert.equal(transcripts.length,failure?0:1);
}
const resetConfirmation=app.match(/const confirmed=await confirmAction\(\s+languageUI.translate\(('(?:[^'\\]|\\.)*')\)/)[1];
for(const lang of ['en','de','fr','ko','th']){
  const message=vm.runInNewContext(resetConfirmation);
  assert(!japanese.test(translate(message,lang)),'The reset confirmation must use the selected language');
  for(const error of [undefined,{},Error('unrecognized worker failure'),Error('音声ファイルの検証に失敗しました。')]){
    assert(!japanese.test(describeError(error,lang)));assert(!describeError(error,lang).includes('undefined'));
  }
}
console.log('PASS: six-language stock UI, warning producer, gradients, dynamic aria labels, play preparation failure/retry/playback, app Back/cancel and history-delete confirmations, history dates and raw speech preservation.');
console.log('PASS: confirmation body/buttons, cancel-first focus, Escape cancellation, focus restoration and duplicate-open protection in six languages.');
console.log('PASS: actual ASR completion/timeout status, localized reset confirmation (no deletion), and worker-error fallback.');
console.log('PASS: Settings Back returns to Home after tutorial replay with stale browser history.');
