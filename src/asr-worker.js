import { env, pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/+esm';

env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;
let device = 'wasm';

self.onmessage = async (event) => {
  const { type } = event.data;
  try {
    if (type === 'init') {
      device = event.data.preferWebGpu && 'gpu' in navigator ? 'webgpu' : 'wasm';
      self.postMessage({ type: 'status', stage: 'asr-init', progress: 0, message: 'Whisperを準備しています…' });
      transcriber = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny', {
        device,
        dtype: device === 'webgpu' ? 'fp32' : 'q8',
        progress_callback: (x) => {
          if (x?.status === 'progress' && Number.isFinite(x.progress)) {
            self.postMessage({ type: 'status', stage: 'asr-download', progress: Math.max(0, Math.min(100, x.progress)), message: 'Whisperを取得しています…' });
          }
        },
      });
      self.postMessage({ type: 'ready', device });
      return;
    }
    if (type === 'transcribe') {
      if (!transcriber) throw new Error('Whisper is not initialized');
      const audio = new Float32Array(event.data.audio);
      const result = await transcriber(audio, {
        language: 'japanese',
        task: 'transcribe',
        return_timestamps: false,
      });
      const text = String(result?.text ?? '').trim();
      self.postMessage({ type: 'transcript', id: event.data.id, text });
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error?.message || String(error) });
  }
};
