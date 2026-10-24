// Adaptive ACFT Small audio-context policy. Pure functions, 16kHz mono PCM.
// Auto-pick 5s/10s context. Longer utterances are segmented at a nearby quiet
// area, with overlap; no source samples may be dropped.
export const SAMPLE_RATE=16000;
export const FIVE_SECONDS=SAMPLE_RATE*5;
export const TEN_SECONDS=SAMPLE_RATE*10;
export const OVERLAP_SAMPLES=Math.round(SAMPLE_RATE*0.25);
export const MAX_UTTERANCE_SAMPLES=SAMPLE_RATE*90;
export function windowSecondsForSamples(count){
  if(!Number.isSafeInteger(count)||count<=0)throw Error('Invalid PCM sample count');
  if(count<=FIVE_SECONDS)return 5;
  if(count<=TEN_SECONDS)return 10;
  return null;
}
function rms(samples,from,to){
  let sum=0;
  for(let i=from;i<to;i++)sum+=samples[i]*samples[i];
  return sum/Math.max(1,to-from);
}
function chooseBoundary(samples,from){
  // Look for the quietest 60ms region close to the 8.5s target boundary.
  // 8.5s target leaves space for 250ms overlap, always below a 10s window.
  const start=Math.min(samples.length,from+SAMPLE_RATE*7);
  const end=Math.min(samples.length,from+SAMPLE_RATE*9);
  const stride=SAMPLE_RATE/20,span=Math.round(SAMPLE_RATE*.06);
  let best=Math.min(samples.length,from+Math.round(SAMPLE_RATE*8.5));
  let score=Infinity;
  for(let candidate=start;candidate<=end-span;candidate+=stride){
    const energy=rms(samples,candidate,candidate+span);
    const bias=Math.abs(candidate-(from+SAMPLE_RATE*8.5))/SAMPLE_RATE*0.000004;
    if(energy+bias<score){score=energy+bias;best=candidate;}
  }
  return best;
}
export function planAdaptiveWindows(samples){
  if(!(samples instanceof Float32Array)||!samples.length)throw Error('Expected non-empty Float32Array at 16kHz');
  if(samples.length>MAX_UTTERANCE_SAMPLES)throw Error('Utterance longer than 90 seconds');
  const count=samples.length;
  const single=windowSecondsForSamples(count);
  if(single)return [{start:0,end:count,windowSeconds:single}];
  const windows=[];
  let start=0;
  while(count-start>TEN_SECONDS){
    const boundary=chooseBoundary(samples,start);
    if(boundary<=start||boundary-start>TEN_SECONDS)throw Error('Invalid audio segmentation boundary');
    windows.push({start,end:boundary,windowSeconds:windowSecondsForSamples(boundary-start)});
    start=boundary-OVERLAP_SAMPLES;
  }
  if(count>start)windows.push({start,end:count,windowSeconds:windowSecondsForSamples(count-start)});
  if(windows.some(x=>!x.windowSeconds||x.end<=x.start))throw Error('Invalid audio segmentation plan');
  if(windows[0].start!==0||windows.at(-1).end!==count)throw Error('Audio segmentation omitted a boundary');
  for(let i=1;i<windows.length;i++){
    if(windows[i].start>windows[i-1].end)throw Error('Audio segmentation dropped samples');
    if(windows[i].start>=windows[i-1].end)throw Error('Audio segments must overlap');
  }
  return windows;
}
const clean=s=>String(s??'').trim();
function normalized(s){return clean(s).normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]/gu,'');}
export function mergeSegmentTexts(texts){
  let merged='';
  for(const raw of texts){
    const next=clean(raw);
    if(!next)continue;
    if(!merged){merged=next;continue;}
    if(normalized(merged)===normalized(next))continue;
    // Deduplicate verbatim suffix/prefix across 250ms overlaps, with a minimum
    // of 3 characters to avoid erasing short particles or single characters.
    const lower=merged.normalize('NFKC').toLowerCase(),right=next.normalize('NFKC').toLowerCase();
    let match=0;
    for(let n=Math.min(32,lower.length,right.length);n>=3;n--){
      if(lower.slice(-n)===right.slice(0,n)){match=n;break;}
    }
    if(match){merged+=next.slice(match);continue;}
    const cjk=/[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]/u;
    const join=cjk.test(merged.at(-1))||cjk.test(next[0])?'':' ';
    merged+=join+next;
  }
  return merged.trim();
}
