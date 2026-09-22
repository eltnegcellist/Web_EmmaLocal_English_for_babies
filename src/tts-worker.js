import { KokoroTTS, TextSplitterStream } from 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';

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
            self.postMessage({
              type: 'status',
              progress: Math.max(0, Math.min(100, x.progress)),
              message: 'Emmaの声を取得しています…'
            });
          }
        },
      });
      self.postMessage({ type: 'ready', device: 'wasm-q8-stream' });
      return;
    }

    if (type === 'speak') {
      if (!tts) throw new Error('Kokoro is not initialized');

      const text = String(
        event.data.text ||
        (Array.isArray(event.data.sentences) ? event.data.sentences.join(' ') : '')
      ).trim();
      if (!text) throw new Error('No text to speak');

      // Kokoro's TextSplitterStream yields sentence-sized audio chunks.
      // The first chunk is posted to the UI immediately, while this worker
      // continues generating the following chunk in parallel with playback.
      const splitter = new TextSplitterStream();
      const stream = tts.stream(splitter, { voice: 'af_heart', speed: 0.94 });
      splitter.push(text);
      splitter.close();

      let index = 0;
      for await (const chunk of stream) {
        const blob = chunk.audio.toBlob();
        self.postMessage({
          type: 'audio',
          requestId: event.data.requestId,
          index,
          sentence: chunk.text,
          blob
        });
        index++;
      }

      self.postMessage({
        type: 'complete',
        requestId: event.data.requestId,
        total: index
      });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId: event.data?.requestId,
      message: error?.message || String(error)
    });
  }
};
