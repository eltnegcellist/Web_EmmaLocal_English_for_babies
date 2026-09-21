import { EmmaMicrophone } from './audio-capture.js';
import { LiteResponseEngine, splitSentences } from './lite-response-engine.js';

const $ = (id) => document.getElementById(id);
const ui = {
  avatar:$('avatar'), statusTitle:$('statusTitle'), statusDetail:$('statusDetail'), progressWrap:$('progressWrap'),
  progressBar:$('progressBar'), progressText:$('progressText'), transcript:$('transcript'), reply:$('reply'),
  mainButton:$('mainButton'), stopButton:$('stopButton'), babyName:$('babyName'), keepAwake:$('keepAwake'),
  runtimeBackend:$('runtimeBackend'), aboutButton:$('aboutButton'), aboutDialog:$('aboutDialog'), closeAbout:$('closeAbout'),
  debugInput:$('debugInput'), debugReplyButton:$('debugReplyButton')
};

if (new URLSearchParams(location.search).has('debug')) document.body.classList.add('debug');
ui.babyName.value = localStorage.getItem('emmaBabyName') || '';
ui.babyName.addEventListener('input',()=>localStorage.setItem('emmaBabyName',ui.babyName.value));
ui.aboutButton.addEventListener('click',()=>ui.aboutDialog.showModal());
ui.closeAbout.addEventListener('click',()=>ui.aboutDialog.close());

const engine = new LiteResponseEngine();
let asrWorker, ttsWorker, mic, wakeLock;
let running=false, ready=false, processing=false, speaking=false;
let requestSeq=0;
let audioContext=null;
const audioQueues = new Map();

ui.mainButton.addEventListener('click', startEmma);
ui.stopButton.addEventListener('click', stopEmma);
ui.debugReplyButton.addEventListener('click', async()=>{
  const text=ui.debugInput.value.trim(); if(!text)return;
  ui.transcript.textContent=text;
  const response=engine.respond(text,ui.babyName.value);
  ui.reply.textContent=response.english;
  await speakResponse(response.english);
});

document.addEventListener('visibilitychange', async()=>{
  if (running && document.visibilityState==='visible' && ui.keepAwake.checked) await requestWakeLock();
});

async function startEmma() {
  ui.mainButton.disabled=true;
  try {
    setState('thinking','初回準備をしています','モデルは一度取得するとブラウザ内に保存されます。');
    showProgress(true,0,'モデルを準備しています…');
    await navigator.storage?.persist?.().catch(()=>false);
    await initWorkers();
    await initAudioContext();
    mic = new EmmaMicrophone({
      onState:(state)=>{ if(!processing&&!speaking) state==='endpoint'?setState('endpoint','聞いています…','話し終わるまで、そのまま話してください。'):setState('listening','Emmaが聞いています','いつもどおり日本語で赤ちゃんへ話しかけてください。'); },
      onUtterance: transcribeUtterance,
      shouldIgnore:()=>processing||speaking
    });
    await mic.start();
    running=true;
    ready=true;
    ui.mainButton.classList.add('hidden');
    ui.stopButton.classList.remove('hidden');
    showProgress(false);
    if(ui.keepAwake.checked) await requestWakeLock();
    setState('listening','Emmaが聞いています','いつもどおり日本語で赤ちゃんへ話しかけてください。');
  } catch (error) {
    console.error(error);
    setState('error','開始できませんでした',friendlyError(error));
    showProgress(false);
    ui.mainButton.disabled=false;
  }
}

async function stopEmma(){
  running=false; processing=false; speaking=false;
  await mic?.stop().catch(()=>{}); mic=null;
  wakeLock?.release?.().catch(()=>{}); wakeLock=null;
  ui.stopButton.classList.add('hidden'); ui.mainButton.classList.remove('hidden'); ui.mainButton.disabled=false;
  setState('idle','Emmaはおやすみ中','「Emmaを始める」を押すと、また会話できます。');
}

async function initWorkers(){
  if (ready) return;
  const asrReady = new Promise((resolve,reject)=>{
    asrWorker=new Worker(new URL('./asr-worker.js',import.meta.url),{type:'module'});
    asrWorker.onmessage=(event)=>handleAsrMessage(event,resolve,reject);
    asrWorker.onerror=reject;
  });
  const ttsReady = new Promise((resolve,reject)=>{
    ttsWorker=new Worker(new URL('./tts-worker.js',import.meta.url),{type:'module'});
    ttsWorker.onmessage=(event)=>handleTtsMessage(event,resolve,reject);
    ttsWorker.onerror=reject;
  });
  asrWorker.postMessage({type:'init',preferWebGpu:false});
  ttsWorker.postMessage({type:'init'});
  const [asrInfo,ttsInfo]=await Promise.all([asrReady,ttsReady]);
  ui.runtimeBackend.textContent=`推論: Whisper ${asrInfo.device} / Kokoro ${ttsInfo.device}`;
}

function handleAsrMessage(event,readyResolve,readyReject){
  const m=event.data;
  if(m.type==='status') showProgress(true,m.progress ?? 0,m.message || 'Whisperを準備しています…');
  else if(m.type==='ready') readyResolve?.(m);
  else if(m.type==='error'){ readyReject?.(new Error(m.message)); if(ready) onRuntimeError(m.message); }
  else if(m.type==='transcript') onTranscript(m);
}
function handleTtsMessage(event,readyResolve,readyReject){
  const m=event.data;
  if(m.type==='status') showProgress(true,m.progress ?? 0,m.message || 'Emmaの声を準備しています…');
  else if(m.type==='ready') readyResolve?.(m);
  else if(m.type==='error'){
    readyReject?.(new Error(m.message));
    if(m.requestId){
      const q=audioQueues.get(m.requestId);
      if(q){q.resolve?.();audioQueues.delete(m.requestId);}
    }
    if(ready) onRuntimeError(m.message);
  }
  else if(m.type==='audio') enqueueAudio(m);
  else if(m.type==='complete'){ const q=audioQueues.get(m.requestId); if(q){q.generationDone=true;pumpAudio(m.requestId);} }
}

function transcribeUtterance(audio){
  if(!running||processing||speaking)return;
  processing=true;
  setState('thinking','聞き取っています…','音声はこのブラウザ内のWhisperで処理しています。');
  const id=++requestSeq;
  asrWorker.postMessage({type:'transcribe',id,audio:audio.buffer},[audio.buffer]);
}
async function onTranscript({text}){
  const clean=(text||'').replace(/\s+/g,' ').trim();
  if(!clean){processing=false;setState('listening','Emmaが聞いています','うまく聞き取れませんでした。もう一度そのまま話してください。');return;}
  ui.transcript.textContent=clean;
  setState('understood','わかりました','Emmaが赤ちゃんへ話しかけます。');
  const response=engine.respond(clean,ui.babyName.value);
  ui.reply.textContent=response.english;
  processing=false;
  await speakResponse(response.english);
}

async function speakResponse(text){
  if(!ttsWorker) throw new Error('Emmaの声がまだ準備されていません');
  speaking=true;
  const requestId=++requestSeq;
  audioQueues.set(requestId,{items:new Map(),next:0,total:0,playing:false,generationDone:false,resolve:null});
  const done=new Promise(resolve=>audioQueues.get(requestId).resolve=resolve);
  setState('speaking','Emmaがお話ししています',text);
  const sentences=splitSentences(text).slice(0,7);
  ttsWorker.postMessage({type:'speak',requestId,sentences});
  await done;
  speaking=false;
  if(running)setState('listening','Emmaが聞いています','いつもどおり日本語で赤ちゃんへ話しかけてください。');
  else setState('idle','Emmaはおやすみ中','「Emmaを始める」を押すと、また会話できます。');
}

function enqueueAudio(m){
  const q=audioQueues.get(m.requestId); if(!q)return;
  q.items.set(m.index,m.blob); q.total=m.total; pumpAudio(m.requestId);
}
async function pumpAudio(requestId){
  const q=audioQueues.get(requestId); if(!q||q.playing)return;
  const blob=q.items.get(q.next);
  if(!blob){
    if(q.generationDone && q.next>=q.total){ q.resolve?.(); audioQueues.delete(requestId); }
    return;
  }
  q.playing=true; q.items.delete(q.next);
  try{ await playBlob(blob); }catch(e){console.error(e)}
  q.next++; q.playing=false;
  if(q.next<q.total) await delay(780);
  pumpAudio(requestId);
}

async function initAudioContext(){ if(!audioContext||audioContext.state==='closed') audioContext=new AudioContext({latencyHint:'interactive'}); if(audioContext.state==='suspended') await audioContext.resume(); }
async function playBlob(blob){
  await initAudioContext();
  const buffer=await blob.arrayBuffer();
  const decoded=await audioContext.decodeAudioData(buffer.slice(0));
  const source=audioContext.createBufferSource(); source.buffer=decoded;
  const analyser=audioContext.createAnalyser(); analyser.fftSize=256;
  source.connect(analyser).connect(audioContext.destination);
  const data=new Uint8Array(analyser.frequencyBinCount);
  let raf;
  const animate=()=>{ analyser.getByteTimeDomainData(data); let sum=0; for(const x of data){const v=(x-128)/128;sum+=v*v;} const rms=Math.sqrt(sum/data.length); ui.avatar.style.setProperty('--mouth',`${Math.max(16,Math.min(43,16+rms*150))}px`); raf=requestAnimationFrame(animate); };
  source.start(); animate();
  await new Promise(resolve=>source.onended=resolve);
  cancelAnimationFrame(raf); ui.avatar.style.setProperty('--mouth','18px');
}

function setState(state,title,detail){
  ui.avatar.className=`avatar state-${state}`; ui.statusTitle.textContent=title; ui.statusDetail.textContent=detail;
}
function showProgress(show,value=0,text=''){
  ui.progressWrap.classList.toggle('hidden',!show); ui.progressWrap.setAttribute('aria-hidden',String(!show)); ui.progressBar.style.width=`${Math.max(0,Math.min(100,value))}%`; ui.progressText.textContent=text;
}
function onRuntimeError(message){ processing=false;speaking=false;setState('error','処理中に問題が起きました',message || 'もう一度お試しください。'); }
function friendlyError(error){
  const msg=error?.message||String(error);
  if(error?.name==='NotAllowedError') return 'マイクの使用を許可してください。';
  if(!window.isSecureContext) return 'マイクを使うにはHTTPSで開く必要があります。';
  return msg;
}
async function requestWakeLock(){
  if(!('wakeLock' in navigator)||document.visibilityState!=='visible')return;
  try{wakeLock=await navigator.wakeLock.request('screen');}catch{}
}
function delay(ms){return new Promise(r=>setTimeout(r,ms));}

if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
