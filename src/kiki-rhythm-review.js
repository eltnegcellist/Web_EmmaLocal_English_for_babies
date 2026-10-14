import manifest from '../tests/kiki-ab-manifest.json' with { type: 'json' };
const $ = (id) => document.getElementById(id);
const cases = manifest.cases;
const reviews = new Map(), cache = new Map();
let worker = null, initializing = null, pending = new Map(), seq = 0, audioUrl = null;
function status(text) { $('status').textContent = text; }
function log(text) { $('log').textContent += text + '\n'; $('log').scrollTop = $('log').scrollHeight; }
function activeCase() { return cases.find(x => x.id === $('case').value) || cases[0]; }
function mode() { return $('keepPunctuation').checked ? 'preserve' : 'legacy'; }
function selectedVariant(version) { return activeCase()[version === 'A' ? 'before' : 'after']; }
function showCase() {
  const c = activeCase(); $('oldText').textContent = c.before; $('newText').textContent = c.after;
  const prior = reviews.get(c.id + ':' + mode()); $('choice').value = prior?.choice || ''; $('note').value = prior?.note || '';
}
for (const c of cases) { const option = document.createElement('option'); option.value = c.id; option.textContent = c.label; $('case').append(option); }
$('case').addEventListener('change', showCase);
$('keepPunctuation').addEventListener('change', showCase);
showCase();

async function initialize() {
 if (initializing) return initializing;
 status('モデルを読み込んでいます…');
 initializing = new Promise((resolve,reject) => {
   worker = new Worker(new URL('./tts-worker.js', import.meta.url), {type:'module'});
   const fail=(error)=>{status('失敗：'+error.message); log(error.message); reject(error);};
   worker.onerror=e => fail(new Error(e.message || 'Worker error'));
   worker.onmessage=e=>{
      const msg=e.data||{};
      if(msg.type==='status') { status(msg.message||'準備中…'); return; }
      if(msg.type==='ready'){status('Kiki準備完了（製品と同じ声・速度）');log('Ready: '+msg.model+' / '+msg.voice);resolve();return;}
      if(msg.type==='error'){
       const job=pending.get(msg.requestId);
       if(job){ pending.delete(msg.requestId);job.reject(new Error(msg.message)); }
       else fail(new Error(msg.message||'TTS init error'));
       return;
      }
      const job=pending.get(msg.requestId);if(!job)return;
      if(msg.type==='audio')job.chunks[msg.index]=msg.blob;
      if(msg.type==='complete'){pending.delete(msg.requestId);try{job.resolve(combineWavs(job.chunks.filter(Boolean)));}catch(error){job.reject(error);}}
   };
   worker.postMessage({type:'init'});
 });
 try{await initializing;$('playA').disabled=false;$('playB').disabled=false;}catch(error){initializing=null;worker?.terminate();worker=null;throw error;}
}
function combineWavs(blobs) {
 if(!blobs.length) throw Error('生成された音声がありません');
 return Promise.all(blobs.map(x=>x.arrayBuffer())).then(buffers=>{
  const base=new DataView(buffers[0]);
  if(base.getUint16(20,true)!==1||base.getUint16(22,true)!==1||base.getUint16(34,true)!==16)throw Error('予期しないWAV形式');
  const rate=base.getUint32(24,true),dataSize=buffers.reduce((s,b)=>s+b.byteLength-44,0);
  const out=new Uint8Array(44+dataSize);out.set(new Uint8Array(buffers[0],0,44),0);
  const view=new DataView(out.buffer);view.setUint32(4,36+dataSize,true);view.setUint32(40,dataSize,true);
  let p=44;
  for(const b of buffers){const header=new DataView(b);if(header.getUint32(24,true)!==rate)throw Error('WAV sample rate mismatch');out.set(new Uint8Array(b,44),p);p+=b.byteLength-44;}
  return new Blob([out],{type:'audio/wav'});
 });
}
async function render(id,version,punctuationMode) {
 await initialize();
 const c=cases.find(x=>x.id===id);
 if(!c)throw Error('Unknown case '+id);
 const key=id+':'+version+':'+punctuationMode;
 if(cache.has(key))return cache.get(key);
 const text=c[version==='A'?'before':'after'],requestId=++seq;
 const job=new Promise((resolve,reject)=>{pending.set(requestId,{resolve,reject,chunks:[]});});
 worker.postMessage({type:'speak',requestId,text,punctuationMode});
 const output=await job;cache.set(key,output);
 log(c.label+' / '+version+' / '+punctuationMode+' / '+Math.round(output.size/1024)+'KiB');
 return output;
}
window.__kikiABReview={render,initialize,cases};
$('load').addEventListener('click',()=>initialize().catch(e=>log(String(e))));
async function play(version) {
 const id=activeCase().id, m=mode();
 for(const el of [$('playA'),$('playB'),$('saveA'),$('saveB')])el.disabled=true;
 try {
  status('Kikiで音声を生成しています…');
  const wav=await render(id,version,m);
  if(audioUrl)URL.revokeObjectURL(audioUrl);
  audioUrl=URL.createObjectURL(wav);
  $('player').src=audioUrl;
  await $('player').play().catch(()=>status('音声を生成しました。プレーヤーの再生ボタンを押してください。'));
  if($('player').paused===false)status('再生中：'+(version==='A'?'旧英文':'新英文'));
 }catch(e){log('ERROR '+String(e));status('エラー：'+e.message);}
 finally{$('playA').disabled=false;$('playB').disabled=false;$('saveA').disabled=false;$('saveB').disabled=false;}
}
$('playA').addEventListener('click',()=>play('A'));$('playB').addEventListener('click',()=>play('B'));
async function save(version) {
 try{const c=activeCase(),wav=await render(c.id,version,mode());const url=URL.createObjectURL(wav),a=document.createElement('a');a.href=url;a.download=c.id+'-'+version+'-'+mode()+'.wav';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){log('ERROR '+e);}
}
$('saveA').addEventListener('click',()=>save('A'));$('saveB').addEventListener('click',()=>save('B'));
$('record').addEventListener('click',()=>{
 const c=activeCase();reviews.set(c.id+':'+mode(),{id:c.id,label:c.label,mode:mode(),choice:$('choice').value,note:$('note').value});
 status('評価を一時保存しました（'+reviews.size+'場面）');
});
$('export').addEventListener('click',()=>{
 const obj={schemaVersion:1,model:manifest.model,voice:manifest.voice,speed:manifest.speed,createdAt:new Date().toISOString(),review:Array.from(reviews.values())};
 const url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='kiki-rhythm-ab-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
