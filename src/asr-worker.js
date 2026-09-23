const MOONSHINE_MODULE_URL =
  'https://cdn.jsdelivr.net/npm/@moonshine-ai/moonshine-wasm@0.1.5/dist/index.js';

let transcriber = null;
let modelInfo = null;

self.onmessage = async (event) => {
  const { type } = event.data;
  try {
    if (type === 'init') {
      if (!self.crossOriginIsolated || typeof SharedArrayBuffer !== 'function') {
        throw new Error(
          'Moonshineの実行に必要なブラウザ分離を有効にできませんでした。ページを再読み込みしてください。'
        );
      }

      self.postMessage({
        type: 'status',
        stage: 'asr-runtime',
        progress: 0,
        message: 'Moonshineの実行エンジンを準備しています…'
      });

      const { Transcriber, ModelArch } = await withTimeout(
        import(MOONSHINE_MODULE_URL),
        60000,
        'Moonshineの実行モジュールを取得できませんでした。通信状態を確認してください。'
      );

      self.postMessage({
        type: 'status',
        stage: 'asr-download',
        progress: 1,
        message: '日本語音声認識モデルを準備しています…'
      });

      transcriber = await withTimeout(
        Transcriber.load({
          language: 'ja',
          modelArch: ModelArch.TinyStreaming,
          options: {
            max_tokens_per_second: '13.0'
          },
          onProgress: (loaded, total, file) => {
            const fraction = total && total > 0 ? loaded / total : 0;
            const progress = total && total > 0
              ? Math.max(1, Math.min(96, Math.round(fraction * 96)))
              : 1;
            const mbLoaded = loaded / 1_000_000;
            const mbTotal = total ? total / 1_000_000 : null;
            const sizeText = mbTotal
              ? `${mbLoaded.toFixed(1)} / ${mbTotal.toFixed(1)} MB`
              : `${mbLoaded.toFixed(1)} MB`;
            self.postMessage({
              type: 'status',
              stage: 'asr-download',
              progress,
              message: `Moonshine 日本語 Tinyを取得しています… ${sizeText}`,
              file
            });
          }
        }),
        600000,
        'Moonshine 日本語モデルの準備に時間がかかりすぎています。通信状態を確認して、もう一度お試しください。'
      );

      modelInfo = {
        engine: 'moonshine',
        model: 'tiny-streaming-ja',
        architecture: 'tiny_streaming',
        license: 'MIT',
        device: 'wasm-cpu'
      };

      self.postMessage({
        type: 'status',
        stage: 'asr-ready',
        progress: 100,
        message: 'Moonshine 日本語音声認識を準備できました'
      });
      self.postMessage({ type: 'ready', ...modelInfo });
      return;
    }

    if (type === 'transcribe') {
      if (!transcriber) throw new Error('Moonshine is not initialized');
      const audio = new Float32Array(event.data.audio);
      const result = transcriber.transcribe(audio, { sampleRate: 16000 });
      const text = Array.isArray(result?.lines)
        ? result.lines
            .map((line) => String(line?.text || '').trim())
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim()
        : '';
      self.postMessage({ type: 'transcript', id: event.data.id, text });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error?.message || String(error)
    });
  }
};

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
