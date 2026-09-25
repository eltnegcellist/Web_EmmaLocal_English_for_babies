import { KittenTTS } from './vendor/kitten/index.js';

const KITTEN_MODEL = 'KittenML/kitten-tts-nano-0.8-fp32';
const KITTEN_VOICE = 'Kiki';
const KITTEN_SPEED = 0.8;

let kittenTts = null;

async function ensureKitten() {
  if (kittenTts) return kittenTts;

  self.postMessage({
    type: 'status',
    progress: 0,
    message: 'Kitten TTS Nano FP32を準備しています…'
  });

  self.postMessage({
    type: 'status',
    progress: 5,
    message: 'Kitten TTS Nano FP32を取得しています…'
  });

  const stageMessages = {
    config: [5, 'Kitten TTSの設定を確認しています…'],
    download: [8, 'Kitten TTS Nano FP32をダウンロードしています…'],
    'download-complete': [82, 'Kitten TTSのダウンロードが完了しました'],
    runtime: [86, '音声エンジンを準備しています…'],
    'onnx-session': [90, 'Kitten TTSを初期化しています…'],
    voices: [96, 'Kikiの声を読み込んでいます…'],
    ready: [99, 'Kitten TTSの初期化が完了しました']
  };

  kittenTts = await withTimeout(
    KittenTTS.from_pretrained(KITTEN_MODEL, {
      onStage: (stage) => {
        const [progress, message] = stageMessages[stage] || [8, 'Kitten TTSを準備しています…'];
        self.postMessage({ type: 'status', progress, message });
      },
      onProgress: (info) => {
        const modelLoaded = Number(info.modelLoaded || 0);
        const modelTotal = Number(info.modelTotal || 0);
        const voicesLoaded = Number(info.voicesLoaded || 0);
        const voicesTotal = Number(info.voicesTotal || 0);
        const knownTotal = modelTotal + voicesTotal;
        const knownLoaded = modelLoaded + voicesLoaded;
        const fraction = knownTotal > 0 ? knownLoaded / knownTotal : 0;
        const progress = Math.max(8, Math.min(80, Math.round(8 + fraction * 72)));
        const mbLoaded = knownLoaded / 1_000_000;
        const mbTotal = knownTotal / 1_000_000;
        const sizeText = knownTotal > 0
          ? `${mbLoaded.toFixed(1)} / ${mbTotal.toFixed(1)} MB`
          : `${mbLoaded.toFixed(1)} MB`;
        self.postMessage({
          type: 'status',
          progress,
          message: `Kitten TTS Nano FP32をダウンロードしています… ${sizeText}`
        });
      }
    }),
    300000,
    'Kitten TTS Nano FP32の準備に時間がかかりすぎています。通信状態を確認して、もう一度お試しください。'
  );

  const voices = kittenTts.list_voices?.() || [];
  if (voices.length && !voices.includes(KITTEN_VOICE)) {
    throw new Error(`Kitten TTSの女性声 ${KITTEN_VOICE} を読み込めませんでした。`);
  }

  self.postMessage({
    type: 'status',
    progress: 100,
    message: 'Emmaの声を準備できました'
  });
  return kittenTts;
}

async function synthesize(text, requestId) {
  const tts = await ensureKitten();
  let index = 0;

  // The JS port streams sentence-by-sentence. Emma's audio queue already
  // supports multiple chunks, so playback can start without waiting for the
  // full reply to finish synthesizing.
  if (typeof tts.stream === 'function') {
    for await (const chunk of tts.stream(text, {
      voice: KITTEN_VOICE,
      speed: KITTEN_SPEED,
      clean: true
    })) {
      const audio = chunk?.audio;
      const samples = audio?.data;
      const sampleRate = audio?.sampling_rate || 24000;
      if (!samples?.length) continue;

      self.postMessage({
        type: 'audio',
        requestId,
        index,
        sentence: String(chunk?.text || ''),
        blob: float32ToWav(samples, sampleRate),
        engine: 'kitten-tts',
        voice: KITTEN_VOICE
      });
      index++;
    }
  } else {
    const audio = await tts.generate(text, {
      voice: KITTEN_VOICE,
      speed: KITTEN_SPEED,
      clean: true
    });
    const samples = audio?.data;
    const sampleRate = audio?.sampling_rate || 24000;
    if (!samples?.length) throw new Error('Kitten TTS Nano FP32の音声生成に失敗しました。');

    self.postMessage({
      type: 'audio',
      requestId,
      index: 0,
      sentence: text,
      blob: float32ToWav(samples, sampleRate),
      engine: 'kitten-tts',
      voice: KITTEN_VOICE
    });
    index = 1;
  }

  if (!index) throw new Error('Kitten TTS Nano FP32の音声生成に失敗しました。');

  self.postMessage({
    type: 'complete',
    requestId,
    total: index,
    engine: 'kitten-tts',
    voice: KITTEN_VOICE
  });
}

self.onmessage = async (event) => {
  const { type } = event.data;
  try {
    if (type === 'init') {
      await ensureKitten();
      self.postMessage({
        type: 'ready',
        device: 'wasm-cpu',
        engine: 'kitten-tts',
        model: KITTEN_MODEL,
        voice: KITTEN_VOICE,
        license: 'Apache-2.0'
      });
      return;
    }

    if (type === 'speak') {
      const text = String(
        event.data.text ||
        (Array.isArray(event.data.sentences) ? event.data.sentences.join(' ') : '')
      ).trim();
      if (!text) throw new Error('No text to speak');

      await synthesize(text, event.data.requestId);
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
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
