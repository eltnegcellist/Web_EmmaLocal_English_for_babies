import { Transcriber, ModelArch, loadEmmaMoonshineModule } from './moonshine-module.js';
import { EmmaMicrophone } from './audio-capture.js';

const logEl=document.getElementById('log');
const resultEl=document.getElementById('result');
const buttons=[...document.querySelectorAll('button')];

let audioContext=null;
let worker=null;
let transcriber=null;
let mic=null;
let latestUtterance=null;
let captureArmed=false;
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
  const reg=await navigator.serviceWorker.register('./service-worker.js?v=20260925-coexistence-r4',{updateViaCache:'none'});
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
    worker.postMessage({type:'speak',requestId,text:'Hello. This is a voice coexistence test.'});
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

async function generateChunks(label){
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
    worker.postMessage({type:'speak',requestId,text:'Hello. This is a voice coexistence test.'});
  });
  const ready=chunks.filter(Boolean);
  if(!ready.length) throw new Error('No audio chunks received');
  return ready;
}

function calculatePlaybackGain(buffer){
  let peak=0;
  for(let channelIndex=0;channelIndex<buffer.numberOfChannels;channelIndex++){
    const channel=buffer.getChannelData(channelIndex);
    for(let i=0;i<channel.length;i++) peak=Math.max(peak,Math.abs(channel[i]));
  }
  if(!(peak>0)) return 1;
  return Math.max(1,Math.min(1.8,0.92/peak));
}

function trimAudioSilence(buffer){
  const threshold=0.004;
  const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
  let start=0;
  let end=buffer.length;
  const peakAt=index=>{
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

async function appPlaybackTest(label){
  await ensureAudio();
  const chunks=await generateChunks(label);
  for(let i=0;i<chunks.length;i++){
    const blob=chunks[i];
    const bytes=await blob.arrayBuffer();
    const decoded=await audioContext.decodeAudioData(bytes.slice(0));
    const playbackBuffer=trimAudioSilence(decoded);
    const gainValue=calculatePlaybackGain(playbackBuffer);
    log(`${label}: processed`,{
      index:i,
      inputDuration:decoded.duration,
      outputDuration:playbackBuffer.duration,
      gain:gainValue,
      sampleRate:playbackBuffer.sampleRate
    });
    const source=audioContext.createBufferSource();
    const gain=audioContext.createGain();
    const analyser=audioContext.createAnalyser();
    analyser.fftSize=256;
    gain.gain.value=gainValue;
    source.buffer=playbackBuffer;
    source.connect(gain).connect(analyser).connect(audioContext.destination);
    source.start();
    log(`${label}: app-style playback started`,{index:i,state:audioContext.state});
    await new Promise(resolve=>source.onended=resolve);
    log(`${label}: app-style playback ended`,{index:i});
  }
  setResult(`${label}: 本体と同じ再生経路で成功`);
  log(`${label}: success`,memoryInfo());
}

async function startMic(){
  if(mic) return;
  mic=new EmmaMicrophone({
    onState:state=>log('Mic state',state),
    onUtterance:audio=>{
      if(!captureArmed) return;
      latestUtterance=audio.slice();
      captureArmed=false;
      log('Utterance captured',{samples:latestUtterance.length,seconds:latestUtterance.length/16000});
      setResult('1発話を取得しました。続けて「12. ASR推論→TTS再生」を押してください。');
    },
    shouldIgnore:()=>!captureArmed
  });
  await mic.start();
  log('Microphone started',{
    contextState:mic.context?.state,
    sampleRate:mic.context?.sampleRate,
    tracks:mic.stream?.getAudioTracks?.().map(t=>({label:t.label,enabled:t.enabled,readyState:t.readyState}))
  });
  setResult('マイクを開始しました。8/9のTTSテスト、または11で1発話を録音できます。');
}

async function stopMic(){
  if(!mic) return;
  await mic.stop();
  mic=null;
  log('Microphone stopped');
  setResult('マイクを停止しました。');
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

async function transcribeThenSpeak(){
  if(!transcriber) throw new Error('先にTinyまたはSmallをロードしてください。');
  if(!latestUtterance?.length) throw new Error('先に「11. 1発話を録音」で日本語を話してください。');

  log('ASR inference start',{samples:latestUtterance.length,memory:memoryInfo()});
  const started=performance.now();
  const result=transcriber.transcribe(latestUtterance,{sampleRate:16000});
  const elapsed=Math.round(performance.now()-started);
  const text=Array.isArray(result?.lines)
    ? result.lines.map(line=>String(line?.text||'').trim()).filter(Boolean).join(' ').replace(/\s+/g,' ').trim()
    : '';
  log('ASR inference complete',{elapsedMs:elapsed,text,memory:memoryInfo()});

  if(!text) throw new Error('ASR結果が空でした。もう一度録音してください。');

  await appPlaybackTest('TTS after real ASR inference');
  setResult(`ASR推論→TTS再生まで成功: ${text}`);
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
document.getElementById('resetTts').addEventListener('click',()=>{
  try{worker?.terminate();}catch{}
  worker=null;
  log('TTS Worker terminated',memoryInfo());
  setResult('TTS Workerを終了しました。ASRはそのままです。');
});
document.getElementById('ttsFreshAfterAsr').addEventListener('click',async()=>{
  try{
    await ensureAudio();
    await initTtsWorker();
    await ttsTest('Fresh TTS after ASR');
  }catch(e){
    log('ERROR fresh TTS after ASR',e.message);
    setResult(e.message,false);
  }
});
document.getElementById('startMic').addEventListener('click',async()=>{
  try{await startMic();}catch(e){log('ERROR mic start',e.message);setResult(e.message,false);}
});
document.getElementById('ttsWithMic').addEventListener('click',async()=>{
  try{await ttsTest('TTS with mic ON');}catch(e){log('ERROR TTS with mic',e.message);setResult(e.message,false);}
});
document.getElementById('appPlaybackWithMic').addEventListener('click',async()=>{
  try{await appPlaybackTest('App playback with mic ON');}catch(e){log('ERROR app playback with mic',e.message);setResult(e.message,false);}
});
document.getElementById('stopMic').addEventListener('click',async()=>{
  try{await stopMic();}catch(e){log('ERROR mic stop',e.message);setResult(e.message,false);}
});

document.getElementById('captureUtterance').addEventListener('click',async()=>{
  try{
    if(!mic) await startMic();
    latestUtterance=null;
    captureArmed=true;
    mic?.resetDetector?.();
    log('Utterance capture armed');
    setResult('録音待ちです。普通に日本語で1文話して、その後黙ってください。');
  }catch(e){
    log('ERROR capture arm',e.message);
    setResult(e.message,false);
  }
});
document.getElementById('transcribeThenSpeak').addEventListener('click',async()=>{
  try{await transcribeThenSpeak();}catch(e){log('ERROR ASR inference -> TTS',e.message);setResult(e.message,false);}
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
