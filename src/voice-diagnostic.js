import {PrerecordedVoiceBank} from './prerecorded-voice.js?v=20261014-r2';
const logEl=document.getElementById('log');
const resultEl=document.getElementById('result');
const testButton=document.getElementById('test');
const clearButton=document.getElementById('clear');
const cachedButton=document.getElementById('cached');

let audioContext=null;
let worker=null;
let seq=0;

function log(message,data){
  const time=new Date().toLocaleTimeString();
  const suffix=data===undefined?'':` ${typeof data==='string'?data:JSON.stringify(data)}`;
  logEl.textContent+=`[${time}] ${message}${suffix}\n`;
  logEl.scrollTop=logEl.scrollHeight;
}

function fail(message,error){
  const detail=error?.message||String(error||'');
  log('ERROR: '+message,detail);
  if(error?.stack)log('Diagnostic stack',error.stack);
  resultEl.className='bad';
  resultEl.textContent=`失敗: ${message}${detail?' / '+detail:''}`;
}

async function ensureAudio(){
  if(!audioContext||audioContext.state==='closed'){
    audioContext=new AudioContext({latencyHint:'interactive'});
    log('AudioContext created',{state:audioContext.state,sampleRate:audioContext.sampleRate});
  }
  if(audioContext.state==='suspended'){
    log('AudioContext resume requested');
    await audioContext.resume();
  }
  log('AudioContext state',{state:audioContext.state});
  if(audioContext.state!=='running') throw new Error('AudioContext is '+audioContext.state);
}

function initWorker(){
  if(worker) worker.terminate();
  worker=new Worker(new URL('./tts-worker.js?v=20261014-qwen3-voice1202-r2',import.meta.url),{type:'module'});
  log('TTS Worker created');
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Worker init timeout after 120s')),120000);
    worker.onerror=(event)=>{
      clearTimeout(timeout);
      reject(event.error||new Error(event.message||'Worker error'));
    };
    worker.onmessageerror=()=>{
      clearTimeout(timeout);
      reject(new Error('Worker message error'));
    };
    worker.onmessage=(event)=>{
      const m=event.data||{};
      if(m.type==='status'){
        log('TTS status',{progress:m.progress,message:m.message});
      }else if(m.type==='ready'){
        clearTimeout(timeout);
        log('TTS ready',m);
        resolve();
      }else if(m.type==='error'){
        clearTimeout(timeout);
        reject(new Error(m.message||'TTS init error'));
      }
    };
    worker.postMessage({type:'init'});
  });
}

async function runSpeak(){
  const requestId=++seq;
  const chunks=[];
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Speech generation timeout after 120s')),120000);
    worker.onmessage=(event)=>{
      const m=event.data||{};
      if(m.type==='status'){
        log('TTS status',{progress:m.progress,message:m.message});
      }else if(m.type==='audio'&&m.requestId===requestId){
        chunks[m.index]=m.blob;
        log('Audio chunk received',{index:m.index,size:m.blob?.size,type:m.blob?.type});
      }else if(m.type==='complete'&&m.requestId===requestId){
        clearTimeout(timeout);
        log('TTS complete',{total:m.total,chunks:chunks.filter(Boolean).length});
        resolve(chunks.filter(Boolean));
      }else if(m.type==='error'&&m.requestId===requestId){
        clearTimeout(timeout);
        reject(new Error(m.message||'TTS generation error'));
      }
    };
    worker.postMessage({type:'speak',requestId,text:"Hi, I'm Emma. Hello, little one!"});
    log('Speak request sent',{requestId});
  });
}

async function playBlob(blob,index){
  log('Decode start',{index,size:blob.size,type:blob.type});
  const bytes=await blob.arrayBuffer();
  const decoded=await audioContext.decodeAudioData(bytes.slice(0));
  log('Decode success',{index,duration:decoded.duration,sampleRate:decoded.sampleRate,channels:decoded.numberOfChannels});
  const source=audioContext.createBufferSource();
  const gain=audioContext.createGain();
  gain.gain.value=1;
  source.buffer=decoded;
  source.connect(gain).connect(audioContext.destination);
  source.start();
  log('Playback started',{index,audioContextState:audioContext.state});
  await new Promise(resolve=>source.onended=resolve);
  log('Playback ended',{index});
}

testButton.addEventListener('click',async()=>{
  testButton.disabled=true;
  resultEl.className='';
  resultEl.textContent='診断中…';
  log('=== diagnostic start ===');
  try{
    await ensureAudio();
    await initWorker();
    const chunks=await runSpeak();
    if(!chunks.length) throw new Error('TTS completed without audio chunks');
    for(let i=0;i<chunks.length;i++) await playBlob(chunks[i],i);
    resultEl.className='ok';
    resultEl.textContent='成功: 採用音声の読込・AACデコード・再生まで完了しました。';
    log('=== diagnostic success ===');
  }catch(error){
    fail('音声診断',error);
  }finally{
    testButton.disabled=false;
  }
});

clearButton.addEventListener('click',()=>{
  logEl.textContent='';
  resultEl.textContent='';
  resultEl.className='';
});

cachedButton.addEventListener('click',async()=>{
  cachedButton.disabled=true;
  testButton.disabled=true;
  resultEl.textContent='保存音声を確認中…';
  try{
    await ensureAudio();
    const bank=new PrerecordedVoiceBank({fetcher:async()=>{throw new Error('Cache-only diagnostic: network disabled');}});
    const manifest=await bank.init();
    const blob=await bank.audioFor("Hi, I'm Emma. Hello, little one!");
    if(!blob)throw new Error('試聴用音源が保存されていません。');
    log('Cache-only verified',{clips:manifest.entries.length,generationSeed:manifest.generationSeed,networkRequests:0});
    await playBlob(blob,0);
    resultEl.className='ok';
    resultEl.textContent='成功: 通信を使わず、保存音源の検証・AACデコード・再生まで完了しました。';
  }catch(error){fail('保存音声の診断（先に通常テストで音源を保存してください）',error);}
  finally{cachedButton.disabled=false;testButton.disabled=false;}
});
