const LANGUAGE = 'ja-JP';
const PREFERRED_QUALITY = 'dictation';

function getSpeechRecognition() {
  const Recognition = window.SpeechRecognition;
  if (!Recognition) {
    throw new Error(
      'このブラウザはEmmaの完全ローカル音声認識に対応していません。Chrome / Edgeなど、オンデバイスWeb Speech API対応ブラウザで開いてください。'
    );
  }
  if (!('processLocally' in Recognition.prototype) ||
      typeof Recognition.available !== 'function' ||
      typeof Recognition.install !== 'function') {
    throw new Error(
      'このブラウザでは音声認識を端末内だけに限定できません。Emmaは会話を外部へ送らないため、クラウド音声認識へは切り替えません。'
    );
  }
  return Recognition;
}

export async function prepareNativeAsr(onStatus = () => {}) {
  const Recognition = getSpeechRecognition();
  onStatus({ progress: 10, message: '端末内の日本語音声認識を確認しています…' });

  const supportsQuality = 'quality' in Recognition.prototype;
  const recognitionOptions = {
    langs: [LANGUAGE],
    processLocally: true,
    ...(supportsQuality ? { quality: PREFERRED_QUALITY } : {}),
  };

  let availability = await Recognition.available(recognitionOptions);

  if (availability === 'available') {
    onStatus({ progress: 100, message: '端末内の日本語音声認識を利用できます。' });
    return { device: 'on-device', language: LANGUAGE, quality: supportsQuality ? PREFERRED_QUALITY : 'default' };
  }

  if (availability === 'unavailable') {
    throw new Error(
      'このブラウザでは日本語のオンデバイス音声認識を利用できません。Emmaは完全ローカルを守るため、クラウド音声認識は使用しません。'
    );
  }

  onStatus({
    progress: availability === 'downloading' ? 55 : 30,
    message: '日本語のオンデバイス音声認識データを準備しています…',
  });

  const installed = await Recognition.install(recognitionOptions);
  if (!installed) {
    throw new Error(
      '日本語のオンデバイス音声認識データを準備できませんでした。ブラウザを更新して、もう一度お試しください。'
    );
  }

  availability = await Recognition.available(recognitionOptions);
  if (availability !== 'available') {
    throw new Error(
      '日本語のオンデバイス音声認識を開始できません。Emmaはクラウド音声認識へは切り替えません。'
    );
  }

  onStatus({ progress: 100, message: '端末内の日本語音声認識を利用できます。' });
  return { device: 'on-device', language: LANGUAGE, quality: supportsQuality ? PREFERRED_QUALITY : 'default' };
}

export class NativeLocalAsr {
  constructor({ onTranscript, onState, onError }) {
    this.Recognition = getSpeechRecognition();
    this.onTranscript = onTranscript;
    this.onState = onState;
    this.onError = onError;
    this.recognition = null;
    this.shouldRun = false;
    this.paused = false;
    this.restartTimer = null;
  }

  start() {
    this.shouldRun = true;
    this.paused = false;
    this.#startRecognition();
  }

  pause() {
    this.paused = true;
    clearTimeout(this.restartTimer);
    this.restartTimer = null;
    if (this.recognition) {
      try { this.recognition.abort(); } catch {}
    }
  }

  resume() {
    if (!this.shouldRun) return;
    this.paused = false;
    this.#scheduleRestart(80);
  }

  stop() {
    this.shouldRun = false;
    this.paused = false;
    clearTimeout(this.restartTimer);
    this.restartTimer = null;
    if (this.recognition) {
      try { this.recognition.abort(); } catch {}
    }
    this.recognition = null;
  }

  #startRecognition() {
    if (!this.shouldRun || this.paused || this.recognition) return;

    const recognition = new this.Recognition();
    recognition.lang = LANGUAGE;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.processLocally = true;
    if ('quality' in recognition) recognition.quality = PREFERRED_QUALITY;

    recognition.onstart = () => this.onState?.('listening');
    recognition.onspeechstart = () => this.onState?.('speech');
    recognition.onspeechend = () => this.onState?.('endpoint');

    recognition.onresult = (event) => {
      const parts = [];
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal && result[0]?.transcript) {
          parts.push(result[0].transcript);
        }
      }
      const text = parts.join(' ').replace(/\s+/g, ' ').trim();
      if (text) this.onTranscript?.(text);
    };

    recognition.onerror = (event) => {
      const code = event.error || 'unknown';
      if (code === 'aborted' || code === 'no-speech') return;
      const messages = {
        'not-allowed': 'マイクの使用を許可してください。',
        'audio-capture': 'マイクを利用できません。',
        'language-not-supported': 'このブラウザでは日本語のオンデバイス音声認識を利用できません。',
        'network': 'オンデバイス音声認識を開始できませんでした。Emmaはクラウド音声認識へ切り替えません。',
      };
      this.onError?.(messages[code] || `オンデバイス音声認識に失敗しました（${code}）。`);
    };

    recognition.onend = () => {
      if (this.recognition === recognition) this.recognition = null;
      if (this.shouldRun && !this.paused) this.#scheduleRestart(120);
    };

    this.recognition = recognition;
    try {
      recognition.start();
    } catch (error) {
      this.recognition = null;
      this.onError?.(error?.message || String(error));
      this.#scheduleRestart(250);
    }
  }

  #scheduleRestart(delay) {
    if (!this.shouldRun || this.paused || this.restartTimer) return;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.#startRecognition();
    }, delay);
  }
}
