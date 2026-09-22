import { EmmaMicrophone } from './audio-capture.js';
import { LiteResponseEngine } from './lite-response-engine.js';
import { toSpokenEnglish, withChanSuffix } from './name-pronunciation.js';

const $ = (id) => document.getElementById(id);
const ui = {
  onboardingScreen:$('onboardingScreen'), homeScreen:$('homeScreen'), settingsScreen:$('settingsScreen'), aboutScreen:$('aboutScreen'),
  onboardingBabyName:$('onboardingBabyName'), prepareEmmaButton:$('prepareEmmaButton'),
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

const STORAGE = {
  onboarded:'emma_web_onboarded_v2',
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
let asrWorker, ttsWorker, mic, wakeLock;
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
  ui.spokenBabyName.value = localStorage.getItem(STORAGE.spokenName) || '';
  ui.colorMode.value = localStorage.getItem(STORAGE.colorMode) || 'color_shift';
  ui.vividPalette.value = localStorage.getItem(STORAGE.vivid) || 'sunshine';
  ui.keepAwake.checked = localStorage.getItem(STORAGE.keepAwake) !== 'false';
  ui.autoRespond.checked = localStorage.getItem(STORAGE.autoRespond) !== 'false';
  ui.useChanSuffix.checked = localStorage.getItem(STORAGE.useChanSuffix) !== 'false';

  bindEvents();
  updateGenderUi();
  updateSpokenNamePreview();
  applyAppearance();
  updateAppearanceSettings();

  if (localStorage.getItem(STORAGE.onboarded) === 'true') showScreen('home');
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
    '「親へ」はEmma Fullの機能です。現在のWeb版は「赤ちゃんへ」の標準Emmaに対応しています。Full版はAndroid版Emmaで利用できます。',
    'https://github.com/eltnegcellist/Android_English_character_for_baby',
    'Android版EmmaをGitHubで見る'
  ));
  ui.fullModeButton.addEventListener('click',()=>showNotice(
    'Emma Full',
    'Web版Fullは今後対応予定です。現在Full版を試す場合はAndroid版Emmaを利用できます。',
    'https://github.com/eltnegcellist/Android_English_character_for_baby',
    'Android版EmmaをGitHubで見る'
  ));
  ui.noticeCloseButton.addEventListener('click',()=>ui.noticeDialog.close());

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
    const value=String(ui.spokenBabyName.value).replace(/[^\p{L}'’\- ]/gu,'').slice(0,40);
    ui.spokenBabyName.value=value;
    localStorage.setItem(STORAGE.spokenName,value);
    updateSpokenNamePreview();
  });
  ui.useChanSuffix.addEventListener('change',()=>{
    localStorage.setItem(STORAGE.useChanSuffix,String(ui.useChanSuffix.checked));
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
  ui.noticeDialog.showModal();
}

async function prepareFirstRun() {
  ui.prepareEmmaButton.disabled=true;
  showOnboardingProgress(true,0,'Emmaを準備しています…');
  try {
    await navigator.storage?.persist?.().catch(()=>false);
    await initWorkers();
    await initAudioContext();
    localStorage.setItem(STORAGE.onboarded,'true');
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
    setState('thinking','Emmaを準備しています','初回はモデルの読み込みに時間がかかることがあります。');
    setBusy(true);
    showProgress(true,0,'モデルを準備しています…');
    await navigator.storage?.persist?.().catch(()=>false);
    await initWorkers();
    await initAudioContext();

    mic = new EmmaMicrophone({
      onState:(state)=>{
        if(processing||speaking)return;
        if(state==='endpoint') setState('endpoint','聞いています…','話し終わるまで、そのまま話してください。');
        else setState('listening','Emmaが聞いています','いつもどおり日本語で赤ちゃんへ話しかけてください。');
      },
      onUtterance:handleCapturedUtterance,
      shouldIgnore:()=>processing||speaking
    });
    await mic.start();
    running=true;
    ui.mainButton.classList.add('hidden');
    ui.stopButton.classList.remove('hidden');
    setBusy(false);
    showProgress(false);
    if(ui.keepAwake.checked) await requestWakeLock();
    setState('listening','Emmaが聞いています','いつもどおり日本語で赤ちゃんへ話しかけてください。');
  } catch(error) {
    console.error(error);
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
    pendingUtterance=audio;
    ui.manualReplyButton.classList.remove('hidden');
    setState('understood','話し終わりを検出しました','「今返事して」を押すとEmmaが返事します。');
  }
}

function respondToPendingUtterance() {
  if(!pendingUtterance||processing||speaking)return;
  const audio=pendingUtterance;
  pendingUtterance=null;
  ui.manualReplyButton.classList.add('hidden');
  transcribeUtterance(audio);
}

async function initWorkers() {
  if(workersReady)return;
  const asrReady=new Promise((resolve,reject)=>{
    asrWorker=new Worker(new URL('./asr-worker.js',import.meta.url),{type:'module'});
    asrWorker.onmessage=(event)=>handleAsrMessage(event,resolve,reject);
    asrWorker.onerror=reject;
  });
  const ttsReady=new Promise((resolve,reject)=>{
    ttsWorker=new Worker(new URL('./tts-worker.js',import.meta.url),{type:'module'});
    ttsWorker.onmessage=(event)=>handleTtsMessage(event,resolve,reject);
    ttsWorker.onerror=reject;
  });
  asrWorker.postMessage({type:'init',preferWebGpu:false});
  ttsWorker.postMessage({type:'init'});
  const [asrInfo,ttsInfo]=await Promise.all([asrReady,ttsReady]);
  workersReady=true;
  ui.runtimeBackend.textContent=`推論: Whisper ${asrInfo.device} / Kokoro ${ttsInfo.device}`;
}

async function ensureWorkersForDebug() {
  if(workersReady)return;
  setBusy(true);
  showProgress(true,0,'Emmaの声を準備しています…');
  await initWorkers();
  setBusy(false);
  showProgress(false);
}

function handleAsrMessage(event,readyResolve,readyReject) {
  const m=event.data;
  if(m.type==='status') {
    showProgress(true,m.progress??0,m.message||'Whisperを準備しています…');
    showOnboardingProgress(true,m.progress??0,m.message||'Whisperを準備しています…');
  } else if(m.type==='ready') readyResolve?.(m);
  else if(m.type==='error') {
    readyReject?.(new Error(m.message));
    if(workersReady) onRuntimeError(m.message);
  } else if(m.type==='transcript') onTranscript(m);
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

function transcribeUtterance(audio) {
  if(!running||processing||speaking)return;
  processing=true;
  setBusy(true);
  setState('thinking','聞き取っています…','音声はこのブラウザ内のWhisperで処理しています。');
  const id=++requestSeq;
  asrWorker.postMessage({type:'transcribe',id,audio:audio.buffer},[audio.buffer]);
}

async function onTranscript({text}) {
  const clean=(text||'').replace(/\s+/g,' ').trim();
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
  ttsWorker.postMessage({type:'speak',requestId,text});
  await done;
  speaking=false;
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
  return msg;
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
  ui.spokenNamePreview.textContent=!base
    ? '名前は未設定です。'
    : spoken
      ? `Emmaが呼ぶ名前：${spoken}`
      : '必要な場合だけ、英字で読み方を指定してください。';
}

function getSpokenBabyName() {
  const base=toSpokenEnglish(
    localStorage.getItem(STORAGE.babyName)||'',
    localStorage.getItem(STORAGE.spokenName)||''
  );
  const useChan=localStorage.getItem(STORAGE.useChanSuffix)!=='false';
  return withChanSuffix(base,useChan);
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

function delay(ms){return new Promise(r=>setTimeout(r,ms));}

if('serviceWorker' in navigator) {
  window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
}
