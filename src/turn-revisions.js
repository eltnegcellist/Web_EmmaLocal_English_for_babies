// Holds the exact ASR PCM of a turn while reply preparation is speculative.
// The microphone, not text heuristics or a longer silence timer, decides continuations.
export class TurnRevisions {
  constructor({ maxSamples = 16000 * 75 } = {}) {
    this.maxSamples = maxSamples;
    this.version = 0;
    this.reset();
  }
  get hasAudio() { return this.parts.length > 0; }
  reset() {
    this.version++;
    this.parts = [];
    this.sampleCount = 0;
    this.continuing = false;
  }
  speechStart() {
    if (!this.hasAudio || this.continuing) return false;
    this.continuing = true;
    this.version++;
    return true;
  }
  append(audio) {
    if (!(audio instanceof Float32Array) || !audio.length) throw Error('Expected captured PCM');
    if (this.sampleCount + audio.length > this.maxSamples) this.reset();
    this.parts.push(audio.slice());
    this.sampleCount += audio.length;
    this.continuing = false;
    const version = ++this.version;
    const merged = new Float32Array(this.sampleCount);
    let offset = 0;
    for (const part of this.parts) { merged.set(part, offset); offset += part.length; }
    return { version, audio: merged };
  }
  isCurrent(version) { return this.hasAudio && !this.continuing && version === this.version; }
}
