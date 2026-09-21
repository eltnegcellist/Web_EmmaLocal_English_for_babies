import { KokoroTTS } from 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';

let tts = null;

self.onmessage = async (event) => {
  const { type } = event.data;
  try {
    if (type === 'init') {
      self.postMessage({ type: 'status', progress: 0, message: 'Emmaの声を準備しています…' });
      tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (x) => {
          if (x?.status === 'progress' && Number.isFinite(x.progress)) {
            self.postMessage({ type: 'status', progress: Math.max(0, Math.min(100, x.progress)), message: 'Emmaの声を取得しています…' });
          }
        },
      });
      self.postMessage({ type: 'ready', device: 'wasm-q8' });
      return;
    }
    if (type === 'speak') {
      if (!tts) throw new Error('Kokoro is not initialized');
      for (let i = 0; i < event.data.sentences.length; i++) {
        const sentence = event.data.sentences[i];
        const raw = await tts.generate(sentence, { voice: 'af_heart', speed: 0.94 });
        const blob = raw.toBlob();
        self.postMessage({ type: 'audio', requestId: event.data.requestId, index: i, total: event.data.sentences.length, sentence, blob });
      }
      self.postMessage({ type: 'complete', requestId: event.data.requestId });
    }
  } catch (error) {
    self.postMessage({ type: 'error', requestId: event.data?.requestId, message: error?.message || String(error) });
  }
};
