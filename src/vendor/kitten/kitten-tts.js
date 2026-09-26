/**
 * KittenTTS — main class.
 *
 * Usage:
 *   const tts = await KittenTTS.from_pretrained('KittenML/kitten-tts-nano-0.8');
 *   const audio = await tts.generate('Hello world', { voice: 'Bella' });
 *   await audio.save('output.wav');
 */

import { downloadModel } from './model-loader.js';
import { loadNpz } from './npz-loader.js';
import { TextCleaner, basic_english_tokenize } from './text-cleaner.js';
import { TextPreprocessor } from './preprocess.js';
import { phonemize } from './phonemizer.js';
import { RawAudio } from './audio.js';

const SAMPLE_RATE = 24000;
const AUDIO_TRIM = 5000;  // trim last N samples from model output
const MAX_CHUNK_CHARS = 400;

const ORT_MODULE_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.0/dist/ort.min.mjs';
const ORT_WASM_BASE = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.0/dist/';
let ortRuntimePromise = null;

async function getOrtRuntime() {
  if (!ortRuntimePromise) {
    ortRuntimePromise = import(ORT_MODULE_URL).then((ort) => {
      ort.env.wasm.wasmPaths = ORT_WASM_BASE;
      const isolated = typeof self !== 'undefined' && self.crossOriginIsolated;
      const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 1) : 1;
      ort.env.wasm.numThreads = isolated ? Math.max(1, Math.min(4, cores)) : 1;
      ort.env.wasm.simd = true;
      return ort;
    });
  }
  return ortRuntimePromise;
}

/** Voice aliases: friendly name → internal NPZ key */
const DEFAULT_VOICE_ALIASES = {
  Bella: 'expr-voice-2-f',
  Jasper: 'expr-voice-2-m',
  Luna: 'expr-voice-3-f',
  Bruno: 'expr-voice-3-m',
  Rosie: 'expr-voice-4-f',
  Hugo: 'expr-voice-4-m',
  Kiki: 'expr-voice-5-f',
  Leo: 'expr-voice-5-m',
};
const DEFAULT_VOICE = 'Leo';

export class KittenTTS {
  /** @private */
  constructor(session, voices, config) {
    this._session = session;
    this._voices = voices;
    this._config = config;
    this._cleaner = new TextCleaner();
    this._preprocessor = new TextPreprocessor({ remove_punctuation: false });

    // Constants
    this.sampleRate = config.sample_rate || SAMPLE_RATE;
    this.voiceAliases = { ...DEFAULT_VOICE_ALIASES, ...(config.voice_aliases || {}) };
    this.speedPriors = config.speed_priors || {};
    this.availableVoices = Object.keys(this._voices);
  }

  /**
   * Load model from HuggingFace Hub.
   *
   * @param {string} [modelId='KittenML/kitten-tts-nano-0.8']
   * @param {{ dtype?: string, cacheDir?: string }} [opts]
   * @returns {Promise<KittenTTS>}
   */
  static async from_pretrained(modelId = 'KittenML/kitten-tts-nano-0.8', opts = {}) {
    const { modelBuffer, voicesBuffer, config } = await downloadModel(modelId, opts);

    opts.onStage?.('runtime');
    // Browser-only runtime: never probe Node.js or import fs/path/os.
    const ort = await getOrtRuntime();
    const sessionOptions = { executionProviders: ['wasm'] };
    opts.onStage?.('onnx-session');
    const session = await ort.InferenceSession.create(modelBuffer, sessionOptions);
    opts.onStage?.('voices');
    const voices = await loadNpz(voicesBuffer);
    opts.onStage?.('ready');

    return new KittenTTS(session, voices, config);
  }

  /**
   * List available friendly voice names.
   * @returns {string[]}
   */
  list_voices() {
    return Object.keys(this.voiceAliases);
  }

  /**
   * Generate audio for the given text.
   *
   * @param {string} text
   * @param {{ voice?: string, speed?: number, clean?: boolean }} [opts]
   * @returns {Promise<RawAudio>}
   */
  async generate(text, opts = {}) {
    const { voice = DEFAULT_VOICE, speed = 1.0, clean = true, nameHints = [] } = opts;
    const chunks = this._chunkText(text);

    const audioChunks = [];
    for (const chunk of chunks) {
      const inputs = await this._prepareInputs(chunk, voice, speed, clean, nameHints);
      const chunkAudio = await this._runInference(inputs);
      audioChunks.push(chunkAudio);
    }

    // Concatenate all chunks
    const totalLen = audioChunks.reduce((s, a) => s + a.length, 0);
    const combined = new Float32Array(totalLen);
    let offset = 0;
    for (const chunk of audioChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return new RawAudio(combined, SAMPLE_RATE);
  }

  /**
   * Stream audio chunk-by-chunk (one per sentence).
   *
   * @param {string} text
   * @param {{ voice?: string, speed?: number, clean?: boolean }} [opts]
   * @yields {{ text: string, audio: RawAudio }}
   */
  async *stream(text, opts = {}) {
    const { voice = DEFAULT_VOICE, speed = 1.0, clean = true, nameHints = [] } = opts;
    const chunks = this._chunkText(text);

    for (const chunk of chunks) {
      const inputs = await this._prepareInputs(chunk, voice, speed, clean, nameHints);
      const chunkAudio = await this._runInference(inputs);
      yield { text: chunk, audio: new RawAudio(chunkAudio, SAMPLE_RATE) };
    }
  }

  /**
   * Release the underlying ONNX Runtime session to free WebAssembly memory.
   * This is especially important in browsers to prevent memory leaks when switching models.
   */
  async release() {
    if (this._session && typeof this._session.release === 'function') {
      try {
        await this._session.release();
      } catch (err) {
        console.warn('[kitten-tts] Failed to release ONNX session:', err);
      }
    }
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  /**
   * Ensure text ends with punctuation. If not, add a comma.
   * Direct port from Python onnx_model.py.
   * @param {string} text
   * @returns {string}
   */
  _ensurePunctuation(text) {
    let t = text.trim();
    if (!t) return t;
    const last = t[t.length - 1];
    if (!['.', '!', '?', ',', ';', ':'].includes(last)) {
      t += ',';
    }
    return t;
  }

  /**
   * Split text into chunks for processing long texts.
   * Direct port from Python chunk_text().
   * @param {string} text
   * @returns {string[]}
   */
  _chunkText(text) {
    // Note: Python's re.split(r'[.!?]+', text) destroys the delimiter.
    const sentences = text.split(/[.!?]+/);
    const chunks = [];

    for (const s of sentences) {
      const sentence = s.trim();
      if (!sentence) continue;

      if (sentence.length <= MAX_CHUNK_CHARS) {
        chunks.push(this._ensurePunctuation(sentence));
      } else {
        // Split long sentences by words
        const words = sentence.split(/\s+/);
        let tempChunk = '';
        for (const word of words) {
          if (tempChunk.length + word.length + 1 <= MAX_CHUNK_CHARS) {
            tempChunk += tempChunk ? ` ${word}` : word;
          } else {
            if (tempChunk) {
              chunks.push(this._ensurePunctuation(tempChunk.trim()));
            }
            tempChunk = word;
          }
        }
        if (tempChunk) {
          chunks.push(this._ensurePunctuation(tempChunk.trim()));
        }
      }
    }

    return chunks;
  }

  /**
   * Preprocess text, phonemize, and build ONNX input tensors.
   * @private
   */
  async _prepareInputs(chunk, voiceName, speed, clean, nameHints = []) {
    // 1. Preprocess
    const processedText = clean ? this._preprocessor.process(chunk) : chunk;

    // 2. Phonemize
    let phonemes = await phonemize(processedText, { nameHints });

    // 3. Tokenize → IDs with padding
    phonemes = basic_english_tokenize(phonemes).join(' ');
    const tokenIds = this._cleaner.clean(phonemes);

    // 4. Look up voice
    if (this.voiceAliases[voiceName]) {
      voiceName = this.voiceAliases[voiceName];
    }
    if (!this._voices[voiceName]) {
      throw new Error(`Voice '${voiceName}' not found. Available: ${this.availableVoices.join(', ')}`);
    }
    const voiceEntry = this._voices[voiceName];
    const voiceData = voiceEntry.data;
    const [numStyles, styleDim] = voiceEntry.shape;

    // 5. Apply speed priors from config metadata exactly like Python does
    if (this.speedPriors[voiceName]) {
      speed = speed * this.speedPriors[voiceName];
    }

    // ref_id = min(text_len, N-1)
    const refId = Math.min(tokenIds.length, numStyles - 1);
    const style = voiceData.slice(refId * styleDim, (refId + 1) * styleDim);

    return {
      input_ids: tokenIds,
      style,
      styleDim,
      speed,
    };
  }

  /**
   * Run ONNX inference and return trimmed audio samples.
   * @private
   */
  async _runInference({ input_ids, style, styleDim, speed }) {
    const ort = await getOrtRuntime();

    const seqLen = input_ids.length;
    const inputIdsTensor = new ort.Tensor('int64',
      BigInt64Array.from(input_ids.map(BigInt)),
      [1, seqLen]);

    const styleTensor = new ort.Tensor('float32',
      new Float32Array(style),
      [1, styleDim]);

    const speedTensor = new ort.Tensor('float32',
      new Float32Array([speed]),
      [1]);

    const feeds = {
      input_ids: inputIdsTensor,
      style: styleTensor,
      speed: speedTensor,
    };

    const results = await this._session.run(feeds);

    // Output key is usually 'audio' or first key
    const outputKey = Object.keys(results)[0];
    const audioData = results[outputKey].data; // Float32Array (flat)

    // Trim last AUDIO_TRIM samples
    const trimmed = audioData.slice(0, Math.max(0, audioData.length - AUDIO_TRIM));
    return new Float32Array(trimmed);
  }
}
