const logEl=document.getElementById('log');
const resultEl=document.getElementById('result');
const testButton=document.getElementById('test');
const clearButton=document.getElementById('clear');

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
  worker=new Worker(new URL('./tts-worker.js?v=20260925-stable-tts-r1',import.meta.url),{type:'module'});
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
    worker.postMessage({type:'speak',requestId,text:'Hello. Can you hear my voice?'});
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
    resultEl.textContent='成功: Kitten TTS生成・WAVデコード・再生まで完了しました。';
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
