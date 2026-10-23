// Research-only ACFT CPU encoder benchmark. No microphone or transcripts.
export const SPECS=Object.freeze({
  base5:{tier:'base',seconds:5,frames:500,approxMB:97},
  base10:{tier:'base',seconds:10,frames:1000,approxMB:99},
  small5:{tier:'small',seconds:5,frames:500,approxMB:273},
  small10:{tier:'small',seconds:10,frames:1000,approxMB:276},
});
export function getSpec(id) {
  if(!Object.hasOwn(SPECS,id))throw Error('Unknown ACFT benchmark model');
  const spec=SPECS[id];
  return {...spec,id,url:`https://huggingface.co/litert-community/whisper-acft/resolve/main/${spec.tier}/acft_whisper_${spec.tier}_${spec.seconds}s_drq.tflite`};
}
export function checkedEncoderInput(details,frames) {
  if(!Array.isArray(details)||details.length!==1)throw Error('Expected one encoder input');
  const item=details[0],shape=Array.from(item.shape||[]);
  if(shape.join(',')!==[1,80,frames].join(',')||item.dtype!=='float32'||!item.name)
    throw Error('Unexpected encode shape/dtype: '+JSON.stringify({shape,dtype:item.dtype,name:item.name}));
  return {name:item.name,shape};
}
export function sampleMel(frames){
  const out=new Float32Array(80*frames);
  for(let b=0;b<80;b++)for(let t=0;t<frames;t++)
    out[b*frames+t]=-0.8+0.25*Math.sin(b/9+t/17)+0.09*Math.cos(b/11+t/7);
  return out;
}
export function median(xs){
  if(!xs?.length||xs.some(x=>!Number.isFinite(x)||x<0))throw Error('Invalid timing sample');
  const a=[...xs].sort((x,y)=>x-y),n=Math.floor(a.length/2);
  return a.length%2?a[n]:(a[n-1]+a[n])/2;
}
