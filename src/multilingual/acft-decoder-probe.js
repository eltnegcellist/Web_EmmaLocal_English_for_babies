// Shape-safe ACFT decoder probe, using the published encode/decode signature.
// Synthetic prompt and mel only. It does NOT validate transcription accuracy.
export function inspectDecoderSignature(inputs,outputs,encodedShape) {
  if(!Array.isArray(inputs)||inputs.length!==3)throw Error('Expected 3 decoder signature inputs');
  const toInfo=d=>({name:String(d.name),dtype:String(d.dtype),shape:Array.from(d.shape||[])});
  const details=inputs.map(toInfo);
  const audio=details.find(d=>d.shape.join(',')===encodedShape.join(',')&&d.dtype==='float32');
  const tokens=details.find(d=>d.dtype==='int32'&&d.shape.length===2&&d.shape[0]===1&&d.shape[1]>=16);
  const length=tokens?.shape[1];
  // ACFT TFLite actual signature uses [1,1,128,128] for the causal mask.
  // Also permit the historical [1,128,128] shape for compatibility.
  const mask=details.find(d=>{
    if(d===audio||d===tokens||d.dtype!=='float32'||!length)return false;
    const sh=d.shape;
    return (sh.length===4&&sh[0]===1&&sh[1]===1&&sh[2]===length&&sh[3]===length) ||
      (sh.length===3&&sh[0]===1&&sh[1]===length&&sh[2]===length);
  });
  if(!audio||!tokens||!mask) {
    throw Error('Unrecognized decoder signature; decoded input metadata: '+JSON.stringify(details)+
      ' encodedShape='+JSON.stringify(encodedShape));
  }
  if(new Set([audio.name,tokens.name,mask.name]).size!==3)throw Error('Decoder input names must be unique');
  if(tokens.shape[1]>256)throw Error('Refusing unusually large token context');
  return {audio,mask,tokens,outputs:(outputs||[]).map(toInfo)};
}
export function fakeDecoderInputs(spec,languageToken=50259) {
  const length=spec.tokens.shape[1];
  const tokens=new Int32Array(length);
  tokens.set([50258,languageToken,50359,50363]);
  // Flattened storage is L×L for both supported ranks: [1,L,L] and [1,1,L,L].
  const elementCount=spec.mask.shape.reduce((acc,size)=>acc*size,1);
  if(elementCount!==length*length)throw Error('Mask size does not match token context');
  const mask=new Float32Array(elementCount);
  for(let i=0;i<length;i++)for(let j=i+1;j<length;j++)mask[i*length+j]=-1e9;
  return {tokens,mask};
}
