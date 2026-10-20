// Only pinned public model assets are downloaded. Speech never leaves the device.
// Large ONNX files use chunked IndexedDB: Android Chrome can reject a single
// 90–157 MB CacheStorage.put() with "Unexpected internal error".
export const MODEL_CACHE = 'mitsukotoba-multilingual-v1';
const DB_NAME = 'mitsukotoba-multilingual-chunks-v1';
const CHUNK_BYTES = 4 * 1024 * 1024;
const LARGE_BYTES = 16 * 1024 * 1024;

export async function digest(buffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),x=>x.toString(16).padStart(2,'0')).join('');
}
function modelResponse(bytes,meta) {
  return new Response(bytes,{headers:{
    'content-type':meta.file.endsWith('.json')?'application/json':'application/octet-stream',
    'content-length':String(meta.bytes),'cross-origin-resource-policy':'cross-origin'
  }});
}
async function verifiedBytes(response,meta) {
  if(!response?.ok)return null;
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength!==meta.bytes || await digest(bytes)!==meta.sha256)return null;
  return bytes;
}
export async function verifiedResponse(response,meta) {
  const bytes=await verifiedBytes(response,meta);
  return bytes?modelResponse(bytes,meta):null;
}
function transactionDone(tx) {
  return new Promise((resolve,reject)=>{
    tx.oncomplete=()=>resolve();
    tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));
    tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction failed'));
  });
}
export async function openChunkStore(factory=globalThis.indexedDB) {
  if(!factory)return null;
  const db=await new Promise((resolve,reject)=>{
    const request=factory.open(DB_NAME,1);
    request.onerror=()=>reject(request.error||new Error('IndexedDB unavailable'));
    request.onblocked=()=>reject(new Error('IndexedDB upgrade blocked'));
    request.onupgradeneeded=()=>{
      const database=request.result;
      if(!database.objectStoreNames.contains('chunks'))database.createObjectStore('chunks');
      if(!database.objectStoreNames.contains('assets'))database.createObjectStore('assets');
    };
    request.onsuccess=()=>resolve(request.result);
  });
  async function get(store,key) {
    return new Promise((resolve,reject)=>{
      const request=db.transaction(store,'readonly').objectStore(store).get(key);
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('IndexedDB read failed'));
    });
  }
  async function write(store,entries) {
    const tx=db.transaction(store,'readwrite'),target=tx.objectStore(store);
    const finished=transactionDone(tx);
    for(const [key,value] of entries) {
      if(value===null)target.delete(key);
      else target.put(value,key);
    }
    await finished;
  }
  return {
    async read(meta) {
      const record=await get('assets',meta.url);
      if(!record||record.bytes!==meta.bytes||record.sha256!==meta.sha256)return null;
      const bytes=new Uint8Array(meta.bytes);
      for(let i=0;i<record.count;i++) {
        const part=await get('chunks',meta.url+'#'+i);
        const offset=i*CHUNK_BYTES,expected=Math.min(CHUNK_BYTES,meta.bytes-offset);
        if(!part||part.byteLength!==expected) {
          await write('assets',[[meta.url,null]]);
          return null;
        }
        bytes.set(new Uint8Array(part),offset);
      }
      if(await digest(bytes)!==meta.sha256) {
        await write('assets',[[meta.url,null]]);
        return null;
      }
      return modelResponse(bytes,meta);
    },
    async write(meta,input) {
      const bytes=new Uint8Array(input),count=Math.ceil(bytes.length/CHUNK_BYTES);
      if(bytes.length!==meta.bytes)throw Error('Model size mismatch');
      // A record is published only after every chunk is durably committed.
      await write('assets',[[meta.url,null]]);
      for(let i=0;i<count;i+=4) {
        const batch=[];
        for(let n=i;n<Math.min(count,i+4);n++) {
          batch.push([meta.url+'#'+n,bytes.slice(n*CHUNK_BYTES,Math.min(bytes.length,(n+1)*CHUNK_BYTES))]);
        }
        await write('chunks',batch);
      }
      await write('assets',[[meta.url,{bytes:meta.bytes,sha256:meta.sha256,count}]]);
    }
  };
}
async function storageError(error,meta) {
  let available='';
  try {
    const estimate=await globalThis.navigator?.storage?.estimate?.();
    if(Number.isFinite(estimate?.quota)&&Number.isFinite(estimate?.usage)) {
      available='（推定空き容量 '+Math.max(0,(estimate.quota-estimate.usage)/1e6).toFixed(0)+' MB）';
    }
  }catch{}
  return new Error('モデルを端末に保存できませんでした'+available+'。ブラウザの空き容量を確認し、他のタブを閉じて再試行してください。'
    +' 保存できなかったファイル: '+meta.model+'/'+meta.file+'。原因: '+(error?.message||String(error)));
}
export async function prepareAssets(manifest,{
  progress=()=>{},fetcher=fetch,cacheStorage=caches,indexedDBFactory=globalThis.indexedDB,
  chunkStore=undefined,chunkThresholdBytes=LARGE_BYTES
}={}) {
  const store=chunkStore===undefined?await openChunkStore(indexedDBFactory).catch(()=>null):chunkStore;
  const cache=await cacheStorage.open(MODEL_CACHE).catch(()=>null);
  const safeMatch=async url=>cache?cache.match(url).catch(()=>null):null;
  const byUrl=new Map(manifest.assets.map(meta=>[meta.url,meta]));
  let loaded=0;const total=manifest.assets.reduce((n,m)=>n+m.bytes,0);
  for(const meta of manifest.assets) {
    let response=await verifiedResponse(await safeMatch(meta.url),meta);
    if(!response&&store)response=await store.read(meta).catch(()=>null);
    if(!response) {
      if(cache)await cache.delete(meta.url).catch(()=>{});
      const network=await fetcher(meta.url,{credentials:'omit',referrerPolicy:'no-referrer'});
      if(!network.ok)throw Error('Model download failed ('+network.status+'): '+meta.model);
      let downloaded;
      if(network.body?.getReader) {
        const reader=network.body.getReader(),bytes=new Uint8Array(meta.bytes);let doneBytes=0;
        while(true) {
          const {value,done}=await reader.read();if(done)break;
          if(doneBytes+value.byteLength>meta.bytes){await reader.cancel();throw Error('Model size mismatch');}
          bytes.set(value,doneBytes);doneBytes+=value.byteLength;
          progress({loaded:loaded+doneBytes,total,model:meta.model});
        }
        if(doneBytes!==meta.bytes)throw Error('Model size mismatch');
        downloaded=bytes.buffer;
      }else downloaded=await network.arrayBuffer();
      if(downloaded.byteLength!==meta.bytes||await digest(downloaded)!==meta.sha256)
        throw Error('Model integrity check failed. Retry the download.');
      try {
        if(store&&meta.bytes>=chunkThresholdBytes) {
          await store.write(meta,downloaded);
        } else if(cache) {
          try{await cache.put(meta.url,modelResponse(downloaded,meta));}
          catch(error){if(!store)throw error;await store.write(meta,downloaded);}
        } else if(store)await store.write(meta,downloaded);
        else throw Error('No model storage is available');
      }catch(error){throw await storageError(error,meta);}
    }
    loaded+=meta.bytes;progress({loaded,total,model:meta.model});
  }
  // Transformers.js uses match() when it loads each fixed URL. Do not write a
  // second, unverified copy of the model into its own cache.
  return {match:async url=>{
    const meta=byUrl.get(String(url));if(!meta)return undefined;
    const cached=await verifiedResponse(await safeMatch(meta.url),meta);
    return cached||(store?await store.read(meta).catch(()=>null):null)||undefined;
  }};
}
