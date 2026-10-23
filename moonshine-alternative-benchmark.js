// Isolated research benchmark: Moonshine Voice v2 MIT streaming ASR, on-device.
// This file never uploads audio or generated transcripts.
import {Transcriber} from './src/vendor/moonshine/transcriber.js';
import {MicTranscriber} from './src/vendor/moonshine/mic-transcriber.js';
import {ModelArch} from './src/vendor/moonshine/enums.js';
import {characterErrorRate} from './experimental/whisper-acft-wasm/quality.js';
import {loadEmmaMoonshineModule} from './src/moonshine-module.js';

const BUILD='20261024-moonshine-multilingual-research-v1';
const models={
 ja:{label:'日本語',arches:['TinyStreaming','SmallStreaming']},
 de:{label:'Deutsch',arches:['TinyStreaming','SmallStreaming']},
 en:{label:'English',arches:['TinyStreaming','SmallStreaming']},
 es:{label:'Español（追加調査）',arches:['TinyStreaming','SmallStreaming']}
};
const $=id=>document.getElementById(id);
let transcriber=null,live=null,loaded=null,busy=false,loading=false,pcm=null,audioSeconds=0,ready=false;
let modelLoadMs=0,preprocessMs=0,lastText='',liveLines=[],liveStarted=0,liveFinal=0;
const now=()=>performance.now();
function status(message){$('status').textContent=message;}
function renderModelOptions(){
 const key=$('language').value;
 const previous=$('arch').value;
 const list=models[key].arches;
 $('arch').replaceChildren(...list.map(arch=>{
  const opt=document.createElement('option');
  opt.value=arch;opt.textContent=arch.replace('Streaming',' Streaming')+' / MIT';
  return opt;
 }));
 $('arch').value=list.includes(previous)?previous:'TinyStreaming';
 $('arch').disabled=busy||!!live;
 updateButtons();
}
function updateButtons(){
 $('load').disabled=!ready||busy||loading||!!live;
 $('file').disabled=busy||!!live;
 $('transcribe').disabled=!ready||busy||!!live||!pcm||!transcriber;
 $('startMic').disabled=!ready||busy||!!live||!transcriber;
 $('stopMic').disabled=!live;
 $('language').disabled=busy||loading||!!live;
 $('arch').disabled=busy||loading||!!live;
}
function setReport(entry) {
 const ref=$('reference').value.trim();
 const cer=ref?characterErrorRate(ref,entry.transcript):null;
 const report={
  build:BUILD,backend:'Moonshine Voice 0.1.5 WASM CPU streaming model',
  language:loaded?.language,arch:loaded?.arch,mode:entry.mode,
  modelLoadMs:Math.round(modelLoadMs),
  preprocessMs:entry.mode==='file'?Math.round(preprocessMs):null,
  audioSeconds:entry.audioSeconds,
  inferenceMs:entry.inferenceMs,
  lastTranscriptionLatencyMs:entry.lastTranscriptionLatencyMs,
  transcript:entry.transcript,reference:ref||null,cer,
  rtFactor:entry.audioSeconds?Number((entry.inferenceMs/1000/entry.audioSeconds).toFixed(3)):null,
  hardwareConcurrency:navigator.hardwareConcurrency,
  crossOriginIsolated:crossOriginIsolated
 };
 $('transcript').textContent=entry.transcript||'(空の認識結果)';
 $('cer').textContent=cer===null?'未計測':(cer*100).toFixed(1)+'%';
 $('report').textContent=JSON.stringify(report,null,2);
}
function fail(error){status('エラー: '+(error?.stack||error?.message||String(error)));}
$('build').textContent=BUILD;
$('language').addEventListener('change',renderModelOptions);
$('arch').addEventListener('change',()=>{
 $('modelStatus').textContent='この設定のモデルは未読み込み';
 updateButtons();
});
$('load').addEventListener('click',async()=>{
 const language=$('language').value,arch=$('arch').value;
 if(!models[language]?.arches.includes(arch))return fail('対象外のモデルです');
 if(loading)return;
 loading=true;busy=true;updateButtons();
 let next;
 try{
  status('Moonshineモデルを準備中（初回のみダウンロード）');
  const start=now();
  const module=await loadEmmaMoonshineModule();
  next=await Transcriber.load({
   module,language,modelArch:ModelArch[arch],
   ...(language==='ja'?{options:{max_tokens_per_second:'13.0'}}:{}),
   onProgress:(loadedBytes,totalBytes,file)=>{
    const percent=totalBytes?Math.round(100*loadedBytes/totalBytes):0;
    $('modelStatus').textContent='モデル取得・準備 '+percent+'%: '+file;
   }
  });
  const elapsed=now()-start;
  const old=transcriber;transcriber=next;next=null;
  if(old)old.close();
  loaded={language,arch};
  modelLoadMs=elapsed;
  $('modelStatus').textContent=language+' / '+arch+' / 準備 '+Math.round(elapsed)+'ms（モデル読み込みを含む）';
  status('準備完了：端末内ASRを実行できます');
 }catch(err){next?.close();fail(err);}
 finally{busy=false;loading=false;updateButtons();}
});
async function toPcm(blob){
 const bytes=await blob.arrayBuffer();
 const Audio=window.AudioContext||window.webkitAudioContext;
 const context=new Audio();
 try{
  const decoded=await context.decodeAudioData(bytes);
  if(decoded.duration<=0||decoded.duration>60)throw Error('音声は60秒以内にしてください');
  const out=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000);
  const src=out.createBufferSource();src.buffer=decoded;src.connect(out.destination);src.start();
  const rendered=await out.startRendering();
  return new Float32Array(rendered.getChannelData(0));
 }finally{await context.close();}
}
$('file').addEventListener('change',async()=>{
 const input=$('file').files?.[0];if(!input)return;
 busy=true;updateButtons();
 try{
  status('音声を16kHz PCMに変換しています');
  const start=now();
  pcm=await toPcm(input);
  preprocessMs=now()-start;
  audioSeconds=pcm.length/16000;
  $('fileStatus').textContent=input.name+' / '+audioSeconds.toFixed(2)+'秒 / 前処理'+Math.round(preprocessMs)+'ms';
  status('ファイル準備完了');
 }catch(err){pcm=null;fail(err);}
 finally{busy=false;updateButtons();}
});
$('transcribe').addEventListener('click',()=>{
 if(!transcriber||!pcm||busy)return;
 busy=true;updateButtons();
 let stream;
 try{
  status('Moonshine Streamingで音声を処理中。5秒超でも分割不要です');
  stream=transcriber.createStream({updateInterval:0.5});
  stream.start();
  const start=now(),step=8000;
  // Offline replay: no deliberate real-time sleeps. All passes count toward
  // compute cost, unlike live microphone processing during speech.
  for(let i=0;i<pcm.length;i+=step){
   stream.addAudio(pcm.subarray(i,Math.min(i+step,pcm.length)),16000);
   stream.transcribe();
  }
  stream.stop();
  const result=stream.latest;
  const inferenceMs=Math.round(now()-start);
  const transcript=(result.lines||[]).map(x=>x.text).join(' ').trim();
  lastText=transcript;
  const latencies=(result.lines||[]).map(x=>x.lastTranscriptionLatencyMs)
   .filter(x=>Number.isFinite(x)&&x>0);
  setReport({mode:'file',audioSeconds:Number(audioSeconds.toFixed(2)),
   inferenceMs,transcript,
   lastTranscriptionLatencyMs:latencies.length?Number(latencies.at(-1).toFixed(2)):null});
  status('ファイル認識完了：'+inferenceMs+'ms（モデル読み込み・音声変換は別）');
 }catch(err){fail(err);}
 finally{stream?.close();busy=false;updateButtons();}
});
$('startMic').addEventListener('click',async()=>{
 if(!transcriber||busy||live)return;
 busy=true;updateButtons();
 try{
  liveLines=[];liveFinal=0;
  const mic=new MicTranscriber()
   .language(loaded.language)
   .modelArch(ModelArch[loaded.arch])
   .useTranscriber(transcriber)
   .onText(text=>{$('transcript').textContent=text||'(認識中)'})
   .onLine(line=>{
    liveLines.push({text:line.text,latencyMs:line.lastTranscriptionLatencyMs});
    $('transcript').textContent=liveLines.map(x=>x.text).join(' ');
    liveFinal=now();
    $('liveLatency').textContent=line.lastTranscriptionLatencyMs?
      Math.round(line.lastTranscriptionLatencyMs)+'ms（モデル内部の確定遅延）':'未計測';
   })
   .onError(fail);
  live=mic;
  await mic.start();
  liveStarted=now();
  $('transcript').textContent='(マイクで話してください)';
  status('ストリーミング認識中。話している間にも処理を進めます');
 }catch(err){live?.close();live=null;fail(err);}
 finally{busy=false;updateButtons();}
});
$('stopMic').addEventListener('click',async()=>{
 if(!live||busy)return;
 busy=true;updateButtons();
 const mic=live,startStop=now();
 try{
  await mic.stop();
  const stopMs=now()-startStop;
  const text=liveLines.map(x=>x.text).join(' ').trim();
  const values=liveLines.map(x=>Number(x.latencyMs)).filter(x=>Number.isFinite(x)&&x>0);
  setReport({mode:'live',audioSeconds:Number(((startStop-liveStarted)/1000).toFixed(2)),
   inferenceMs:Math.round(now()-liveStarted),
   transcript:text,
   lastTranscriptionLatencyMs:values.length?Number(values.at(-1).toFixed(2)):null});
  status('ライブ終了。停止処理 '+Math.round(stopMs)+'ms／確定遅延は「lastTranscriptionLatencyMs」');
 }catch(err){fail(err);}
 finally{mic.close();live=null;busy=false;updateButtons();}
});
$('copy').addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText($('report').textContent);status('診断JSONをコピーしました');}
 catch(err){fail(err)}
});
async function bootstrap(){
 renderModelOptions();
 try{
  if(!self.crossOriginIsolated || typeof SharedArrayBuffer==='undefined'){
   if(!navigator.serviceWorker)throw new Error('WASMスレッドにはService Workerが必要です');
   await navigator.serviceWorker.register('./service-worker.js?v=20261024-moonshine-asr-alt-coi-v1',{updateViaCache:'none'});
   await navigator.serviceWorker.ready;
   const key='asr_alt_moonshine_isolated_v1';
   if(!sessionStorage.getItem(key)){
    sessionStorage.setItem(key,'1');
    status('Moonshine WASM用にブラウザを再読み込みします');
    location.reload();
    return;
   }
   if(!self.crossOriginIsolated)throw new Error('crossOriginIsolatedを有効にできませんでした');
  }
  ready=true;updateButtons();
  status('WASM実行環境の準備完了。MIT Streamingモデルを読み込んでください');
 }catch(e){fail(e);updateButtons();}
}
bootstrap();
