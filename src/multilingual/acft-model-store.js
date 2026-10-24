import {digest,openChunkStore} from './assets.js';

// Official multilingual FUTO model, hash obtained from the official URL in
// pinned GitHub Action preflight (264,464,624 bytes). Imported once, local-only.
// No unauthenticated CORS proxy and no network upload of private recordings.
export const ACFT_MODEL={
  model:'futo-whisper-acft-small',
  file:'small_acft_q8_0.bin',
  url:'https://voiceinput.futo.org/VoiceInput/small_acft_q8_0.bin',
  bytes:264464624,
  sha256:'15ef255465a6dc582ecf1ec651a4618c7ee2c18c05570bbe46493d248d465ac4'
};
export async function importAcftModel(file,{progress=()=>{}}={}){
  if(file?.name!==ACFT_MODEL.file)throw Error('FUTO公式の small_acft_q8_0.bin を選択してください');
  if(file.size!==ACFT_MODEL.bytes)throw Error('ACFTモデルのサイズが正しくありません');
  progress({stage:'verifying',loaded:0,total:ACFT_MODEL.bytes});
  const buffer=await file.arrayBuffer();
  const sha=await digest(buffer);
  if(sha!==ACFT_MODEL.sha256)throw Error('ACFTモデルのSHA-256が不一致です。公式ファイルを再取得してください');
  const store=await openChunkStore();
  if(!store)throw Error('IndexedDBが使えないため、モデルを保存できません');
  progress({stage:'storing',loaded:0,total:ACFT_MODEL.bytes});
  await store.write(ACFT_MODEL,buffer);
  progress({stage:'complete',loaded:ACFT_MODEL.bytes,total:ACFT_MODEL.bytes});
  return {bytes:buffer.byteLength,sha256:sha};
}
export async function hasImportedAcftModel(){
  const store=await openChunkStore().catch(()=>null);
  if(!store)return false;
  // Check cheap manifest metadata here; full SHA256 is validated once before
  // starting native ASR when the model is loaded.
  return Boolean(await store.has(ACFT_MODEL).catch(()=>false));
}
export async function readImportedAcftModel(){
  const store=await openChunkStore();
  if(!store)throw Error('IndexedDB unavailable');
  const response=await store.read(ACFT_MODEL);
  if(!response)throw Error('ACFT Smallの保存データがありません。モデルを再インポートしてください');
  return response.arrayBuffer();
}
