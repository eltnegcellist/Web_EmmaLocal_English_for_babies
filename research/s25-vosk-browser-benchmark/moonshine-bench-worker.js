// Isolated test worker: same Moonshine Small Streaming implementation as app.
// Lazy import so any browser module error is reported to UI with its cause.
let moonshineImports;
async function getMoonshine(){
  return moonshineImports ||= import('../../src/moonshine-module.js').catch(e=>{
    moonshineImports=null;throw Error('Moonshine module import failed: '+(e?.message||String(e)),{cause:e});
  });
}
let instance=null;
self.onmessage=async ({data})=>{
  const {id,type}=data;
  try{
    if(type==='ping'){
      self.postMessage({type:'reply',id,ready:true,worker:'moonshine',isolated:self.crossOriginIsolated===true});
    }else if(type==='probe'){
      const m=await getMoonshine();
      if(typeof m.Transcriber?.load!=='function'||typeof m.loadEmmaMoonshineModule!=='function')
        throw Error('Moonshine runtime exports are incomplete');
      self.postMessage({type:'reply',id,probed:true,engine:'moonshine'});
    }else if(type==='init'){
      if(self.crossOriginIsolated!==true || typeof SharedArrayBuffer!=='function')
        throw Error('Moonshine Small requires COOP/COEP cross-origin isolation. Check the benchmark page.');
      self.postMessage({type:'stage',stage:'Importing Moonshine app runtime'});
      const {ModelArch,Transcriber,loadEmmaMoonshineModule}=await getMoonshine();
      self.postMessage({type:'stage',stage:'Loading Moonshine WASM'});
      const module=await loadEmmaMoonshineModule();
      self.postMessage({type:'stage',stage:'Downloading Moonshine Small streaming model'});
      const language=data.language==='ja'?'ja':'en';
      instance?.close?.();
      instance=await Transcriber.load({
        module,language,modelArch:ModelArch.SmallStreaming,
        options:{vad_threshold:'0',vad_max_segment_duration:'1000',max_tokens_per_second:'13.0'},
        onProgress:(loaded,total)=>self.postMessage({type:'progress',loaded,total}),
      });
      self.postMessage({type:'reply',id,ready:true,engine:'Moonshine Small Streaming',language});
    } else if(type==='run'){
      if(!instance)throw Error('Moonshine has not loaded.');
      const t0=performance.now();
      const result=instance.transcribe(new Float32Array(data.audio),{sampleRate:16000});
      const text=Array.isArray(result?.lines)?result.lines.map(x=>x?.text||'').join(' ').trim():'';
      self.postMessage({type:'reply',id,text,internalMs:performance.now()-t0});
    }else if(type==='dispose'){
      instance?.close?.();instance=null;
      self.postMessage({type:'reply',id,disposed:true});
    }
  }catch(err){self.postMessage({type:'error',id,message:err?.message||String(err)});}
};
