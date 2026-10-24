/* Galaxy S25 Vosk in-browser benchmark. No telemetry, no audio upload. */
'use strict';
const $ = id => document.getElementById(id);
const MODELS = Object.freeze({
  en: 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz',
  fr: 'https://huggingface.co/atamano/vosk-chess-fr/resolve/main/vosk-model-small-fr-0.22.tar.gz'
});
let model = null, loadedUrl = '', loading = false, busy = false;
let rawSamples = null, actualSampleRate = 16000, sourceKind = '', lastReport = null, loadMs = null;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const status = (s, error=false) => { $('status').textContent = s; $('status').dataset.error = String(error); };
const fmt = n => Number.isFinite(n) ? n.toFixed(1) : '—';
function percentile(xs, p) {
  const a = [...xs].sort((x,y) => x-y);
  const at = (a.length-1)*p;
  const lo = Math.floor(at), hi = Math.ceil(at);
  return a[lo] + (a[hi]-a[lo])*(at-lo);
}
function controls() {
  $('load').disabled = loading || busy;
  $('record').disabled = loading || busy || !model;
  $('run').disabled = loading || busy || !model || !rawSamples;
  $('language').disabled = loading || busy;
  $('modelUrl').disabled = loading || busy;
  $('duration').disabled = busy;
  $('repeats').disabled = busy;
}
function syncModel() {
  const chosen = MODELS[$('language').value];
  if (chosen) $('modelUrl').value = chosen;
  if (model && $('modelUrl').value !== loadedUrl) {
    model.terminate();
    model = null; loadedUrl=''; loadMs=null;
    $('loadTime').textContent = '未測定';
    status('モデルを切り替えました。新しいモデルを読み込んでください。');
  }
  controls();
}
$('language').addEventListener('change', syncModel);
$('modelUrl').addEventListener('change', () => {
  if (model && $('modelUrl').value !== loadedUrl) {
    model.terminate(); model=null; loadedUrl=''; loadMs=null;
    $('loadTime').textContent = '未測定';
    status('URLが変更されました。新しいモデルを読み込んでください。');
  }
  controls();
});
syncModel();

async function loadModel() {
  if (busy || loading) return;
  const url = $('modelUrl').value.trim();
  if (!/^https:\/\//.test(url) || !/\.tar\.gz(?:\?|$)/i.test(url)) {
    status('HTTPSのブラウザ用 .tar.gz モデルURLを指定してください。', true); return;
  }
  if (!window.Vosk || typeof Vosk.createModel !== 'function') {
    status('vosk-browserライブラリを読み込めません。Chromeの通信接続を確認してください。', true); return;
  }
  loading=true; controls(); $('result').style.display='none';
  try {
    if (model) { model.terminate(); model=null; }
    status('モデルをダウンロード・展開しています。初回は数十MB必要です。');
    const start=performance.now();
    const candidate = await Promise.race([
      Vosk.createModel(url),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('モデルの読み込みが180秒を超えました。モデルの形式やURLを確認してください。')),180000))
    ]);
    model=candidate; loadedUrl=url; loadMs=performance.now()-start;
    if (typeof model.setLogLevel === 'function') model.setLogLevel(-1);
    $('loadTime').textContent=fmt(loadMs)+' ms';
    status('Vosk準備完了（'+fmt(loadMs)+' ms）。5秒または10秒録音するか、音声ファイルを選択してください。');
  } catch(err) {
    status('モデルの読み込み失敗：'+String(err?.message||err)+'\n※公式Vosk .zip は直接使えません。モデルフォルダーを model/ として圧縮した .tar.gz が必要です。',true);
    model=null;loadedUrl='';loadMs=null;
  } finally { loading=false; controls(); }
}
$('load').addEventListener('click',loadModel);

function arrayBufferFromSamples(samples, sr, seconds) {
  const n = Math.min(Math.round(seconds*sr),samples.length);
  // A short trailing silence gives Vosk an opportunity to flush utterances.
  const end = Math.round(sr*0.8);
  const pcm = new AudioBuffer({length:n+end,numberOfChannels:1,sampleRate:sr});
  pcm.getChannelData(0).set(samples.subarray(0,n),0);
  return {buffer:pcm,inputSeconds:n/sr+0.8,speechSeconds:n/sr};
}
async function resample(input, inputRate) {
  if (inputRate === 16000) return input;
  const sourceBuffer = new AudioBuffer({length:input.length,numberOfChannels:1,sampleRate:inputRate});
  sourceBuffer.copyToChannel(input,0);
  const outFrames=Math.max(1,Math.round(input.length*16000/inputRate));
  const offline=new OfflineAudioContext(1,outFrames,16000);
  const source=offline.createBufferSource();
  source.buffer=sourceBuffer; source.connect(offline.destination); source.start();
  const out=await offline.startRendering();
  return new Float32Array(out.getChannelData(0));
}
async function record() {
  if (!model || busy || loading) return;
  busy=true;controls();$('result').style.display='none';
  let stream=null,ctx=null,processor=null,src=null,sink=null;
  try {
    const duration=Number($('duration').value);
    status('マイクのアクセス許可を求めています。');
    stream=await navigator.mediaDevices.getUserMedia({
      audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1},
      video:false
    });
    ctx=new (window.AudioContext||window.webkitAudioContext)();
    await ctx.resume();
    src=ctx.createMediaStreamSource(stream);
    processor=ctx.createScriptProcessor(4096,1,1);
    sink=ctx.createGain();sink.gain.value=0;
    src.connect(processor);processor.connect(sink);sink.connect(ctx.destination);
    const chunks=[];let total=0;const target=Math.round(duration*ctx.sampleRate);
    status(duration+'秒間録音しています。通常の声で話してください。');
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('録音が時間内に終了しませんでした')), (duration+12)*1000);
      processor.onaudioprocess=e=>{
        if(total>=target)return;
        const data=e.inputBuffer.getChannelData(0);
        const take=Math.min(target-total,data.length);
        chunks.push(new Float32Array(data.subarray(0,take)));total+=take;
        if(total>=target){clearTimeout(timeout);processor.onaudioprocess=null;resolve();}
      };
    });
    const collected=new Float32Array(total);let off=0;
    for (const chunk of chunks){collected.set(chunk,off);off+=chunk.length;}
    rawSamples=await resample(collected,ctx.sampleRate);
    actualSampleRate=16000;sourceKind='Galaxy S25 microphone';
    status('録音完了：'+(rawSamples.length/16000).toFixed(2)+'秒。測定を実行できます。');
  } catch(err) {
    status('マイク録音失敗：'+String(err?.message||err)+'。Chromeで開き、マイク権限を確認してください。',true);
  } finally {
    try{processor?.disconnect();src?.disconnect();sink?.disconnect();await ctx?.close();}catch(_){}
    stream?.getTracks().forEach(t=>t.stop());busy=false;controls();
  }
}
$('record').addEventListener('click',record);

$('audioFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  if(file.size>40*1024*1024){status('40MB以内の短い音声ファイルを指定してください。',true);return;}
  busy=true;controls();
  let ctx=null;
  try {
    status('音声を読み込んで16kHzに変換しています。');
    ctx=new (window.AudioContext||window.webkitAudioContext)();
    const decoded=await ctx.decodeAudioData(await file.arrayBuffer());
    const seconds=Math.min(10,decoded.duration);
    const length=Math.max(1,Math.ceil(seconds*decoded.sampleRate));
    const mono=new Float32Array(length);
    const channels=decoded.numberOfChannels;
    for(let ch=0;ch<channels;ch++){
      const samples=decoded.getChannelData(ch);
      const use=Math.min(length,samples.length);
      for(let i=0;i<use;i++)mono[i]+=samples[i]/channels;
    }
    rawSamples=await resample(mono,decoded.sampleRate);
    actualSampleRate=16000;sourceKind='user-selected '+file.name;
    status('音声の読込完了：'+(rawSamples.length/16000).toFixed(2)+'秒。先頭5秒/10秒を使用します。');
  }catch(err){status('音声の読み込み失敗：'+String(err?.message||err),true);}
  finally{try{await ctx?.close();}catch(_){}busy=false;controls();}
});

function recognizeOnce(buffer,timeoutMs=55000) {
  return new Promise((resolve,reject)=>{
    let rec=null,done=false,timer=null;
    const start=performance.now();
    function finish(error,data){
      if(done)return;done=true;clearTimeout(timer);
      const elapsed=performance.now()-start;
      try{rec?.remove();}catch(_){}
      if(error)reject(error);
      else resolve({elapsedMs:elapsed,reported:data||'',kind:data?.kind||'unknown'});
    }
    try {
      rec=new model.KaldiRecognizer(buffer.sampleRate);
      rec.setWords?.(false);
      rec.on('error',e=>finish(new Error('認識エラー：'+(e?.error||JSON.stringify(e)))));
      rec.on('result',e=>finish(null,{kind:'final result',text:e?.result?.text||''}));
      rec.on('partialresult',e=>finish(null,{kind:'partial result',text:e?.result?.partial||''}));
      timer=setTimeout(()=>finish(new Error('音声の認識が55秒以内に終わりませんでした')),timeoutMs);
      rec.acceptWaveform(buffer);
    }catch(err){finish(err);}
  });
}
async function benchmark() {
  if(!model || !rawSamples || busy || loading)return;
  busy=true;controls();$('result').style.display='none';
  const repeats=Number($('repeats').value),seconds=Number($('duration').value);
  const input=arrayBufferFromSamples(rawSamples,actualSampleRate,seconds);
  const timings=[],details=[];
  try {
    for(let i=0;i<repeats;i++){
      status('S25でVoskを測定中：'+(i+1)+' / '+repeats+' 回。音声はネットワーク送信しません。');
      const r=await recognizeOnce(input.buffer);
      timings.push(r.elapsedMs);
      details.push({iteration:i+1,ms:Number(r.elapsedMs.toFixed(2)),kind:r.reported.kind,text:r.reported.text});
      // Yield to UI without affecting the measured interval.
      await sleep(60);
    }
    const p50=percentile(timings,0.5),p95=percentile(timings,0.95);
    const rtfs=timings.map(v=>v/1000/input.inputSeconds);
    $('p50').textContent=fmt(p50);
    $('p95').textContent=fmt(p95);
    $('rtf').textContent=percentile(rtfs,0.5).toFixed(2);
    $('first').textContent=fmt(timings[0])+' ms';
    $('range').textContent=fmt(Math.min(...timings))+' / '+fmt(Math.max(...timings))+' ms';
    $('inputSec').textContent=fmt(input.inputSeconds)+' 秒（音声 '+fmt(input.speechSeconds)+' 秒）';
    $('loadStat').textContent=fmt(loadMs)+' ms';
    $('device').textContent=navigator.platform||'Android Chrome';
    $('details').textContent=details.map(x=>'#'+x.iteration+': '+fmt(x.ms)+'ms ['+x.kind+'] '+x.text).join('\n');
    lastReport={
      benchmark:'CooTrio Vosk S25 WebAssembly research v1',timestamp:new Date().toISOString(),
      device:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency??null,
      deviceMemoryGiB:navigator.deviceMemory??null,
      modelUrl:loadedUrl,modelLoadMs:loadMs,source:sourceKind,
      selectedWindowSeconds:seconds,actualSpeechSeconds:input.speechSeconds,
      fullAudioSecondsProcessed:input.inputSeconds,repeats,
      metrics:{p50Ms:p50,p95Ms:p95,rtfP50:percentile(rtfs,.5),
         fastestMs:Math.min(...timings),slowestMs:Math.max(...timings)},
      samples:details,
      methodology:'Browser Vosk-WASM worker; file replay of same PCM 3–5 times; elapsed from queue acceptWaveform start to first result/partialresult callback after complete 5/10s AudioBuffer, includes ~0.8s trailing silence; no mic/record/download/load/E5 duration',
      caveat:'An ASR callback after full-buffer submission measures throughput+worker response, not end-of-speech streaming latency.'
    };
    $('result').style.display='block';
    status('完了。中央値 '+fmt(p50)+' ms、p95 '+fmt(p95)+' ms、RTF '+percentile(rtfs,.5).toFixed(2)+'。結果をコピーしてChatGPTに貼ってください。');
  }catch(err){status('測定失敗：'+String(err?.message||err)+'。認識結果が得られない場合は別の音声または英語モデルで確認してください。',true);}
  finally{busy=false;controls();}
}
$('run').addEventListener('click',benchmark);
$('repeats').addEventListener('change',()=>{$('run').textContent=$('repeats').value+'回測定する';});
$('repeats').dispatchEvent(new Event('change'));
$('copy').addEventListener('click',async()=>{
  if(!lastReport)return;
  const data=JSON.stringify(lastReport,null,2);
  try{await navigator.clipboard.writeText(data);status('結果JSONをコピーしました。ChatGPTに貼り付けてください。');}
  catch(_){$('details').textContent=data;status('コピーに失敗したため、下部にJSONを表示しました。選択してコピーしてください。',true);}
});
