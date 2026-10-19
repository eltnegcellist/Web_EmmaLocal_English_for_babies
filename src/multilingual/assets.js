// Only pinned public model assets are downloaded. No audio leaves the device.
export const MODEL_CACHE = 'mitsukotoba-multilingual-v1';
export async function digest(buffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),x=>x.toString(16).padStart(2,'0')).join('');
}
export async function verifiedResponse(response,meta) {
  if(!response?.ok)return null;
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength!==meta.bytes || await digest(bytes)!==meta.sha256)return null;
  return new Response(bytes,{headers:{'content-type':meta.file.endsWith('.json')?'application/json':'application/octet-stream',
    'content-length':String(bytes.byteLength),'cross-origin-resource-policy':'cross-origin'}});
}
export async function prepareAssets(manifest,{progress=()=>{},fetcher=fetch,cacheStorage=caches}={}) {
  const cache=await cacheStorage.open(MODEL_CACHE);
  let loaded=0;const total=manifest.assets.reduce((n,m)=>n+m.bytes,0);
  for(const meta of manifest.assets) {
    let response=await verifiedResponse(await cache.match(meta.url),meta);
    if(!response) {
      await cache.delete(meta.url);
      const network=await fetcher(meta.url,{credentials:'omit',referrerPolicy:'no-referrer'});
      if(!network.ok)throw Error(`Model download failed (${network.status}): ${meta.model}`);
      if(network.body?.getReader) {
        const reader=network.body.getReader(),chunks=[];let doneBytes=0;
        while(true){const {value,done}=await reader.read();if(done)break;chunks.push(value);doneBytes+=value.byteLength;
          if(doneBytes>meta.bytes){await reader.cancel();throw Error('Model size mismatch');}
          progress({loaded:loaded+doneBytes,total,model:meta.model});}
        const bytes=new Uint8Array(doneBytes);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
        response=await verifiedResponse(new Response(bytes),meta);
      }else response=await verifiedResponse(network,meta);
      if(!response)throw Error('Model integrity check failed. Retry the download.');
      await cache.put(meta.url,response.clone());
    }
    loaded+=meta.bytes;progress({loaded,total,model:meta.model});
  }
  return cache;
}
