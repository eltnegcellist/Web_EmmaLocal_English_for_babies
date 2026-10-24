import {WHISPER_THREAD_KEY,WHISPER_LANGUAGE_MODE_KEY,
  THREAD_OPTIONS,LANGUAGE_DETECTION_OPTIONS,normalizeThreads,normalizeLanguageDetection}
  from './performance.js';

// Developer-only A/B controls; never switch to a smaller Whisper model or GPU.
export function installWhisperPerformanceControls({
  document=globalThis.document,storage=globalThis.localStorage,onChange=()=>{},
  onForgetLanguage=()=>{},onImportAcftFile=async()=>{},hasAcftModel=async()=>false
}={}){
  const host=document.getElementById('developerTools');
  if(!host)return {apply:()=>{}};
  const block=document.createElement('section');
  block.className='developer-test-panel';block.id='whisperPerformanceControls';
  const heading=document.createElement('strong');heading.textContent='Whisper Small 高速化の比較';
  const help=document.createElement('p');help.className='small muted';
  help.textContent='CPUのみ・同じWhisper Small。スレッド数の変更時は会話を終了しモデルを再起動します。';
  block.append(heading,help);
  const makeSelect=(id,title,choices,key,normalize)=>{
    const label=document.createElement('label');
    label.textContent=title;
    const select=document.createElement('select');select.id=id;
    for(const [value,caption] of choices){
      const opt=document.createElement('option');opt.value=value;opt.textContent=caption;select.append(opt);
    }
    let saved=null;try{saved=storage.getItem(key);}catch{}
    select.value=normalize(saved);
    select.addEventListener('change',()=>{
      const value=normalize(select.value);
      try{storage.setItem(key,value);}catch{}
      onChange({threads:getThreads(),languageDetection:getDetection()});
    });
    label.append(select);block.append(label);return select;
  };
  const threads=makeSelect('whisperThreadCount','WASMスレッド数',
    [['auto','自動（最大4）'],['1','1（比較用）'],['2','2'],['4','4']],
    WHISPER_THREAD_KEY,normalizeThreads);
  const detection=makeSelect('whisperLanguageDetection','音声言語判定',
    [['once','初回だけ判定（推奨）'],['every','毎回判定（比較用）'],
      ['fixed','英語固定（比較用）']],
    WHISPER_LANGUAGE_MODE_KEY,normalizeLanguageDetection);
  const getThreads=()=>normalizeThreads(threads.value);
  const getDetection=()=>normalizeLanguageDetection(detection.value);
  const button=document.createElement('button');button.type='button';
  button.className='outline-button compact-button';
  button.textContent='検出言語を忘れて次回判定';
  button.addEventListener('click',()=>onForgetLanguage());
  const label=document.createElement('p');label.className='small muted';
  label.textContent='言語キャッシュは会話終了時にも破棄します。再測定は同じ音声長・発話内容で行ってください。';
  block.append(button,label);
  const modelInfo=document.createElement('p');modelInfo.className='small muted';
  modelInfo.textContent='ACFT Small（5/10秒窓）実験版：公式のsmall_acft_q8_0.bin（約264MB）を一度保存すると、多言語ASRが短窓版に切り替わります。音声は端末内だけで処理します。';
  const link=document.createElement('a');link.href='https://voiceinput.futo.org/VoiceInput/small_acft_q8_0.bin';
  link.target='_blank';link.rel='noopener noreferrer';link.textContent='FUTO公式モデルを保存';
  const modelInput=document.createElement('input');modelInput.type='file';
  modelInput.accept='.bin,application/octet-stream';modelInput.id='acftSmallModelImport';
  modelInput.setAttribute('aria-label','ACFT Small model (GGML)');
  const modelStatus=document.createElement('p');modelStatus.className='small muted';
  modelStatus.id='acftSmallModelStatus';modelStatus.textContent='モデル状態を確認中…';
  const refreshModelStatus=async()=>{
    try{modelStatus.textContent=(await hasAcftModel())?'ACFT Small：端末内に保存済み（5/10秒窓が有効）':'ACFT Small：未保存。取り込むまでは従来Whisper Smallを使用';}
    catch(e){modelStatus.textContent='保存状態を確認できませんでした：'+e.message;}
  };
  modelInput.addEventListener('change',async()=>{
    const file=modelInput.files?.[0];if(!file)return;
    modelInput.disabled=true;modelStatus.textContent='ACFTモデルのSHA-256を確認して端末内へ保存しています…';
    try{await onImportAcftFile(file);await refreshModelStatus();}
    catch(e){modelStatus.textContent='保存に失敗：'+e.message;}
    finally{modelInput.value='';modelInput.disabled=false;}
  });
  block.append(modelInfo,link,modelInput,modelStatus);
  host.prepend(block);
  refreshModelStatus();
  return {apply(language){block.hidden=language==='ja';if(!block.hidden)refreshModelStatus();},threads,detection,refreshModelStatus};
}
