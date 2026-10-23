// Research-only LiteRT.js 2.5.3 WASM URL verification and Emscripten locator.
// In a Worker, Emscripten can resolve its binary relative to self.location
// (our GitHub Pages worker.js), even though its glue JS came from the CDN.
// Passing this FileLocator to ModuleFactory avoids a GitHub Pages 404 HTML
// response being instantiated as WebAssembly.
export const LITERT_WASM_CANDIDATES=Object.freeze([
  'https://cdn.jsdelivr.net/npm/@litertjs/core@2.5.3/wasm/',
  'https://unpkg.com/@litertjs/core@2.5.3/wasm/',
]);
export const LITERT_WASM_PROBES=Object.freeze([
  'litert_wasm_internal.wasm',
  'litert_wasm_compat_internal.wasm',
]);
export function wasmFileLocator(base) {
  const root=new URL(base);
  if(!root.href.endsWith('/'))throw Error('WASM directory must end in /');
  return {locateFile:filename=>new URL(filename,root).href};
}
export function wasmMagic(bytes) {
  return bytes?.length>=4&&bytes[0]===0&&bytes[1]===97&&bytes[2]===115&&bytes[3]===109;
}
export async function probeWasmFile(url,fetcher=fetch) {
  // A single-byte range request is CORS-safelisted and avoids transferring
  // the full 9+ MB just to inspect the magic bytes when Range is supported.
  const response=await fetcher(url,{headers:{Range:'bytes=0-3'},cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status+' for '+url);
  let reader=null;
  try {
    if(!response.body?.getReader)throw Error('No readable response body for '+url);
    reader=response.body.getReader();
    const magic=[];
    while(magic.length<4){
      const {done,value}=await reader.read();
      if(done)break;
      for(const byte of value){
        magic.push(byte);
        if(magic.length===4)break;
      }
    }
    if(!wasmMagic(magic)){
      const hex=magic.map(n=>n.toString(16).padStart(2,'0')).join(' ');
      throw Error('Invalid WASM magic '+hex+'; content-type='+
        (response.headers.get('content-type')||'unknown')+'; URL='+url);
    }
    return true;
  }finally{
    if(reader){try{await reader.cancel();}catch{} try{reader.releaseLock();}catch{}}
  }
}
export async function selectValidLiteRtWasm({
  bases=LITERT_WASM_CANDIDATES,fetcher=fetch,onCandidate=()=>{}
}={}) {
  const errors=[];
  for(const base of bases){
    try {
      onCandidate(base);
      const locator=wasmFileLocator(base);
      for(const name of LITERT_WASM_PROBES){
        await probeWasmFile(locator.locateFile(name),fetcher);
      }
      return {base,locator};
    }catch(e){errors.push(String(e?.message||e));}
  }
  throw Error('No valid LiteRT WASM source: '+errors.join(' | '));
}
