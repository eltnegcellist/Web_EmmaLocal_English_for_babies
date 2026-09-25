import { Transcriber, ModelArch, loadEmmaMoonshineModule } from './moonshine-module.js';

const logEl=document.getElementById('log');
const resultEl=document.getElementById('result');
const buttons=[...document.querySelectorAll('button')];

let audioContext=null;
let worker=null;
let transcriber=null;
let seq=0;

function log(message,data){
  const time=new Date().toLocaleTimeString();
  const suffix=data===undefined?'':` ${typeof data==='string'?data:JSON.stringify(data)}`;
  logEl.textContent+=`[${time}] ${message}${suffix}\n`;
  logEl.scrollTop=logEl.scrollHeight;
}

function setResult(message,ok=true){
  resultEl.className=ok?'ok':'bad';
  resultEl.textContent=message;
}

function memoryInfo(){
  const m=performance.memory;
  if(!m) return null;
  return {
    usedMB:Math.round(m.usedJSHeapSize/1048576),
    totalMB:Math.round(m.totalJSHeapSize/1048576),
    limitMB:Math.round(m.jsHeapSizeLimit/1048576)
  };
}

async function ensureIsolation(){
  log('Isolation check',{crossOriginIsolated:window.crossOriginIsolated,sharedArrayBuffer:typeof SharedArrayBuffer});
  if(window.crossOriginIsolated && typeof SharedArrayBuffer==='function') return;
  if(!('serviceWorker' in navigator)) throw new Error('Service Worker unavailable');
  const reg=await navigator.serviceWorker.register('./service-worker.js?v=20260925-coexistence-r1',{updateViaCache:'none'});
  await reg.update().catch(()=>{});
  log('Service Worker updated; reload may be required');
  if(!window.crossOriginIsolated){
    location.reload();
    await new Promise(()=>{});
  }
}

async function ensureAudio(){
  if(!audioContext||audioContext.state==='closed'){
    audioContext=new AudioContext({latencyHint:'interactive'});
    log('AudioContext created',{state:audioContext.state,sampleRate:audioContext.sampleRate});
  }
  if(audioContext.state==='suspended') await audioContext.resume();
  log('AudioContext state',{state:audioContext.state});
  if(audioContext.state!=='running') throw new Error('AudioContext is '+audioContext.state);
}

async function initTtsWorker(){
  if(worker) return;
  worker=new Worker(new URL('./tts-worker.js?v=20260925-stable-tts-r1',import.meta.url),{type:'module'});
  log('TTS Worker created',memoryInfo());
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('TTS init timeout')),120000);
    worker.onerror=e=>{clearTimeout(timer);reject(e.error||new Error(e.message||'Worker error'));};
    worker.onmessage=e=>{
      const m=e.data||{};
      if(m.type==='status') log('TTS status',{progress:m.progress,message:m.message});
      else if(m.type==='ready'){clearTimeout(timer);log('TTS ready',m);resolve();}
      else if(m.type==='error'){clearTimeout(timer);reject(new Error(m.message||'TTS error'));}
    };
    worker.postMessage({type:'init'});
  });
}

async function ttsTest(label){
  await ensureAudio();
  await initTtsWorker();
  const requestId=++seq;
  const chunks=[];
  log(`${label}: speak request`,{requestId,memory:memoryInfo()});
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('TTS generation timeout')),120000);
    worker.onmessage=e=>{
      const m=e.data||{};
      if(m.type==='status') log('TTS status',{progress:m.progress,message:m.message});
      else if(m.type==='audio'&&m.requestId===requestId){
        chunks[m.index]=m.blob;
        log(`${label}: audio chunk`,{index:m.index,size:m.blob?.size});
      }else if(m.type==='complete'&&m.requestId===requestId){
        clearTimeout(timer); resolve();
      }else if(m.type==='error'&&m.requestId===requestId){
        clearTimeout(timer); reject(new Error(m.message||'TTS generation error'));
      }
    };
    worker.postMessage({type:'speak',requestId,text:'Hello. Emma voice coexistence test.'});
  });
  if(!chunks.filter(Boolean).length) throw new Error('No audio chunks received');
  for(let i=0;i<chunks.length;i++){
    const blob=chunks[i];
    if(!blob) continue;
    const bytes=await blob.arrayBuffer();
    const decoded=await audioContext.decodeAudioData(bytes.slice(0));
    log(`${label}: decoded`,{index:i,duration:decoded.duration,sampleRate:decoded.sampleRate});
    const source=audioContext.createBufferSource();
    source.buffer=decoded;
    source.connect(audioContext.destination);
    source.start();
    log(`${label}: playback started`,{index:i,state:audioContext.state});
    await new Promise(resolve=>source.onended=resolve);
    log(`${label}: playback ended`,{index:i});
  }
  setResult(`${label}: TTS生成・再生成功`);
  log(`${label}: success`,memoryInfo());
}

async function loadAsr(kind){
  if(transcriber){
    transcriber.close();
    transcriber=null;
    log('Previous ASR closed',memoryInfo());
  }
  const arch=kind==='small'?ModelArch.SmallStreaming:ModelArch.TinyStreaming;
  log(`Moonshine ${kind} load start`,memoryInfo());
  const module=await loadEmmaMoonshineModule();
  log('Moonshine WASM runtime ready',memoryInfo());
  transcriber=await Transcriber.load({
    module,
    language:'ja',
    modelArch:arch,
    includeSpelling:false,
    options:{identify_speakers:'false',keyterm_boost:'1.25'},
    onProgress:(loaded,total,file)=>{
      const pct=total>0?Math.round(loaded/total*100):0;
      if(pct===100 || pct%20===0) log(`Moonshine ${kind} download`,{pct,file:String(file||'').split('/').pop()});
    }
  });
  log(`Moonshine ${kind} ready`,memoryInfo());
  setResult(`Moonshine ${kind}ロード成功。続けて「3. ASRロード後にTTSテスト」を押してください。`);
}

document.getElementById('ttsBefore').addEventListener('click',async()=>{
  try{await ttsTest('TTS before ASR');}catch(e){log('ERROR TTS before ASR',e.message);setResult(e.message,false);}
});
document.getElementById('loadTiny').addEventListener('click',async()=>{
  try{await loadAsr('tiny');}catch(e){log('ERROR Tiny load',e.message);setResult(e.message,false);}
});
document.getElementById('loadSmall').addEventListener('click',async()=>{
  try{await loadAsr('small');}catch(e){log('ERROR Small load',e.message);setResult(e.message,false);}
});
document.getElementById('ttsAfter').addEventListener('click',async()=>{
  try{await ttsTest('TTS after ASR');}catch(e){log('ERROR TTS after ASR',e.message);setResult(e.message,false);}
});
document.getElementById('closeAsr').addEventListener('click',()=>{
  try{transcriber?.close();}catch{}
  transcriber=null;
  log('ASR closed',memoryInfo());
  setResult('ASRを閉じました。');
});
document.getElementById('clear').addEventListener('click',()=>{logEl.textContent='';resultEl.textContent='';});

await ensureIsolation();
log('Diagnostic ready',memoryInfo());
