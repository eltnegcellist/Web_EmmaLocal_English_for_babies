let supertonicPipeline = null;
const supertonicEmbeddings = new Map();

const SUPERTONIC_VOICE_BASE =
  'https://raw.githubusercontent.com/activated-intelligence/voice-chat/7484f9b4383590b8248b268ba2f2ee551b07c334/public/voices';

async function ensureSupertonic() {
  if (supertonicPipeline) return supertonicPipeline;

  self.postMessage({ type: 'status', progress: 0, message: 'Supertonic 3をCPUで準備しています…' });
  const { env, pipeline } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/+esm');
  env.allowLocalModels = false;
  env.useBrowserCache = true;

  if (env.backends?.onnx?.wasm) {
    env.backends.onnx.wasm.numThreads = self.crossOriginIsolated
      ? Math.max(1, Math.min(4, self.navigator?.hardwareConcurrency || 1))
      : 1;
  }

  supertonicPipeline = await pipeline(
    'text-to-speech',
    'onnx-community/Supertonic-TTS-ONNX',
    {
      device: 'wasm',
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

async function getSupertonicEmbedding() {
  if (supertonicEmbeddings.has('F3')) return supertonicEmbeddings.get('F3');

  const response = await fetch(`${SUPERTONIC_VOICE_BASE}/F3.bin`);
  if (!response.ok) throw new Error('Supertonic voice F3 の取得に失敗しました。');
  const embedding = new Float32Array(await response.arrayBuffer());
  supertonicEmbeddings.set('F3', embedding);
  return embedding;
}

async function synthesize(text, requestId) {
  const tts = await ensureSupertonic();
  const embedding = await getSupertonicEmbedding();

  const output = await tts(text, {
    speaker_embeddings: embedding,
    num_inference_steps: 5,
    speed: 1.0
  });

  const audio = output?.audio;
  const sampleRate = output?.sampling_rate || 24000;
  if (!audio || !audio.length) throw new Error('Supertonic 3の音声生成に失敗しました。');

  const blob = float32ToWav(audio, sampleRate);

  self.postMessage({
    type: 'audio',
    requestId,
    index: 0,
    sentence: text,
    blob,
    engine: 'supertonic'
  });
  self.postMessage({
    type: 'complete',
    requestId,
    total: 1,
    engine: 'supertonic'
  });
}

self.onmessage = async (event) => {
  const { type } = event.data;
  try {
    if (type === 'init') {
      await ensureSupertonic();
      self.postMessage({ type: 'ready', device: 'wasm-cpu', engine: 'supertonic' });
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
