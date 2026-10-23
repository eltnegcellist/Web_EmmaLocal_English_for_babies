import {getSpec} from './acft-encoder-benchmark.js';
const $=id=>document.getElementById(id);
const start=$('runAcft'),copy=$('copyAcft'),status=$('acftLog'),result=$('acftResults'),select=$('acftChoice');
let worker=null,latest=null;
function log(text){status.textContent+='\n'+text;status.scrollTop=status.scrollHeight;}
function modelLabel(){
 const spec=getSpec(select.value);
 $('acftModelInfo').textContent=`${spec.tier} / ${spec.seconds}秒窓 / 約${spec.approxMB} MB（初回ダウンロード）`;
}
select.addEventListener('change',modelLabel);modelLabel();
start.addEventListener('click',async()=>{
 if(worker)return;
 start.disabled=true;copy.disabled=true;latest=null;
 status.textContent='';result.textContent='';
 const spec=getSpec(select.value);
 log(`開始: ${spec.id}。CPUのみ、実音声なし。`);
 let bytes=null;
 const file=$('acftLocalModel').files?.[0];
 if(file){
  const expectedName='acft_whisper_'+spec.tier+'_'+spec.seconds+'s_drq.tflite';
  if(file.name!==expectedName){
    log('ファイル名が選択と一致しません: '+expectedName);
    start.disabled=false;return;
  }
  try{bytes=await file.arrayBuffer();}
  catch(e){log('モデルファイルを読めませんでした: '+e.message);start.disabled=false;return;}
 }
 // LiteRT.js invokes importScripts() inside its WASM loader. A module Worker
 // always throws; a classic worker can still dynamic-import ES modules.
 worker=new Worker(new URL('./acft-encoder-worker.js?v=20261023-acft-wasm-path-v3',import.meta.url),{type:'classic'});
 const finish=()=>{worker?.terminate();worker=null;start.disabled=false;};
 worker.onerror=e=>{log('Worker エラー: '+(e.message||'unknown'));finish();};
 worker.postMessage({action:'benchmark',model:spec.id,bytes},bytes?[bytes]:[]);
 worker.onmessage=({data})=>{
  if(data.type==='status')log(data.text);
  else if(data.type==='sample')log(`計測 ${data.sample}/5：${data.ms} ms`);
  else if(data.type==='error'){
    log('エラー：'+data.error+'\nstage='+data.stage+'\nbuild='+data.build+
      '\nclassicImportScripts='+data.classicImportScripts);
    finish();
  }
  else if(data.type==='complete'){
   latest=data;copy.disabled=false;
   result.textContent=`Encoder中央値: ${data.medianMs} ms / モデル取得と準備: ${data.loadingMs} ms\n旧Whisper Small 30秒窓Encoder中央値: 8200 ms（異なるモデル・実装の参考値）`;
   log('完了。診断結果をコピーしてください。');
   finish();
  }
 };
});
copy.addEventListener('click',async()=>{
 if(!latest)return;
 const text='Mitsukotoba ACFT CPU encoder benchmark\n'+Object.entries(latest).map(([k,v])=>
  `${k}=${typeof v==='object'?JSON.stringify(v):v}`).join('\n');
 try{await navigator.clipboard.writeText(text);log('コピーしました');}
 catch(e){log('コピー失敗: '+e.message);status.textContent+='\n'+text;}
});
