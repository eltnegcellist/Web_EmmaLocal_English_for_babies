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
    this.inFlight = new Map();
    this.prefetchPromise = null;
    this.prefetchComplete = false;
    this.prefetchStorageFailed = false;
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
    this.cache = this.cacheStorage ? await this.cacheStorage.open(VOICE_CACHE).catch(() => null) : null;
    let response;
    try {
      response = await this.fetcher(this.manifestUrl, {cache: 'no-store'});
      if (!response.ok) throw Error('音声一覧を取得できません。');
      await this.cache?.put(this.manifestUrl, response.clone()).catch(error => {
        console.warn('音声一覧のキャッシュ保存をスキップします', error);
      });
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
    // Do not make the tutorial wait for the complete bank.
    return manifest;
  }

  async clip(entry, {background = false} = {}) {
    const url = new URL(entry.file, this.manifestUrl).href;
    if (this.inFlight.has(url)) return this.inFlight.get(url);
    const pending = this.loadClip(entry, url, {background})
      .finally(() => this.inFlight.delete(url));
    this.inFlight.set(url, pending);
    return pending;
  }

  async loadClip(entry, url, {background = false} = {}) {
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
    try {
      if (this.cache) await this.cache.put(url, stored.clone());
      else if (!background) this.memory.set(url, stored);
    } catch (error) {
      // On-demand playback should work even when persistence is unavailable.
      if (background) this.prefetchStorageFailed = true;
      else console.warn('音声を保存できませんでした。今回の再生は続行します。', error);
    }
    return new Blob([bytes], {type: 'audio/mp4'});
  }

  /** Background caching starts only after the tutorial becomes visible. */
  async prefetchAll(onStatus = () => {}) {
    await this.init();
    if (this.prefetchComplete) return;
    if (this.prefetchPromise) return this.prefetchPromise;
    if (!this.cache) {
      onStatus({stage: 'paused', message: '保存できない環境のため音声は再生時に取得します。'});
      return;
    }
    this.prefetchStorageFailed = false;
    const entries = this.manifest.entries;
    let next = 0, completed = 0, failed = 0, bytes = 0;
    let consecutiveFailures = 0, paused = false;
    onStatus({stage: 'progress', completed, total: entries.length, bytes});
    this.prefetchPromise = Promise.all(
      Array.from({length: Math.min(2, entries.length)}, async () => {
        while (next < entries.length && !paused) {
          const entry = entries[next++];
          try {
            await this.clip(entry, {background: true});
            if (this.prefetchStorageFailed) {
              failed++;
              paused = true;
            } else {
              completed++;
              bytes += entry.bytes;
              consecutiveFailures = 0;
            }
          } catch (error) {
            failed++;
            consecutiveFailures++;
            if (error?.name === 'QuotaExceededError' ||
                /quota|storage|容量/i.test(String(error?.message || '')) ||
                consecutiveFailures >= 3) paused = true;
          }
          if ((completed + failed) % 20 === 0 || next >= entries.length || paused) {
            onStatus({stage: 'progress', completed, failed, total: entries.length, bytes});
          }
        }
      })
    ).then(() => {
      this.prefetchComplete = !paused && failed === 0;
      onStatus({stage: paused ? 'paused' : failed ? 'partial' : 'complete',
        completed, failed, total: entries.length, bytes});
    }).finally(() => { this.prefetchPromise = null; });
    return this.prefetchPromise;
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
