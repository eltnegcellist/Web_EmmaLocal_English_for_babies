import { installSemanticPanel } from './semantic/panel.js';
import { createSemanticController } from './semantic/controller.js';
import { ConversationHistory, historyEnabled, createHistoryEntry } from './conversation-history.js';
import { installFeatureScreens } from './feature-screens.js';
import { SOFT_PALETTES, VIVID_PALETTES, FILLED_PALETTES, normalizeFilledPalette, normalizeSoftPalette, normalizeVividPalette, normalizeColorSettings, shiftingPalette, GRADIENT_CYCLE_MS, GRADIENT_DESCRIPTIONS } from './emma-color-palettes.js';
import { EmmaMicrophone } from './audio-capture.js';
import { MoonshineAsrClient } from './asr-client.js';
import { TurnRevisions } from './turn-revisions.js';
import { LiteResponseEngine, isMeaningfulUtterance } from './lite-response-engine.js';
import { appHistoryState, resolveAppPopScreen, shouldUseBrowserBack } from './app-navigation.js';
import { replyDisplayHint } from './reply-display-hint.js';
import { inspectMoonshineCacheInventory, inspectMoonshineManifestCache } from './vendor/moonshine/asset-downloader.js';
import { MultilingualClient } from './multilingual/client.js';
import { LanguageSemanticClient } from './multilingual/semantic-client.js';
import { installLanguageUI } from './multilingual/ui.js';
import { meaningfulSpeech, LANGUAGE_KEY } from './multilingual/core.js';

const $ = (id) => document.getElementById(id);
const ui = {
  onboardingScreen:$('onboardingScreen'), homeScreen:$('homeScreen'), settingsScreen:$('settingsScreen'), aboutScreen:$('aboutScreen'),
  onboardingHighPerformance:$('onboardingHighPerformance'),
  prepareEmmaButton:$('prepareEmmaButton'),
  onboardingProgress:$('onboardingProgress'), onboardingProgressBar:$('onboardingProgressBar'), onboardingProgressText:$('onboardingProgressText'),
  avatar:$('avatar'), statusTitle:$('statusTitle'), statusDetail:$('statusDetail'), busySpinner:$('busySpinner'), tutorialStatusTarget:$('tutorialStatusTarget'),
  progressWrap:$('progressWrap'), progressBar:$('progressBar'), progressText:$('progressText'),
  conversation:$('conversation'), emmaBubble:$('emmaBubble'), reply:$('reply'),
  replyTopic:$('replyTopic'), replyJapanese:$('replyJapanese'),
  mainButton:$('mainButton'), stopButton:$('stopButton'), manualReplyButton:$('manualReplyButton'), enableAudioButton:$('enableAudioButton'),
  autoRespond:$('autoRespond'), endpointMode:$('endpointMode'), aboutButton:$('aboutButton'), settingsButton:$('settingsButton'),
  settingsBackButton:$('settingsBackButton'), settingsAboutButton:$('settingsAboutButton'),
  aboutBackButton:$('aboutBackButton'), onboardingAboutButton:$('onboardingAboutButton'),
  aiBubbleLabel:$('aiBubbleLabel'), aiNameBadge:$('aiNameBadge'),
  aiAvatarFace:$('aiAvatarFace'), onboardingAiIntro:$('onboardingAiIntro'),
  tutorialReplayButton:$('tutorialReplayButton'), tutorialOverlay:$('tutorialOverlay'), tutorialSpotlight:$('tutorialSpotlight'),
  tutorialCard:$('tutorialCard'), tutorialStepLabel:$('tutorialStepLabel'), tutorialTitle:$('tutorialTitle'),
  tutorialBody:$('tutorialBody'), tutorialSkipButton:$('tutorialSkipButton'), tutorialPrimaryButton:$('tutorialPrimaryButton'), tutorialHint:$('tutorialHint'),
  filledPalette:$('filledPalette'), filledPaletteRow:$('filledPaletteRow'), softPalette:$('softPalette'), softPaletteRow:$('softPaletteRow'), colorMode:$('colorMode'), vividPalette:$('vividPalette'), vividPaletteRow:$('vividPaletteRow'), colorModeDescription:$('colorModeDescription'), gradientDescription:$('gradientDescription'),
  keepAwake:$('keepAwake'), asrModel:$('asrModel'), asrModelStatus:$('asrModelStatus'), runtimeBackend:$('runtimeBackend'),
  storageProtectionStatus:$('storageProtectionStatus'), modelCacheStatus:$('modelCacheStatus'), modelCacheHistoryStatus:$('modelCacheHistoryStatus'),
  developerUnlockTrigger:$('developerUnlockTrigger'), webBuild:$('webBuild'), developerTools:$('developerTools'), fullResetButton:$('fullResetButton'),
  webTimingDiagnostics:$('webTimingDiagnostics'), copyDiagnosticsButton:$('copyDiagnosticsButton'),
  downloadDiagnosticsButton:$('downloadDiagnosticsButton'), clearDiagnosticsButton:$('clearDiagnosticsButton'),
  diagnosticsStatus:$('diagnosticsStatus'),
  semanticEnabled:$('semanticEnabled'), semanticStatus:$('semanticStatus'),
  debugInput:$('debugInput'), debugReplyButton:$('debugReplyButton'),
  noticeDialog:$('noticeDialog'), noticeTitle:$('noticeTitle'), noticeBody:$('noticeBody'), noticeLink:$('noticeLink'), noticeCloseButton:$('noticeCloseButton')
};

const CURRENT_SETUP_REVISION = 'moonshine-streaming-qwen3-prerecorded-1202-v11';
const WEB_BUILD = '20261020-private-asr-i18n-r1';

const STORAGE = {
  setupRevision:'emma_web_setup_revision',
  colorMode:'emma_color_mode',
  vivid:'emma_vivid_palette',
  soft:'emma_soft_palette',
  filled:'emma_filled_palette',
  keepAwake:'emma_keep_awake',
  autoRespond:'emma_auto_respond',
  endpointMode:'emma_endpoint_mode',
  playSentenceCount:'emma_play_sentence_count',
  asrModel:'emma_asr_model',
  startTiny:'emma_first_run_start_tiny',
  highPerformance:'emma_first_run_high_performance',
  asrReload:'emma_asr_reload',
  tutorialDone:'emma_web_tutorial_completed_v1',
  modelCacheSnapshot:'emma_moonshine_cache_snapshot_v1',
  modelCacheLoss:'emma_moonshine_cache_loss_v1',
  replyDiversity:'emma_ruri_reply_diversity_v1'
};

if (new URLSearchParams(location.search).has('debug')) document.body.classList.add('debug');

function readStoredJson(key) {
  try {
    const raw=localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredJson(key,value) {
  try { localStorage.setItem(key,JSON.stringify(value)); } catch {}
}

const engine = new LiteResponseEngine({diversityState:readStoredJson(STORAGE.replyDiversity)});
const turnRevisions = new TurnRevisions();
let speculativeEngineSnapshot=null;
function restoreUnspokenTurn(){
  if(speculativeEngineSnapshot){
    engine.restoreTurnState(speculativeEngineSnapshot);
    writeStoredJson(STORAGE.replyDiversity,engine.exportReplyDiversityState());
    speculativeEngineSnapshot=null;
  }
}
function isLiveTurn(revision,epoch){
  return epoch===conversationEpoch && (revision===null || (running && turnRevisions.isCurrent(revision)));
}
let semanticPanel;
let preparingConversation=false;
// The official v0.1.5 release archive contains the split-frontend WASM build;
// the v0.1.5 npm tarball's WASM does not.
let moonshineTranscriber, ttsWorker, mic, wakeLock;
let moonshineStage='idle';
let asrInfoCache=null, ttsInfoCache=null, ttsWorkerSignature='';
let running=false, workersReady=false, processing=false, speaking=false;
let requestSeq=0;
let audioContext=null;
let activeAudioSource=null;
let audioUnlocked=false;
const audioUnlockWaiters=[];
let pendingUtterance=null;
let avatarVisualState='idle';
let avatarBlinkFrame='open';
let avatarMouthLevel='small';
let avatarBlinkTimer=null;
let tutorialStep=null;
let tutorialIntroPlayed=false;
let tutorialUserSpoke=false;
let previousScreen='home';
let currentScreen='home';
let appearanceTimer=null;
let developerTapCount=0;
let developerTapTimer=null;
let lastTtsFirstChunkMillis=null;
let lastTtsGenerationCompleteMillis=null;
let lastTtsFirstAudioMillis=null;
let lastTtsTotalMillis=null;
let lastMoonshineDiagnostics=null;
let storagePersistenceState='unknown';
let modelCacheState={
  status:'unknown',
  label:null,
  entryCount:0,
  expectedFiles:null,
  presentFiles:null,
  expectedBytes:null,
  presentBytes:null,
  aliasHits:0,
  missingFiles:[]
};
let previousModelCacheSnapshot=readStoredJson(STORAGE.modelCacheSnapshot);
let lastModelCacheLoss=readStoredJson(STORAGE.modelCacheLoss);
const runtimeDiagnosticEvents=[];
function recordRuntimeDiagnosticEvent(kind,error){
  const value=error instanceof Error ? error : new Error(String(error||kind));
  runtimeDiagnosticEvents.push({
    at:new Date().toISOString(),
    kind,
    name:value.name||'Error',
    message:String(value.message||'').replace(/[\r\n]+/g,' ').slice(0,500),
  });
  if(runtimeDiagnosticEvents.length>30)runtimeDiagnosticEvents.splice(0,runtimeDiagnosticEvents.length-30);
}
window.addEventListener('error',event=>recordRuntimeDiagnosticEvent('error',event.error||event.message));
window.addEventListener('unhandledrejection',event=>recordRuntimeDiagnosticEvent('unhandledrejection',event.reason));
const diagnosticNow=()=>typeof performance!=='undefined'&&typeof performance.now==='function'
  ? performance.now()
  : Date.now();
const audioQueues = new Map();
const history = new ConversationHistory();
let sessionId='', conversationEpoch=0;
const preparedAudio=new Map();
let featureScreens;
function audioCacheKey(text){
  return [getTtsSignature(),String(text||'')].join('|');
}



let multilingualStatus=()=>{};
let multilingual,languageUI;
let modelSelectionEpoch=0;
let multilingualAsrDiagnostic={stage:'idle',detectedLanguage:null,elapsedMs:null,error:null};
function initLanguages(){
multilingual=new MultilingualClient({onStatus:data=>{
  const recognition=data.stage==='detecting-language'||data.stage==='transcribing';
  if(recognition)multilingualAsrDiagnostic.stage=data.stage;
  if(data.detectedLanguage)multilingualAsrDiagnostic.detectedLanguage=data.detectedLanguage;
  const key=data.stage==='loading'?'モデルを読み込んでいます…':
    data.stage==='detecting-language'?'発話の言語を判定しています…':
    data.stage==='transcribing'?'聞き取っています…':'モデルを準備しています…';
  languageUI.setStatus(key,data);
  const message=languageUI.translate(key),percent=data.total?data.loaded/data.total*100:0;
  if(recognition){
    setState('thinking',key,
      data.stage==='detecting-language'?'音声から言語を確認しています。':'Whisperで音声を認識しています。');
  }else{
    showProgress(true,percent,message);showOnboardingProgress(true,percent,message);
    multilingualStatus({...data,message});
  }
}});
languageUI=installLanguageUI({onChange:async(next,{commit})=>{
  const changedRoute=(languageUI.language==='ja')!==(next==='ja');
  modelSelectionEpoch++;
  await stopEmma();
  if(changedRoute){moonshineTranscriber?.close?.();moonshineTranscriber=null;asrInfoCache=null;workersReady=false;
    semanticPanel?.client.japanese?.cancel();multilingual.cancel();}
  commit();
  await semanticPanel.setEnabled(true,{prepare:false,mode:'semantic'});
  // Moonshine requires an isolated page before its worker downloads/initializes.
  // Switching from a non-Japanese Whisper session used to skip this check.
  if(next==='ja' && changedRoute){
    const isolated=await ensureMoonshineIsolation({manualStartAfterReload:true});
    if(!isolated)return; // The refreshed page resumes with the saved Japanese choice.
  }
  if(localStorage.getItem(STORAGE.setupRevision)!==CURRENT_SETUP_REVISION){languageUI.setStatus('初回のみ必要なモデルを準備します');return;}
  languageUI.setStatus('モデルを準備しています…');
  try{await initWorkers();await prepareSemanticForConversation();languageUI.setStatus('モデルの準備ができました');}
  catch(error){languageUI.setStatus('モデルを準備できませんでした。再試行してください。');throw error;}
  finally{showProgress(false);showOnboardingProgress(false);}
  setState('idle','準備できました','言語を変更しました。開始ボタンから再開してください。');
}});
}
initUi();

function initUi() {
  initLanguages();
  // A saved Japanese opt-out must not silently disable the foreign E5 route.
  if(languageUI.language!=='ja')localStorage.setItem('emma_semantic_enabled','true');
  semanticPanel=createSemanticController({engine,mode:'semantic',clientFactory:onStatus=>{
    multilingualStatus=onStatus;
    return new LanguageSemanticClient({language:()=>languageUI.language,multilingual,onStatus});
  },beforeChange:async()=>{if(running||preparingConversation||processing||speaking)await stopEmma();}});
  installSemanticPanel({controller:semanticPanel});
  semanticPanel.subscribe(({requested,status})=>{
    ui.semanticEnabled.checked=requested;
    ui.semanticStatus.textContent=status.message;
    if(languageUI.language!=='ja' && status.error)languageUI.setStatus('モデルを準備できませんでした。再試行してください。');
  });
  const historyCheckbox=$('historyEnabled');
  historyCheckbox.checked=historyEnabled(localStorage);
  historyCheckbox.addEventListener('change',()=>localStorage.setItem('emma_history_enabled',String(historyCheckbox.checked)));
  featureScreens=installFeatureScreens({
    stop:stopEmma,
    prepare:initVoice,
    speak:speakResponse,
    history,
    isSpeaking:()=>speaking,
    playSentenceCount:()=>localStorage.getItem(STORAGE.playSentenceCount)==='3'?3:1,
    setPlaySentenceCount:count=>localStorage.setItem(STORAGE.playSentenceCount,count===3?'3':'1'),
    avatar:()=>{ const avatar=ui.avatar.cloneNode(true); avatar.removeAttribute('id'); avatar.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id')); return avatar; }
  });
  const colors = normalizeColorSettings(localStorage.getItem(STORAGE.colorMode), localStorage.getItem(STORAGE.vivid));
  ui.colorMode.value = colors.mode;
  ui.vividPalette.value = colors.vivid;
  ui.softPalette.value = normalizeSoftPalette(localStorage.getItem(STORAGE.soft));
  ui.filledPalette.value = normalizeFilledPalette(localStorage.getItem(STORAGE.filled));
  ui.keepAwake.checked = localStorage.getItem(STORAGE.keepAwake) !== 'false';
  ui.autoRespond.checked = localStorage.getItem(STORAGE.autoRespond) !== 'false';
  if(ui.endpointMode)ui.endpointMode.value=localStorage.getItem(STORAGE.endpointMode)==='legacy'?'legacy':'silero';
  if (ui.asrModel) ui.asrModel.value = localStorage.getItem(STORAGE.asrModel) || 'small';
  if (ui.onboardingHighPerformance) {
    const savedPerformance = localStorage.getItem(STORAGE.highPerformance);
    const legacyTiny = localStorage.getItem(STORAGE.startTiny) === 'true' ||
      localStorage.getItem(STORAGE.asrModel) === 'tiny';
    const semanticRequested = localStorage.getItem('emma_semantic_enabled') !== 'false';
    ui.onboardingHighPerformance.checked = savedPerformance == null
      ? (!legacyTiny && semanticRequested)
      : savedPerformance !== 'false';
  }
  updateAsrModelStatus();
  bindEvents();
  updateAiNameUi();
  applyAppearance();
  updateAppearanceSettings();
  updateAudioUnlockUi();
  queueMicrotask(()=>ensurePersistentModelStorage({request:false}));
  queueMicrotask(()=>refreshMoonshineCacheInventory());
  renderModelCacheHistoryStatus();

  startAvatarBlinkLoop();

  const reloadedAsr=sessionStorage.getItem(STORAGE.asrReload);
  const needsMicGestureAfterIsolation=sessionStorage.getItem('emma_coi_manual_start')==='1';
  if (localStorage.getItem(STORAGE.setupRevision) === CURRENT_SETUP_REVISION) {
    if(reloadedAsr){
      sessionStorage.removeItem(STORAGE.asrReload);
      showScreen('home',{autoStart:false});
      const label=reloadedAsr==='small' ? 'Small' : 'Tiny';
      setState('idle',`音声認識を${label}に変更しました`,'「呼びかけを始める」を押して呼びかけを再開してください。');
      if(ui.asrModelStatus) ui.asrModelStatus.textContent=`現在：${label}。再読み込みして安全に切り替えました。`;
      if(localStorage.getItem(STORAGE.tutorialDone)!=='true') queueMicrotask(()=>startTutorial());
    } else if(needsMicGestureAfterIsolation) {
      sessionStorage.removeItem('emma_coi_manual_start');
      showScreen('home',{autoStart:false});
      setState('idle','マイクの準備ができました','「呼びかけを始める」を押すと、マイクの許可を確認して呼びかけを始めます。');
      // The isolation reload is expected on some Android browsers. Resume at
      // the real start-button exercise rather than silently losing the coach.
      if(localStorage.getItem(STORAGE.tutorialDone)!=='true') {
        tutorialStep=1;
        tutorialIntroPlayed=true;
        tutorialUserSpoke=false;
        renderTutorial();
      }
    } else if(localStorage.getItem(STORAGE.tutorialDone)==='true') {
      showScreen('home');
    } else {
      showScreen('home',{autoStart:false});
      queueMicrotask(()=>startTutorial());
    }
  } else showScreen('onboarding');
}

function bindEvents() {
  ui.mainButton.addEventListener('click',async()=>{
    unlockPlaybackAudioFromGesture();
    await startEmma();
    if(tutorialStep===1 && running){
      tutorialStep=2;
      tutorialUserSpoke=false;
      renderTutorial();
    }
  });
  ui.stopButton.addEventListener('click', stopEmma);
  ui.manualReplyButton.addEventListener('click', forceReplyNow);
  ui.enableAudioButton?.addEventListener('click',unlockPlaybackAudioFromGesture);
  document.addEventListener('pointerdown',()=>{ if(!audioUnlocked) unlockPlaybackAudioFromGesture(); },{capture:true,passive:true});
  ui.prepareEmmaButton.addEventListener('click',()=>{ unlockPlaybackAudioFromGesture(); prepareFirstRun(); });

  // About remains available in Settings; the top-right shortcut now opens "押して聞く".
  ui.settingsAboutButton.addEventListener('click',()=>openAbout('settings'));
  ui.onboardingAboutButton.addEventListener('click',()=>openAbout('onboarding'));
  ui.aboutBackButton.addEventListener('click',backFromSubpage);
  ui.settingsBackButton.addEventListener('click',backFromSubpage);
  ui.settingsButton.addEventListener('click',async()=>{
    if (running || preparingConversation || speaking || processing) await stopEmma();
    openSubpage('settings');
  });
  window.addEventListener('popstate',(event)=>{
    const target=resolveAppPopScreen(currentScreen,previousScreen,event.state);
    if(target) showScreen(target,{autoStart:false});
  });

  ui.noticeCloseButton.addEventListener('click',closeNotice);
  ui.noticeDialog.addEventListener('click',(event)=>{
    if(event.target===ui.noticeDialog) closeNotice();
  });
  document.addEventListener('keydown',(event)=>{
    if(event.key==='Escape'&&!ui.noticeDialog.classList.contains('hidden')) closeNotice();
  });

  ui.colorMode.addEventListener('change',()=>{
    localStorage.setItem(STORAGE.colorMode,ui.colorMode.value);
    applyAppearance();
    updateAppearanceSettings();
  });
  ui.softPalette.addEventListener('change',()=>{
    localStorage.setItem(STORAGE.soft,ui.softPalette.value);
    applyAppearance();
  });
  ui.filledPalette.addEventListener('change',()=>{
    localStorage.setItem(STORAGE.filled,ui.filledPalette.value);
    applyAppearance();
  });
  ui.vividPalette.addEventListener('change',()=>{
    localStorage.setItem(STORAGE.vivid,ui.vividPalette.value);
    applyAppearance();
  });

  ui.keepAwake.addEventListener('change',()=>{
    localStorage.setItem(STORAGE.keepAwake,String(ui.keepAwake.checked));
    if (!ui.keepAwake.checked) {
      wakeLock?.release?.().catch(()=>{});
      wakeLock=null;
    } else if (running) requestWakeLock();
  });

  ui.asrModel?.addEventListener('change',()=>{
    const next=ui.asrModel.value==='small' ? 'small' : 'tiny';
    const current=localStorage.getItem(STORAGE.asrModel)==='tiny' ? 'tiny' : 'small';
    if(next===current) return;

    localStorage.setItem(STORAGE.asrModel,next);
    sessionStorage.setItem(STORAGE.asrReload,next);

    if(ui.asrModelStatus) {
      const label=next==='small' ? 'Small' : 'Tiny';
      ui.asrModelStatus.textContent=`${label}へ切り替えるためみつことばを再読み込みします…`;
    }

    const url=new URL(location.href);
    url.searchParams.set('v',WEB_BUILD);
    url.searchParams.set('asr',next);
    location.replace(url.href);
  });
  ui.onboardingHighPerformance?.addEventListener('change',()=>{
    localStorage.setItem(STORAGE.highPerformance,String(ui.onboardingHighPerformance.checked));
  });
  ui.semanticEnabled.addEventListener('change',()=>semanticPanel.setEnabled(ui.semanticEnabled.checked,{prepare:true,mode:'semantic'}));
  ui.endpointMode?.addEventListener('change',async()=>{
    await stopEmma();
    const mode=ui.endpointMode.value==='legacy'?'legacy':'silero';
    localStorage.setItem(STORAGE.endpointMode,mode);
    setState('idle','話し終わりの判定を変更しました','「呼びかけを始める」を押して再開してください。');
  });
  ui.autoRespond.addEventListener('change',()=>{
    localStorage.setItem(STORAGE.autoRespond,String(ui.autoRespond.checked));
    if (!ui.autoRespond.checked){restoreUnspokenTurn();turnRevisions.reset();}
    if (ui.autoRespond.checked && pendingUtterance && !processing && !speaking) respondToPendingUtterance();
  });

  ui.developerUnlockTrigger?.addEventListener('click',()=>{
    developerTapCount+=1;
    clearTimeout(developerTapTimer);
    developerTapTimer=setTimeout(()=>{developerTapCount=0;},4000);
    if(developerTapCount>=5){
      developerTapCount=0;
      clearTimeout(developerTapTimer);
      ui.developerTools?.classList.remove('hidden');
    }
  });

  ui.copyDiagnosticsButton?.addEventListener('click',async()=>{
    const report=await buildWebDiagnosticReport();
    try{
      await copyTextToClipboard(report);
      if(ui.diagnosticsStatus)ui.diagnosticsStatus.textContent='診断情報をコピーしました。';
    }catch(error){
      if(ui.diagnosticsStatus)ui.diagnosticsStatus.textContent=`コピーできませんでした: ${error.message||error}`;
    }
  });
  ui.downloadDiagnosticsButton?.addEventListener('click',async()=>{
    const report=await buildWebDiagnosticReport();
    const blob=new Blob([report],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=`mitsukotoba-web-diagnostics-${new Date().toISOString().replace(/[:.]/g,'-')}.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    if(ui.diagnosticsStatus)ui.diagnosticsStatus.textContent='診断情報をTXTで保存しました。';
  });

  ui.clearDiagnosticsButton?.addEventListener('click',()=>{
    runtimeDiagnosticEvents.length=0;
    lastTtsFirstChunkMillis=null;
    lastTtsGenerationCompleteMillis=null;
    lastTtsFirstAudioMillis=null;
    lastTtsTotalMillis=null;
    updateWebTimingDiagnostics();
    if(ui.diagnosticsStatus)ui.diagnosticsStatus.textContent='直近の診断記録をクリアしました。';
  });

  ui.fullResetButton?.addEventListener('click',()=>{
    const confirmed=window.confirm(
      'みつことばを初期状態に戻します。\n\n赤ちゃんの設定、見た目、初回準備情報、保存音声とモデルのキャッシュを削除します。次回は音声とモデルの再取得が必要です。\n\n実行しますか？'
    );
    if(confirmed) location.href='./reset.html?full=1';
  });
  ui.tutorialReplayButton?.addEventListener('click',async()=>{
    if(running || preparingConversation || processing || speaking) await stopEmma();
    showScreen('home',{autoStart:false});
    startTutorial({replay:true});
  });
  ui.tutorialSkipButton?.addEventListener('click',finishTutorial);
  ui.tutorialPrimaryButton?.addEventListener('click',async()=>{
    if(tutorialStep!==0 || tutorialIntroPlayed)return;
    unlockPlaybackAudioFromGesture();
    ui.tutorialPrimaryButton.disabled=true;
    try{
      await ensureWorkersForDebug();
      const played=await speakResponse("Hi, I'm Emma.");
      if(played && tutorialStep===0){
        tutorialIntroPlayed=true;
        tutorialStep=1;
      }
    }catch(error){
      console.error('Tutorial self-introduction failed',error);
    }finally{
      ui.tutorialPrimaryButton.disabled=false;
      renderTutorial();
    }
  });
  window.addEventListener('resize',()=>{ if(tutorialStep!==null) scheduleTutorialSpotlightSync(); });
  window.addEventListener('scroll',()=>{ if(tutorialStep!==null) scheduleTutorialSpotlightSync(); },{passive:true});
  window.visualViewport?.addEventListener('resize',()=>{ if(tutorialStep!==null) scheduleTutorialSpotlightSync(); });
  window.visualViewport?.addEventListener('scroll',()=>{ if(tutorialStep!==null) scheduleTutorialSpotlightSync(); },{passive:true});

  ui.debugReplyButton.addEventListener('click',async()=>{
    const text=ui.debugInput.value.trim();
    if(!text)return;
    showConversation(text,'');
    const epoch=conversationEpoch;
    const response=await semanticPanel.respond(text,'',{isCurrent:()=>epoch===conversationEpoch});
    if(!response)return;
    const english=stripAiSpeakerLabel(response.english);
    showConversation(text,english,response.scene);
    await ensureWorkersForDebug();
    await speakResponse(english);
  });

  document.addEventListener('visibilitychange',async()=>{
    if(document.visibilityState==='hidden') requestBackgroundModelContinuation();
    if(running && document.visibilityState==='visible' && ui.keepAwake.checked) await requestWakeLock();
  });
  window.addEventListener('pagehide',requestBackgroundModelContinuation,{capture:true});
}

function showScreen(name,{autoStart=true}={}) {
  currentScreen=name;
  for (const key of ['onboarding','home','settings','about']) {
    ui[key+'Screen'].classList.toggle('hidden',key!==name);
  }
  window.scrollTo({top:0,behavior:'auto'});

  if(
    autoStart &&
    tutorialStep===null &&
    name==='home' &&
    localStorage.getItem(STORAGE.setupRevision)===CURRENT_SETUP_REVISION &&
    localStorage.getItem(STORAGE.tutorialDone)==='true'
  ) {
    queueMicrotask(async()=>{
      if(running || processing || speaking || ui.mainButton.disabled) return;
      const permission=await getMicrophonePermissionState();
      const sessionGranted=sessionStorage.getItem('emma_mic_session_granted')==='1';
      if(!sessionGranted && permission!=='granted') {
        setState('idle','呼びかけを始められます','「呼びかけを始める」を押すと、マイクを確認して呼びかけを始めます。');
        return;
      }
      if(!running && !processing && !speaking && !ui.mainButton.disabled) {
        startEmma({ auto: true }).catch(error=>console.warn('Emma auto-start:',error));
      }
    });
  }
}

function openSubpage(name) {
  if(currentScreen!==name) window.history.pushState(appHistoryState(name),'',location.href);
  showScreen(name,{autoStart:false});
}

function backFromSubpage() {
  if(shouldUseBrowserBack(currentScreen,window.history.state)) {
    window.history.back();
    return;
  }
  showScreen(currentScreen==='about'?previousScreen:'home',{autoStart:false});
}

function openAbout(from) {
  previousScreen=from;
  openSubpage('about');
}

function showNotice(title,body,linkUrl='',linkLabel='') {
  ui.noticeTitle.textContent=title;
  ui.noticeBody.textContent=body;
  if (ui.noticeLink) {
    ui.noticeLink.classList.toggle('hidden',!linkUrl);
    ui.noticeLink.href=linkUrl || '#';
    ui.noticeLink.textContent=linkLabel || '詳しく見る';
  }
  ui.noticeDialog.classList.remove('hidden');
  ui.noticeDialog.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
  requestAnimationFrame(()=>ui.noticeCloseButton.focus({preventScroll:true}));
}

function closeNotice() {
  ui.noticeDialog.classList.add('hidden');
  ui.noticeDialog.setAttribute('aria-hidden','true');
  document.body.classList.remove('modal-open');
}

async function getMicrophonePermissionState() {
  try {
    if(!navigator.permissions?.query) return 'unknown';
    const status=await navigator.permissions.query({name:'microphone'});
    return status?.state || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function requestMicrophonePermission(timeoutMs=30000) {
  if(!navigator.mediaDevices?.getUserMedia) {
    throw new Error('このブラウザではマイクを利用できません。');
  }

  let timer;
  let stream;
  try {
    stream=await Promise.race([
      navigator.mediaDevices.getUserMedia({
        audio:{channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false},
        video:false
      }),
      new Promise((_,reject)=>{
        timer=setTimeout(
          ()=>reject(new Error('マイクの許可確認が完了しませんでした。サイト設定でマイクを許可し、Androidで他アプリのバブルやオーバーレイが表示されている場合は閉じてから、もう一度お試しください。')),
          timeoutMs
        );
      })
    ]);
    return true;
  } finally {
    clearTimeout(timer);
    stream?.getTracks?.().forEach(track=>track.stop());
  }
}

function renderStoragePersistenceStatus() {
  if(ui.storageProtectionStatus) {
    ui.storageProtectionStatus.textContent=storagePersistenceState==='persistent'
      ? '保存領域の保護: ON'
      : storagePersistenceState==='best-effort'
        ? '保存領域の保護: OFF（ブラウザが削除する場合があります）'
        : storagePersistenceState==='unsupported'
          ? '保存領域の保護: このブラウザは非対応'
          : '保存領域の保護: 確認中';
  }
  if(moonshineStage==='idle' || moonshineStage==='ready') updateAsrModelStatus();
}

function formatModelMb(value) {
  return Number.isFinite(value) ? `${(value/1_000_000).toFixed(1)} MB` : '';
}

function formatModelCheckTime(value) {
  const date=new Date(value||0);
  if(!Number.isFinite(date.getTime())) return '時刻不明';
  return new Intl.DateTimeFormat('ja-JP',{
    month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'
  }).format(date);
}

function snapshotFromModelCacheState(state=modelCacheState) {
  return {
    checkedAt:new Date().toISOString(),
    label:state.label,
    status:state.status,
    entryCount:Number(state.entryCount)||0,
    expectedFiles:Number.isFinite(state.expectedFiles)?state.expectedFiles:null,
    presentFiles:Number.isFinite(state.presentFiles)?state.presentFiles:null,
    expectedBytes:Number.isFinite(state.expectedBytes)?state.expectedBytes:null,
    presentBytes:Number.isFinite(state.presentBytes)?state.presentBytes:null,
    missingFiles:Array.isArray(state.missingFiles)?[...state.missingFiles]:[],
    storageProtection:storagePersistenceState
  };
}

function isComparableCompleteSnapshot(snapshot,label) {
  return snapshot?.label===label &&
    snapshot?.status==='complete' &&
    Number.isFinite(snapshot.presentFiles) &&
    snapshot.presentFiles===snapshot.expectedFiles;
}

function detectModelCacheLoss(previous,current,{inventoryOnly=false}={}) {
  if(!previous || !current) return null;
  if(!isComparableCompleteSnapshot(previous,current.label||previous.label)) return null;
  const definitelyMissing=inventoryOnly
    ? Number(current.entryCount)===0
    : current.status==='missing' || current.status==='partial';
  if(!definitelyMissing) return null;
  return {
    detectedAt:new Date().toISOString(),
    previous,
    current,
    inventoryOnly:Boolean(inventoryOnly),
    storageProtectionAtDetection:storagePersistenceState
  };
}

function recordModelCacheObservation({inventoryOnly=false}={}) {
  const current=snapshotFromModelCacheState();
  if(inventoryOnly && !current.label) current.label=previousModelCacheSnapshot?.label||null;
  const loss=detectModelCacheLoss(previousModelCacheSnapshot,current,{inventoryOnly});
  if(loss) {
    lastModelCacheLoss=loss;
    writeStoredJson(STORAGE.modelCacheLoss,loss);
  }
  if(!inventoryOnly && current.label && ['complete','partial','missing'].includes(current.status)) {
    previousModelCacheSnapshot=current;
    writeStoredJson(STORAGE.modelCacheSnapshot,current);
  }
  renderModelCacheHistoryStatus();
  return loss;
}

function renderModelCacheHistoryStatus() {
  if(!ui.modelCacheHistoryStatus) return;
  if(lastModelCacheLoss?.previous && lastModelCacheLoss?.current) {
    const prev=lastModelCacheLoss.previous;
    const cur=lastModelCacheLoss.current;
    const prevFiles=Number.isFinite(prev.presentFiles)&&Number.isFinite(prev.expectedFiles)
      ? `${prev.presentFiles}/${prev.expectedFiles}`
      : '確認済み';
    const currentFiles=Number.isFinite(cur.presentFiles)&&Number.isFinite(cur.expectedFiles)
      ? `${cur.presentFiles}/${cur.expectedFiles}`
      : Number(cur.entryCount)===0 ? 'キャッシュ0件' : cur.status;
    const protection=lastModelCacheLoss.storageProtectionAtDetection==='persistent' ? '保護ON' : '保護状態 '+String(lastModelCacheLoss.storageProtectionAtDetection||'不明');
    ui.modelCacheHistoryStatus.textContent=
      `キャッシュ消失を検出: 前回 ${prevFiles}（${formatModelCheckTime(prev.checkedAt)}）→ 今回 ${currentFiles}（${formatModelCheckTime(lastModelCacheLoss.detectedAt)} / ${protection}）`;
    return;
  }
  if(previousModelCacheSnapshot) {
    const prev=previousModelCacheSnapshot;
    const files=Number.isFinite(prev.presentFiles)&&Number.isFinite(prev.expectedFiles)
      ? `${prev.presentFiles}/${prev.expectedFiles}ファイル`
      : prev.status;
    const size=Number.isFinite(prev.expectedBytes)?`・${formatModelMb(prev.expectedBytes)}`:'';
    ui.modelCacheHistoryStatus.textContent=
      `前回確認: Moonshine ${prev.label||''} ${files}${size}（${formatModelCheckTime(prev.checkedAt)}）`;
    return;
  }
  ui.modelCacheHistoryStatus.textContent='前回確認: まだ記録がありません。';
}

function renderModelCacheStatus() {
  if(!ui.modelCacheStatus) return;
  const selected=localStorage.getItem(STORAGE.asrModel)==='tiny' ? 'Tiny' : 'Small';
  const state=modelCacheState;
  if(state.status==='complete' && state.label===selected) {
    ui.modelCacheStatus.textContent=`Moonshine ${selected}: 保存済み ${formatModelMb(state.expectedBytes)}（${state.presentFiles}/${state.expectedFiles}ファイル）`;
  } else if(state.status==='partial' && state.label===selected) {
    ui.modelCacheStatus.textContent=`Moonshine ${selected}: 一部不足（${state.presentFiles}/${state.expectedFiles}ファイル）。不足分は次回取得します。`;
  } else if(state.status==='missing' && state.label===selected) {
    ui.modelCacheStatus.textContent=`Moonshine ${selected}: 未保存。次回利用時に取得します。`;
  } else if(state.status==='unsupported') {
    ui.modelCacheStatus.textContent=`Moonshine ${selected}: キャッシュ状態を確認できません。`;
  } else if(state.entryCount>0) {
    ui.modelCacheStatus.textContent=`Moonshine ${selected}: キャッシュに${state.entryCount}件あります。完全性は会話開始時に確認します。`;
  } else if(state.status==='inventory') {
    ui.modelCacheStatus.textContent=`Moonshine ${selected}: キャッシュは空です。`;
  } else {
    ui.modelCacheStatus.textContent=`Moonshine ${selected}: 保存状態を確認中。`;
  }
}

async function refreshMoonshineCacheInventory() {
  try {
    const inventory=await inspectMoonshineCacheInventory();
    modelCacheState={
      ...modelCacheState,
      status:inventory.supported ? 'inventory' : 'unsupported',
      entryCount:Number(inventory.entryCount)||0
    };
  } catch(error) {
    console.warn('Moonshineキャッシュ一覧を確認できませんでした',error);
    modelCacheState={...modelCacheState,status:'unsupported'};
  }
  renderModelCacheStatus();
  recordModelCacheObservation({inventoryOnly:true});
  if(moonshineStage==='idle' || moonshineStage==='ready') updateAsrModelStatus();
}

async function refreshSelectedMoonshineCache(manifestJson,label,{repairAliases=true}={}) {
  try {
    const result=await inspectMoonshineManifestCache(manifestJson,{repairAliases});
    modelCacheState={
      status:result.status,
      label,
      entryCount:Number(result.entryCount)||0,
      expectedFiles:result.expectedFiles,
      presentFiles:result.presentFiles,
      expectedBytes:result.expectedBytes,
      presentBytes:result.presentBytes,
      aliasHits:result.aliasHits||0,
      missingFiles:Array.isArray(result.missingFiles)?result.missingFiles:[]
    };
  } catch(error) {
    console.warn('Moonshineモデルの保存状態を確認できませんでした',error);
    modelCacheState={...modelCacheState,status:'unsupported',label};
  }
  renderModelCacheStatus();
  recordModelCacheObservation({inventoryOnly:false});
  if(moonshineStage==='idle' || moonshineStage==='ready') updateAsrModelStatus();
  return modelCacheState;
}

async function ensurePersistentModelStorage({request=false}={}) {
  const storage=navigator.storage;
  if(!storage || typeof storage.persisted!=='function') {
    storagePersistenceState='unsupported';
    renderStoragePersistenceStatus();
    return false;
  }
  try {
    let persisted=await storage.persisted();
    if(!persisted && request && typeof storage.persist==='function') {
      persisted=await storage.persist();
    }
    storagePersistenceState=persisted ? 'persistent' : 'best-effort';
  } catch(error) {
    console.warn('モデル保存の永続化状態を確認できませんでした',error);
    storagePersistenceState='unknown';
  }
  renderStoragePersistenceStatus();
  return storagePersistenceState==='persistent';
}

async function clearObsoleteModelCaches() {
  if(typeof caches==='undefined') return;
  const obsoletePatterns=[
    'onnx-community/whisper-tiny',
    'onnx-community/Supertonic-TTS-ONNX',
    '/voices/F3.bin',
    'KittenML__kitten-tts-nano-0.8__',
    'KittenML__kitten-tts-nano-0.8-int8__'
  ];

  try {
    const cacheNames=await caches.keys();
    await Promise.all(cacheNames.map(async cacheName=>{
      const cache=await caches.open(cacheName);
      const requests=await cache.keys();
      await Promise.all(requests.map(request=>{
        const url=request.url;
        return obsoletePatterns.some(pattern=>url.includes(pattern))
          ? cache.delete(request)
          : Promise.resolve(false);
      }));
    }));
  } catch(error) {
    console.warn('旧モデルキャッシュの整理をスキップしました',error);
  }
}

async function prepareFirstRun() {
  if(languageUI.needsChoice)return;
  languageUI.confirm();
  const epoch=conversationEpoch;
  ui.prepareEmmaButton.disabled=true;
  showOnboardingProgress(true,0,'マイクの使用許可を確認しています…');
  try {
    // Ask for microphone permission immediately while the user's tap is still
    // active. Model preparation can take a long time, after which mobile
    // browsers may no longer show the permission prompt automatically.
    await requestMicrophonePermission();
    const highPerformance = true;
    const firstRunAsr = highPerformance ? 'small' : 'tiny';
    localStorage.setItem(STORAGE.highPerformance,String(highPerformance));
    localStorage.setItem(STORAGE.asrModel,firstRunAsr);
    localStorage.setItem(STORAGE.startTiny,String(!highPerformance));
    if(ui.asrModel) ui.asrModel.value=firstRunAsr;
    await semanticPanel.setEnabled(highPerformance,{prepare:false,mode:'semantic'});
    updateAsrModelStatus();
    if(!(await ensureMoonshineIsolation({isCurrent:()=>epoch===conversationEpoch})) || epoch!==conversationEpoch) return;
    await ensurePersistentModelStorage({request:true});
    await clearObsoleteModelCaches();
    await initWorkers();
    await ensurePersistentModelStorage({request:true});
    if(epoch!==conversationEpoch)return;
    await prepareSemanticForConversation();
    if(epoch!==conversationEpoch)return;
    // Playback AudioContext is resumed after microphone capture starts.
    localStorage.setItem(STORAGE.setupRevision,CURRENT_SETUP_REVISION);
    showOnboardingProgress(false);
    showProgress(false);
    setBusy(false);
    showScreen('home',{autoStart:false});
    setState('idle','準備できました','使い方を3ステップで確認しましょう。');
    startTutorial();
  } catch(error) {
    if(epoch!==conversationEpoch)return;
    console.error(error);
    showOnboardingProgress(true,0,friendlyError(error));
    ui.prepareEmmaButton.disabled=false;
  }
}

async function startEmma({ auto = false } = {}) {
  if(languageUI.needsChoice){showScreen('onboarding');return;}
  if(auto && !localStorage.getItem(LANGUAGE_KEY))return;
  languageUI.confirm();
  if(running || preparingConversation || processing || speaking || featureScreens?.isOpen() || ui.mainButton.disabled) return;
  const epoch=++conversationEpoch;
  sessionId=crypto.randomUUID();
  ui.mainButton.disabled=true;
  preparingConversation=true;
  try {
    if(!(await ensureMoonshineIsolation({isCurrent:()=>epoch===conversationEpoch,manualStartAfterReload:true}))) return;

    // Always try the real microphone first. Do not gate startup on the
    // Permissions API: Android/Brave/Chrome may report "prompt" even when the
    // actual capture path can proceed, and one-time permission must be allowed
    // to show its browser prompt on every new launch.
    running=true;
    ui.mainButton.classList.add("hidden");
    ui.stopButton.classList.remove("hidden");
    engine.resetConversationContext();
    setBusy(true);
    setState('thinking','マイクを起動しています','必要なら表示される許可画面でマイクを許可してください。');
    showProgress(true,0,'マイクを開始しています…');
    await startMoonshineCapture();
    sessionStorage.setItem('emma_mic_session_granted','1');
    if(epoch!==conversationEpoch){await mic?.stop();mic=null;return;}

    // Only after real capture is active do we prepare the local ASR/TTS models.
    // This prevents model startup from blocking the microphone permission UI.
    setState('thinking','みつことばを準備しています','マイクは起動済みです。Moonshineと音声モデルを準備しています。');
    showProgress(true,0,'Moonshineを準備しています…');
    await ensurePersistentModelStorage({request:true});
    await withTimeout(
      initWorkers(),
      330000,
      'みつことばの準備が完了しませんでした。ページを再読み込みして、もう一度お試しください。'
    );
    await ensurePersistentModelStorage({request:true});
    if(epoch!==conversationEpoch)return;
    await prepareSemanticForConversation();

    // The microphone has been open while the models initialize. Discard any
    // partial VAD state gathered during startup. Playback is unlocked only by a
    // real user gesture so mobile browser autoplay policy cannot leave Emma mute.
    if(epoch!==conversationEpoch)return;
    mic?.resetDetector?.();
    await mic?.ensureActive?.();
    if(epoch!==conversationEpoch)return;
    ensureAudioContextCreated();
    updateAudioUnlockUi();

    ui.mainButton.classList.add('hidden');
    ui.manualReplyButton.classList.remove('hidden');
    ui.stopButton.classList.remove('hidden');
    preparingConversation=false;
    setBusy(false);
    showProgress(false);
    if(ui.keepAwake.checked) await requestWakeLock();
    setState('listening',`${getAiName()}が聞いています`,
      languageUI.language==='ja'?'いつもどおり日本語で赤ちゃんへ話しかけてください。必要なら「今すぐAIが返事する」で区切れます。':
        '選択した言語で赤ちゃんに話しかけてください。');
  } catch(error) {
    if(epoch!==conversationEpoch)return;
    console.error(error);
    running=false;
    preparingConversation=false;
    ui.stopButton.classList.add("hidden");
    ui.manualReplyButton.classList.add("hidden");
    ui.mainButton.classList.remove("hidden");
    await mic?.stop().catch(()=>{});
    mic=null;
    setBusy(false);
    showProgress(false);
    if(auto) {
      setState('idle','自動開始できませんでした',friendlyError(error));
    } else {
      setState('error','開始できませんでした',friendlyError(error));
    }
    ui.mainButton.disabled=false;
  }
}

async function prepareSemanticForConversation() {
  if(!semanticPanel.requested)return;
  const unsubscribe=semanticPanel.subscribe(({status})=>{
    const progress=status.total ? Math.min(100,status.loaded/status.total*100) : 0;
    const size=status.total ? ` ${(status.loaded/1e6).toFixed(1)} / ${(status.total/1e6).toFixed(1)} MB` : '';
    const message=languageUI.translate(status.message||'')+size;
    showProgress(true,progress,message);
    showOnboardingProgress(true,progress,message);
  });
  try {
    const ready=await semanticPanel.prepare({retry:true});
    if(languageUI.language!=='ja'&&!ready) {
      const detail=semanticPanel.snapshot.status?.message;
      throw Error(detail||languageUI.translate('モデルを準備できませんでした。再試行してください。'));
    }
  }
  finally {unsubscribe();}
}

async function stopEmma() {
  conversationEpoch++;
  semanticPanel?.cancelPending();
  while(audioUnlockWaiters.length)audioUnlockWaiters.shift()?.();
  running=false;
  preparingConversation=false;
  processing=false;
  speaking=false;
  pendingUtterance=null;
  restoreUnspokenTurn();
  turnRevisions.reset();
  for(const q of audioQueues.values()) {q.generationResolve?.();q.resolve?.();}
  audioQueues.clear();
  if(activeAudioSource){
    try{activeAudioSource.stop();}catch{}
    activeAudioSource=null;
  }
  await mic?.stop().catch(()=>{});
  mic=null;
  wakeLock?.release?.().catch(()=>{});
  wakeLock=null;
  ui.manualReplyButton.classList.add('hidden');
  ui.stopButton.classList.add('hidden');
  ui.mainButton.classList.remove('hidden');
  ui.mainButton.disabled=false;
  setBusy(false);
  setState('idle','Emmaはおやすみ中','下の大きな「呼びかけを始める」を押すと再開できます。');
}

function handleCapturedUtterance(audio) {
  if(!running||preparingConversation||speaking)return;
  if(tutorialStep===2){
    tutorialUserSpoke=true;
    // Tutorial must honor the same auto-reply preference as ordinary speech.
    // Otherwise the screen promises automatic replies but waits for a tap.
    if(!ui.autoRespond.checked){
      pendingUtterance={kind:'audio',audio};
      ui.manualReplyButton.classList.remove('hidden');
      setState('understood','話し終わりを検出しました','「今すぐAIが返事する」を押すと返事します。');
      scheduleTutorialSpotlightSync();
      return;
    }
  }
  if(ui.autoRespond.checked){
    // An earlier speculative reply has already been invalidated at speech-start.
    // Re-transcribe the complete PCM, never concatenate separately decoded texts.
    const {version,audio:complete}=turnRevisions.append(audio);
    transcribeUtterance(complete,{revision:version});
  } else {
    if(processing)return;
    pendingUtterance={kind:'audio',audio};
    ui.manualReplyButton.classList.remove('hidden');
    setState('understood','話し終わりを検出しました','「今すぐAIが返事する」を押すと返事します。');
  }
}

function handleSpeechStartDuringPreparation(){
  if(!running||preparingConversation||speaking||tutorialStep===2||!ui.autoRespond.checked)return;
  if(!turnRevisions.speechStart())return;
  // The old ASR/Semantic/TTS can finish naturally. Revision checks discard it.
  restoreUnspokenTurn();
  processing=false;
  setBusy(false);
  ui.emmaBubble.classList.add('hidden');
  setState('endpoint','続きも聞いています…','返答の準備を中断し、続きのことばを聞いています。');
}

function respondToPendingUtterance({manual=false}={}) {
  if(!pendingUtterance||processing||speaking)return false;
  const pending=pendingUtterance;
  pendingUtterance=null;
  if(pending.kind==='audio') {
    transcribeUtterance(pending.audio,{manual});
    return true;
  }
  return false;
}

async function respondGenericallyToManualRequest() {
  if(!running||speaking)return;
  processing=true;
  setBusy(true);
  pendingUtterance=null;
  setState('thinking','返事を考えています…',`${getAiName()}が今すぐ話します。`);

  try {
    const response=semanticPanel.respondGeneric('');
    const english=stripAiSpeakerLabel(response.english);
    showConversation('',english);
    processing=false;
    setBusy(false);
    await speakResponse(english,{entry:createHistoryEntry(sessionId,'',english,'generic')});
  } catch(error) {
    processing=false;
    setBusy(false);
    console.error(error);
    setState('error','返事を作れませんでした',friendlyError(error));
  }
}

async function forceReplyNow() {
  if(!running||processing||speaking)return;
  if(respondToPendingUtterance({manual:true})) return;

  const audio=mic?.forceUtterance?.();
  if(!audio){
    await respondGenericallyToManualRequest();
    return;
  }
  pendingUtterance=null;
  setState('understood','ここまで聞きました',`${getAiName()}が返事を考えます。`);
  transcribeUtterance(audio,{manual:true});
}

async function startMoonshineCapture() {
  if(mic) return;
  const epoch=conversationEpoch;
  const capture=new EmmaMicrophone({
    endpointMode:localStorage.getItem(STORAGE.endpointMode)==='legacy'?'legacy':'silero',
    onWarning:message=>{if(epoch===conversationEpoch)showNotice('従来方式で会話します',message);},
    onError:async error=>{if(epoch===conversationEpoch){await stopEmma();setState('error','音声の判定が中断しました',error.message);}},
    onState:(state)=>{
      if(epoch!==conversationEpoch || !running || preparingConversation || !workersReady || speaking || (processing && !ui.autoRespond.checked))return;
      if(state==='endpoint') {handleSpeechStartDuringPreparation();if(!turnRevisions.continuing)setState('endpoint','聞いています…','話し終わるまで、そのまま話してください。');}
      else setState('listening',`${getAiName()}が聞いています`,
        languageUI.language==='ja'?'いつもどおり日本語で赤ちゃんへ話しかけてください。':
          '選択した言語で赤ちゃんに話しかけてください。');
    },
    onUtterance:(audio)=>{ if(epoch===conversationEpoch && !preparingConversation)handleCapturedUtterance(audio); },
    shouldIgnore:()=>epoch!==conversationEpoch||preparingConversation||!workersReady||speaking||(processing&&!ui.autoRespond.checked)
  });
  mic=capture;
  await capture.start();
  if(epoch!==conversationEpoch || !running){await capture.stop();if(mic===capture)mic=null;}
}

async function initWorkers() {
  const selectionEpoch=modelSelectionEpoch;
  if(!asrInfoCache){
    const asrPreparing=languageUI.language==='ja'?'Moonshineを準備しています…':'Whisperを準備しています…';
    showProgress(true,0,asrPreparing);
    showOnboardingProgress(true,0,asrPreparing);
    if(languageUI.language==='ja'){
      const info=await initMoonshine({selectionEpoch});
      if(selectionEpoch!==modelSelectionEpoch)throw Error('Language operation cancelled');
      asrInfoCache=info;
    }
    else {
      await multilingual.prepare();
      if(selectionEpoch!==modelSelectionEpoch)throw Error('Language operation cancelled');
      moonshineTranscriber={transcribe:async audio=>(await multilingual.transcribe(audio,languageUI.language)).text,close:()=>multilingual.cancel()};
      asrInfoCache={kind:'whisper',engine:'whisper-small',architecture:'whisper-small-multilingual',device:'wasm-cpu'};
      languageUI.setStatus('モデルの準備ができました');
    }
  }

  await initVoice();
  if(selectionEpoch!==modelSelectionEpoch)throw Error('Language operation cancelled');

  workersReady=true;
  updateRuntimeBackend();
}

let voiceInitialization;
async function initVoice() {
  if(voiceInitialization)return voiceInitialization;
  voiceInitialization=(async()=>{
    const signature=getTtsSignature();
  if(!(ttsWorker && ttsInfoCache && ttsWorkerSignature===signature)){
    ttsWorker?.terminate();
    preparedAudio.clear();
    ttsInfoCache=null;
    ttsWorkerSignature=signature;
    ttsInfoCache=await new Promise((resolve,reject)=>{
      ttsWorker=new Worker(new URL('./tts-worker.js?v=20261020-progressive-voice-v1',import.meta.url),{type:'module'});
      ttsWorker.onmessage=(event)=>handleTtsMessage(event,resolve,reject);
      ttsWorker.onerror=reject;
      ttsWorker.postMessage({ type:'init' });
    });
  }

  })();
  try {
    await voiceInitialization;
    if (currentScreen === 'home' && tutorialStep === null &&
        localStorage.getItem(STORAGE.tutorialDone) === 'true') requestVoicePrefetch();
  } finally { voiceInitialization=null;showProgress(false); }
}

async function initMoonshine({selectionEpoch=modelSelectionEpoch}={}) {
  if(moonshineTranscriber && asrInfoCache?.kind==='moonshine')return asrInfoCache;
  const selectedAsr=localStorage.getItem(STORAGE.asrModel)==='tiny'?'tiny':'small';
  const modelLabel=selectedAsr==='tiny'?'Tiny':'Small';
  const started=diagnosticNow();
  const diagnostics={
    cacheReadMs:0,cacheReadBytes:0,cacheFiles:0,cacheMisses:0,
    networkDownloadMs:0,networkDownloadBytes:0,networkFiles:0,
    cacheWriteMs:0,wasmInitMs:null,modelBuildMs:null,totalInitMs:null,lastSource:'unknown'
  };
  lastMoonshineDiagnostics=diagnostics;
  let manifest=null;
  moonshineStage='runtime';
  showMoonshineProgress(0,'Moonshineの実行エンジンを準備しています…');
  const client=new MoonshineAsrClient({onEvent:event=>{
    if(event.type==='stage'){
      moonshineStage=event.stage;
      showMoonshineProgress(1,event.message);
    } else if(event.type==='manifest'){
      manifest=event.manifest;
      // Take the pre-download cache snapshot before releasing Worker initialization.
      refreshSelectedMoonshineCache(manifest,modelLabel,{repairAliases:true})
        .then(()=>{
          diagnostics.cacheManifestBefore={
            status:modelCacheState.status,presentFiles:modelCacheState.presentFiles,
            expectedFiles:modelCacheState.expectedFiles,aliasHits:modelCacheState.aliasHits,
            missingFiles:[...modelCacheState.missingFiles]
          };
        })
        .catch(error=>console.warn('Moonshine cache inventory:',error))
        .finally(()=>client.resumeInit());
    } else if(event.type==='progress'){
      moonshineStage='download';
      const loaded=Number(event.loaded)||0,total=Number(event.total)||0;
      const progress=total?Math.max(1,Math.min(96,Math.round(loaded/total*96))):1;
      const detail=event.detail||{};
      const source=detail.source==='cache'?'cache':detail.source==='network'?'network':'unknown';
      diagnostics.lastSource=source;
      const fileName=String(event.file||'').split('/').pop();
      const action=source==='cache'?'端末から読み込んでいます':source==='network'?'ダウンロードしています':'準備しています';
      const sizeText=total?` ${(loaded/1e6).toFixed(1)} / ${(total/1e6).toFixed(1)} MB`:` ${(loaded/1e6).toFixed(1)} MB`;
      const message=`Moonshine 日本語${modelLabel} Streamingを${action}…${sizeText}${fileName?'（'+fileName+'）':''}`;
      showMoonshineProgress(progress,message);
      if(ui.asrModelStatus)ui.asrModelStatus.textContent=message;
    } else if(event.type==='asset-event'){
      const item=event.event||{};
      if(item.kind==='cache-read'){
        diagnostics.cacheReadMs+=Number(item.durationMs)||0;
        diagnostics.cacheReadBytes+=Number(item.bytes)||0;
        diagnostics.cacheFiles++;
        diagnostics.lastSource='cache';
      } else if(item.kind==='cache-miss')diagnostics.cacheMisses++;
      else if(item.kind==='network-download'){
        diagnostics.networkDownloadMs+=Number(item.durationMs)||0;
        diagnostics.networkDownloadBytes+=Number(item.bytes)||0;
        diagnostics.networkFiles++;
        diagnostics.cacheWriteMs+=Number(item.cacheWriteMs)||0;
        diagnostics.lastSource='network';
      }
    } else if(event.type==='diagnostic'){
      if(event.kind==='wasmInitMs')diagnostics.wasmInitMs=Number(event.durationMs)||0;
      if(event.kind==='model-build')diagnostics.modelBuildMs=Number(event.durationMs)||0;
    } else if(event.type==='warning')console.warn(event.message);
    updateWebTimingDiagnostics();
  }});
  try{
    const result=await client.init({model:selectedAsr});
    if(selectionEpoch!==modelSelectionEpoch){client.close();throw Error('Language operation cancelled');}
    if(manifest){
      await refreshSelectedMoonshineCache(manifest,modelLabel,{repairAliases:true});
      diagnostics.cacheManifestAfter={
        status:modelCacheState.status,presentFiles:modelCacheState.presentFiles,
        expectedFiles:modelCacheState.expectedFiles,aliasHits:modelCacheState.aliasHits,
        missingFiles:[...modelCacheState.missingFiles]
      };
    }
    diagnostics.totalInitMs=diagnosticNow()-started;
    updateWebTimingDiagnostics();
    moonshineStage='ready';
    moonshineTranscriber?.close?.();
    moonshineTranscriber=client;
    showMoonshineProgress(100,`Moonshine 日本語${modelLabel}を準備できました`);
    if(ui.asrModelStatus)ui.asrModelStatus.textContent=
      `現在：${modelLabel}。準備完了。${diagnostics.networkFiles?'必要なモデルを取得しました。':'保存済みモデルを読み込みました。'}`;
    return {kind:'moonshine',engine:'moonshine',model:result.model,architecture:result.architecture,license:'MIT',device:'wasm-cpu',worker:'dedicated'};
  }catch(error){
    client.close();
    moonshineStage='error';
    throw error;
  }
}

function forwardBackgroundDownload(message) {
  if(!message?.url || !message?.cacheName || !message?.cacheKey) return;
  navigator.serviceWorker?.ready
    ?.then(reg => (navigator.serviceWorker.controller || reg.active)?.postMessage({
      type:'track-model-download',
      title:languageUI.translate('モデルをバックグラウンドで準備中'),
      url:message.url,
      cacheName:message.cacheName,
      cacheKey:message.cacheKey,
    }))
    .catch(()=>{});
}

function requestBackgroundModelContinuation() {
  navigator.serviceWorker?.ready
    ?.then(reg => (navigator.serviceWorker.controller || reg.active)?.postMessage({
      type:'start-background-downloads',
    }))
    .catch(()=>{});
}

function showMoonshineProgress(progress,message) {
  showProgress(true,progress,message);
  showOnboardingProgress(true,progress,message);
}

async function ensureWorkersForDebug() {
  setBusy(true);
  showProgress(true,0,'みつことばの声を準備しています…');
  // Typed speech already has a transcript; it needs TTS, not the ASR runtime.
  await initVoice();
  setBusy(false);
  showProgress(false);
}

function handleTtsMessage(event,readyResolve,readyReject) {
  const m=event.data;
  if(m.type==='background-download-url') {
    forwardBackgroundDownload(m);
    return;
  }
  if (m.type === 'prefetch-status') {
    // Background activity must not replace the foreground speech UI.
    return;
  }
  if(m.type==='status') {
    showProgress(true,m.progress??0,m.message||'みつことばの声を準備しています…');
    showOnboardingProgress(true,m.progress??0,m.message||'みつことばの声を準備しています…');
  } else if(m.type==='ready') readyResolve?.(m);
  else if(m.type==='error') {
    const error=new Error(m.message || '音声の準備または再生に失敗しました。');
    readyReject?.(error);
    if(m.requestId){
      const q=audioQueues.get(m.requestId);
      if(q){q.generationReject?.(error);q.reject?.(error);}
    }
    const affected=m.requestId?audioQueues.get(m.requestId):null;
    if(workersReady && (!m.requestId || (affected && (affected.revision===null || turnRevisions.isCurrent(affected.revision))))) onRuntimeError(error.message);
  } else if(m.type==='audio') enqueueAudio(m);
  else if(m.type==='complete') {
    const q=audioQueues.get(m.requestId);
    if(q){
      if(Number.isInteger(m.total)) q.total=Math.max(q.total,m.total);
      if(q.cacheKey && q.generated?.length){
        const cached=q.generated.slice(0,q.total||q.generated.length).filter(Boolean);
        if(cached.length){
          preparedAudio.delete(q.cacheKey);
          preparedAudio.set(q.cacheKey,cached);
          if(preparedAudio.size>24)preparedAudio.delete(preparedAudio.keys().next().value);
        }
      }
      q.generationDone=true;
      q.generationResolve?.();
      lastTtsGenerationCompleteMillis=Math.round(diagnosticNow()-q.ttsRequestStartedAt);
      updateWebTimingDiagnostics();
      pumpAudio(m.requestId);
    }
  }
}

async function transcribeUtterance(audio,{manual=false,revision=null}={}) {
  const epoch=conversationEpoch;
  if(!isLiveTurn(revision,epoch)||preparingConversation||speaking||!moonshineTranscriber)return;
  processing=true;
  setBusy(true);
  const japanese=languageUI.language==='ja';
  const asrStart=diagnosticNow();
  if(!japanese)multilingualAsrDiagnostic={stage:'transcribing',detectedLanguage:null,elapsedMs:null,error:null};
  setState('thinking','聞き取っています…',
    japanese?'Moonshineで音声を端末内処理しています。':'Whisperで音声を認識しています。');
  try{
    // A separate worker keeps the UI responsive; avoid an endless "Transcribing"
    // state on memory-constrained private browsing sessions.
    const text=await withTimeout(
      moonshineTranscriber.transcribe(audio),
      japanese?120000:90000,
      japanese?'音声認識が時間内に完了しませんでした。もう一度お試しください。':
        '音声認識が時間内に完了しませんでした。通常のブラウザタブか短い発話で再試行してください。'
    );
    if(!japanese){
      multilingualAsrDiagnostic.stage='complete';
      multilingualAsrDiagnostic.elapsedMs=Math.round(diagnosticNow()-asrStart);
    }
    if(!isLiveTurn(revision,epoch))return;
    await processTranscript(text,{manual,revision});
  }catch(error){
    if(!isLiveTurn(revision,epoch))return;
    processing=false;
    setBusy(false);
    if(revision!==null){restoreUnspokenTurn();turnRevisions.reset();}
    console.error(error);
    if(!japanese){
      multilingualAsrDiagnostic.stage='error';
      multilingualAsrDiagnostic.elapsedMs=Math.round(diagnosticNow()-asrStart);
      multilingualAsrDiagnostic.error=String(error?.message||error);
    }
    if(languageUI.language!=='ja'&&/時間内に完了しませんでした/.test(String(error?.message))){
      // Terminate stalled Whisper inference so a later attempt can initialize
      // a fresh worker instead of sitting behind the failed queued request.
      multilingual.cancel('ASR timeout; worker restarted for the next attempt');
    }
    setState('error','音声認識でエラーが発生しました',friendlyError(error));
  }
}

async function processTranscript(text,{manual=false,revision=null}={}) {
  const epoch=conversationEpoch;
  if(!isLiveTurn(revision,epoch)||speaking)return;
  processing=true;
  setBusy(true);
  const clean=String(text||'').replace(/\s+/g,' ').trim();
  if(!(languageUI.language==='ja'?isMeaningfulUtterance(clean):meaningfulSpeech(clean))){
    processing=false;setBusy(false);
    if(revision!==null){restoreUnspokenTurn();turnRevisions.reset();}
    if(manual)await respondGenericallyToManualRequest();
    else setState('listening',`${getAiName()}が聞いています`,'意味のあることばを待っています。');
    return;
  }
  showConversation(clean,'');
  setState('understood','わかりました',`${getAiName()}が赤ちゃんへ話しかけます。`);
  if(revision!==null)speculativeEngineSnapshot=engine.snapshotTurnState();
  const response=await semanticPanel.respond(clean,'',{isCurrent:()=>isLiveTurn(revision,epoch)});
  if(!isLiveTurn(revision,epoch))return;
  if(!response){processing=false;setBusy(false);restoreUnspokenTurn();return;}
  const english=stripAiSpeakerLabel(response.english);
  showConversation(clean,english,response.scene);
  // A speculative TTS is still an active turn: keep manual reply disabled,
  // while allowing the microphone/VAD to detect a continuation.
  processing=revision!==null;
  setBusy(revision!==null);
  await speakResponse(english,{entry:createHistoryEntry(sessionId,clean,english,response.scene),revision});
  // Do not complete the tutorial here: the speculative playback commit resets
  // turnRevisions, so isLiveTurn(revision) is no longer true after playback.
}

async function releaseMicrophoneForEmmaVoice() {
  if(!mic) return false;
  const activeMic=mic;
  mic=null;
  try {
    await activeMic.stop();
  } catch(error) {
    console.warn('Microphone release before TTS failed.',error);
  }

  // Chrome on Android can keep the communication audio route briefly after
  // getUserMedia is released. Give the platform one short turn to restore the
  // normal media route before starting Emma's playback.
  await new Promise(resolve=>setTimeout(resolve,180));
  return true;
}

async function restoreMicrophoneAfterEmmaVoice() {
  if(!running || mic) return;
  try {
    await startMoonshineCapture();
    mic?.resetDetector?.();
    await mic?.ensureActive?.();
  } catch(error) {
    console.error('Microphone restart after TTS failed.',error);
    setState('error','マイクの再開に失敗しました',friendlyError(error));
    throw error;
  }
}

async function speakResponse(text,{entry=null,revision=null}={}) {
  const epoch=conversationEpoch;
  if(!ttsWorker)throw Error('AIの声がまだ準備されていません');
  const speculative=revision!==null;
  const valid=()=>isLiveTurn(revision,epoch);
  // Ordinary/manual replies keep their existing direct playback behavior.
  const shouldRestoreMic=running && Boolean(mic);
  let micReleased=false;
  let startedPlayback=false;
  if(!speculative && shouldRestoreMic){
    setState('thinking','AIが話す準備をしています','マイクを一時停止してスピーカー音量へ切り替えています。');
    await releaseMicrophoneForEmmaVoice();
    micReleased=true;
  }
  if(!valid())return;
  if(!speculative){speaking=true;startedPlayback=true;}
  const requestId=++requestSeq;
  const cacheKey=audioCacheKey(text);
  const ttsRequestStartedAt=diagnosticNow();
  audioQueues.set(requestId,{
    items:new Map(),next:0,total:0,playing:false,generationDone:false,
    resolve:null,reject:null,generationResolve:null,generationReject:null,
    deferPlayback:speculative,revision,entry,started:false,text,cacheKey,generated:[],
    ttsRequestStartedAt,firstChunkRecorded:false,firstAudioRecorded:false
  });
  const queue=audioQueues.get(requestId);
  const done=new Promise((resolve,reject)=>{queue.resolve=resolve;queue.reject=reject;});
  const generationReady=new Promise((resolve,reject)=>{queue.generationResolve=resolve;queue.generationReject=reject;});
  // Avoid unhandled rejections for whichever completion promise is unused.
  if(!speculative)generationReady.catch(()=>{});
  if(speculative)done.catch(()=>{});
  setState(speculative?'thinking':'speaking',speculative?'英語の声を準備しています':'AIが話しています',
    speculative?'続きのことばがあれば、そのまま話してください。':'赤ちゃんへ英語で話しかけています。');
  try{
    const cached=preparedAudio.get(cacheKey);
    if(cached){
      cached.forEach((blob,index)=>queue.items.set(index,blob));
      queue.total=cached.length;queue.generationDone=true;
      queue.generationResolve?.();
      pumpAudio(requestId);
    }else ttsWorker.postMessage({type:'speak',requestId,text,nameHints:[]});
    if(speculative){
      await generationReady;
      if(!valid())return;
      // The microphone stays live throughout ASR, Semantic and TTS preparation.
      if(shouldRestoreMic){
        await releaseMicrophoneForEmmaVoice();
        micReleased=true;
      }
      if(!valid())return;
      // This candidate is now committed to playback. The next capture is a
      // new turn, not a continuation of words we have already answered.
      speculativeEngineSnapshot=null;
      turnRevisions.reset();
      processing=false;
      setBusy(false);
      speaking=true;
      startedPlayback=true;
      queue.deferPlayback=false;
      setState('speaking','AIが話しています','赤ちゃんへ英語で話しかけています。');
      pumpAudio(requestId);
    }
    await done;
    // Complete step 3 only after Emma's recorded audio actually finished.
    // A speculative turn's revision is intentionally reset when playback
    // commits, so the caller cannot reliably pass isLiveTurn(revision) here.
    // Epoch + decoded-playback checks prevent stop/cancel/empty audio from
    // incorrectly marking the tutorial complete.
    if(epoch===conversationEpoch && startedPlayback && queue.next>0 &&
       tutorialStep===2 && tutorialUserSpoke) finishTutorial();
    lastTtsTotalMillis=Math.round(diagnosticNow()-ttsRequestStartedAt);
    updateWebTimingDiagnostics();
  }catch(error){
    if(!valid())return;
    console.error('Emma TTS playback failed',error);
    setState('error','AIの声でエラーが発生しました',friendlyError(error));
    throw error;
  }finally{
    if(epoch===conversationEpoch && startedPlayback)speaking=false;
    audioQueues.delete(requestId);
    if(micReleased && running && epoch===conversationEpoch){
      try{await restoreMicrophoneAfterEmmaVoice();}
      catch(error){console.error('Microphone restore failed after Emma voice.',error);}
    }
  }
  if(!valid())return;
  if(running)setState('listening','AIが聞いています',
    languageUI.language==='ja'?'いつもどおり日本語で赤ちゃんへ話しかけてください。':
      '選択した言語で赤ちゃんに話しかけてください。');
  else setState('idle','Emmaはおやすみ中','大きな「呼びかけを始める」から会話を再開できます。');
  return startedPlayback && queue.next>0;
}

function enqueueAudio(m) {
  const q=audioQueues.get(m.requestId);
  if(!q)return;
  if(!q.firstChunkRecorded){
    q.firstChunkRecorded=true;
    lastTtsFirstChunkMillis=Math.round(diagnosticNow()-q.ttsRequestStartedAt);
    updateWebTimingDiagnostics();
  }
  q.items.set(m.index,m.blob);
  q.generated[m.index]=m.blob;
  q.total=Math.max(q.total,m.index+1);
  pumpAudio(m.requestId);
}

async function pumpAudio(requestId) {
  const q=audioQueues.get(requestId);
  if(!q||q.playing||q.deferPlayback)return;
  const blob=q.items.get(q.next);
  if(!blob){
    if(q.generationDone&&q.next>=q.total){
      q.resolve?.();
      audioQueues.delete(requestId);
    }
    return;
  }
  q.playing=true;
  q.items.delete(q.next);
  try {
    await playBlob(blob,requestId);
    q.next++;
    q.playing=false;
    pumpAudio(requestId);
  } catch(error) {
    console.error('Emma audio playback failed',error);
    q.playing=false;
    q.reject?.(new Error(`音声再生に失敗しました: ${error?.message || error}`));
  }
}

function ensureAudioContextCreated() {
  if(!audioContext||audioContext.state==='closed') {
    audioContext=new AudioContext({latencyHint:'interactive'});
    audioContext.addEventListener?.('statechange',()=>{
      if(audioContext?.state==='running') markAudioUnlocked();
      else updateAudioUnlockUi();
    });
  }
  if(audioContext.state==='running') markAudioUnlocked();
  return audioContext;
}

function markAudioUnlocked() {
  audioUnlocked=true;
  updateAudioUnlockUi();
  while(audioUnlockWaiters.length) audioUnlockWaiters.shift()?.();
}

function updateAudioUnlockUi() {
  if(!ui.enableAudioButton) return;
  ui.enableAudioButton.classList.toggle('hidden',audioUnlocked);
}

function unlockPlaybackAudioFromGesture() {
  const ctx=ensureAudioContextCreated();
  const finish=()=>{
    if(ctx.state==='running') markAudioUnlocked();
    else updateAudioUnlockUi();
  };
  try {
    const resumed=ctx.state==='suspended' ? ctx.resume() : Promise.resolve();
    Promise.resolve(resumed).then(finish).catch(error=>{
      console.warn('AudioContext resume failed.',error);
      updateAudioUnlockUi();
    });
  } catch(error) {
    console.warn('AudioContext unlock failed.',error);
    updateAudioUnlockUi();
  }
}

async function waitForPlaybackAudio() {
  const ctx=ensureAudioContextCreated();
  if(ctx.state==='running'){
    markAudioUnlocked();
    return;
  }

  audioUnlocked=false;
  updateAudioUnlockUi();
  setState('speaking','AIの声を再開してください','画面を一度タップすると音声を再開します。');
  await new Promise(resolve=>audioUnlockWaiters.push(resolve));
}

async function playBlob(blob,requestId) {
  await waitForPlaybackAudio();
  const buffer=await blob.arrayBuffer();
  const decoded=await audioContext.decodeAudioData(buffer.slice(0));
  if(!audioQueues.has(requestId))return;
  const source=audioContext.createBufferSource();
  activeAudioSource=source;
  // The adopted AAC bank already has matched volume and intentional pauses.
  const prerecorded=blob.type==='audio/mp4';
  const playbackBuffer=prerecorded ? decoded : trimAudioSilence(decoded);
  source.buffer=playbackBuffer;
  const gainNode=audioContext.createGain();
  gainNode.gain.value=prerecorded ? 1 : calculatePlaybackGain(playbackBuffer);
  const analyser=audioContext.createAnalyser();
  analyser.fftSize=256;
  source.connect(gainNode).connect(analyser).connect(audioContext.destination);
  const data=new Uint8Array(analyser.frequencyBinCount);
  let raf;
  const animate=()=>{
    analyser.getByteTimeDomainData(data);
    let sum=0;
    for(const x of data){const v=(x-128)/128;sum+=v*v;}
    const rms=Math.sqrt(sum/data.length);
    avatarMouthLevel=rms<0.025 ? 'small' : rms<0.075 ? 'medium' : 'large';
    renderAvatarFrame();
    raf=requestAnimationFrame(animate);
  };
  const ended=new Promise(resolve=>source.onended=resolve);
  source.start();
  const q=audioQueues.get(requestId);
  if(q && !q.firstAudioRecorded){
    q.firstAudioRecorded=true;
    lastTtsFirstAudioMillis=Math.round(diagnosticNow()-q.ttsRequestStartedAt);
    updateWebTimingDiagnostics();
  }
  if(q && !q.started){q.started=true;if(q.entry && historyEnabled(localStorage))history.append(q.entry).catch(error=>{ console.warn('履歴を保存できませんでした',error);$('historyWarning').textContent='履歴を保存できませんでした。端末の空き容量やブラウザ設定を確認してください。'; });}
  animate();
  await ended;
  if(activeAudioSource===source) activeAudioSource=null;
  cancelAnimationFrame(raf);
  avatarMouthLevel='small';
  renderAvatarFrame();
}

function avatarFrameName() {
  const blink=avatarBlinkFrame;
  if(avatarVisualState==='speaking'){
    if(blink==='half') return `emma-face-talk-${avatarMouthLevel}-half.svg`;
    if(blink==='closed') return `emma-face-talk-${avatarMouthLevel}-closed.svg`;
    return `emma-face-talk-${avatarMouthLevel}.svg`;
  }
  if(avatarVisualState==='understood') return 'emma-face-idle-closed.svg';
  if(blink==='half') return 'emma-face-idle-half.svg';
  if(blink==='closed') return 'emma-face-idle-closed.svg';
  return 'emma-face-idle-open.svg';
}
function renderAvatarFrame(){
  if(!ui.aiAvatarFace) return;
  const next=avatarFrameName();
  // Switch complete frames; palette variables now inherit into the inline SVGs.
  for(const frame of [...ui.aiAvatarFace.querySelectorAll('[data-avatar-frame]'), ...(document.querySelectorAll?.('.play-avatar [data-avatar-frame]') || [])]){
    frame.classList.toggle('hidden',frame.dataset.avatarFrame!==next);
  }
}
function startAvatarBlinkLoop(){
  clearTimeout(avatarBlinkTimer);
  const schedule=()=>{
    avatarBlinkTimer=setTimeout(async()=>{
      avatarBlinkFrame='half'; renderAvatarFrame();
      await new Promise(r=>setTimeout(r,55));
      avatarBlinkFrame='closed'; renderAvatarFrame();
      await new Promise(r=>setTimeout(r,75));
      avatarBlinkFrame='half'; renderAvatarFrame();
      await new Promise(r=>setTimeout(r,55));
      avatarBlinkFrame='open'; renderAvatarFrame();
      schedule();
    },2800+Math.random()*2200);
  };
  renderAvatarFrame();
  schedule();
}

function tutorialTarget(){
  if(tutorialStep===0) return ui.avatar;
  if(tutorialStep===1) return ui.mainButton;
  return ui.manualReplyButton || ui.tutorialStatusTarget || ui.statusTitle;
}
function positionTutorialSpotlight(){
  if(tutorialStep===null || !ui.tutorialSpotlight) return;
  const target=tutorialTarget();
  if(!target) return;
  const r=target.getBoundingClientRect();
  const pad=tutorialStep===0 ? 8 : tutorialStep===1 ? 8 : 4;
  const left=Math.max(4,r.left-pad);
  const top=Math.max(4,r.top-pad);
  const right=Math.min(innerWidth-4,r.right+pad);
  const bottom=Math.min(innerHeight-4,r.bottom+pad);
  const width=Math.max(24,right-left);
  const height=Math.max(24,bottom-top);
  Object.assign(ui.tutorialSpotlight.style,{
    left:`${left}px`,
    top:`${top}px`,
    width:`${width}px`,
    height:`${height}px`
  });

  const card=ui.tutorialCard;
  if(!card) return;
  const cardHeight=card.getBoundingClientRect().height||180;
  const above=top;
  const below=innerHeight-bottom;
  let cardTop;
  if(above>=cardHeight+22) cardTop=top-cardHeight-16;
  else if(below>=cardHeight+22) cardTop=bottom+16;
  else cardTop=12;
  card.style.top=`${Math.max(12,Math.min(innerHeight-cardHeight-12,cardTop))}px`;
}
function scheduleTutorialSpotlightSync(){
  requestAnimationFrame(()=>requestAnimationFrame(positionTutorialSpotlight));
  setTimeout(positionTutorialSpotlight,80);
  setTimeout(positionTutorialSpotlight,220);
}

function renderTutorial(){
  const active=tutorialStep!==null;
  ui.tutorialOverlay?.classList.toggle('hidden',!active);
  ui.tutorialOverlay?.setAttribute('aria-hidden',String(!active));
  if(!active) return;
  const name='Emma';
  ui.tutorialStepLabel.textContent=`${tutorialStep+1} / 3`;
  ui.tutorialHint.classList.add('hidden');
  ui.tutorialPrimaryButton.classList.add('hidden');
  if(tutorialStep===0){
    ui.tutorialTitle.textContent=`${name}と会おう`;
    ui.tutorialBody.textContent=`まず${name}の自己紹介を聞きます。再生が終わると自動で次のステップに進みます。`;
    ui.tutorialPrimaryButton.textContent='自己紹介を聞く';
    ui.tutorialPrimaryButton.classList.remove('hidden');
  }else if(tutorialStep===1){
    ui.tutorialTitle.textContent='ここから呼びかけを始めます';
    ui.tutorialBody.textContent='画面下で光っている「呼びかけを始める」を実際に押してください。押すとマイクが始まり、呼びかけを開始します。';
    ui.tutorialHint.textContent='↓ 光っている本物のボタンを押す';
    ui.tutorialHint.classList.remove('hidden');
  }else{
    ui.tutorialTitle.textContent='実際に話しかけてみよう';
    ui.tutorialBody.textContent='普段どおり日本語で赤ちゃんへ話しかけてください。話し終わったら、必要に応じて光っている「今すぐAIが返事する」を押すと、その時点までの言葉をもとにAIが返事します。「自動で返事」がオンなら、押さなくても話し終わりを検出して自動で返事します。';
    ui.tutorialHint.textContent='Emmaの英語の返答が終わると自動的に完了します。';
    ui.tutorialHint.classList.remove('hidden');
  }
  if(tutorialStep===0) {
    tutorialTarget()?.scrollIntoView({block:'center',behavior:'auto'});
  }
  scheduleTutorialSpotlightSync();
}
function requestVoicePrefetch() {
  if (ttsWorker && ttsInfoCache) ttsWorker.postMessage({type:'prefetch'});
}

function startTutorial({replay=false}={}){
  tutorialStep=0;
  tutorialIntroPlayed=false;
  tutorialUserSpoke=false;
  if(replay) setState('idle','チュートリアル','使い方を3ステップで確認します。');
  renderTutorial();
  // A manifest and worker can initialize in parallel with the visible tutorial.
  void initVoice().then(requestVoicePrefetch).catch(error =>
    console.warn('音声のバックグラウンド準備は後で再試行します', error));
}
function finishTutorial(){
  localStorage.setItem(STORAGE.tutorialDone,'true');
  tutorialStep=null;
  tutorialIntroPlayed=false;
  tutorialUserSpoke=false;
  renderTutorial();
}
function calculatePlaybackGain(buffer) {
  let peak=0;
  for(let channelIndex=0;channelIndex<buffer.numberOfChannels;channelIndex++){
    const channel=buffer.getChannelData(channelIndex);
    for(let i=0;i<channel.length;i++) peak=Math.max(peak,Math.abs(channel[i]));
  }
  if(!(peak>0)) return 1;
  return Math.max(1,Math.min(1.8,0.92/peak));
}

function trimAudioSilence(buffer) {
  const threshold=0.004;
  const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
  let start=0;
  let end=buffer.length;

  const peakAt=(index)=>{
    let peak=0;
    for(const channel of channels) peak=Math.max(peak,Math.abs(channel[index]||0));
    return peak;
  };

  while(start<end && peakAt(start)<threshold) start++;
  while(end>start && peakAt(end-1)<threshold) end--;

  const leadPad=Math.floor(buffer.sampleRate*0.015);
  const tailPad=Math.floor(buffer.sampleRate*0.045);
  start=Math.max(0,start-leadPad);
  end=Math.min(buffer.length,end+tailPad);

  if(start===0 && end===buffer.length) return buffer;
  if(end-start < Math.floor(buffer.sampleRate*0.08)) return buffer;

  const trimmed=audioContext.createBuffer(buffer.numberOfChannels,end-start,buffer.sampleRate);
  channels.forEach((channel,i)=>trimmed.copyToChannel(channel.subarray(start,end),i));
  return trimmed;
}

function setState(state,title,detail) {
  title=languageUI?.translate(title)??title;detail=languageUI?.translate(detail)??detail;
  avatarVisualState=state;
  ui.avatar.className=`avatar state-${state}`;
  renderAvatarFrame();
  ui.statusTitle.textContent=title;
  ui.statusDetail.textContent=detail;
  ui.homeScreen.dataset.session=running?'active':'stopped';
  // Keep the status inside Emma's existing name-badge location.
  // Only surface secondary detail when the user needs to act (errors /
  // audio unlock), never duplicate the spoken English in a second row.
  const needsNotice=state==='error' ||
    (state==='speaking' && /再開|タップ/.test(title)) ||
    (state==='idle' && /失敗|できません/.test(title));
  ui.statusDetail.classList.toggle('hidden',!needsNotice);
  ui.statusTitle.className=`status-chip status-${state}`;
  if(tutorialStep!==null) scheduleTutorialSpotlightSync();
}

function setBusy(value) {
  ui.busySpinner.classList.toggle('hidden',!value);
  if(ui.manualReplyButton) ui.manualReplyButton.disabled=Boolean(value)||!running;
}

function showProgress(show,value=0,text='') {
  ui.progressWrap.classList.toggle('hidden',!show);
  ui.progressWrap.setAttribute('aria-hidden',String(!show));
  ui.progressBar.style.width=`${Math.max(0,Math.min(100,value))}%`;
  ui.progressText.textContent=languageUI?.translate(text)??text;
}

function showOnboardingProgress(show,value=0,text='') {
  ui.onboardingProgress.classList.toggle('hidden',!show);
  ui.onboardingProgressBar.style.width=`${Math.max(0,Math.min(100,value))}%`;
  ui.onboardingProgressText.textContent=languageUI?.translate(text)??text;
}

function showConversation(parentText,emmaText,route='generic') {
  // Do not render the parent's ASR transcript on the live home screen.
  // The original transcript is still consumed by Ruri and saved by history.
  // Preserve the initial "Hi, I'm Emma." and the most recent spoken reply
  // while Moonshine/Ruri process the next utterance. Only a genuine new
  // English response replaces the card, never an intermediate empty ASR turn.
  if(!emmaText)return;
  ui.conversation.classList.remove('hidden');
  ui.emmaBubble.classList.remove('hidden');
  ui.replyTopic.classList.remove('hidden');
  const hint=replyDisplayHint(route);
  ui.replyTopic.textContent=hint.topicLabel;
  ui.reply.textContent=emmaText;
  ui.replyJapanese.textContent=hint.japaneseNote;
}

function onRuntimeError(message) {
  processing=false;
  speaking=false;
  setBusy(false);
  setState('error','処理中に問題が起きました',message||'もう一度お試しください。');
}

function friendlyError(error) {
  const msg=error?.message||String(error);
  if(error?.name==='NotAllowedError') return 'マイクを開始できませんでした。サイト設定でマイクを許可してください。Androidで他アプリのバブルやオーバーレイが表示されている場合は、閉じてから「呼びかけを始める」をもう一度押してください。';
  if(!window.isSecureContext) return 'マイクを使うにはHTTPSで開く必要があります。';
  const trimmed=String(msg||'').trim();
  if(/^[-+]?\d+(?:\s+[-+]?\d+)*$/.test(trimmed)) {
    const stageLabels={
      runtime:'実行エンジン起動',
      catalog:'モデル一覧取得',
      download:'モデル取得',
      'model-build':'モデル構築',
      ready:'準備完了後'
    };
    const stage=stageLabels[moonshineStage]||moonshineStage;
    return `Moonshineの${stage}でネイティブエラーが発生しました（内部アドレス: ${trimmed}）。`;
  }
  return trimmed || '処理中に不明なエラーが発生しました。';
}

async function requestWakeLock() {
  if(!('wakeLock' in navigator)||document.visibilityState!=='visible')return;
  try{wakeLock=await navigator.wakeLock.request('screen');}catch{}
}

function getAiName() { return 'Emma'; }

function stripAiSpeakerLabel(text) {
  const clean=String(text||'').trim();
  const name='Emma';
  const escaped=name.replace(/[.*+?^\${}()|[\]\\]/g,'\\$&');
  const pattern=new RegExp('^\\s*(?:'+escaped+'|AI)\\s*[:：\\-–—]\\s*','i');
  return clean.replace(pattern,'').trim();
}
function updateAiNameUi() {
  const name='Emma';
  if(ui.aiBubbleLabel) ui.aiBubbleLabel.textContent=name;
  // The former name badge now displays the live voice recognition / speaking status.
  if(ui.aiAvatarFace) ui.aiAvatarFace.setAttribute('aria-label',`${name}（みつことば AI）`);
}

function getTtsSignature() {
  return 'qwen3-prerecorded-voice1202-v1';
}

function updateAsrModelStatus() {
  if(!ui.asrModelStatus) return;
  const selected=localStorage.getItem(STORAGE.asrModel)==='tiny' ? 'Tiny' : 'Small';
  const state=modelCacheState;
  if(state.label===selected && state.status==='complete') {
    ui.asrModelStatus.textContent=`現在：${selected}。必要なモデルファイルはすべて保存済みです。`;
  } else if(state.label===selected && (state.status==='partial'||state.status==='missing')) {
    ui.asrModelStatus.textContent=`現在：${selected}。モデルファイルが不足しているため、次回利用時に取得します。`;
  } else {
    ui.asrModelStatus.textContent=`現在：${selected}。保存状態は会話開始時に必要ファイル単位で確認します。`;
  }
  renderModelCacheStatus();
}

function updateWebTimingDiagnostics() {
  if(!ui.webTimingDiagnostics)return;
  const format=value=>Number.isFinite(value)?`${Math.round(value)}ms`:'未計測';
  const formatMb=value=>Number.isFinite(value)?`${(value/1_000_000).toFixed(1)}MB`:'未計測';
  const asr=lastMoonshineDiagnostics;
  const asrText=asr
    ? `ASR 端末読込 ${format(asr.cacheReadMs)} / ${formatMb(asr.cacheReadBytes)} / 通信 ${format(asr.networkDownloadMs)} / ${formatMb(asr.networkDownloadBytes)} / WASM ${format(asr.wasmInitMs)} / モデル構築 ${format(asr.modelBuildMs)} / 合計 ${format(asr.totalInitMs)} ｜ `
    : '';
  ui.webTimingDiagnostics.textContent=
    `直近計測: ${asrText}TTS初チャンク ${format(lastTtsFirstChunkMillis)} / 生成完了 ${format(lastTtsGenerationCompleteMillis)} / 初音 ${format(lastTtsFirstAudioMillis)} / 全体 ${format(lastTtsTotalMillis)}`;
}

async function buildWebDiagnosticReport() {
  const semantic=semanticPanel?.snapshot||{};
  let storageEstimate=null;
  let storagePersisted='unknown';
  try { storageEstimate=await navigator.storage?.estimate?.() || null; } catch {}
  try {
    if(typeof navigator.storage?.persisted==='function') storagePersisted=await navigator.storage.persisted();
  } catch {}
  const selectedAsr=localStorage.getItem(STORAGE.asrModel)==='tiny'?'Tiny':'Small';
  const lines=[
    'Mitsukotoba Web diagnostics',
    `created=${new Date().toISOString()}`,
    `build=${WEB_BUILD}`,
    `urlOrigin=${location.origin}`,
    `secureContext=${window.isSecureContext}`,
    `crossOriginIsolated=${window.crossOriginIsolated}`,
    `visibility=${document.visibilityState}`,
    `userAgent=${navigator.userAgent}`,
    `language=${navigator.language}`,
    `app.language=${languageUI.language}`,
    `app.languageMode=${languageUI.mode}`,
    `multilingual.asrStage=${multilingualAsrDiagnostic.stage}`,
    `multilingual.asrLanguage=${multilingualAsrDiagnostic.detectedLanguage??'unknown'}`,
    `multilingual.asrElapsedMs=${multilingualAsrDiagnostic.elapsedMs??'unknown'}`,
    `multilingual.asrError=${multilingualAsrDiagnostic.error??'none'}`,
    `hardwareConcurrency=${navigator.hardwareConcurrency??'unknown'}`,
    `deviceMemory=${navigator.deviceMemory??'unknown'}`,
    `asr.selected=${selectedAsr}`,
    `asr.ready=${Boolean(moonshineTranscriber)}`,
    `asr.stage=${moonshineStage}`,
    `asr.lastSource=${lastMoonshineDiagnostics?.lastSource??'unmeasured'}`,
    `asr.cacheReadMs=${lastMoonshineDiagnostics?.cacheReadMs??'unmeasured'}`,
    `asr.cacheReadBytes=${lastMoonshineDiagnostics?.cacheReadBytes??'unmeasured'}`,
    `asr.cacheFiles=${lastMoonshineDiagnostics?.cacheFiles??'unmeasured'}`,
    `asr.cacheMisses=${lastMoonshineDiagnostics?.cacheMisses??'unmeasured'}`,
    `asr.networkDownloadMs=${lastMoonshineDiagnostics?.networkDownloadMs??'unmeasured'}`,
    `asr.networkDownloadBytes=${lastMoonshineDiagnostics?.networkDownloadBytes??'unmeasured'}`,
    `asr.networkFiles=${lastMoonshineDiagnostics?.networkFiles??'unmeasured'}`,
    `asr.cacheWriteMs=${lastMoonshineDiagnostics?.cacheWriteMs??'unmeasured'}`,
    `asr.wasmInitMs=${lastMoonshineDiagnostics?.wasmInitMs??'unmeasured'}`,
    `asr.modelBuildMs=${lastMoonshineDiagnostics?.modelBuildMs??'unmeasured'}`,
    `asr.totalInitMs=${lastMoonshineDiagnostics?.totalInitMs??'unmeasured'}`,
    `tts.ready=${Boolean(ttsWorker&&ttsInfoCache)}`,
    'tts.model=Qwen3-TTS pre-generated',
    'tts.voice=Mitsukotoba-1202',
    'tts.generationSeed=1202',
    'tts.loudnessTarget=-20LUFS',
    'tts.prerecordedPlaybackGain=1.0',
    'tts.fallbackTargetPeak=0.92',
    'tts.fallbackMaxBoost=1.8x',
    `semantic.requested=${Boolean(semantic.requested)}`,
    `semantic.mode=${semantic.mode||'unknown'}`,
    `semantic.enabled=${Boolean(semantic.enabled)}`,
    `semantic.ready=${Boolean(semantic.ready)}`,
    `semantic.failed=${Boolean(semantic.failed)}`,
    `semantic.status=${semantic.status?.message||'unknown'}`,
    `interaction.enabled=true`,
    `routing.auditLimit=20`,
    `routing.auditPrivacy=no_transcript_or_name`,
    `history.enabled=${historyEnabled(localStorage)}`,
    `autoRespond=${ui.autoRespond?.checked!==false}`,
    `keepAwake=${ui.keepAwake?.checked!==false}`,
    `playSentenceCount=${localStorage.getItem(STORAGE.playSentenceCount)==='3'?3:1}`,
    `colorMode=${localStorage.getItem(STORAGE.colorMode)||'vivid'}`,
    `tts.firstChunkMs=${lastTtsFirstChunkMillis??'unmeasured'}`,
    `tts.generationCompleteMs=${lastTtsGenerationCompleteMillis??'unmeasured'}`,
    `tts.firstAudioMs=${lastTtsFirstAudioMillis??'unmeasured'}`,
    `tts.totalMs=${lastTtsTotalMillis??'unmeasured'}`,
    `storage.usageBytes=${storageEstimate?.usage??'unknown'}`,
    `storage.quotaBytes=${storageEstimate?.quota??'unknown'}`,
    `storage.persisted=${storagePersisted}`,
    `storage.persistenceState=${storagePersistenceState}`,
    `modelCache.status=${modelCacheState.status}`,
    `modelCache.label=${modelCacheState.label??'unverified'}`,
    `modelCache.entryCount=${modelCacheState.entryCount??'unknown'}`,
    `modelCache.presentFiles=${modelCacheState.presentFiles??'unknown'}`,
    `modelCache.expectedFiles=${modelCacheState.expectedFiles??'unknown'}`,
    `modelCache.presentBytes=${modelCacheState.presentBytes??'unknown'}`,
    `modelCache.expectedBytes=${modelCacheState.expectedBytes??'unknown'}`,
    `modelCache.aliasHits=${modelCacheState.aliasHits??0}`,
    `modelCache.missingFiles=${modelCacheState.missingFiles?.join(',')||'none'}`,
    `modelCache.previousSnapshot=${previousModelCacheSnapshot?JSON.stringify(previousModelCacheSnapshot):'none'}`,
    `modelCache.lastLoss=${lastModelCacheLoss?JSON.stringify(lastModelCacheLoss):'none'}`,
  ];
  const routingHistory=semantic.routingHistory||[];
  lines.push(`routing.turnCount=${routingHistory.length}`);
  if(routingHistory.length){
    lines.push('routing.turns.begin');
    for(const entry of routingHistory)lines.push('routing.turn='+JSON.stringify(entry));
    lines.push('routing.turns.end');
  }
  if(runtimeDiagnosticEvents.length){
    lines.push('runtimeErrors.begin');
    for(const event of runtimeDiagnosticEvents){
      lines.push(`${event.at} kind=${event.kind} name=${event.name} message=${event.message}`);
    }
    lines.push('runtimeErrors.end');
  }
  if(semantic.result?.topic){
    lines.push(
      `semantic.lastTopic=${semantic.result.topic.id}`,
      `semantic.lastProbability=${semantic.result.topic.probability}`,
      `semantic.lastMargin=${semantic.result.topic.margin}`,
      `semantic.lastElapsedMs=${semantic.result.elapsedMs??'unknown'}`,
    );
  }
  return lines.join('\n')+'\n';
}

async function copyTextToClipboard(text) {
  if(navigator.clipboard?.writeText){
    await navigator.clipboard.writeText(text);
    return;
  }
  const area=document.createElement('textarea');
  area.value=text;
  area.style.position='fixed';
  area.style.opacity='0';
  document.body.append(area);
  area.select();
  const ok=document.execCommand('copy');
  area.remove();
  if(!ok)throw new Error('clipboard unavailable');
}

function updateRuntimeBackend() {
  if(languageUI.language!=='ja'){ui.runtimeBackend.textContent='Whisper Small · multilingual / E5 · on-device WASM';return;}
  if(!asrInfoCache || !ttsInfoCache){
    ui.runtimeBackend.textContent='推論: 未初期化';
    return;
  }
  const asrLabel=asrInfoCache?.architecture==='small_streaming' ? 'Small' : 'Tiny';
  ui.runtimeBackend.textContent=`ASR: Moonshine Japanese ${asrLabel} Streaming / 端末内WASM ・ 音声: 選んだ声 / 保存済み音声`;
}

function updateAppearanceSettings() {
  const mode=ui.colorMode.value;
  ui.vividPaletteRow.classList.toggle('hidden',mode!=='vivid');
  ui.softPaletteRow.classList.toggle('hidden',mode!=='soft');
  ui.filledPaletteRow.classList.toggle('hidden',mode!=='filled');
  const descriptions={
    soft:'明るくやさしい配色です。グラデーションでは顔と飾りの色がゆっくり変わります。',
    vivid:'白い顔に、耳や頭の飾りの鮮やかな色が映える配色です。グラデーションでも白い部分はそのままです。',
    filled:'濃い飾り色と、顔や体にも薄く色を付けた配色です。グラデーションでは顔と飾りの色がゆっくり変わります。'
  };
  ui.colorModeDescription.textContent=descriptions[mode]||'';
  ui.gradientDescription.textContent=GRADIENT_DESCRIPTIONS[mode]||'';
}

function applyAppearance() {
  if(appearanceTimer){clearInterval(appearanceTimer);appearanceTimer=null;}
  const savedMode=localStorage.getItem(STORAGE.colorMode);
  const {mode,vivid}=normalizeColorSettings(savedMode||ui.colorMode.value, localStorage.getItem(STORAGE.vivid)||ui.vividPalette.value);
  if(savedMode==='mono_red'||savedMode==='color_shift'){
    localStorage.setItem(STORAGE.colorMode,mode);
    localStorage.setItem(STORAGE.vivid,vivid);
  }
  const soft=normalizeSoftPalette(localStorage.getItem(STORAGE.soft)||ui.softPalette.value);
  const filled=normalizeFilledPalette(localStorage.getItem(STORAGE.filled)||ui.filledPalette.value);
  ui.filledPalette.value=filled;
  ui.colorMode.value=mode;
  ui.vividPalette.value=vivid;
  ui.softPalette.value=soft;
  const selected=mode==='soft' ? soft : mode==='filled' ? filled : vivid;
  if(selected==='gradient'){
    const update=()=>{
      const hue=((Date.now()/GRADIENT_CYCLE_MS*360)%360+360)%360;
      setPalette(shiftingPalette(hue,mode));
    };
    update();
    appearanceTimer=setInterval(update,500);
    return;
  }
  setPalette(mode==='soft' ? SOFT_PALETTES[soft] : mode==='filled' ? FILLED_PALETTES[filled] : VIVID_PALETTES[vivid]);
}

function setPalette(palette) {
  if(!palette)return;
  const root=document.documentElement.style;
  root.setProperty('--face',palette.face);
  root.setProperty('--accent',palette.accent);
  root.setProperty('--dark',palette.dark);
  root.setProperty('--blush',palette.blush);
  root.setProperty('--mouth',palette.mouth);
  root.setProperty('--tongue',palette.tongue);
}

function delay(ms){return new Promise(r=>setTimeout(r,ms));}

function withTimeout(promise,ms,message){
  let timer;
  const timeout=new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(new Error(message)),ms);
  });
  return Promise.race([promise,timeout]).finally(()=>clearTimeout(timer));
}

async function ensureMoonshineIsolation({isCurrent=()=>true,manualStartAfterReload=false}={}) {
  if(!isCurrent())return false;
  if(typeof languageUI!=='undefined' && languageUI.language!=='ja')return true;
  if(window.crossOriginIsolated && typeof SharedArrayBuffer === 'function') {
    sessionStorage.removeItem('emma_coi_reload_count');
    return true;
  }
  if(!('serviceWorker' in navigator)) {
    throw new Error('このブラウザではMoonshineに必要なService Workerを利用できません。');
  }

  const registration=await navigator.serviceWorker.register('./service-worker.js?v=20261020-progressive-voice-v1',{updateViaCache:'none'});
  await registration.update().catch(()=>{});

  const candidate=registration.installing || registration.waiting;
  if(candidate && candidate.state!=='activated') {
    await Promise.race([
      new Promise(resolve=>{
        const onState=()=>{
          if(candidate.state==='activated' || candidate.state==='redundant'){
            candidate.removeEventListener('statechange',onState);
            resolve();
          }
        };
        candidate.addEventListener('statechange',onState);
        onState();
      }),
      delay(5000)
    ]);
  }

  if(!isCurrent())return false;
  if(window.crossOriginIsolated && typeof SharedArrayBuffer === 'function') return true;

  const reloadCount=Number(sessionStorage.getItem('emma_coi_reload_count')||'0');
  if(reloadCount<2) {
    sessionStorage.setItem('emma_coi_reload_count',String(reloadCount+1));
    if(manualStartAfterReload) sessionStorage.setItem('emma_coi_manual_start','1');
    location.reload();
    return false;
  }

  throw new Error('Moonshineに必要なブラウザ分離を有効にできませんでした。通常のブラウザタブで開き直してください。');
}

window.addEventListener('load',()=>{
  if('serviceWorker' in navigator) {
    // Register for offline assets now. Reload for isolation only when ASR starts,
    // so background setup cannot discard settings or Japanese text being edited.
    navigator.serviceWorker.register('./service-worker.js?v=20261020-progressive-voice-v1',{updateViaCache:'none'}).catch(error=>console.warn('Service Worker setup:',error));
  }
});
