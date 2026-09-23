const DEFAULT_LANG = 'ja-JP';

function getLocalSpeechRecognition() {
  const Recognition = globalThis.SpeechRecognition;
  if (typeof Recognition !== 'function') {
    throw new Error('On-device Web Speech API is not available.');
  }
  if (!Recognition.prototype || !('processLocally' in Recognition.prototype)) {
    throw new Error('This SpeechRecognition implementation cannot require local processing.');
  }
  if (typeof Recognition.available !== 'function') {
    throw new Error('On-device speech availability check is not available.');
  }
  return Recognition;
}

async function queryAvailability(Recognition, lang, quality) {
  const options = { langs: [lang], processLocally: true };
  if (quality) options.quality = quality;
  return Recognition.available(options);
}

async function installLanguagePack(Recognition, lang, quality) {
  if (typeof Recognition.install !== 'function') return false;
  const options = { langs: [lang], processLocally: true };
  if (quality) options.quality = quality;
  return Recognition.install(options);
}

async function prepareQuality(Recognition, lang, quality, onStatus) {
  let availability = await queryAvailability(Recognition, lang, quality);
  if (availability === 'available') return true;
  if (availability === 'unavailable') return false;

  if (availability === 'downloadable' || availability === 'downloading') {
    onStatus?.('端末内の日本語音声認識データを準備しています…');
    const installed = await installLanguagePack(Recognition, lang, quality);
    if (!installed) return false;
    availability = await queryAvailability(Recognition, lang, quality);
    return availability === 'available';
  }
  return false;
}

export async function prepareNativeLocalAsr({
  lang = DEFAULT_LANG,
  onStatus = null,
} = {}) {
  const Recognition = getLocalSpeechRecognition();
  onStatus?.('端末内の日本語音声認識を確認しています…');

  // Prefer the higher-quality dictation pack when the browser exposes it.
  // If that exact quality is unavailable, still accept another strictly local
  // on-device pack rather than ever permitting cloud recognition.
  let quality = 'dictation';
  let ready = false;
  try {
    ready = await prepareQuality(Recognition, lang, quality, onStatus);
  } catch (error) {
    console.info('Native ASR dictation-quality check was not usable:', error);
  }

  if (!ready) {
    quality = null;
    ready = await prepareQuality(Recognition, lang, null, onStatus);
  }

  if (!ready) {
    throw new Error('On-device Japanese Web Speech is not available.');
  }

  return {
    kind: 'native',
    device: 'on-device-web-speech',
    lang,
    quality: quality || 'default',
  };
}

export class NativeLocalAsr {
  constructor({
    lang = DEFAULT_LANG,
    quality = 'default',
    onTranscript,
    onState,
    onError,
  } = {}) {
    const Recognition = getLocalSpeechRecognition();
    this.onTranscript = onTranscript;
    this.onState = onState;
    this.onError = onError;
    this.active = false;
    this.paused = true;
    this.listening = false;
    this.restartTimer = null;

    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.processLocally = true;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    if (quality !== 'default' && 'quality' in recognition) {
      recognition.quality = quality;
    }

    recognition.onstart = () => {
      this.listening = true;
      this.onState?.('listening');
    };

    recognition.onspeechstart = () => this.onState?.('speechstart');
    recognition.onspeechend = () => this.onState?.('speechend');

    recognition.onresult = (event) => {
      const parts = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result?.isFinal) continue;
        const text = String(result[0]?.transcript || '').trim();
        if (text) parts.push(text);
      }
      const transcript = parts.join(' ').replace(/\s+/g, ' ').trim();
      if (!transcript) return;

      // Freeze recognition as soon as we have a final utterance. The app will
      // resume only after Emma has finished responding (or when appropriate).
      this.paused = true;
      try { recognition.abort(); } catch {}
      this.onTranscript?.(transcript);
    };

    recognition.onerror = (event) => {
      const code = event?.error || 'unknown';
      if (code === 'aborted' && (this.paused || !this.active)) return;
      if (code === 'no-speech') return;
      this.onError?.({
        code,
        message: event?.message || code,
      });
    };

    recognition.onend = () => {
      this.listening = false;
      if (this.active && !this.paused) this.#scheduleRestart();
    };

    this.recognition = recognition;
  }

  start() {
    this.active = true;
    this.paused = false;
    this.#startNow();
  }

  pause() {
    this.paused = true;
    clearTimeout(this.restartTimer);
    this.restartTimer = null;
    try { this.recognition.abort(); } catch {}
  }

  resume() {
    if (!this.active) return;
    this.paused = false;
    if (!this.listening) this.#scheduleRestart(0);
  }

  stop() {
    this.active = false;
    this.paused = true;
    clearTimeout(this.restartTimer);
    this.restartTimer = null;
    try { this.recognition.abort(); } catch {}
  }

  #scheduleRestart(delay = 120) {
    clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => {
      if (this.active && !this.paused && !this.listening) this.#startNow();
    }, delay);
  }

  #startNow() {
    if (!this.active || this.paused || this.listening) return;
    try {
      this.recognition.start();
    } catch (error) {
      if (error?.name === 'InvalidStateError') {
        this.#scheduleRestart(150);
        return;
      }
      this.onError?.({
        code: error?.name || 'start-failed',
        message: error?.message || String(error),
      });
    }
  }
}
