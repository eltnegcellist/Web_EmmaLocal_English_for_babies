// Isolated test worker: same Moonshine Small Streaming implementation as app.
import {ModelArch,Transcriber,loadEmmaMoonshineModule} from '../../src/moonshine-module.js';
let instance=null;
self.onmessage=async ({data})=>{
  const {id,type}=data;
  try{
    if(type==='init'){
      if(self.crossOriginIsolated!==true || typeof SharedArrayBuffer!=='function')
        throw Error('Moonshine Small requires COOP/COEP cross-origin isolation. Check the benchmark page.');
      const module=await loadEmmaMoonshineModule();
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
