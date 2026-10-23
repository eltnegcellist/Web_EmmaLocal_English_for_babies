// ONNX session-level timing for the pinned Transformers.js v3.8.1 Whisper model.
// Observational only: do not change tensor values, decoding, or scheduling.
export function attachWhisperSessionProfiler(model,{now=()=>performance.now()}={}) {
  const fresh=()=>({encoderMs:0,decoderMs:0,encoderRuns:0,decoderRuns:0});
  let totals=fresh(),active=false;
  function patch(session,key){
    if(!session||typeof session.run!=='function')return false;
    const original=session.run;
    try{
      session.run=async function(...args){
        const measure=active,start=measure?now():0;
        try{return await original.apply(this,args);}
        finally{if(measure){
          totals[key+'Ms']+=Math.max(0,now()-start);
          totals[key+'Runs']++;
        }}
      };
      return session.run!==original;
    }catch{return false;}
  }
  // Seq2seq encoder resides in sessions.model; decoder in decoder_model_merged.
  const encoderOK=patch(model?.sessions?.model,'encoder');
  const decoderOK=patch(model?.sessions?.decoder_model_merged,'decoder');
  const available=encoderOK&&decoderOK;
  return {
    available,
    start(){totals=fresh();active=available;},
    snapshot(){return available?{
      encoderMs:Math.round(totals.encoderMs),
      decoderMs:Math.round(totals.decoderMs),
      encoderRuns:totals.encoderRuns,decoderRuns:totals.decoderRuns
    }:null;},
    stop(){const result=this.snapshot();active=false;return result;}
  };
}
