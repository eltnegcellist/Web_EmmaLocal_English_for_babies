import { SOFT_PALETTES, VIVID_PALETTES, FILLED_PALETTES, normalizeFilledPalette, normalizeSoftPalette, normalizeVividPalette, normalizeColorSettings, shiftingPalette } from './emma-color-palettes.js';
import { EmmaMicrophone } from './audio-capture.js';
import { LiteResponseEngine, CHILDCARE_ASR_KEYTERMS, isMeaningfulUtterance } from './lite-response-engine.js';
import { toSpokenEnglish, withChanSuffix } from './name-pronunciation.js';

const $ = (id) => document.getElementById(id);
const ui = {
  onboardingScreen:$('onboardingScreen'), homeScreen:$('homeScreen'), settingsScreen:$('settingsScreen'), aboutScreen:$('aboutScreen'),
  onboardingBabyName:$('onboardingBabyName'), onboardingAiCharacterName:$('onboardingAiCharacterName'), onboardingSpokenBabyName:$('onboardingSpokenBabyName'),
  onboardingUseChanSuffix:$('onboardingUseChanSuffix'), onboardingStartTiny:$('onboardingStartTiny'), onboardingSpokenNamePreview:$('onboardingSpokenNamePreview'),
  onboardingPronunciationToggle:$('onboardingPronunciationToggle'), onboardingPronunciationPanel:$('onboardingPronunciationPanel'),
  prepareEmmaButton:$('prepareEmmaButton'),
  onboardingProgress:$('onboardingProgress'), onboardingProgressBar:$('onboardingProgressBar'), onboardingProgressText:$('onboardingProgressText'),
  avatar:$('avatar'), statusTitle:$('statusTitle'), statusDetail:$('statusDetail'), busySpinner:$('busySpinner'), tutorialStatusTarget:$('tutorialStatusTarget'),
  progressWrap:$('progressWrap'), progressBar:$('progressBar'), progressText:$('progressText'),
  conversation:$('conversation'), parentBubble:$('parentBubble'), emmaBubble:$('emmaBubble'), transcript:$('transcript'), reply:$('reply'),
  mainButton:$('mainButton'), stopButton:$('stopButton'), manualReplyButton:$('manualReplyButton'), enableAudioButton:$('enableAudioButton'),
  autoRespond:$('autoRespond'), aboutButton:$('aboutButton'), settingsButton:$('settingsButton'),
  settingsBackButton:$('settingsBackButton'), settingsAboutButton:$('settingsAboutButton'),
  aboutBackButton:$('aboutBackButton'), onboardingAboutButton:$('onboardingAboutButton'),
  aiCharacterName:$('aiCharacterName'), aiNamePreview:$('aiNamePreview'), aiBubbleLabel:$('aiBubbleLabel'), aiNameBadge:$('aiNameBadge'),
  aiAvatarFace:$('aiAvatarFace'), onboardingAiIntro:$('onboardingAiIntro'),
  tutorialReplayButton:$('tutorialReplayButton'), tutorialOverlay:$('tutorialOverlay'), tutorialSpotlight:$('tutorialSpotlight'),
  tutorialCard:$('tutorialCard'), tutorialStepLabel:$('tutorialStepLabel'), tutorialTitle:$('tutorialTitle'),
  tutorialBody:$('tutorialBody'), tutorialSkipButton:$('tutorialSkipButton'), tutorialPrimaryButton:$('tutorialPrimaryButton'), tutorialHint:$('tutorialHint'),
  babyName:$('babyName'), spokenBabyName:$('spokenBabyName'), useChanSuffix:$('useChanSuffix'), genderHelp:$('genderHelp'),
  pronunciationToggle:$('pronunciationToggle'), pronunciationPanel:$('pronunciationPanel'), spokenNamePreview:$('spokenNamePreview'),
  filledPalette:$('filledPalette'), filledPaletteRow:$('filledPaletteRow'), softPalette:$('softPalette'), softPaletteRow:$('softPaletteRow'), colorMode:$('colorMode'), vividPalette:$('vividPalette'), vividPaletteRow:$('vividPaletteRow'), colorModeDescription:$('colorModeDescription'),
  keepAwake:$('keepAwake'), asrModel:$('asrModel'), asrModelStatus:$('asrModelStatus'), runtimeBackend:$('runtimeBackend'),
  developerUnlockTrigger:$('developerUnlockTrigger'), webBuild:$('webBuild'), developerTools:$('developerTools'), fullResetButton:$('fullResetButton'),
  debugInput:$('debugInput'), debugReplyButton:$('debugReplyButton'),
  noticeDialog:$('noticeDialog'), noticeTitle:$('noticeTitle'), noticeBody:$('noticeBody'), noticeLink:$('noticeLink'), noticeCloseButton:$('noticeCloseButton')
};

const CURRENT_SETUP_REVISION = 'moonshine-streaming-kitten-int8-kiki-v10';
const WEB_BUILD = '20261004-filled-gradients-r17';

const STORAGE = {
  setupRevision:'emma_web_setup_revision',
  aiName:'emma_ai_character_name',
  babyName:'emma_baby_name',
  spokenName:'emma_baby_spoken_name',
  gender:'emma_baby_gender',
  colorMode:'emma_color_mode',
  vivid:'emma_vivid_palette',
  soft:'emma_soft_palette',
  filled:'emma_filled_palette',
  keepAwake:'emma_keep_awake',
  autoRespond:'emma_auto_respond',
  useChanSuffix:'emma_use_chan_suffix',
  asrModel:'emma_asr_model',
  startTiny:'emma_first_run_start_tiny',
  asrReload:'emma_asr_reload',
  tutorialDone:'emma_web_tutorial_completed_v1'
};

if (!localStorage.getItem(STORAGE.babyName) && localStorage.getItem('emmaBabyName')) {
  localStorage.setItem(STORAGE.babyName, localStorage.getItem('emmaBabyName'));
}
if (new URLSearchParams(location.search).has('debug')) document.body.classList.add('debug');

const engine = new LiteResponseEngine();
// The official v0.1.5 release archive contains the split-frontend WASM build;
// the v0.1.5 npm tarball's WASM does not.
const MOONSHINE_MODULE_URL = new URL('./moonshine-module.js', import.meta.url).href;
let moonshineTranscriber, moonshineModule, ttsWorker, mic, wakeLock;
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
let appearanceTimer=null;
let developerTapCount=0;
let developerTapTimer=null;
const audioQueues = new Map();


initUi();

function initUi() {
  const babyName = localStorage.getItem(STORAGE.babyName) || '';
  const aiName = localStorage.getItem(STORAGE.aiName) || 'Emma';
  if(ui.webBuild) ui.webBuild.textContent=`Web build: ${WEB_BUILD}`;
  if(ui.aiCharacterName) ui.aiCharacterName.value = aiName;
  if(ui.onboardingAiCharacterName) ui.onboardingAiCharacterName.value = aiName;
  ui.babyName.value = babyName;
  ui.onboardingBabyName.value = babyName;
  const spokenName = localStorage.getItem(STORAGE.spokenName) || '';
  ui.spokenBabyName.value = spokenName;
  ui.onboardingSpokenBabyName.value = spokenName;
  const colors = normalizeColorSettings(localStorage.getItem(STORAGE.colorMode), localStorage.getItem(STORAGE.vivid));
  ui.colorMode.value = colors.mode;
  ui.vividPalette.value = colors.vivid;
  ui.softPalette.value = normalizeSoftPalette(localStorage.getItem(STORAGE.soft));
  ui.filledPalette.value = normalizeFilledPalette(localStorage.getItem(STORAGE.filled));
  ui.keepAwake.checked = localStorage.getItem(STORAGE.keepAwake) !== 'false';
  ui.autoRespond.checked = localStorage.getItem(STORAGE.autoRespond) !== 'false';
  if (ui.asrModel) ui.asrModel.value = localStorage.getItem(STORAGE.asrModel) || 'small';
  if (ui.onboardingStartTiny) {
    ui.onboardingStartTiny.checked = localStorage.getItem(STORAGE.startTiny) === 'true';
  }
  updateAsrModelStatus();
  const useChanSuffix = localStorage.getItem(STORAGE.useChanSuffix) !== 'false';
  ui.useChanSuffix.checked = useChanSuffix;
  ui.onboardingUseChanSuffix.checked = useChanSuffix;

  bindEvents();
  updateGenderUi();
  updateSpokenNamePreview();
  updateAiNameUi();
  applyAppearance();
  updateAppearanceSettings();
  updateAudioUnlockUi();

  startAvatarBlinkLoop();

  const reloadedAsr=sessionStorage.getItem(STORAGE.asrReload);
  if (localStorage.getItem(STORAGE.setupRevision) === CURRENT_SETUP_REVISION) {
    if(reloadedAsr){
      sessionStorage.removeItem(STORAGE.asrReload);
      showScreen('home',{autoStart:false});
      const label=reloadedAsr==='small' ? 'Small' : 'Tiny';
      setState('idle',`音声認識を${label}に変更しました`,'「3人で話す」を押して会話を再開してください。');
      if(ui.asrModelStatus) ui.asrModelStatus.textContent=`現在：${label}。再読み込みして安全に切り替えました。`;
      if(localStorage.getItem(STORAGE.tutorialDone)!=='true') queueMicrotask(()=>startTutorial());
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

  ui.aboutButton.addEventListener('click',()=>openAbout('home'));
  ui.settingsAboutButton.addEventListener('click',()=>openAbout('settings'));
  ui.onboardingAboutButton.addEventListener('click',()=>openAbout('onboarding'));
  ui.aboutBackButton.addEventListener('click',()=>showScreen(previousScreen));
  ui.settingsBackButton.addEventListener('click',()=>showScreen('home'));
  ui.settingsButton.addEventListener('click',async()=>{
    if (running || speaking || processing) await stopEmma();
    showScreen('settings');
  });

  ui.noticeCloseButton.addEventListener('click',closeNotice);
  ui.noticeDialog.addEventListener('click',(event)=>{
    if(event.target===ui.noticeDialog) closeNotice();
  });
  document.addEventListener('keydown',(event)=>{
    if(event.key==='Escape'&&!ui.noticeDialog.classList.contains('hidden')) closeNotice();
  });

  ui.aiCharacterName?.addEventListener('input',()=>{
    const value=sanitizeAiName(ui.aiCharacterName.value);
    ui.aiCharacterName.value=value;
    if(ui.onboardingAiCharacterName) ui.onboardingAiCharacterName.value=value;
    localStorage.setItem(STORAGE.aiName,value);
    updateAiNameUi();
  });
  ui.onboardingAiCharacterName?.addEventListener('input',()=>{
    const value=sanitizeAiName(ui.onboardingAiCharacterName.value);
    ui.onboardingAiCharacterName.value=value;
    if(ui.aiCharacterName) ui.aiCharacterName.value=value;
    localStorage.setItem(STORAGE.aiName,value);
    updateAiNameUi();
  });

  ui.babyName.addEventListener('input',()=>{
    const value=sanitizePlainName(ui.babyName.value,30);
    ui.babyName.value=value;
    ui.onboardingBabyName.value=value;
    localStorage.setItem(STORAGE.babyName,value);
    updateSpokenNamePreview();
  });
  ui.onboardingBabyName.addEventListener('input',()=>{
    const value=sanitizePlainName(ui.onboardingBabyName.value,30);
    ui.onboardingBabyName.value=value;
    ui.babyName.value=value;
    localStorage.setItem(STORAGE.babyName,value);
    updateSpokenNamePreview();
  });
  ui.spokenBabyName.addEventListener('input',()=>{
    const value=sanitizeSpokenName(ui.spokenBabyName.value);
    ui.spokenBabyName.value=value;
    ui.onboardingSpokenBabyName.value=value;
    localStorage.setItem(STORAGE.spokenName,value);
    updateSpokenNamePreview();
  });
  ui.onboardingSpokenBabyName.addEventListener('input',()=>{
    const value=sanitizeSpokenName(ui.onboardingSpokenBabyName.value);
    ui.onboardingSpokenBabyName.value=value;
    ui.spokenBabyName.value=value;
    localStorage.setItem(STORAGE.spokenName,value);
    updateSpokenNamePreview();
  });
  ui.useChanSuffix.addEventListener('change',()=>{
    ui.onboardingUseChanSuffix.checked=ui.useChanSuffix.checked;
    localStorage.setItem(STORAGE.useChanSuffix,String(ui.useChanSuffix.checked));
    updateSpokenNamePreview();
  });
  ui.onboardingUseChanSuffix.addEventListener('change',()=>{
    ui.useChanSuffix.checked=ui.onboardingUseChanSuffix.checked;
    localStorage.setItem(STORAGE.useChanSuffix,String(ui.onboardingUseChanSuffix.checked));
    updateSpokenNamePreview();
  });
  ui.pronunciationToggle.addEventListener('click',()=>{
    const opening=ui.pronunciationPanel.classList.contains('hidden');
    ui.pronunciationPanel.classList.toggle('hidden',!opening);
    ui.pronunciationToggle.textContent=opening?'名前の読み方設定を閉じる':'名前の読み方を調整';
  });
  ui.onboardingPronunciationToggle.addEventListener('click',()=>{
    const opening=ui.onboardingPronunciationPanel.classList.contains('hidden');
    ui.onboardingPronunciationPanel.classList.toggle('hidden',!opening);
    ui.onboardingPronunciationToggle.textContent=opening?'名前の読み方設定を閉じる':'名前の読み方を調整';
  });

  document.querySelectorAll('[data-gender]').forEach(button=>{
    button.addEventListener('click',()=>{
      localStorage.setItem(STORAGE.gender,button.dataset.gender);
      updateGenderUi();
    });
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
  ui.onboardingStartTiny?.addEventListener('change',()=>{
    localStorage.setItem(STORAGE.startTiny,String(ui.onboardingStartTiny.checked));
  });
  ui.autoRespond.addEventListener('change',()=>{
    localStorage.setItem(STORAGE.autoRespond,String(ui.autoRespond.checked));
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

  ui.fullResetButton?.addEventListener('click',()=>{
    const confirmed=window.confirm(
      'みつことばを初期状態に戻します。\n\n赤ちゃんの設定、見た目、初回準備情報、Moonshine / Kittenのモデルキャッシュを削除します。次回はモデルの再取得が必要です。\n\n実行しますか？'
    );
    if(confirmed) location.href='./reset.html?full=1';
  });
  ui.tutorialReplayButton?.addEventListener('click',async()=>{
    if(running || processing || speaking) await stopEmma();
    showScreen('home',{autoStart:false});
    startTutorial({replay:true});
  });
  ui.tutorialSkipButton?.addEventListener('click',finishTutorial);
  ui.tutorialPrimaryButton?.addEventListener('click',async()=>{
    if(tutorialStep!==0) return;
    unlockPlaybackAudioFromGesture();
    if(!tutorialIntroPlayed){
      ui.tutorialPrimaryButton.disabled=true;
      try{
        await ensureWorkersForDebug();
        await speakResponse(`Hi, I'm ${getAiName()}.`);
        tutorialIntroPlayed=true;
      }finally{
        ui.tutorialPrimaryButton.disabled=false;
        renderTutorial();
      }
      return;
    }
    tutorialStep=1;
    renderTutorial();
  });
  window.addEventListener('resize',()=>{ if(tutorialStep!==null) scheduleTutorialSpotlightSync(); });
  window.addEventListener('scroll',()=>{ if(tutorialStep!==null) scheduleTutorialSpotlightSync(); },{passive:true});
  window.visualViewport?.addEventListener('resize',()=>{ if(tutorialStep!==null) scheduleTutorialSpotlightSync(); });
  window.visualViewport?.addEventListener('scroll',()=>{ if(tutorialStep!==null) scheduleTutorialSpotlightSync(); },{passive:true});

  ui.debugReplyButton.addEventListener('click',async()=>{
    const text=ui.debugInput.value.trim();
    if(!text)return;
    showConversation(text,'');
    const response=engine.respond(text,getSpokenBabyName());
    const english=stripAiSpeakerLabel(response.english);
    showConversation(text,english);
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
    queueMicrotask(()=>{
      if(!running && !processing && !speaking && !ui.mainButton.disabled) {
        startEmma({ auto: true }).catch(error=>console.warn('Emma auto-start:',error));
      }
    });
  }
}

function openAbout(from) {
  previousScreen=from;
  showScreen('about');
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
          ()=>reject(new Error('マイクの許可確認が完了しませんでした。ブラウザのサイト設定でマイクを許可してから、もう一度お試しください。')),
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
  ui.prepareEmmaButton.disabled=true;
  showOnboardingProgress(true,0,'マイクの使用許可を確認しています…');
  try {
    // Ask for microphone permission immediately while the user's tap is still
    // active. Model preparation can take a long time, after which mobile
    // browsers may no longer show the permission prompt automatically.
    await requestMicrophonePermission();
    const firstRunAsr = ui.onboardingStartTiny?.checked ? 'tiny' : 'small';
    localStorage.setItem(STORAGE.asrModel,firstRunAsr);
    localStorage.setItem(STORAGE.startTiny,String(firstRunAsr==='tiny'));
    if(ui.asrModel) ui.asrModel.value=firstRunAsr;
    updateAsrModelStatus();
    if(!(await ensureMoonshineIsolation())) return;
    await navigator.storage?.persist?.().catch(()=>false);
    await clearObsoleteModelCaches();
    await initWorkers();
    // Playback AudioContext is resumed after microphone capture starts.
    localStorage.setItem(STORAGE.setupRevision,CURRENT_SETUP_REVISION);
    showOnboardingProgress(false);
    showProgress(false);
    setBusy(false);
    showScreen('home',{autoStart:false});
    setState('idle','準備できました','使い方を3ステップで確認しましょう。');
    startTutorial();
  } catch(error) {
    console.error(error);
    showOnboardingProgress(true,0,friendlyError(error));
    ui.prepareEmmaButton.disabled=false;
  }
}

async function startEmma({ auto = false } = {}) {
  if(running || processing || speaking || ui.mainButton.disabled) return;
  ui.mainButton.disabled=true;
  try {
    if(!(await ensureMoonshineIsolation())) return;

    // Always try the real microphone first. Do not gate startup on the
    // Permissions API: Android/Brave/Chrome may report "prompt" even when the
    // actual capture path can proceed, and one-time permission must be allowed
    // to show its browser prompt on every new launch.
    running=true;
    engine.resetConversationContext();
    setBusy(true);
    setState('thinking','マイクを起動しています','必要なら表示される許可画面でマイクを許可してください。');
    showProgress(true,0,'マイクを開始しています…');
    await startMoonshineCapture();

    // Only after real capture is active do we prepare the local ASR/TTS models.
    // This prevents model startup from blocking the microphone permission UI.
    setState('thinking','みつことばを準備しています','マイクは起動済みです。Moonshineと音声モデルを準備しています。');
    showProgress(true,0,'Moonshineを準備しています…');
    await navigator.storage?.persist?.().catch(()=>false);
    await withTimeout(
      initWorkers(),
      330000,
      'みつことばの準備が完了しませんでした。ページを再読み込みして、もう一度お試しください。'
    );

    // The microphone has been open while the models initialize. Discard any
    // partial VAD state gathered during startup. Playback is unlocked only by a
    // real user gesture so mobile browser autoplay policy cannot leave Emma mute.
    mic?.resetDetector?.();
    await mic?.ensureActive?.();
    ensureAudioContextCreated();
    updateAudioUnlockUi();

    ui.mainButton.classList.add('hidden');
    ui.manualReplyButton.classList.remove('hidden');
    ui.stopButton.classList.remove('hidden');
    setBusy(false);
    showProgress(false);
    if(ui.keepAwake.checked) await requestWakeLock();
    setState('listening',`${getAiName()}が聞いています`,'いつもどおり日本語で赤ちゃんへ話しかけてください。必要なら「ここで返事して」で区切れます。');
  } catch(error) {
    console.error(error);
    running=false;
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

async function stopEmma() {
  running=false;
  processing=false;
  speaking=false;
  pendingUtterance=null;
  for(const q of audioQueues.values()) q.resolve?.();
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
  setState('idle','みつことばはおやすみ中','「3人で話す」を押すと、また会話できます。');
}

function handleCapturedUtterance(audio) {
  if(!running||processing||speaking)return;
  if(tutorialStep===2){
    tutorialUserSpoke=true;
    pendingUtterance={kind:'audio',audio};
    ui.manualReplyButton.classList.remove('hidden');
    setState('understood','話し終わりを検出しました','画面下で光っている「ここで返事して」を押してください。');
    scheduleTutorialSpotlightSync();
    return;
  }
  if(ui.autoRespond.checked) transcribeUtterance(audio);
  else {
    pendingUtterance={kind:'audio',audio};
    ui.manualReplyButton.classList.remove('hidden');
    setState('understood','話し終わりを検出しました','「ここで返事して」を押すと返事します。');
  }
}

function respondToPendingUtterance() {
  if(!pendingUtterance||processing||speaking)return false;
  const pending=pendingUtterance;
  pendingUtterance=null;
  if(pending.kind==='audio') {
    transcribeUtterance(pending.audio);
    return true;
  }
  return false;
}

function forceReplyNow() {
  if(!running||processing||speaking)return;
  if(respondToPendingUtterance()) return;

  const audio=mic?.forceUtterance?.();
  if(!audio){
    setState('listening',`${getAiName()}が聞いています`,'もう少し話してから「ここで返事して」を押してください。');
    return;
  }
  pendingUtterance=null;
  setState('understood','ここまで聞きました',`${getAiName()}が返事を考えます。`);
  transcribeUtterance(audio);
}

async function startMoonshineCapture() {
  if(mic) return;
  mic=new EmmaMicrophone({
    onState:(state)=>{
      if(!workersReady||processing||speaking)return;
      if(state==='endpoint') setState('endpoint','聞いています…','話し終わるまで、そのまま話してください。');
      else setState('listening',`${getAiName()}が聞いています`,'いつもどおり日本語で赤ちゃんへ話しかけてください。');
    },
    onUtterance:handleCapturedUtterance,
    shouldIgnore:()=>!workersReady||processing||speaking
  });
  await mic.start();
}

async function initWorkers() {
  const signature=getTtsSignature();

  if(!asrInfoCache){
    showProgress(true,0,'Moonshineを準備しています…');
    showOnboardingProgress(true,0,'Moonshineを準備しています…');
    asrInfoCache=await initMoonshine();
  }

  if(!(ttsWorker && ttsInfoCache && ttsWorkerSignature===signature)){
    ttsWorker?.terminate();
    ttsInfoCache=null;
    ttsWorkerSignature=signature;
    ttsInfoCache=await new Promise((resolve,reject)=>{
      ttsWorker=new Worker(new URL('./tts-worker.js?v=20261004-filled-gradients-r17',import.meta.url),{type:'module'});
      ttsWorker.onmessage=(event)=>handleTtsMessage(event,resolve,reject);
      ttsWorker.onerror=reject;
      ttsWorker.postMessage({ type:'init' });
    });
  }

  workersReady=true;
  updateRuntimeBackend();
}

async function initMoonshine() {
  if(moonshineTranscriber && asrInfoCache?.kind==='moonshine') return asrInfoCache;

  moonshineStage='runtime';
  showMoonshineProgress(0,'Moonshineの実行エンジンを準備しています…');
  if(!moonshineModule){
    moonshineModule=await import(MOONSHINE_MODULE_URL);
  }
  const { Transcriber, ModelArch, loadEmmaMoonshineModule }=moonshineModule;
  if(typeof Transcriber?.load!=='function') {
    throw new Error('Moonshineの公式Transcriberを読み込めませんでした。');
  }

  const onProgress=(loaded,total,file)=>{
    moonshineStage='download';
    const safeLoaded=Number(loaded)||0;
    const safeTotal=Number(total)||0;
    const fraction=safeTotal>0 ? safeLoaded/safeTotal : 0;
    const progress=safeTotal>0 ? Math.max(1,Math.min(96,Math.round(fraction*96))) : 1;
    const mbLoaded=safeLoaded/1_000_000;
    const sizeText=safeTotal>0
      ? `${mbLoaded.toFixed(1)} / ${(safeTotal/1_000_000).toFixed(1)} MB`
      : `${mbLoaded.toFixed(1)} MB`;
    const fileName=String(file||'').split('/').pop();
    const selectedLabel=localStorage.getItem(STORAGE.asrModel)==='tiny' ? 'Tiny' : 'Small';
    const progressMessage=`Moonshine 日本語${selectedLabel} Streamingを取得しています… ${sizeText}${fileName ? `（${fileName}）` : ''}`;
    showMoonshineProgress(progress,progressMessage);
    if(ui.asrModelStatus) ui.asrModelStatus.textContent=progressMessage;
  };

  const module=await loadEmmaMoonshineModule();
  moonshineStage='catalog';
  const selectedAsr=localStorage.getItem(STORAGE.asrModel)==='tiny' ? 'tiny' : 'small';
  const modelArch=selectedAsr==='small' ? ModelArch.SmallStreaming : ModelArch.TinyStreaming;
  const modelLabel=selectedAsr==='small' ? 'Small' : 'Tiny';
  const nextTranscriber=await Transcriber.load({
    module,
    language:'ja',
    modelArch,
    options:{max_tokens_per_second:'13.0'},
    onProgress
  });
  try {
    nextTranscriber.setKeyterms(CHILDCARE_ASR_KEYTERMS);
  } catch(error) {
    console.warn('Moonshine育児語バイアスを適用できませんでした',error);
  }

  moonshineStage='ready';
  moonshineTranscriber?.close?.();
  moonshineTranscriber=nextTranscriber;
  showMoonshineProgress(100,`Moonshine 日本語${modelLabel}を準備できました`);
  if(ui.asrModelStatus) ui.asrModelStatus.textContent=`現在：${modelLabel}。準備完了。取得済みモデルはブラウザキャッシュを再利用します。`;

  return {
    kind:'moonshine',
    engine:'moonshine',
    model:selectedAsr+'-streaming-ja',
    architecture:selectedAsr+'_streaming',
    license:'MIT',
    device:'wasm-cpu',
    worker:'none-batch-transcriber'
  };
}

function forwardBackgroundDownload(message) {
  if(!message?.url || !message?.cacheName || !message?.cacheKey) return;
  navigator.serviceWorker?.ready
    ?.then(reg => (navigator.serviceWorker.controller || reg.active)?.postMessage({
      type:'track-model-download',
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
  await initWorkers();
  setBusy(false);
  showProgress(false);
}

function handleTtsMessage(event,readyResolve,readyReject) {
  const m=event.data;
  if(m.type==='background-download-url') {
    forwardBackgroundDownload(m);
    return;
  }
  if(m.type==='status') {
    showProgress(true,m.progress??0,m.message||'みつことばの声を準備しています…');
    showOnboardingProgress(true,m.progress??0,m.message||'みつことばの声を準備しています…');
  } else if(m.type==='ready') readyResolve?.(m);
  else if(m.type==='error') {
    const error=new Error(m.message || 'Kitten TTSでエラーが発生しました。');
    readyReject?.(error);
    if(m.requestId){
      const q=audioQueues.get(m.requestId);
      if(q) q.reject?.(error);
    }
    if(workersReady) onRuntimeError(error.message);
  } else if(m.type==='audio') enqueueAudio(m);
  else if(m.type==='complete') {
    const q=audioQueues.get(m.requestId);
    if(q){
      if(Number.isInteger(m.total)) q.total=Math.max(q.total,m.total);
      q.generationDone=true;
      pumpAudio(m.requestId);
    }
  }
}

async function transcribeUtterance(audio) {
  if(!running||processing||speaking||!moonshineTranscriber)return;
  processing=true;
  setBusy(true);
  setState('thinking','聞き取っています…','Moonshineで音声を端末内処理しています。');

  try {
    // Paint the thinking state before synchronous WASM inference starts.
    await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
    const result=moonshineTranscriber.transcribe(audio,{sampleRate:16000});
    const text=Array.isArray(result?.lines)
      ? result.lines
          .map(line=>String(line?.text||'').trim())
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g,' ')
          .trim()
      : '';
    await processTranscript(text);
  } catch(error) {
    processing=false;
    setBusy(false);
    console.error(error);
    setState('error','音声認識でエラーが発生しました',friendlyError(error));
  }
}

async function processTranscript(text) {
  if(!running||speaking)return;
  processing=true;
  setBusy(true);
  const clean=String(text||'').replace(/\s+/g,' ').trim();
  if(!isMeaningfulUtterance(clean)){
    processing=false;
    setBusy(false);
    setState('listening',`${getAiName()}が聞いています`,'意味のあることばを待っています。');
    return;
  }
  showConversation(clean,'');
  setState('understood','わかりました',`${getAiName()}が赤ちゃんへ話しかけます。`);
  const response=engine.respond(clean,getSpokenBabyName());
  const english=stripAiSpeakerLabel(response.english);
  showConversation(clean,english);
  processing=false;
  setBusy(false);
  await speakResponse(english);
  if(tutorialStep===2 && tutorialUserSpoke) finishTutorial();
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

async function speakResponse(text) {
  if(!ttsWorker) throw new Error('AIの声がまだ準備されていません');

  const shouldRestoreMic=running && Boolean(mic);
  if(shouldRestoreMic){
    setState('thinking','AIが話す準備をしています','マイクを一時停止してスピーカー音量へ切り替えています。');
    await releaseMicrophoneForEmmaVoice();
  }

  speaking=true;
  const requestId=++requestSeq;
  audioQueues.set(requestId,{items:new Map(),next:0,total:0,playing:false,generationDone:false,resolve:null,reject:null});
  const done=new Promise((resolve,reject)=>{
    const q=audioQueues.get(requestId);
    q.resolve=resolve;
    q.reject=reject;
  });

  setState('speaking','AIが話しています',text);
  try {
    ttsWorker.postMessage({type:'speak',requestId,text,nameHints:getTtsNameHints()});
    await done;
  } catch(error) {
    console.error('Emma TTS playback failed',error);
    setState('error','AIの声でエラーが発生しました',friendlyError(error));
    throw error;
  } finally {
    speaking=false;
    audioQueues.delete(requestId);

    if(shouldRestoreMic && running){
      try {
        await restoreMicrophoneAfterEmmaVoice();
      } catch(error) {
        console.error('Microphone restore failed after Emma voice.',error);
      }
    }
  }

  if(running) setState('listening','AIが聞いています','いつもどおり日本語で赤ちゃんへ話しかけてください。');
  else setState('idle','みつことばはおやすみ中','「3人で話す」を押すと、また会話できます。');
}

function enqueueAudio(m) {
  const q=audioQueues.get(m.requestId);
  if(!q)return;
  q.items.set(m.index,m.blob);
  q.total=Math.max(q.total,m.index+1);
  pumpAudio(m.requestId);
}

async function pumpAudio(requestId) {
  const q=audioQueues.get(requestId);
  if(!q||q.playing)return;
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
    await playBlob(blob);
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
  setState('speaking','AIの声を有効にしてください','画面下の「みつことばの声を有効にする」を一度タップしてください。');
  await new Promise(resolve=>audioUnlockWaiters.push(resolve));
}

async function playBlob(blob) {
  await waitForPlaybackAudio();
  const buffer=await blob.arrayBuffer();
  const decoded=await audioContext.decodeAudioData(buffer.slice(0));
  const source=audioContext.createBufferSource();
  activeAudioSource=source;
  const playbackBuffer=trimAudioSilence(decoded);
  source.buffer=playbackBuffer;
  const gainNode=audioContext.createGain();
  gainNode.gain.value=calculatePlaybackGain(playbackBuffer);
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
  source.start();
  animate();
  await new Promise(resolve=>source.onended=resolve);
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
  for(const frame of ui.aiAvatarFace.querySelectorAll('[data-avatar-frame]')){
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
  const name=getAiName();
  ui.tutorialStepLabel.textContent=`${tutorialStep+1} / 3`;
  ui.tutorialHint.classList.add('hidden');
  ui.tutorialPrimaryButton.classList.add('hidden');
  if(tutorialStep===0){
    ui.tutorialTitle.textContent=`${name}と会おう`;
    ui.tutorialBody.textContent=tutorialIntroPlayed
      ? `${name}の自己紹介が終わりました。明るく表示されている顔が、赤ちゃんへ英語で話しかけます。`
      : `まず${name}の自己紹介を聞きます。Webではブラウザの音声再生制限があるため、下のボタンを一度押してください。`;
    ui.tutorialPrimaryButton.textContent=tutorialIntroPlayed?'次へ':'自己紹介を聞く';
    ui.tutorialPrimaryButton.classList.remove('hidden');
  }else if(tutorialStep===1){
    ui.tutorialTitle.textContent='ここから会話を始めます';
    ui.tutorialBody.textContent='画面下で光っている「3人で話す」を実際に押してください。押すとマイクが始まり、会話を開始します。';
    ui.tutorialHint.textContent='↓ 光っている本物のボタンを押す';
    ui.tutorialHint.classList.remove('hidden');
  }else{
    ui.tutorialTitle.textContent='実際に話しかけてみよう';
    ui.tutorialBody.textContent=`「聞いています」を確認して、普段どおり日本語で赤ちゃんへ話しかけてください。話し終わりを検知したら、画面下で光っている「ここで返事して」を押します。`;
    ui.tutorialHint.textContent='↓ 話したあと「ここで返事して」を押す';
    ui.tutorialHint.classList.remove('hidden');
  }
  if(tutorialStep===0) {
    tutorialTarget()?.scrollIntoView({block:'center',behavior:'auto'});
  }
  scheduleTutorialSpotlightSync();
}
function startTutorial({replay=false}={}){
  tutorialStep=0;
  tutorialIntroPlayed=false;
  tutorialUserSpoke=false;
  if(replay) setState('idle','チュートリアル','使い方を3ステップで確認します。');
  renderTutorial();
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
  avatarVisualState=state;
  ui.avatar.className=`avatar state-${state}`;
  renderAvatarFrame();
  ui.statusTitle.textContent=title;
  ui.statusDetail.textContent=detail;
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
  ui.progressText.textContent=text;
}

function showOnboardingProgress(show,value=0,text='') {
  ui.onboardingProgress.classList.toggle('hidden',!show);
  ui.onboardingProgressBar.style.width=`${Math.max(0,Math.min(100,value))}%`;
  ui.onboardingProgressText.textContent=text;
}

function showConversation(parentText,emmaText) {
  ui.conversation.classList.remove('hidden');
  if(parentText){
    ui.parentBubble.classList.remove('hidden');
    ui.transcript.textContent=parentText;
    if(!emmaText) ui.emmaBubble.classList.add('hidden');
  }
  if(emmaText){
    ui.emmaBubble.classList.remove('hidden');
    ui.reply.textContent=emmaText;
  }
}

function onRuntimeError(message) {
  processing=false;
  speaking=false;
  setBusy(false);
  setState('error','処理中に問題が起きました',message||'もう一度お試しください。');
}

function friendlyError(error) {
  const msg=error?.message||String(error);
  if(error?.name==='NotAllowedError') return 'マイクの使用を許可してください。';
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

function sanitizeAiName(raw) {
  return String(raw||'')
    .replace(/[^A-Za-z' -]/g,'')
    .replace(/\s+/g,' ')
    .slice(0,24);
}

function getAiName() {
  return sanitizeAiName(localStorage.getItem(STORAGE.aiName)||'').trim() || 'Emma';
}

function stripAiSpeakerLabel(text) {
  const clean=String(text||'').trim();
  const name=getAiName();
  const escaped=name.replace(/[.*+?^\${}()|[\]\\]/g,'\\$&');
  const pattern=new RegExp('^\\s*(?:'+escaped+'|AI)\\s*[:：\\-–—]\\s*','i');
  return clean.replace(pattern,'').trim();
}
function updateAiNameUi() {
  const name=getAiName();
  if(ui.aiNamePreview) ui.aiNamePreview.textContent=`初回チュートリアルで「Hi, I'm ${name}.」と自己紹介します。通常会話では毎回名乗りません。`;
  if(ui.aiBubbleLabel) ui.aiBubbleLabel.textContent=name;
  if(ui.aiNameBadge) ui.aiNameBadge.textContent=name;
  if(ui.aiAvatarFace) ui.aiAvatarFace.setAttribute('aria-label',`${name}（みつことば AI）`);
  if(ui.onboardingAiIntro) {
    ui.onboardingAiIntro.innerHTML =
      '<span class="ai-intro-label">AIキャラクター</span>' +
      '<span class="ai-intro-copy">名前は <strong>' + name +
      '</strong>。初回チュートリアルで自己紹介します。</span>';
  }
}

function updateGenderUi() {
  const gender=localStorage.getItem(STORAGE.gender)||'UNSPECIFIED';
  document.querySelectorAll('[data-gender]').forEach(button=>button.classList.toggle('selected',button.dataset.gender===gender));
  ui.genderHelp.textContent=gender==='UNSPECIFIED'
    ? '未指定の場合、AIは名前などから性別を推測しません。'
    : '親へ話す機能を追加した場合も、この設定に合わせて呼び方を選びます。';
}

function updateSpokenNamePreview() {
  const spoken=getSpokenBabyName();
  const base=localStorage.getItem(STORAGE.babyName)||'';
  const message=!base
    ? '名前は未設定です。'
    : spoken
      ? `AIが呼ぶ名前：${spoken}`
      : '必要な場合だけ、英字で読み方を指定してください。';
  ui.spokenNamePreview.textContent=message;
  ui.onboardingSpokenNamePreview.textContent=message;
}

function getSpokenBabyName() {
  const base=toSpokenEnglish(
    localStorage.getItem(STORAGE.babyName)||'',
    localStorage.getItem(STORAGE.spokenName)||''
  );
  const useChan=localStorage.getItem(STORAGE.useChanSuffix)!=='false';
  return withChanSuffix(base,useChan);
}

function getTtsNameHints() {
  const saved=localStorage.getItem(STORAGE.babyName)||'';
  const override=localStorage.getItem(STORAGE.spokenName)||'';
  const base=toSpokenEnglish(saved,override);
  if(!base) return [];
  // Only route names originating from Japanese script through the Japanese-name G2P.
  // Plain ASCII names continue to use CMUDict so English names keep their normal reading.
  const isJapaneseSource=/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(saved);
  return isJapaneseSource ? [base] : [];
}

function getTtsSignature() {
  return 'kitten-nano-fp32-kiki-cmudict-v1';
}

function updateAsrModelStatus() {
  if(!ui.asrModelStatus) return;
  const selected=localStorage.getItem(STORAGE.asrModel)==='tiny' ? 'Tiny' : 'Small';
  ui.asrModelStatus.textContent=`現在：${selected}。モデルはブラウザ内に保存されます。`;
}

function updateRuntimeBackend() {
  if(!asrInfoCache || !ttsInfoCache){
    ui.runtimeBackend.textContent='推論: 未初期化';
    return;
  }
  const asrLabel=asrInfoCache?.architecture==='small_streaming' ? 'Small' : 'Tiny';
  ui.runtimeBackend.textContent=`ASR: Moonshine Japanese ${asrLabel} Streaming / 端末内WASM ・ 音声: Kitten TTS Nano FP32 / Kiki / 端末内`;
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
      const hue=((Date.now()/120000*360)%360+360)%360;
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

function sanitizePlainName(value,max) {
  return String(value||'').replace(/[\n\r\t]/g,'').slice(0,max);
}

function sanitizeSpokenName(value) {
  return String(value||'').replace(/[^\p{L}'’\- ]/gu,'').slice(0,40);
}

function delay(ms){return new Promise(r=>setTimeout(r,ms));}

function withTimeout(promise,ms,message){
  let timer;
  const timeout=new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(new Error(message)),ms);
  });
  return Promise.race([promise,timeout]).finally(()=>clearTimeout(timer));
}

async function ensureMoonshineIsolation() {
  if(window.crossOriginIsolated && typeof SharedArrayBuffer === 'function') {
    sessionStorage.removeItem('emma_coi_reload_count');
    return true;
  }
  if(!('serviceWorker' in navigator)) {
    throw new Error('このブラウザではMoonshineに必要なService Workerを利用できません。');
  }

  const registration=await navigator.serviceWorker.register('./service-worker.js?v=20261004-filled-gradients-r17',{updateViaCache:'none'});
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

  if(window.crossOriginIsolated && typeof SharedArrayBuffer === 'function') return true;

  const reloadCount=Number(sessionStorage.getItem('emma_coi_reload_count')||'0');
  if(reloadCount<2) {
    sessionStorage.setItem('emma_coi_reload_count',String(reloadCount+1));
    location.reload();
    return false;
  }

  throw new Error('Moonshineに必要なブラウザ分離を有効にできませんでした。通常のブラウザタブで開き直してください。');
}

window.addEventListener('load',()=>{
  if('serviceWorker' in navigator) {
    ensureMoonshineIsolation().catch(error=>console.warn('Moonshine isolation setup:',error));
  }
});
