import { EmmaMicrophone } from './audio-capture.js';
import { LiteResponseEngine } from './lite-response-engine.js';
import { toSpokenEnglish, withChanSuffix } from './name-pronunciation.js';

const $ = (id) => document.getElementById(id);
const ui = {
  onboardingScreen:$('onboardingScreen'), homeScreen:$('homeScreen'), settingsScreen:$('settingsScreen'), aboutScreen:$('aboutScreen'),
  onboardingBabyName:$('onboardingBabyName'), onboardingSpokenBabyName:$('onboardingSpokenBabyName'),
  onboardingUseChanSuffix:$('onboardingUseChanSuffix'), onboardingSpokenNamePreview:$('onboardingSpokenNamePreview'),
  prepareEmmaButton:$('prepareEmmaButton'),
  onboardingProgress:$('onboardingProgress'), onboardingProgressBar:$('onboardingProgressBar'), onboardingProgressText:$('onboardingProgressText'),
  avatar:$('avatar'), statusTitle:$('statusTitle'), statusDetail:$('statusDetail'), busySpinner:$('busySpinner'),
  progressWrap:$('progressWrap'), progressBar:$('progressBar'), progressText:$('progressText'),
  conversation:$('conversation'), parentBubble:$('parentBubble'), emmaBubble:$('emmaBubble'), transcript:$('transcript'), reply:$('reply'),
  mainButton:$('mainButton'), stopButton:$('stopButton'), manualReplyButton:$('manualReplyButton'),
  autoRespond:$('autoRespond'), aboutButton:$('aboutButton'), settingsButton:$('settingsButton'),
  parentAudienceButton:$('parentAudienceButton'), settingsBackButton:$('settingsBackButton'), settingsAboutButton:$('settingsAboutButton'),
  aboutBackButton:$('aboutBackButton'), onboardingAboutButton:$('onboardingAboutButton'),
  babyName:$('babyName'), spokenBabyName:$('spokenBabyName'), useChanSuffix:$('useChanSuffix'), genderHelp:$('genderHelp'),
  pronunciationToggle:$('pronunciationToggle'), pronunciationPanel:$('pronunciationPanel'), spokenNamePreview:$('spokenNamePreview'),
  colorMode:$('colorMode'), vividPalette:$('vividPalette'), vividPaletteRow:$('vividPaletteRow'), colorModeDescription:$('colorModeDescription'),
  keepAwake:$('keepAwake'), runtimeBackend:$('runtimeBackend'), fullModeButton:$('fullModeButton'),
  debugInput:$('debugInput'), debugReplyButton:$('debugReplyButton'),
  noticeDialog:$('noticeDialog'), noticeTitle:$('noticeTitle'), noticeBody:$('noticeBody'), noticeLink:$('noticeLink'), noticeCloseButton:$('noticeCloseButton')
};

const CURRENT_SETUP_REVISION = 'moonshine-tiny-kitten-kiki-v8';

const STORAGE = {
  setupRevision:'emma_web_setup_revision',
  babyName:'emma_baby_name',
  spokenName:'emma_baby_spoken_name',
  gender:'emma_baby_gender',
  colorMode:'emma_color_mode',
  vivid:'emma_vivid_palette',
  keepAwake:'emma_keep_awake',
  autoRespond:'emma_auto_respond',
  useChanSuffix:'emma_use_chan_suffix'
};

if (!localStorage.getItem(STORAGE.babyName) && localStorage.getItem('emmaBabyName')) {
  localStorage.setItem(STORAGE.babyName, localStorage.getItem('emmaBabyName'));
}
if (new URLSearchParams(location.search).has('debug')) document.body.classList.add('debug');

const engine = new LiteResponseEngine();
const MOONSHINE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@moonshine-ai/moonshine-wasm@0.1.5/dist/index.js';
const MOONSHINE_MODEL_BASE = 'https://download.moonshine.ai/model/tiny-streaming-ja/quantized_26_08_23/';
const MOONSHINE_MODEL_FILES = [
  'adapter.ort',
  'cross_kv.ort',
  'decoder_kv.ort',
  'encoder.ort',
  'frontend.model.ort',
  'frontend.weights.ort',
  'streaming_config.json',
  'tokenizer.bin'
];
let moonshineTranscriber, moonshineModule, ttsWorker, mic, wakeLock;
let moonshineStage='idle';
let asrInfoCache=null, ttsInfoCache=null, ttsWorkerSignature='';
let running=false, workersReady=false, processing=false, speaking=false;
let requestSeq=0;
let audioContext=null;
let activeAudioSource=null;
let pendingUtterance=null;
let previousScreen='home';
let appearanceTimer=null;
const audioQueues = new Map();

initUi();

function initUi() {
  const babyName = localStorage.getItem(STORAGE.babyName) || '';
  ui.babyName.value = babyName;
  ui.onboardingBabyName.value = babyName;
  const spokenName = localStorage.getItem(STORAGE.spokenName) || '';
  ui.spokenBabyName.value = spokenName;
  ui.onboardingSpokenBabyName.value = spokenName;
  ui.colorMode.value = localStorage.getItem(STORAGE.colorMode) || 'color_shift';
  ui.vividPalette.value = localStorage.getItem(STORAGE.vivid) || 'sunshine';
  ui.keepAwake.checked = localStorage.getItem(STORAGE.keepAwake) !== 'false';
  ui.autoRespond.checked = localStorage.getItem(STORAGE.autoRespond) !== 'false';
  const useChanSuffix = localStorage.getItem(STORAGE.useChanSuffix) !== 'false';
  ui.useChanSuffix.checked = useChanSuffix;
  ui.onboardingUseChanSuffix.checked = useChanSuffix;

  bindEvents();
  updateGenderUi();
  updateSpokenNamePreview();
  applyAppearance();
  updateAppearanceSettings();

  if (localStorage.getItem(STORAGE.setupRevision) === CURRENT_SETUP_REVISION) showScreen('home');
  else showScreen('onboarding');
}

function bindEvents() {
  ui.mainButton.addEventListener('click', startEmma);
  ui.stopButton.addEventListener('click', stopEmma);
  ui.manualReplyButton.addEventListener('click', respondToPendingUtterance);
  ui.prepareEmmaButton.addEventListener('click', prepareFirstRun);

  ui.aboutButton.addEventListener('click',()=>openAbout('home'));
  ui.settingsAboutButton.addEventListener('click',()=>openAbout('settings'));
  ui.onboardingAboutButton.addEventListener('click',()=>openAbout('onboarding'));
  ui.aboutBackButton.addEventListener('click',()=>showScreen(previousScreen));
  ui.settingsBackButton.addEventListener('click',()=>showScreen('home'));
  ui.settingsButton.addEventListener('click',async()=>{
    if (running || speaking || processing) await stopEmma();
    showScreen('settings');
  });

  ui.parentAudienceButton.addEventListener('click',()=>showNotice(
    '親へ話すモード',
    'Web版はEmma Liteのみで、「赤ちゃんへ」に対応しています。Android版には Lite / Standard / Full があり、親との会話やより柔軟な応答はStandard / Fullで利用できます。',
    'https://github.com/eltnegcellist/Android_English_character_for_baby',
    'Android版EmmaをGitHubで見る'
  ));
  ui.fullModeButton.addEventListener('click',()=>showNotice(
    'Emma Full',
    'Web版はEmma Liteのみです。Android版には Lite / Standard / Full の3つがあり、Standard / FullはAndroid版で利用できます。',
    'https://github.com/eltnegcellist/Android_English_character_for_baby',
    'Android版EmmaをGitHubで見る'
  ));
  ui.noticeCloseButton.addEventListener('click',closeNotice);
  ui.noticeDialog.addEventListener('click',(event)=>{
    if(event.target===ui.noticeDialog) closeNotice();
  });
  document.addEventListener('keydown',(event)=>{
    if(event.key==='Escape'&&!ui.noticeDialog.classList.contains('hidden')) closeNotice();
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
  ui.autoRespond.addEventListener('change',()=>{
    localStorage.setItem(STORAGE.autoRespond,String(ui.autoRespond.checked));
    if (ui.autoRespond.checked && pendingUtterance && !processing && !speaking) respondToPendingUtterance();
  });

  ui.debugReplyButton.addEventListener('click',async()=>{
    const text=ui.debugInput.value.trim();
    if(!text)return;
    showConversation(text,'');
    const response=engine.respond(text,getSpokenBabyName());
    showConversation(text,response.english);
    await ensureWorkersForDebug();
    await speakResponse(response.english);
  });

  document.addEventListener('visibilitychange',async()=>{
    if(running && document.visibilityState==='visible' && ui.keepAwake.checked) await requestWakeLock();
  });
}

function showScreen(name) {
  for (const key of ['onboarding','home','settings','about']) {
    ui[key+'Screen'].classList.toggle('hidden',key!==name);
  }
  window.scrollTo({top:0,behavior:'auto'});
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

async function clearObsoleteModelCaches() {
  if(typeof caches==='undefined') return;
  const obsoletePatterns=[
    'onnx-community/whisper-tiny',
    'onnx-community/Supertonic-TTS-ONNX',
    '/small-streaming-ja/',
    '/voices/F3.bin',
    'KittenML__kitten-tts-nano-0.8__'
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
  showOnboardingProgress(true,0,'Emmaを準備しています…');
  try {
    if(!(await ensureMoonshineIsolation())) return;
    await navigator.storage?.persist?.().catch(()=>false);
    await clearObsoleteModelCaches();
    await initWorkers();
    await initAudioContext();
    localStorage.setItem(STORAGE.setupRevision,CURRENT_SETUP_REVISION);
    showOnboardingProgress(false);
    showProgress(false);
    setBusy(false);
    showScreen('home');
    setState('idle','準備できました','「Emmaと話す」を押すと会話を始められます。');
  } catch(error) {
    console.error(error);
    showOnboardingProgress(true,0,friendlyError(error));
    ui.prepareEmmaButton.disabled=false;
  }
}

async function startEmma() {
  ui.mainButton.disabled=true;
  try {
    if(!(await ensureMoonshineIsolation())) return;
    setState('thinking','Emmaを準備しています','初回はMoonshineと音声モデルの読み込みに時間がかかることがあります。');
    setBusy(true);
    showProgress(true,0,'Moonshineを準備しています…');
    await navigator.storage?.persist?.().catch(()=>false);
    await initWorkers();
    await initAudioContext();

    running=true;
    await startMoonshineCapture();

    ui.mainButton.classList.add('hidden');
    ui.stopButton.classList.remove('hidden');
    setBusy(false);
    showProgress(false);
    if(ui.keepAwake.checked) await requestWakeLock();
    setState('listening','Emmaが聞いています','いつもどおり日本語で赤ちゃんへ話しかけてください。');
  } catch(error) {
    console.error(error);
    running=false;
    await mic?.stop().catch(()=>{});
    mic=null;
    setBusy(false);
    showProgress(false);
    setState('error','開始できませんでした',friendlyError(error));
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
  setState('idle','Emmaはおやすみ中','「Emmaと話す」を押すと、また会話できます。');
}

function handleCapturedUtterance(audio) {
  if(!running||processing||speaking)return;
  if(ui.autoRespond.checked) transcribeUtterance(audio);
  else {
    pendingUtterance={kind:'audio',audio};
    ui.manualReplyButton.classList.remove('hidden');
    setState('understood','話し終わりを検出しました','「今返事して」を押すとEmmaが返事します。');
  }
}

function respondToPendingUtterance() {
  if(!pendingUtterance||processing||speaking)return;
  const pending=pendingUtterance;
  pendingUtterance=null;
  ui.manualReplyButton.classList.add('hidden');
  if(pending.kind==='audio') transcribeUtterance(pending.audio);
}

async function startMoonshineCapture() {
  if(mic) return;
  mic=new EmmaMicrophone({
    onState:(state)=>{
      if(processing||speaking)return;
      if(state==='endpoint') setState('endpoint','聞いています…','話し終わるまで、そのまま話してください。');
      else setState('listening','Emmaが聞いています','いつもどおり日本語で赤ちゃんへ話しかけてください。');
    },
    onUtterance:handleCapturedUtterance,
    shouldIgnore:()=>processing||speaking
  });
  await mic.start();
}

async function initWorkers() {
  const signature=getTtsSignature();

  // Moonshine is initialized first. Its threaded WASM/ONNX runtime has the
  // stricter startup requirements, so reserve its memory before Kitten TTS.
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
      ttsWorker=new Worker(new URL('./tts-worker.js?v=20260923-moonshine-direct-2',import.meta.url),{type:'module'});
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
  const { Transcriber, ModelArch }=moonshineModule;
  if(typeof Transcriber?.load!=='function' || typeof Transcriber?.loadFromUrls!=='function') {
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
    showMoonshineProgress(
      progress,
      `Moonshine 日本語 Tinyを取得しています… ${sizeText}${fileName ? `（${fileName}）` : ''}`
    );
  };
  const common={
    modelArch:ModelArch.TinyStreaming,
    options:{max_tokens_per_second:'13.0'},
    onProgress
  };

  let nextTranscriber;
  try {
    moonshineStage='catalog';
    nextTranscriber=await Transcriber.load({
      language:'ja',
      ...common
    });
  } catch(firstError) {
    console.warn('Moonshine catalog load failed; retrying with direct model URLs.',firstError);
    moonshineStage='direct-download';
    showMoonshineProgress(1,'Moonshineのモデル一覧取得を迂回して再試行しています…');
    const files=Object.fromEntries(
      MOONSHINE_MODEL_FILES.map(name=>[name,MOONSHINE_MODEL_BASE+name])
    );
    try {
      nextTranscriber=await Transcriber.loadFromUrls(files,common);
    } catch(secondError) {
      moonshineStage='model-build';
      secondError.moonshineFirstError=firstError;
      throw secondError;
    }
  }

  moonshineStage='ready';
  moonshineTranscriber?.close?.();
  moonshineTranscriber=nextTranscriber;
  showMoonshineProgress(100,'Moonshine 日本語音声認識を準備できました');

  return {
    kind:'moonshine',
    engine:'moonshine',
    model:'tiny-streaming-ja',
    architecture:'tiny_streaming',
    license:'MIT',
    device:'wasm-cpu',
    worker:'none-batch-transcriber'
  };
}

function showMoonshineProgress(progress,message) {
  showProgress(true,progress,message);
  showOnboardingProgress(true,progress,message);
}

async function ensureWorkersForDebug() {
  setBusy(true);
  showProgress(true,0,'Emmaの声を準備しています…');
  await initWorkers();
  setBusy(false);
  showProgress(false);
}

function handleTtsMessage(event,readyResolve,readyReject) {
  const m=event.data;
  if(m.type==='status') {
    showProgress(true,m.progress??0,m.message||'Emmaの声を準備しています…');
    showOnboardingProgress(true,m.progress??0,m.message||'Emmaの声を準備しています…');
  } else if(m.type==='ready') readyResolve?.(m);
  else if(m.type==='error') {
    readyReject?.(new Error(m.message));
    if(m.requestId){
      const q=audioQueues.get(m.requestId);
      if(q){q.resolve?.();audioQueues.delete(m.requestId);}
    }
    if(workersReady) onRuntimeError(m.message);
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
  if(!clean){
    processing=false;
    setBusy(false);
    setState('listening','Emmaが聞いています','うまく聞き取れませんでした。もう一度そのまま話してください。');
    return;
  }
  showConversation(clean,'');
  setState('understood','わかりました','Emmaが赤ちゃんへ話しかけます。');
  const response=engine.respond(clean,getSpokenBabyName());
  showConversation(clean,response.english);
  processing=false;
  setBusy(false);
  await speakResponse(response.english);
}

async function speakResponse(text) {
  if(!ttsWorker) throw new Error('Emmaの声がまだ準備されていません');
  speaking=true;
  const requestId=++requestSeq;
  audioQueues.set(requestId,{items:new Map(),next:0,total:0,playing:false,generationDone:false,resolve:null});
  const done=new Promise(resolve=>audioQueues.get(requestId).resolve=resolve);
  setState('speaking','Emmaがお話ししています',text);
  try {
    ttsWorker.postMessage({type:'speak',requestId,text});
    await done;
  } finally {
    speaking=false;
  }
  if(running) setState('listening','Emmaが聞いています','いつもどおり日本語で赤ちゃんへ話しかけてください。');
  else setState('idle','Emmaはおやすみ中','「Emmaと話す」を押すと、また会話できます。');
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
  try{await playBlob(blob);}catch(e){console.error(e);}
  q.next++;
  q.playing=false;
  pumpAudio(requestId);
}

async function initAudioContext() {
  if(!audioContext||audioContext.state==='closed') audioContext=new AudioContext({latencyHint:'interactive'});
  if(audioContext.state==='suspended') await audioContext.resume();
}

async function playBlob(blob) {
  await initAudioContext();
  const buffer=await blob.arrayBuffer();
  const decoded=await audioContext.decodeAudioData(buffer.slice(0));
  const source=audioContext.createBufferSource();
  activeAudioSource=source;
  source.buffer=trimAudioSilence(decoded);
  const analyser=audioContext.createAnalyser();
  analyser.fftSize=256;
  source.connect(analyser).connect(audioContext.destination);
  const data=new Uint8Array(analyser.frequencyBinCount);
  let raf;
  const animate=()=>{
    analyser.getByteTimeDomainData(data);
    let sum=0;
    for(const x of data){const v=(x-128)/128;sum+=v*v;}
    const rms=Math.sqrt(sum/data.length);
    const level=rms<0.025 ? 0 : rms<0.075 ? 0.55 : 1;
    ui.avatar.style.setProperty('--mouth-scale',String(level));
    ui.avatar.classList.toggle('mouth-wide',level>.5);
    raf=requestAnimationFrame(animate);
  };
  source.start();
  animate();
  await new Promise(resolve=>source.onended=resolve);
  if(activeAudioSource===source) activeAudioSource=null;
  cancelAnimationFrame(raf);
  ui.avatar.style.setProperty('--mouth-scale','0');
  ui.avatar.classList.remove('mouth-wide');
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
  ui.avatar.className=`avatar state-${state}`;
  ui.statusTitle.textContent=title;
  ui.statusDetail.textContent=detail;
  ui.statusTitle.className=`status-chip status-${state}`;
}

function setBusy(value) {
  ui.busySpinner.classList.toggle('hidden',!value);
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
      'direct-download':'モデル直接取得',
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

function updateGenderUi() {
  const gender=localStorage.getItem(STORAGE.gender)||'UNSPECIFIED';
  document.querySelectorAll('[data-gender]').forEach(button=>button.classList.toggle('selected',button.dataset.gender===gender));
  ui.genderHelp.textContent=gender==='UNSPECIFIED'
    ? '未指定の場合、Emmaは名前などから性別を推測しません。'
    : '親へ話す機能を追加した場合も、この設定に合わせて呼び方を選びます。';
}

function updateSpokenNamePreview() {
  const spoken=getSpokenBabyName();
  const base=localStorage.getItem(STORAGE.babyName)||'';
  const message=!base
    ? '名前は未設定です。'
    : spoken
      ? `Emmaが呼ぶ名前：${spoken}`
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

function getTtsSignature() {
  return 'kitten-nano-fp32-kiki-browser-wasm';
}

function updateRuntimeBackend() {
  if(!asrInfoCache || !ttsInfoCache){
    ui.runtimeBackend.textContent='推論: 未初期化';
    return;
  }
  ui.runtimeBackend.textContent='ASR: Moonshine Japanese Tiny Streaming / 端末内WASM ・ 音声: Kitten TTS Nano Kiki / 端末内';
}

function updateAppearanceSettings() {
  const mode=ui.colorMode.value;
  ui.vividPaletteRow.classList.toggle('hidden',mode!=='vivid');
  const descriptions={
    soft:'今までのEmmaの淡い配色です。',
    vivid:'原色寄りの複数色で、顔のコントラストを強くします。',
    mono_red:'白い顔、黒い目と輪郭、赤いアクセントの固定配色です。',
    color_shift:'会話状態とは無関係に、時間経過で配色がゆっくり変わります。'
  };
  ui.colorModeDescription.textContent=descriptions[mode]||'';
}

function applyAppearance() {
  if(appearanceTimer){clearInterval(appearanceTimer);appearanceTimer=null;}
  const mode=localStorage.getItem(STORAGE.colorMode)||ui.colorMode.value||'color_shift';
  const vivid=localStorage.getItem(STORAGE.vivid)||ui.vividPalette.value||'sunshine';
  ui.colorMode.value=mode;
  ui.vividPalette.value=vivid;
  if(mode==='color_shift'){
    const update=()=>{
      const hue=((Date.now()/120000*360)%360+360)%360;
      setPalette({
        face:`hsl(${hue} 88% 67%)`,
        accent:`hsl(${(hue+155)%360} 92% 46%)`,
        dark:'#121019',
        blush:`hsl(${(hue+292)%360} 95% 58%)`,
        mouth:'#82173a',
        tongue:'#ff9fb7'
      });
    };
    update();
    appearanceTimer=setInterval(update,500);
    return;
  }
  const palettes={
    soft:{face:'#f0e7ff',accent:'#7653b8',dark:'#302940',blush:'#ff8faa',mouth:'#af4269',tongue:'#ffb0c2'},
    mono_red:{face:'#ffffff',accent:'#e00000',dark:'#080808',blush:'#e00000',mouth:'#080808',tongue:'#e00000'},
    sunshine:{face:'#ffd600',accent:'#1e5bff',dark:'#101010',blush:'#ff3b30',mouth:'#8f153b',tongue:'#ff8ca7'},
    ocean:{face:'#2d7fff',accent:'#ffd600',dark:'#0b1733',blush:'#ff4081',mouth:'#7a1639',tongue:'#ff9ab5'},
    candy:{face:'#ff4fa3',accent:'#00c853',dark:'#1e1020',blush:'#ffd600',mouth:'#8a1746',tongue:'#ffb0c5'},
    forest:{face:'#00c853',accent:'#7c4dff',dark:'#102418',blush:'#ff3b30',mouth:'#76152f',tongue:'#ff9dae'}
  };
  setPalette(mode==='vivid'?palettes[vivid]:palettes[mode]);
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

async function ensureMoonshineIsolation() {
  if(window.crossOriginIsolated && typeof SharedArrayBuffer === 'function') {
    sessionStorage.removeItem('emma_coi_reload_count');
    return true;
  }
  if(!('serviceWorker' in navigator)) {
    throw new Error('このブラウザではMoonshineに必要なService Workerを利用できません。');
  }

  const registration=await navigator.serviceWorker.register('./service-worker.js?v=20260923-moonshine-direct-2',{updateViaCache:'none'});
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

if('serviceWorker' in navigator) {
  window.addEventListener('load',()=>{
    ensureMoonshineIsolation().catch(error=>console.warn('Moonshine isolation setup:',error));
  });
}
