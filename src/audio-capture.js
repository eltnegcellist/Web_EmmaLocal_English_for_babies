export class EmmaMicrophone {
  constructor({ onState, onUtterance, shouldIgnore }) {
    this.onState = onState;
    this.onUtterance = onUtterance;
    this.shouldIgnore = shouldIgnore;
    this.stream = null;
    this.context = null;
    this.node = null;
    this.vad = new AdaptiveEndpointDetector();
  }

  async start() {
    this.stream = await withTimeout(
      navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      }),
      15000,
      'マイクの開始が完了しませんでした。ブラウザのサイト設定でマイクを許可してから、もう一度お試しください。'
    );
    this.context = new AudioContext({ latencyHint: 'interactive' });
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    await this.context.audioWorklet.addModule(new URL('../worklets/pcm-capture-worklet.js', import.meta.url));
    const source = this.context.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.context, 'emma-pcm-capture');
    const silent = this.context.createGain();
    silent.gain.value = 0;
    source.connect(this.node).connect(silent).connect(this.context.destination);
    this.node.port.onmessage = (event) => this.handleFrame(event.data);
    this.onState?.('listening');
  }

  handleFrame(frame) {
    if (this.shouldIgnore?.()) {
      this.vad.resetSpeechOnly();
      return;
    }
    const result = this.vad.push(frame, this.context.sampleRate, performance.now());
    if (result.event === 'speech-start') this.onState?.('endpoint');
    if (result.event === 'utterance') {
      const downsampled = resampleLinear(result.audio, this.context.sampleRate, 16000);
      if (downsampled.length >= 16000 * 0.32) this.onUtterance?.(downsampled);
      this.onState?.('listening');
    }
  }

  resetDetector() {
    this.vad.reset();
  }

  async ensureActive() {
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  async stop() {
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.context && this.context.state !== 'closed') await this.context.close();
    this.stream = null;
    this.context = null;
    this.node = null;
    this.vad.reset();
  }
}

class AdaptiveEndpointDetector {
  constructor() { this.reset(); }
  reset() {
    this.noiseFloor = 0.006;
    this.preRoll = [];
    this.preRollSamples = 0;
    this.inSpeech = false;
    this.frames = [];
    this.speechStartAt = 0;
    this.lastVoiceAt = 0;
    this.aboveSince = 0;
  }
  resetSpeechOnly() {
    this.inSpeech = false;
    this.frames = [];
    this.aboveSince = 0;
    this.preRoll = [];
    this.preRollSamples = 0;
  }
  push(frame, sampleRate, now) {
    const rms = rootMeanSquare(frame);
    const speechThreshold = Math.max(0.012, this.noiseFloor * 3.0);
    const silenceThreshold = Math.max(0.008, this.noiseFloor * 1.65);

    if (!this.inSpeech && rms < speechThreshold) {
      const capped = Math.min(rms, 0.04);
      this.noiseFloor = this.noiseFloor * 0.985 + capped * 0.015;
    }

    if (!this.inSpeech) {
      this.preRoll.push(frame);
      this.preRollSamples += frame.length;
      const target = Math.floor(sampleRate * 0.35);
      while (this.preRollSamples > target && this.preRoll.length > 1) {
        this.preRollSamples -= this.preRoll[0].length;
        this.preRoll.shift();
      }

      if (rms >= speechThreshold) {
        if (!this.aboveSince) this.aboveSince = now;
        if (now - this.aboveSince >= 110) {
          this.inSpeech = true;
          this.speechStartAt = this.aboveSince;
          this.lastVoiceAt = now;
          this.frames = [...this.preRoll];
          this.preRoll = [];
          this.preRollSamples = 0;
          return { event: 'speech-start' };
        }
      } else {
        this.aboveSince = 0;
      }
      return { event: 'none' };
    }

    this.frames.push(frame);
    if (rms >= silenceThreshold) this.lastVoiceAt = now;
    const speechMs = now - this.speechStartAt;
    const silenceMs = now - this.lastVoiceAt;
    const neededSilence = speechMs < 2000 ? 850 : speechMs < 4000 ? 1100 : speechMs < 8000 ? 1400 : 1750;
    if ((speechMs > 320 && silenceMs >= neededSilence) || speechMs >= 30000) {
      const audio = concatFloat32(this.frames);
      this.inSpeech = false;
      this.frames = [];
      this.aboveSince = 0;
      return { event: 'utterance', audio };
    }
    return { event: 'none' };
  }
}

function rootMeanSquare(frame) {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / Math.max(1, frame.length));
}
function concatFloat32(chunks) {
  const length = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Float32Array(length);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}
function resampleLinear(input, sourceRate, targetRate) {
  if (sourceRate === targetRate) return input.slice();
  const ratio = sourceRate / targetRate;
  const length = Math.floor(input.length / ratio);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const p = i * ratio;
    const a = Math.floor(p);
    const b = Math.min(a + 1, input.length - 1);
    const t = p - a;
    out[i] = input[a] * (1 - t) + input[b] * t;
  }
  return out;
}


function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
