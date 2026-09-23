let engine = 'kokoro';
let kokoro = null;
let kittenTextToSpeech = null;
let kittenModel = 'nano';
let selectedVoice = 'af_heart';
let supertonicPipeline = null;
const supertonicEmbeddings = new Map();

const KITTEN_MODELS = new Set(['nano','micro','mini']);
const SUPERTONIC_VOICES = new Set(['F1','F2','F3','F4','F5','M1','M2','M3','M4','M5']);
const SUPERTONIC_VOICE_BASE =
  'https://raw.githubusercontent.com/activated-intelligence/voice-chat/7484f9b4383590b8248b268ba2f2ee551b07c334/public/voices';

async function ensureKokoro() {
  if (kokoro) return kokoro;
  self.postMessage({ type: 'status', progress: 0, message: 'Kokoroの声を準備しています…' });
  const { KokoroTTS } = await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm');
  kokoro = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (x) => {
      if (x?.status === 'progress' && Number.isFinite(x.progress)) {
        self.postMessage({
          type: 'status',
          progress: Math.max(0, Math.min(100, x.progress)),
          message: 'Kokoroの声を取得しています…'
        });
      }
    },
  });
  return kokoro;
}

async function ensureKitten() {
  if (kittenTextToSpeech) return kittenTextToSpeech;
  if (!navigator.gpu) throw new Error('このブラウザではWebGPUを利用できません。');
  self.postMessage({ type: 'status', progress: 0, message: 'KittenTTSを準備しています…' });
  const module = await import('https://cdn.jsdelivr.net/npm/kitten-tts-webgpu@0.1.1/+esm');
  if (typeof module.textToSpeech !== 'function') throw new Error('KittenTTSの読み込みに失敗しました。');
  kittenTextToSpeech = module.textToSpeech;
  return kittenTextToSpeech;
}

async function ensureSupertonic() {
  if (supertonicPipeline) return supertonicPipeline;
  if (!navigator.gpu) throw new Error('このブラウザではWebGPUを利用できません。');

  self.postMessage({ type: 'status', progress: 0, message: 'Supertonic 3を準備しています…' });
  const { env, pipeline } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/+esm');
  env.allowLocalModels = false;
  env.useBrowserCache = true;

  supertonicPipeline = await pipeline(
    'text-to-speech',
    'onnx-community/Supertonic-TTS-ONNX',
    {
      device: 'webgpu',
      progress_callback: (x) => {
        if (x?.status === 'progress' && Number.isFinite(x.progress)) {
          self.postMessage({
            type: 'status',
            progress: Math.max(0, Math.min(100, x.progress)),
            message: 'Supertonic 3を取得しています…'
          });
        }
      }
    }
  );
  return supertonicPipeline;
}

async function getSupertonicEmbedding(voice) {
  const id = SUPERTONIC_VOICES.has(voice) ? voice : 'F3';
  if (supertonicEmbeddings.has(id)) return supertonicEmbeddings.get(id);

  const response = await fetch(`${SUPERTONIC_VOICE_BASE}/${id}.bin`);
  if (!response.ok) throw new Error(`Supertonic voice ${id} の取得に失敗しました。`);
  const embedding = new Float32Array(await response.arrayBuffer());
  supertonicEmbeddings.set(id, embedding);
  return embedding;
}

async function synthesizeKokoro(text, requestId, voice = 'af_heart') {
  const tts = await ensureKokoro();
  const { TextSplitterStream } = await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm');
  const splitter = new TextSplitterStream();

  // No artificial pause is inserted here. If a gap appears between sentences,
  // it is because the following sentence has not finished generating yet.
  const stream = tts.stream(splitter, { voice: voice || 'af_heart', speed: 0.94 });
  splitter.push(text);
  splitter.close();

  let index = 0;
  for await (const chunk of stream) {
    self.postMessage({
      type: 'audio',
      requestId,
      index,
      sentence: chunk.text,
      blob: chunk.audio.toBlob()
    });
    index++;
  }
  self.postMessage({ type: 'complete', requestId, total: index });
}

async function synthesizeKitten(text, requestId, voice, model) {
  const textToSpeech = await ensureKitten();
  const chosenModel = KITTEN_MODELS.has(model) ? model : 'nano';
  const blob = await textToSpeech(text, {
    voice: voice || 'Luna',
    speed: 1.0,
    model: chosenModel,
    onProgress: (stage) => self.postMessage({
      type: 'status',
      progress: 0,
      message: 'KittenTTS: ' + String(stage || '音声を生成しています…')
    })
  });
  self.postMessage({ type: 'audio', requestId, index: 0, sentence: text, blob });
  self.postMessage({ type: 'complete', requestId, total: 1 });
}

async function synthesizeSupertonic(text, requestId, voice) {
  const tts = await ensureSupertonic();
  const embedding = await getSupertonicEmbedding(voice);
  const output = await tts(text, {
    speaker_embeddings: embedding,
    num_inference_steps: 5,
    speed: 1.0
  });

  const audio = output?.audio;
  const sampleRate = output?.sampling_rate || 24000;
  if (!audio || !audio.length) throw new Error('Supertonic 3の音声生成に失敗しました。');

  const blob = float32ToWav(audio, sampleRate);
  self.postMessage({ type: 'audio', requestId, index: 0, sentence: text, blob });
  self.postMessage({ type: 'complete', requestId, total: 1 });
}

async function fallBackToKokoro(error) {
  self.postMessage({
    type: 'fallback',
    from: engine,
    to: 'kokoro',
    message: error?.message || String(error)
  });
  engine = 'kokoro';
  selectedVoice = 'af_heart';
  await ensureKokoro();
}

self.onmessage = async (event) => {
  const { type } = event.data;
  try {
    if (type === 'init') {
      engine = ['kokoro','kitten','supertonic'].includes(event.data.engine)
        ? event.data.engine
        : 'kokoro';
      kittenModel = KITTEN_MODELS.has(event.data.model) ? event.data.model : 'nano';
      selectedVoice = event.data.voice || (engine === 'kitten' ? 'Luna' : engine === 'supertonic' ? 'F3' : 'af_heart');

      if (engine === 'kitten') {
        try {
          await ensureKitten();
          self.postMessage({ type: 'ready', device: `webgpu-${kittenModel}`, engine: 'kitten', model: kittenModel });
        } catch (error) {
          await fallBackToKokoro(error);
          self.postMessage({ type: 'ready', device: 'wasm-q8-stream', engine: 'kokoro' });
        }
      } else if (engine === 'supertonic') {
        try {
          await ensureSupertonic();
          self.postMessage({ type: 'ready', device: 'webgpu', engine: 'supertonic' });
        } catch (error) {
          await fallBackToKokoro(error);
          self.postMessage({ type: 'ready', device: 'wasm-q8-stream', engine: 'kokoro' });
        }
      } else {
        await ensureKokoro();
        self.postMessage({ type: 'ready', device: 'wasm-q8-stream', engine: 'kokoro' });
      }
      return;
    }

    if (type === 'speak') {
      const text = String(
        event.data.text ||
        (Array.isArray(event.data.sentences) ? event.data.sentences.join(' ') : '')
      ).trim();
      if (!text) throw new Error('No text to speak');

      const voice = event.data.voice || selectedVoice;
      const model = event.data.model || kittenModel;

      if (engine === 'kitten') {
        try {
          await synthesizeKitten(text, event.data.requestId, voice, model);
          return;
        } catch (error) {
          await fallBackToKokoro(error);
        }
      } else if (engine === 'supertonic') {
        try {
          await synthesizeSupertonic(text, event.data.requestId, voice);
          return;
        } catch (error) {
          await fallBackToKokoro(error);
        }
      }

      await synthesizeKokoro(text, event.data.requestId, engine === 'kokoro' ? voice : 'af_heart');
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId: event.data?.requestId,
      message: error?.message || String(error)
    });
  }
};

function float32ToWav(samples, sampleRate) {
  const input = samples instanceof Float32Array ? samples : new Float32Array(samples);
  const buffer = new ArrayBuffer(44 + input.length * 2);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + input.length * 2, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, input.length * 2, true);

  let offset = 44;
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}
