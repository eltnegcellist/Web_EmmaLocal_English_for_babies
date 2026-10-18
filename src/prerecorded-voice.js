export const VOICE_CACHE = 'mitsukotoba-qwen3-voice-1202-v1';
export const normalizeVoiceText = text => String(text || '').trim().replace(/\s+/g, ' ');

/** Fixed-text voice bank. Every downloaded clip is checked before caching/playback. */
export class PrerecordedVoiceBank {
  constructor({manifestUrl = new URL('../assets/voice-1202/manifest.json', import.meta.url),
    fetcher = (...args) => globalThis.fetch(...args), cacheStorage = globalThis.caches} = {}) {
    this.manifestUrl = String(manifestUrl);
    this.fetcher = fetcher;
    this.cacheStorage = cacheStorage;
    this.memory = new Map();
  }

  async init(onStatus = () => {}) {
    if (this.initializing) return this.initializing;
    this.initializing = this.prepare(onStatus).catch(error => {
      this.initializing = null;
      throw error;
    });
    return this.initializing;
  }

  async prepare(onStatus) {
    this.cache = this.cacheStorage ? await this.cacheStorage.open(VOICE_CACHE) : null;
    let response;
    try {
      response = await this.fetcher(this.manifestUrl, {cache: 'no-store'});
      if (!response.ok) throw Error('音声一覧を取得できません。');
      await this.cache?.put(this.manifestUrl, response.clone());
    } catch (error) {
      // Web is online-first. A stale, previously cached manifest must not
      // silently map new English to obsolete audio when fetching fails.
      throw Error('最新版の音声一覧を取得できません。通信を確認して再準備してください。');
    }
    const manifest = await response.json();
    if (manifest.schemaVersion !== 1 || manifest.generationSeed !== 1202 || !manifest.entries?.length) {
      throw Error('音声一覧の形式または固定seedが一致しません。');
    }
    this.byText = new Map();
    for (const entry of manifest.entries) {
      const text = normalizeVoiceText(entry.text);
      if (!text || !/^clips\/[a-f0-9]{24}\.m4a$/.test(entry.file) || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
        throw Error('音声一覧に不正な項目があります。');
      }
      if (this.byText.has(text)) throw Error('英文の音声対応が重複しています。');
      this.byText.set(text, entry);
    }
    this.manifest = manifest;
    let next = 0, completed = 0, bytes = 0;
    onStatus({progress: 1, message: '選んだ声を端末に準備しています…'});
    await Promise.all(Array.from({length: Math.min(4, manifest.entries.length)}, async () => {
      while (next < manifest.entries.length) {
        const entry = manifest.entries[next++];
        await this.clip(entry);
        completed++; bytes += entry.bytes;
        onStatus({progress: Math.round(completed / manifest.entries.length * 100),
          message: `選んだ声を準備しています… ${completed}/${manifest.entries.length} (${(bytes / 1e6).toFixed(1)} MB)`});
      }
    }));
    return manifest;
  }

  async clip(entry) {
    const url = new URL(entry.file, this.manifestUrl).href;
    const existing = this.memory.get(url) || await this.cache?.match(url);
    if (existing) {
      const bytes = await existing.clone().arrayBuffer();
      if (await this.valid(bytes, entry)) return new Blob([bytes], {type: 'audio/mp4'});
      await this.cache?.delete(url);
      this.memory.delete(url);
    }
    const response = await this.fetcher(url, {cache: 'no-store'});
    if (!response.ok) throw Error('音声を取得できません。接続を確認して再試行してください。');
    const bytes = await response.arrayBuffer();
    if (!await this.valid(bytes, entry)) throw Error('音声ファイルの検証に失敗しました。');
    const stored = new Response(bytes, {headers: {'Content-Type': 'audio/mp4'}});
    if (this.cache) await this.cache.put(url, stored);
    else this.memory.set(url, stored);
    return new Blob([bytes], {type: 'audio/mp4'});
  }

  async valid(bytes, entry) {
    if (bytes.byteLength !== entry.bytes) return false;
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, '0')).join('') === entry.sha256;
  }

  async audioFor(text) {
    await this.init();
    const entry = this.byText.get(normalizeVoiceText(text));
    return entry ? this.clip(entry) : null;
  }
}
