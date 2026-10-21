export const VOICE_CACHE = 'mitsukotoba-qwen3-voice-1202-v1';
export const normalizeVoiceText = text => String(text || '').trim().replace(/\s+/g, ' ');

/** Fixed-text voice bank. Every downloaded clip is checked before caching/playback. */
export class PrerecordedVoiceBank {
  constructor({manifestUrl = new URL('../assets/voice-1202/manifest.json', import.meta.url),
    fetcher = (...args) => globalThis.fetch(...args), cacheStorage = globalThis.caches,
    wait = ms => new Promise(resolve => setTimeout(resolve, ms))} = {}) {
    this.manifestUrl = String(manifestUrl);
    this.fetcher = fetcher;
    this.cacheStorage = cacheStorage;
    this.wait = wait;
    this.memory = new Map();
    this.inFlight = new Map();
    this.prefetchPromise = null;
    this.prefetchComplete = false;
    this.prefetchStorageFailed = false;
    this.prefetchLastError = null;
    this.prefetchLastFile = null;
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
    // CacheStorage may be unavailable in private/low-storage browser sessions.
    // A failed cache read must not prevent a valid on-demand playback.
    const existing = this.memory.get(url) || await this.cache?.match(url).catch(() => null);
    if (existing) {
      const bytes = await existing.clone().arrayBuffer();
      if (await this.valid(bytes, entry)) return new Blob([bytes], {type: 'audio/mp4'});
      await this.cache?.delete(url).catch(() => {});
      this.memory.delete(url);
    }
    const bytes = await this.fetchVerifiedClip(entry, url);
    const stored = new Response(bytes, {headers: {'Content-Type': 'audio/mp4'}});
    try {
      if (this.cache) await this.cache.put(url, stored.clone());
      else if (!background) this.memory.set(url, stored);
    } catch (error) {
      // On-demand playback should work even when persistence is unavailable.
      if (background) {
        this.prefetchStorageFailed = true;
        this.prefetchLastError = String(error?.message || error);
        this.prefetchLastFile = entry.file;
      }
      else console.warn('音声を保存できませんでした。今回の再生は続行します。', error);
    }
    return new Blob([bytes], {type: 'audio/mp4'});
  }

  /** Bounded retries for transient network failures and truncated/corrupted AAC. */
  async fetchVerifiedClip(entry, url) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      // Each clip is small; a stalled network request must not hang the
      // background voice preparation indefinitely.
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 20000) : null;
      try {
        const response = await this.fetcher(url, {
          cache: 'no-store', ...(controller ? {signal: controller.signal} : {})
        });
        if (!response.ok) throw Error('HTTP ' + response.status);
        const bytes = await response.arrayBuffer();
        if (!await this.valid(bytes, entry)) throw Error('音声ファイルの検証に失敗しました（容量・SHA-256）');
        return bytes;
      } catch (error) {
        lastError = error;
        // Retry also covers a transient 404 during Pages deployment; keep
        // the failed file out of the verified audio cache.
        if (attempt < 2) await this.wait(300 * (attempt + 1));
      } finally {
        if (timer !== null) clearTimeout(timer);
      }
    }
    throw Error('音声を取得できません（' + entry.file + '、' +
      String(lastError?.message || lastError) + '）。接続を確認して再試行してください。');
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
    this.prefetchLastError = null;
    this.prefetchLastFile = null;
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
            this.prefetchLastError = String(error?.message || error);
            this.prefetchLastFile = entry.file;
            if (error?.name === 'QuotaExceededError' ||
                /quota|storage|容量/i.test(String(error?.message || '')) ||
                consecutiveFailures >= 3) paused = true;
          }
          if ((completed + failed) % 20 === 0 || next >= entries.length || paused) {
            onStatus({stage: 'progress', completed, failed, total: entries.length, bytes,
              lastFile:this.prefetchLastFile,reason:this.prefetchLastError});
          }
        }
      })
    ).then(() => {
      this.prefetchComplete = !paused && failed === 0;
      onStatus({stage: paused ? 'paused' : failed ? 'partial' : 'complete',
        completed, failed, total: entries.length, bytes,
        lastFile:this.prefetchLastFile,reason:this.prefetchLastError,
        message:this.prefetchStorageFailed
          ? '音声の保存に失敗しました。保存容量やプライベートモードの制限をご確認ください。'
          : failed ? '一部の音声が未取得です。次回の準備で取得済みデータを再利用し、再試行します。' : ''});
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
