// Independent Moonshine Voice 0.1.5 browser research, CPU/WASM only.
// Records are in memory only; microphone PCM is not uploaded to this app.
import {WASM_CDN_URL, MOONSHINE_TRIAL_LANGUAGES} from './model-matrix.js';
import {characterErrorRate} from '../whisper-acft-wasm/quality.js';

const BUILD='20261024-moonshine-streaming-research-v1';
const $=id=>document.getElementById(id);
let sdk=null,transcriber=null,loadedKey='',running=false,busy=false,startTime=0;
let progressStart=0,phrases=[],partial='',errorMessage=null,modelLoadMs=null;
$('build').textContent=BUILD;
$('package').textContent=WASM_CDN_URL;

function status(message){$('status').textContent=message;}
function setButtons(){
 $('prepare').disabled=busy||running;
 $('start').disabled=busy||running||!transcriber;
 $('stop').disabled=busy||!running;
 $('language').disabled=busy||running;
 $('size').disabled=busy||running;
}
function output(){
 const ref=$('reference').value.trim();
 const single=phrases.length===1?characterErrorRate(ref,phrases[0].text):null;
 $('cer').textContent=single==null?'未採点（正解文と完成した1発話が必要）':(single*100).toFixed(1)+'%';
 $('partial').textContent=partial||'（ここに発話途中の文字起こしが表示されます）';
 $('transcript').textContent=phrases.length?phrases.map(p=>p.text).join('\n'):'（まだ確定した発話はありません）';
 $('report').textContent=JSON.stringify({
   build:BUILD,backend:'Moonshine Voice WASM CPU streaming',
   package:'@moonshine-ai/moonshine-wasm@0.1.5',
   language:$('language').value,architecture:$('size').value,
   modelLoadMs,recordingActive:running,
   completedLines:phrases.length,
   lines:phrases.map(x=>({text:x.text,providerPostSpeechLatencyMs:x.providerPostSpeechLatencyMs})),
   providerLatencyMs:phrases.map(x=>x.providerPostSpeechLatencyMs).filter(Number.isFinite),
   singlePhraseReference:ref||null,singlePhraseCER:single,
   hardwareConcurrency:navigator.hardwareConcurrency,
   crossOriginIsolated:self.crossOriginIsolated,
   note:'Reported provider per-phrase latency is NOT full start-to-end ASR runtime. No representative accuracy/performance verdict is implied.'
 },null,2);
}
async function ensureIsolation(){
 if(self.crossOriginIsolated&&typeof SharedArrayBuffer==='function')return true;
 if(!('serviceWorker' in navigator))throw Error('このブラウザではスレッド隔離を準備できません');
 await navigator.serviceWorker.register('./service-worker.js?v=20261023-consolidated-main-v1',
   {updateViaCache:'none'});
 await navigator.serviceWorker.ready;
 const key='moonshine_alt_coi_reloaded_v1';
 if(sessionStorage.getItem(key)==='1')throw Error('ページ更新後もcrossOriginIsolated=falseです');
 sessionStorage.setItem(key,'1');
 location.reload();
 return false;
}
async function prepareSDK(){
 if(!sdk){
  status('Moonshine Voice WASMライブラリを読み込みます');
  sdk=await import(WASM_CDN_URL);
  if(!sdk.MicTranscriber||!sdk.ModelArch)throw Error('Moonshine Voice公式APIが利用できません');
 }
 return sdk;
}
const readKey=()=>$('language').value+'-'+$('size').value;
function buildArch(arch){
 if(arch==='tiny')return sdk.ModelArch.TinyStreaming;
 if(arch==='small')return sdk.ModelArch.SmallStreaming;
 throw Error('未知のモデルサイズ: '+arch);
}
async function prepare(){
 if(busy||running)return;
 try{
  busy=true;setButtons();errorMessage=null;
  const language=$('language').value;
  if(!MOONSHINE_TRIAL_LANGUAGES.includes(language))throw Error('この言語に公開Streamingモデルはありません');
  const key=readKey();
  if(transcriber&&key===loadedKey){status('モデル準備済み');return;}
  if(transcriber&&typeof transcriber.dispose==='function'){
   try{await transcriber.dispose()}catch(e){console.warn(e)}
  }
  transcriber=null;loadedKey='';phrases=[];partial='';output();
  const {MicTranscriber}=await prepareSDK();
  progressStart=performance.now();
  let lastProgressAt=0;
  const mic=new MicTranscriber()
   .language(language)
   .modelArch(buildArch($('size').value))
   .onText(text=>{partial=String(text||'');output();})
   .onLine(line=>{
     const text=String(line.text||'').trim();
     if(!text)return;
     const ms=Number(line.lastTranscriptionLatencyMs);
     phrases.push({text,providerPostSpeechLatencyMs:Number.isFinite(ms)?ms:null});
     partial='';output();
     status('確定文 '+phrases.length+' 件 / 最終化遅延 '+(Number.isFinite(ms)?Math.round(ms)+'ms':'不明'));
   })
   .onError(err=>{errorMessage=String(err?.message||err);status('Moonshineエラー: '+errorMessage);})
   .onProgress((fraction,file)=>{
     const now=performance.now();
     if(now-lastProgressAt<150)return;lastProgressAt=now;
     status('モデル準備中 '+(Math.min(100,Math.round((Number(fraction)||0)*100)))+'% '+(file||''));
   });
  await mic.load();
  transcriber=mic;loadedKey=key;
  modelLoadMs=Math.round(performance.now()-progressStart);
  $('loadTime').textContent=modelLoadMs+'ms';
  status('モデル準備完了。録音を開始できます');
  output();
 }catch(e){
  errorMessage=String(e?.message||e);
  status('モデル読み込み失敗: '+errorMessage);
 }finally{busy=false;setButtons();}
}
$('prepare').addEventListener('click',prepare);
$('start').addEventListener('click',async()=>{
 if(!transcriber||busy||running)return;
 try{
  busy=true;setButtons();phrases=[];partial='';output();
  const start=performance.now();
  await transcriber.start();
  startTime=performance.now();running=true;
  $('startLatency').textContent=Math.round(startTime-start)+'ms';
  status('録音・ストリーミング認識中。5秒を超えても途切れず処理します');
  output();
 }catch(e){status('録音開始失敗: '+String(e?.message||e));}
 finally{busy=false;setButtons();}
});
$('stop').addEventListener('click',async()=>{
 if(!running||busy)return;
 busy=true;setButtons();
 const stopped=performance.now();
 try{
  await transcriber.stop();running=false;
  $('captureSeconds').textContent=((stopped-startTime)/1000).toFixed(2)+'秒';
  status('録音終了。確定した発話 '+phrases.length+' 件。必要なら結果をコピー');
 }catch(e){status('録音終了エラー: '+String(e?.message||e));}
 finally{busy=false;setButtons();output();}
});
$('language').addEventListener('change',()=>{
 if(readKey()!==loadedKey){transcriber=null;loadedKey='';modelLoadMs=null;status('言語を変更しました。モデルを準備してください');setButtons();}
});
$('size').addEventListener('change',()=>{
 if(readKey()!==loadedKey){transcriber=null;loadedKey='';modelLoadMs=null;status('サイズを変更しました。モデルを準備してください');setButtons();}
});
$('reference').addEventListener('input',output);
$('copy').addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText($('report').textContent);status('診断ログをコピーしました')}
 catch(e){status('コピーできません: '+String(e))}
});
setButtons();output();
(async()=>{
 try{
  if(!(await ensureIsolation()))return;
  status('起動可能。言語とサイズを選び、モデル準備を押してください');
 }catch(e){status('環境チェック: '+String(e?.message||e))}
})();
