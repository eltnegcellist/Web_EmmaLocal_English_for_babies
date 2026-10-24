/* S25 same-audio ASR benchmark. No analytics, speech uploads or production writes. */
const $=id=>document.getElementById(id);
const encoderText=s=>String(s||'').trim();
const MODEL_URL='https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz';
const labels={vosk:'Vosk Small',moonshine:'Moonshine Small Streaming',whisper:'Whisper Small q8'};
let samples=null,loadedEngine=null,loadedBackend=null,loading=false,running=false;
let loadMs=null,sequence=0,lastWorker=null;
const results={};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function withTimeout(promise,ms,label){
 let timer;
 try{
  return await Promise.race([promise,new Promise((_,reject)=>{
   timer=setTimeout(()=>reject(Error(label+'が'+Math.round(ms/1000)+'秒以内に完了しませんでした。ページを閉じて再試行してください。')),ms);
  })]);
 }finally{clearTimeout(timer);}
}
function notify(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function state(){
 const busy=loading||running;
 $('audioFile').disabled=busy;$('duration').disabled=busy;$('repeats').disabled=busy;$('engine').disabled=busy;
 $('load').disabled=busy||!samples;
 $('run').disabled=busy||!samples||loadedEngine!==$('engine').value;
 $('copy').disabled=!Object.keys(results).length;
 $('run').textContent=$('repeats').value+'回、同じ音声を認識';
}
const round=n=>Math.round(n*100)/100;
function percentile(values,p){
 const a=[...values].sort((x,y)=>x-y);
 const x=(a.length-1)*p,lo=Math.floor(x),hi=Math.ceil(x);
 return a[lo]+(a[hi]-a[lo])*(x-lo);
}
async function enableIsolation(){
 if(crossOriginIsolated&&typeof SharedArrayBuffer==='function'){
   $('isolation').className='success';
   $('isolation').textContent='ブラウザ分離：有効（Moonshineのスレッド利用可）';
   return;
 }
 const attempts=Number(sessionStorage.getItem('coi-benchmark-reloads')||0);
 try{
   if(!('serviceWorker' in navigator))throw Error('Service Worker未対応');
   $('isolation').textContent='ブラウザ分離を初期化しています（失敗してもVoskは使用可能）。';
   const registration=await Promise.race([
     navigator.serviceWorker.register('./coi-service-worker.js',{scope:'./',updateViaCache:'none'}),
     new Promise((_,reject)=>setTimeout(()=>reject(Error('Service Workerの登録が10秒で完了しませんでした')),10000))
   ]);
   await Promise.race([
     navigator.serviceWorker.ready,
     new Promise((_,reject)=>setTimeout(()=>reject(Error('Service Workerが8秒で有効になりませんでした')),8000))
   ]);
   if(attempts<2){
     sessionStorage.setItem('coi-benchmark-reloads',String(attempts+1));
     if(!navigator.serviceWorker.controller){
       await new Promise(resolve=>{const t=setTimeout(resolve,7000);
         navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(t);resolve();},{once:true});});
     }
     location.reload();return;
   }
   $('isolation').textContent='ブラウザ分離：無効。Voskの測定は可能ですが、Moonshineの実行が失敗する可能性があります。';
   $('isolation').className='warn';
 }catch(e){
   $('isolation').textContent='分離環境を有効化できません：'+encoderText(e?.message||e)+'。Voskの測定を試せます。';
   $('isolation').className='warn';
 }
}
function resetResults(){for(const key of Object.keys(results))delete results[key];render();}
function resampleTo16k(buffer){
 const channels=buffer.numberOfChannels, length=buffer.length;
 const out=new Float32Array(length);
 for(let ch=0;ch<channels;ch++){
   const data=buffer.getChannelData(ch);
   for(let i=0;i<length;i++)out[i]+=data[i]/channels;
 }
 return out;
}
async function loadAudio(file){
 if(!file||file.size>42*1024*1024){notify('42MB以下の音声ファイルを選択してください。',true);return;}
 const ctx=new (window.AudioContext||window.webkitAudioContext)();
 try{
   const decoded=await ctx.decodeAudioData(await file.arrayBuffer());
   const target=16000,frames=Math.max(1,Math.ceil(decoded.duration*target));
   const mono=resampleTo16k(decoded);
   const source=ctx.createBuffer(1,mono.length,decoded.sampleRate);
   source.copyToChannel(mono,0);
   const render=new OfflineAudioContext(1,frames,target);
   const node=render.createBufferSource();node.buffer=source;
   node.connect(render.destination);node.start(0);
   const output=await render.startRendering();
   samples=new Float32Array(output.getChannelData(0));
   if(samples.some(x=>!Number.isFinite(x)))throw Error('入力音声に無効な数値があります');
   resetResults();
   $('audioInfo').textContent=file.name+' / '+round(samples.length/target)+'秒、16kHzモノラルに変換済み';
   notify('音声準備完了。モデルを選択して読み込んでください。');
 }catch(e){samples=null;notify('音声を読み込めません：'+(e?.message||e),true);}
 finally{await ctx.close();state();}
}
function extractPCM(){
 const seconds=Number($('duration').value);
 const count=Math.min(samples.length,Math.round(seconds*16000));
 const buf=new Float32Array(count+Math.round(.8*16000));
 buf.set(samples.subarray(0,count));
 return {pcm:buf,audioSeconds:buf.length/16000,speechSeconds:count/16000,
         windowSeconds:seconds};
}
async function closeBackend(){
 if(loadedBackend?.kind==='vosk'){
   try{loadedBackend.model.terminate()}catch(_){}
 }else if(loadedBackend?.kind==='moonshine-main'){
   try{loadedBackend.transcriber.close()}catch(_){}
 }else if(loadedBackend?.kind==='worker')loadedBackend.worker.terminate();
 loadedBackend=null;loadedEngine=null;loadMs=null;
}
function makeWorkerBackend(url){
 const worker=new Worker(new URL(url,import.meta.url),{type:'module'});
 const pending=new Map();
 const rejectAll=e=>{for(const {reject,timer} of pending.values()){clearTimeout(timer);reject(e)}pending.clear()};
 worker.onerror=e=>{
   const where=e?.filename?(' '+e.filename+':'+(e.lineno||'?')+':'+(e.colno||'?')):'';
   const cause=e?.error?.stack||e?.error?.message||e?.message||'Worker module failed before initialization';
   rejectAll(Error('Benchmark Worker startup error: '+cause+where));
 };
 worker.onmessageerror=e=>rejectAll(Error('Benchmark Worker message could not be decoded: '+(e?.message||'messageerror')));
 worker.onmessage=({data})=>{
   if(data.type==='stage'){if(loading)notify('モデル準備：'+String(data.stage||'読み込み中'));return;}
   if(data.type==='progress'){if(loading&&data.total>0)notify('モデル取得中 '+Math.round(100*data.loaded/data.total)+'%');return;}
   const task=pending.get(data.id);if(!task)return;
   clearTimeout(task.timer);pending.delete(data.id);
   data.type==='error'?task.reject(Error(data.message||'Worker error')):task.resolve(data);
 };
 let seq=0;
 return {
   kind:'worker',worker,
   request(type,fields={},timeout=600000,transfers=[]){
     const id=++seq;
     return new Promise((resolve,reject)=>{
       const timer=setTimeout(()=>{pending.delete(id);reject(Error(type+' のタイムアウト'))},timeout);
       pending.set(id,{resolve,reject,timer});
       worker.postMessage({id,type,...fields},transfers);
     });
   },
   terminate(){rejectAll(Error('Model changed'));worker.terminate()}
 };
}
function recognizeVosk(buffer){
 return new Promise((resolve,reject)=>{
   const recognizer=new loadedBackend.model.KaldiRecognizer(16000);
   console.info('S25 Vosk recognizer methods',{id:recognizer.id,finalizer:typeof recognizer.retrieveFinalResult});
   let settled=false;
   const timeout=setTimeout(()=>finish(Error('Vosk final recognition timeout')),120000);
   let text='';
   const start=performance.now();
   function finish(err){
     if(settled)return;settled=true;clearTimeout(timeout);
     const ms=performance.now()-start;
     try{recognizer.remove()}catch(_){}
     if(err)reject(err);
     else resolve({ms,text,kind:'final',internalMs:null});
   }
   recognizer.on('error',e=>finish(Error(encoderText(e?.error||'Vosk recognizer error'))));
   recognizer.on('result',msg=>{
     console.info('S25 Vosk final result event',{id:msg?.recognizerId,expected:recognizer.id,text:msg?.result?.text});
     // Crucial fix: reject a late callback from a different recognizer;
     // unlike v1, partialresult is NEVER considered the ASR completion.
     if(msg?.recognizerId&&msg.recognizerId!==recognizer.id)return;
     const part=encoderText(msg?.result?.text);
     if(part)text=[text,part].filter(Boolean).join(' ');
     finish();
   });
   recognizer.on('partialresult',msg=>{
     console.info('S25 Vosk partial event ignored',msg?.result?.partial?.slice(0,90));
   });
   try{
     const ab=new AudioBuffer({length:buffer.length,numberOfChannels:1,sampleRate:16000});
     ab.copyToChannel(buffer,0);
     recognizer.acceptWaveform(ab);
     // Request an explicit final flush; do not score intermediate partials.
     if(typeof recognizer.retrieveFinalResult!=='function')
       throw Error('The installed vosk-browser lacks retrieveFinalResult(); upgrade required');
     recognizer.retrieveFinalResult();
   }catch(e){finish(e)}
 });
}
async function loadSelected(){
 if(loading||running||!samples)return;
 loading=true;state();
 const engine=$('engine').value;
 try{
   await closeBackend();
   notify(labels[engine]+'を読み込んでいます（ダウンロードと初期化は計測から除外）。');
   const started=performance.now();
   if(engine==='vosk'){
     if(!globalThis.Vosk?.createModel)throw Error('Voskブラウザライブラリの読み込みに失敗しました');
     const model=await Vosk.createModel(MODEL_URL);
     loadedBackend={kind:'vosk',model};
   }else if(engine==='moonshine'){
     if(!crossOriginIsolated || typeof SharedArrayBuffer!=='function')
       throw Error('Moonshineにはブラウザ分離が必要です。分離環境表示を確認してください。');
     // The Moonshine WASM runtime creates its own pthread Workers. Unlike the
     // failing nested benchmark worker, run its host in the page context.
     // Only this research page changes; production ASR is untouched.
     notify('Moonshine: モジュール読み込み');
     const {ModelArch,Transcriber,loadEmmaMoonshineModule}=
       await import('../../src/moonshine-module.js');
     notify('Moonshine: WASM取得・展開・スレッド初期化（90秒以内に完了しなければエラー）');
     const module=await withTimeout(loadEmmaMoonshineModule(),90000,'Moonshine WASM初期化');
     notify('Moonshine: Small Streamingモデルを準備中');
     const transcriber=await withTimeout(Transcriber.load({
       module,language:'en',modelArch:ModelArch.SmallStreaming,
       options:{vad_threshold:'0',vad_max_segment_duration:'1000',max_tokens_per_second:'13.0'},
       onProgress:(loaded,total)=>{
         if(loading&&total>0)notify('Moonshine: モデル取得 '+Math.round(100*loaded/total)+'%');
       },
     }),480000,'Moonshineモデル読み込み');
     loadedBackend={kind:'moonshine-main',transcriber};
   }else{
     const worker=makeWorkerBackend('./whisper-bench-worker.js');
     loadedBackend=worker;
     const probe=await worker.request('ping',{},20000);
     if(!probe.ready)throw Error('Worker handshake failed');
     await worker.request('init',{language:'en'},900000);
   }
   loadMs=performance.now()-started;loadedEngine=engine;
   notify(labels[engine]+' 準備完了：読み込み '+round(loadMs)+' ms。測定を開始できます。');
 }catch(e){await closeBackend();notify('読み込みエラー：'+(e?.message||e),true);}
 finally{loading=false;state();}
}
async function recognizeWorker(pcm){
 const start=performance.now();
 if(loadedBackend?.kind==='moonshine-main'){
   const result=loadedBackend.transcriber.transcribe(pcm,{sampleRate:16000});
   const ms=performance.now()-start;
   const text=Array.isArray(result?.lines)
     ?result.lines.map(line=>encoderText(line?.text)).filter(Boolean).join(' '):'';
   return {ms,internalMs:ms,text,kind:'final'};
 }
 const buffer=pcm.slice().buffer;
 const response=await loadedBackend.request('run',{audio:buffer,language:'en'},900000,[buffer]);
 return {ms:performance.now()-start,internalMs:response.internalMs??null,
     text:encoderText(response.text),kind:'final'};
}
async function run(){
 if(running||loading||!samples||loadedEngine!==$('engine').value)return;
 running=true;state();
 const engine=loadedEngine,info=extractPCM(),repeats=Number($('repeats').value);
 const times=[],predictions=[];
 try{
   for(let i=0;i<repeats;i++){
     notify(labels[engine]+'：同じ音声を認識 '+(i+1)+' / '+repeats);
     const sample=engine==='vosk'?await recognizeVosk(info.pcm):await recognizeWorker(info.pcm);
     if(!(sample.ms>0&&sample.ms<900000))throw Error('認識処理時間が無効です');
     times.push(sample.ms);
     predictions.push({turn:i+1,elapsedMs:round(sample.ms),
       engineInternalMs:sample.internalMs==null?null:round(sample.internalMs),
       text:sample.text,kind:sample.kind});
     await sleep(80);
   }
   results[engine]={
     name:labels[engine],engine,loadMs:round(loadMs),
     p50Ms:round(percentile(times,.5)),p95Ms:round(percentile(times,.95)),
     rtfP50:round(percentile(times,.5)/(1000*info.audioSeconds)),
     firstMs:round(times[0]),audioSeconds:round(info.audioSeconds),
     speechSeconds:round(info.speechSeconds),windowSeconds:info.windowSeconds,
     iterations:predictions,threads:navigator.hardwareConcurrency,
     architecture:engine==='whisper'?'Whisper Small q8 WASM':engine==='moonshine'?'Moonshine Small Streaming MIT':'Vosk Small English WASM'
   };
   render();
   notify(labels[engine]+' 完了。p50 '+results[engine].p50Ms+'ms、p95 '+results[engine].p95Ms+
      'ms、RTF '+results[engine].rtfP50+'。次のモデルを選んで読み込んでください。');
 }catch(e){notify('測定エラー：'+(e?.message||e),true);}
 finally{running=false;state();}
}
function render(){
 const entries=Object.values(results);
 $('rows').replaceChildren();
 if(!entries.length){
   const row=document.createElement('tr');const c=document.createElement('td');c.colSpan=5;c.textContent='未測定';
   row.append(c);$('rows').append(row);$('transcripts').textContent='未測定';state();return;
 }
 for(const x of entries){
   const row=document.createElement('tr');
   for(const txt of [x.name,x.p50Ms+'ms',x.p95Ms+'ms',x.rtfP50,x.loadMs+'ms']){
     const cell=document.createElement('td');cell.textContent=txt;
     if(row.childElementCount)cell.className='num';row.append(cell);
   }
   $('rows').append(row);
 }
 $('transcripts').textContent=entries.map(r=>r.name+'\n'+r.iterations.map(s=>
   '#'+s.turn+' '+s.elapsedMs+' ms — '+s.text).join('\n')).join('\n\n');
 state();
}
$('engine').addEventListener('change',()=>{
 if(loadedEngine!==$('engine').value)notify('モデルを切り替えました。「読み込む」を押してください。既存結果は保持されます。');
 state();
});
$('audioFile').addEventListener('change',event=>{if(event.target.files?.[0])loadAudio(event.target.files[0]);});
for(const id of ['duration','repeats'])$(id).addEventListener('change',()=>{resetResults();state()});
$('load').addEventListener('click',loadSelected);
$('run').addEventListener('click',run);
$('copy').addEventListener('click',async()=>{
 const report={
   benchmark:'CooTrio S25 same audio Vosk/Moonshine/Whisper v2',
   capturedAt:new Date().toISOString(),
   device:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,
   deviceMemoryGiB:navigator.deviceMemory??null,crossOriginIsolated,
   audioSource:$('audioFile').files?.[0]?.name||'',
   comparedAudioMethod:'same 16kHz mono 5/10 second window + 0.8 second silence; file replay',
   meaningOfMetrics:'p50/p95 ASR elapsed excluding model loading, microphone capture and classification; Vosk final event, Moonshine/Whisper worker result',
   results
 };
 const value=JSON.stringify(report,null,2);
 try{await navigator.clipboard.writeText(value);notify('比較結果JSONをコピーしました。ChatGPTに貼り付けてください。');}
 catch(e){$('transcripts').textContent=value;notify('コピーが使えません。詳細欄のJSONをコピーしてください。',true);}
});
state();notify('ファイルを選択してください。Moonshine/Whisperの分離環境を確認します。');
enableIsolation();
