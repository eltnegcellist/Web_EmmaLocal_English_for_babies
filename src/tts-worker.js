let engine = 'kokoro';
let kokoro = null;
let kittenTextToSpeech = null;
let kittenVoice = 'Luna';

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
  const module = await import('https://cdn.jsdelivr.net/npm/@anudit/kitten-tts-webgpu@0.2.1/+esm');
  if (typeof module.textToSpeech !== 'function') throw new Error('KittenTTSの読み込みに失敗しました。');
  kittenTextToSpeech = module.textToSpeech;
  return kittenTextToSpeech;
}

self.onmessage = async (event) => {
  const { type } = event.data;
  try {
    if (type === 'init') {
      engine = event.data.engine === 'kitten' ? 'kitten' : 'kokoro';
      kittenVoice = event.data.voice || 'Luna';

      if (engine === 'kitten') {
        try {
          await ensureKitten();
          self.postMessage({ type: 'ready', device: 'webgpu-nano', engine: 'kitten' });
        } catch (error) {
          self.postMessage({
            type: 'fallback',
            from: 'kitten',
            to: 'kokoro',
            message: error?.message || String(error)
          });
          engine = 'kokoro';
          await ensureKokoro();
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

      if (engine === 'kitten') {
        try {
          const textToSpeech = await ensureKitten();
          const blob = await textToSpeech(text, {
            voice: event.data.voice || kittenVoice || 'Luna',
            speed: 1.0,
            model: 'nano',
            onProgress: (stage) => self.postMessage({
              type: 'status',
              progress: 0,
              message: 'KittenTTS: ' + String(stage || '音声を生成しています…')
            })
          });
          self.postMessage({
            type: 'audio',
            requestId: event.data.requestId,
            index: 0,
            sentence: text,
            blob
          });
          self.postMessage({ type: 'complete', requestId: event.data.requestId, total: 1 });
          return;
        } catch (error) {
          self.postMessage({
            type: 'fallback',
            from: 'kitten',
            to: 'kokoro',
            message: error?.message || String(error)
          });
          engine = 'kokoro';
          await ensureKokoro();
        }
      }

      const { TextSplitterStream } = await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm');
      const splitter = new TextSplitterStream();
      const stream = kokoro.stream(splitter, { voice: 'af_heart', speed: 0.94 });
      splitter.push(text);
      splitter.close();

      let index = 0;
      for await (const chunk of stream) {
        self.postMessage({
          type: 'audio',
          requestId: event.data.requestId,
          index,
          sentence: chunk.text,
          blob: chunk.audio.toBlob()
        });
        index++;
      }
      self.postMessage({ type: 'complete', requestId: event.data.requestId, total: index });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId: event.data?.requestId,
      message: error?.message || String(error)
    });
  }
};
