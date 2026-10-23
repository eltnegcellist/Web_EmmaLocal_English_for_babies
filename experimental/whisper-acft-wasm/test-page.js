// FUTO ACFT Small + whisper.cpp WASM research UI. No audio sent to server.
import {characterErrorRate} from './quality.js';
// MIT: ggml-org/whisper.cpp; Apache-2.0: FUTO ACFT model.
const $=id=>document.getElementById(id);
const BUILD='20261023-acft-cpp-encoder-profile-v2';
const MODEL_NAME='small_acft_q8_0.bin';
let wasmReady=false,loaded=false,busy=false,recording=false,stream=null,recorder=null;
let recordingChunks=[],pcm=null,pcmDuration=0,modelName='',instance=false,logLines=[];
const log=(line)=>{
 const text=String(line);
 logLines.push(text);
 if(logLines.length>130)logLines.shift();
 $('log').textContent=logLines.join('\n');
};
function setStatus(message){$('status').textContent=message;log(message);}
function enable(){
 $('startTranscribe').disabled=!wasmReady||!loaded||!pcm||busy;
 $('startRecord').disabled=recording||busy;
 $('stopRecord').disabled=!recording;
 $('loadModel').disabled=!wasmReady||busy;
}
function error(message){setStatus('エラー: '+String(message));enable();}
$('build').textContent=BUILD;
$('modelDownload').href='https://voiceinput.futo.org/VoiceInput/'+MODEL_NAME;
$('modelDownload').textContent='FUTO公式の多言語ACFT Small（q8）を保存';
const details=()=>{
 const t=$('duration').textContent;
 $('runtime').textContent='Model '+(loaded?'読み込み済み':'未読み込み')+' / Audio '+t+
   ' / CPU Threads '+$('threads').value+' / COI '+String(self.crossOriginIsolated);
};
async function prepareIsolation(){
 if(self.crossOriginIsolated && typeof SharedArrayBuffer==='function')return true;
 if(!navigator.serviceWorker)throw Error('ブラウザのService Workerが使えないため、WASM pthreadsの隔離ができません');
 await navigator.serviceWorker.register('./service-worker.js?v=20261023-acft-whispercpp-coi-v1',
   {updateViaCache:'none'});
 await navigator.serviceWorker.ready;
 const reloadKey='mitsukotoba_whispercpp_coi_reloaded_v1';
 if(sessionStorage.getItem(reloadKey)!=='1'){
   sessionStorage.setItem(reloadKey,'1');
   setStatus('WASMマルチスレッドの隔離を準備しました。ページを自動再読込します');
   location.reload();
   return false;
 }
 throw Error('crossOriginIsolated=falseのままです。再読込後も改善しない場合、Service Worker/ブラウザ設定を確認してください');
}
function checkCompatible(){
 if(!self.crossOriginIsolated||typeof SharedArrayBuffer!=='function'){
  throw Error('Whisper WASM pthreadsにはcrossOriginIsolatedが必要です。再読込し、それでもfalseならGitHub Pagesの隔離設定を確認してください。');
 }
 if(typeof WebAssembly==='undefined')throw Error('WebAssemblyに未対応のブラウザです');
}
async function loadWasm(){
 try{
  setStatus('whisper.cpp WASMを読み込みます');
  if(!(await prepareIsolation()))return;
  checkCompatible();
  const module={print:(...x)=>log(x.join(' ')),printErr:(...x)=>log('stderr: '+x.join(' ')),
   setStatus:()=>{},onRuntimeInitialized:()=>{wasmReady=true;setStatus('whisper.cpp WASM起動完了。ACFTモデルを選択してください。');enable();}};
  window.Module=module;
  const url='./experimental/whisper-acft-wasm/runtime/main.js?v='+BUILD;
  const check=await fetch(url,{method:'HEAD',cache:'no-store'});
  if(!check.ok)throw Error('whisper.cpp WASMのビルド成果物が未公開です (HTTP '+check.status+')。GitHub Actionsのビルドを確認してください。');
  const script=document.createElement('script');
  script.src=url;script.async=true;
  script.onerror=()=>error('whisper.cpp WASMの実行コードを読み込めませんでした');
  document.body.append(script);
 }catch(e){error(e.stack||e);}
}
$('loadModel').addEventListener('click',async()=>{
 const f=$('modelFile').files?.[0];
 if(!f)return error('FUTO公式ACFT Smallの .bin ファイルを選択してください');
 if(f.name!==MODEL_NAME)return error('モデル名が一致しません。公式配布ファイル '+MODEL_NAME+' を選んでください');
 if(f.size<100*1024*1024||f.size>600*1024*1024)return error('モデルファイルの容量が異常です（'+f.size+' bytes）');
 try{
  busy=true;enable();
  setStatus('モデルを端末内に読み込み中。容量が大きいためメモリを使用します');
  const start=performance.now();
  if(instance){window.Module.acft_free();instance=false;}
  if(loaded){try{window.Module.FS_unlink('/'+MODEL_NAME);}catch{}loaded=false;}
  const bytes=new Uint8Array(await f.arrayBuffer());
  window.Module.FS_createDataFile('/',MODEL_NAME,bytes,true,true);
  // Model data exists only in the browser's WASM filesystem, never uploaded.
  instance=Boolean(window.Module.acft_init(MODEL_NAME));
  if(!instance)throw Error('Whisper GGMLモデルの初期化に失敗しました。空きRAMやファイル形式を確認してください。');
  loaded=true;modelName=f.name;
  $('modelMs').textContent=Math.round(performance.now()-start)+' ms';
  setStatus('ACFT Smallモデルを読み込みました。音声を選んでください。');
 }catch(e){error(e.stack||e);}finally{busy=false;enable();details();}
});
async function convertToPcm(bytes) {
 const audioContext=new (window.AudioContext||window.webkitAudioContext)();
 try{
  const buffer=await audioContext.decodeAudioData(bytes);
  const duration=buffer.duration;
  if(!Number.isFinite(duration)||duration<=0||duration>12)throw Error('音声は0～10秒程度の短文にしてください（検出: '+duration.toFixed(1)+'秒）');
  const offline=new OfflineAudioContext(1,Math.max(1,Math.ceil(duration*16000)),16000);
  const src=offline.createBufferSource();
  src.buffer=buffer;src.connect(offline.destination);src.start();
  const rendered=await offline.startRendering();
  return rendered.getChannelData(0).slice();
 }finally{await audioContext.close();}
}
async function setAudio(arrayBuffer){
 try{
  busy=true;enable();setStatus('音声を16kHzモノラルPCMに変換しています');
  const start=performance.now();
  const audio=await convertToPcm(arrayBuffer);
  pcm=audio;pcmDuration=audio.length/16000;
  $('preprocessMs').textContent=Math.round(performance.now()-start)+' ms';
  $('duration').textContent=pcmDuration.toFixed(2)+' s';
  setStatus('音声を読み込みました: '+pcmDuration.toFixed(2)+'秒（送信なし）');
 }catch(e){pcm=null;error(e.stack||e);}finally{busy=false;enable();details();}
}
$('audioFile').addEventListener('change',async()=>{
 const f=$('audioFile').files?.[0];
 if(f)await setAudio(await f.arrayBuffer());
});
$('startRecord').addEventListener('click',async()=>{
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('マイクが利用できません（HTTPSで開いてください）');
  stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1},video:false});
  recorder=new MediaRecorder(stream);
  recordingChunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)recordingChunks.push(e.data)};
  recorder.onstop=async()=>{
    stream?.getTracks().forEach(t=>t.stop());stream=null;recording=false;enable();
    try{await setAudio(await new Blob(recordingChunks,{type:recorder.mimeType}).arrayBuffer());}
    catch(e){error(e.stack||e)}
  };
  recorder.start();recording=true;setStatus('録音中。5秒または10秒程度で停止してください');enable();
 }catch(e){error(e.stack||e);stream?.getTracks().forEach(t=>t.stop());stream=null;}
});
$('stopRecord').addEventListener('click',()=>{if(recorder&&recording)recorder.stop();});
$('startTranscribe').addEventListener('click',async()=>{
 if(busy||!loaded||!pcm)return;
 const windowSeconds=Number($('window').value);
 if(pcmDuration>windowSeconds+0.01)return error('音声が'+windowSeconds+'秒窓を超えています。10秒窓へ変更してください。切り捨てはしません。');
 const ctx=windowSeconds*50;
 const lang=$('language').value;
 const nthreads=Number($('threads').value);
 busy=true;enable();$('transcript').textContent='';
 const started=performance.now();
 try{
  checkCompatible();
  setStatus('ASR開始。音声窓'+windowSeconds+'秒、KVキャッシュ付きDecoder、CPU '+nthreads+'スレッド');
  const code=window.Module.acft_run(pcm,lang,nthreads,ctx);
  if(code!==0)throw Error('whisper.cppの実行開始に失敗しました。コード='+code);
  const poll=()=>{
   let st;
   try{st=window.Module.acft_status();}catch(e){busy=false;error(e.stack||e);return;}
   if(st===0){setTimeout(poll,200);return;}
   if(st!==1){busy=false;error('whisper.cpp推論失敗。状態='+st);return;}
   const elapsed=performance.now()-started;
   const output=window.Module.acft_result().trim();
   const native=window.Module.acft_timings();
   let timings={};
   try{timings=JSON.parse(native)}catch{}
   $('transcript').textContent=output||'(空文字列：無音・言語判定・モデル品質を確認)';
   const reference=$('reference').value.trim();
   const cer=characterErrorRate(reference,output);
   $('cer').textContent=cer===null?'未計測':(cer*100).toFixed(1)+'%';
   const encodePasses=Number.isInteger(timings.encodeRuns)?timings.encodeRuns:null;
   const encodeTotalMs=Number.isFinite(timings.encodeTotalMs)?timings.encodeTotalMs:null;
   const nonEncoderMs=encodeTotalMs!==null?Math.round(elapsed-encodeTotalMs):null;
   const report={build:BUILD,model:MODEL_NAME,backend:'whisper.cpp WASM CPU pthreads + KV cache',
     audioSeconds:Number(pcmDuration.toFixed(2)),audioContext:ctx,
     languageSetting:lang,nthreads,asrTotalMs:Math.round(elapsed),
     encodePasses,encoderTotalMs:encodeTotalMs,nonEncoderMs,
     preprocessMs:Number(($('preprocessMs').textContent||'').replace(/[^0-9]/g,'')),
     modelLoadMs:Number(($('modelMs').textContent||'').replace(/[^0-9]/g,'')),
     nativeTimings:timings,transcript:output,reference:reference||null,cer,
     hardwareConcurrency:navigator.hardwareConcurrency,
     crossOriginIsolated:self.crossOriginIsolated};
   $('report').textContent=JSON.stringify(report,null,2);
   setStatus('実音声ASR完了: '+Math.round(elapsed)+'ms / Encoder '+(encodePasses??'?')+
     '回・合計 '+(encodeTotalMs===null?'未測定':Math.round(encodeTotalMs)+'ms'));
   busy=false;enable();
  };
  // poll() handles asynchronous native inference without blocking the UI.
  poll();
 }catch(e){busy=false;error(e.stack||e);}finally{enable();}
});
$('copy').addEventListener('click',async()=>{
 const report=$('report').textContent;
 if(!report)return;
 try{await navigator.clipboard.writeText(report);setStatus('レポートをコピーしました');}
 catch(e){error('コピーに失敗: '+e.message)}
});
$('threads').addEventListener('input',details);
$('window').addEventListener('change',details);
enable();details();loadWasm();
