// Same fixed probability/onset policy as the Mac benchmark. No PCM filtering.
export class SileroEndpointPolicy {
  constructor({ silenceMs = 1100 } = {}) { this.silenceMs = silenceMs; this.reset(); }
  reset() { this.inSpeech=false; this.onset=0; this.voiced=0; this.silence=0; }
  push(probability, count=512) {
    if(!Number.isFinite(probability)||probability<0||probability>1) throw Error('Invalid Silero probability');
    const voice=probability >= (this.inSpeech ? .35 : .5);
    if(!this.inSpeech) {
      this.onset=voice ? this.onset+count : 0;
      if(this.onset>=160*16) { this.inSpeech=true;this.voiced=this.onset;this.onset=0;this.silence=0;return 'speech-start'; }
    } else if(voice) { this.voiced+=count;this.silence=0; }
    else {
      this.silence+=count;
      if(this.voiced<450*16 && this.silence>=700*16) { this.reset();return 'cancel'; }
      if(this.voiced>=450*16 && this.silence>=this.silenceMs*16) { this.reset();return 'utterance'; }
    }
    return 'none';
  }
}

// Streaming, phase-preserving analysis resampling; captured ASR PCM is untouched.
export class AnalysisResampler {
  constructor(sourceRate) { this.ratio=sourceRate/16000;this.reset(); }
  reset() { this.offset=0;this.next=0;this.previous=0; }
  push(frame) {
    const out=[]; const end=this.offset+frame.length-1;
    while(this.next<=end) {
      const i=Math.floor(this.next);const t=this.next-i;
      if(t>0 && i+1>end) break;
      const a=i<this.offset ? this.previous : frame[i-this.offset];
      const b=t>0 ? frame[i+1-this.offset] : a;
      out.push(a*(1-t)+b*t);this.next+=this.ratio;
    }
    this.offset+=frame.length;if(frame.length)this.previous=frame[frame.length-1];
    return out;
  }
}

export class RawPcmWindow {
  constructor(capacity) { this.capacity=capacity;this.clear(); }
  clear() { this.chunks=[];this.head=0;this.end=0; }
  append(frame) {
    this.chunks.push({ start:this.end,data:frame });this.end+=frame.length;
    while(this.head<this.chunks.length && this.chunks[this.head].start+this.chunks[this.head].data.length<=this.end-this.capacity)this.head++;
    if(this.head>2048) { this.chunks=this.chunks.slice(this.head);this.head=0; }
  }
  slice(begin,end=this.end) {
    begin=Math.max(begin,end-this.capacity,0);end=Math.min(end,this.end);
    const parts=[];
    for(let i=this.head;i<this.chunks.length;i++) {
      const c=this.chunks[i];const a=Math.max(begin,c.start),b=Math.min(end,c.start+c.data.length);
      if(b>a)parts.push(c.data.subarray(a-c.start,b-c.start));
    }
    const out=new Float32Array(parts.reduce((n,c)=>n+c.length,0));let offset=0;
    for(const part of parts){out.set(part,offset);offset+=part.length;}return out;
  }
}
