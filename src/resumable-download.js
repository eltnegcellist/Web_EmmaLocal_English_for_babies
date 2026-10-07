const DB_NAME = 'mitsukotoba-resumable-downloads-v1';
const DB_VERSION = 1;
const META_STORE = 'meta';
const CHUNK_STORE = 'chunks';
const PERSIST_CHUNK_BYTES = 1024 * 1024;

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

let dbPromise;
function openDb() {
  if (!hasIndexedDb()) return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'url' });
        }
        if (!db.objectStoreNames.contains(CHUNK_STORE)) {
          const store = db.createObjectStore(CHUNK_STORE, { keyPath: ['url', 'index'] });
          store.createIndex('url', 'url', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Unable to open download database'));
    }).catch(error => {
      dbPromise = undefined;
      throw error;
    });
  }
  return dbPromise;
}

async function loadPartial(url) {
  const db = await openDb().catch(() => null);
  if (!db) return null;
  const tx = db.transaction([META_STORE, CHUNK_STORE], 'readonly');
  const meta = await requestResult(tx.objectStore(META_STORE).get(url)).catch(() => null);
  const index = tx.objectStore(CHUNK_STORE).index('url');
  const chunks = await requestResult(index.getAll(IDBKeyRange.only(url))).catch(() => []);
  await transactionDone(tx).catch(() => {});
  if (!meta || !chunks?.length) return null;
  chunks.sort((a, b) => a.index - b.index);
  const downloaded = chunks.reduce((sum, item) => sum + Number(item.bytes || item.data?.byteLength || 0), 0);
  if (!downloaded) return null;
  return {
    meta: { ...meta, downloaded, nextIndex: chunks.length },
    chunks,
  };
}

async function persistChunk(url, index, data, meta) {
  const db = await openDb().catch(() => null);
  if (!db) return false;
  const tx = db.transaction([META_STORE, CHUNK_STORE], 'readwrite');
  tx.objectStore(CHUNK_STORE).put({
    url,
    index,
    bytes: data.byteLength,
    data,
  });
  tx.objectStore(META_STORE).put(meta);
  await transactionDone(tx);
  return true;
}

export async function clearResumableDownload(url) {
  const db = await openDb().catch(() => null);
  if (!db) return;
  const readTx = db.transaction(CHUNK_STORE, 'readonly');
  const keys = await requestResult(
    readTx.objectStore(CHUNK_STORE).index('url').getAllKeys(IDBKeyRange.only(url))
  ).catch(() => []);
  await transactionDone(readTx).catch(() => {});

  const tx = db.transaction([META_STORE, CHUNK_STORE], 'readwrite');
  tx.objectStore(META_STORE).delete(url);
  const chunks = tx.objectStore(CHUNK_STORE);
  for (const key of keys) chunks.delete(key);
  await transactionDone(tx).catch(() => {});
}

function parseTotal(response, offset) {
  const contentRange = response.headers.get('content-range') || '';
  const match = /\/([0-9]+)$/.exec(contentRange);
  if (match) return Number(match[1]) || 0;
  const length = Number(response.headers.get('content-length')) || 0;
  return length > 0 ? offset + length : 0;
}

function mergeBuffers(buffers, totalBytes) {
  const total = totalBytes || buffers.reduce((sum, part) => sum + part.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const part of buffers) {
    const view = part instanceof Uint8Array ? part : new Uint8Array(part);
    merged.set(view, offset);
    offset += view.byteLength;
  }
  return merged.buffer;
}

function announceBackgroundDownload(url, background) {
  if (!background?.cacheName || !background?.cacheKey) return;
  const message = {
    type: 'track-model-download',
    url,
    cacheName: background.cacheName,
    cacheKey: background.cacheKey,
  };

  try {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      navigator.serviceWorker.ready
        .then(reg => (navigator.serviceWorker.controller || reg.active)?.postMessage(message))
        .catch(() => {});
      return;
    }
  } catch {}

  try {
    if (typeof document === 'undefined' && typeof self?.postMessage === 'function') {
      self.postMessage({ type: 'background-download-url', ...message });
    }
  } catch {}
}

async function fetchNetwork(url, offset) {
  const baseOptions = { mode: 'cors', cache: 'no-store' };
  if (offset <= 0) return fetch(url, baseOptions);

  try {
    const response = await fetch(url, {
      ...baseOptions,
      headers: { Range: `bytes=${offset}-` },
    });
    if (response.status === 206) return response;
    return response;
  } catch {
    return fetch(url, baseOptions);
  }
}

export async function downloadResumable(url, options = {}) {
  const onProgress = options.onProgress;
  const background = options.background;
  announceBackgroundDownload(url, background);

  let partial = await loadPartial(url).catch(() => null);
  let existingChunks = partial?.chunks?.map(item => item.data) || [];
  let meta = partial?.meta || {
    url,
    downloaded: 0,
    nextIndex: 0,
    etag: '',
    lastModified: '',
    total: 0,
    updatedAt: Date.now(),
  };
  let offset = Number(meta.downloaded || 0);
  let resumed = offset > 0;

  let response = await fetchNetwork(url, offset);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }

  const serverEtag = response.headers.get('etag') || '';
  const serverLastModified = response.headers.get('last-modified') || '';

  const rangeAccepted = offset > 0 && response.status === 206;
  const validatorChanged =
    offset > 0 &&
    ((meta.etag && serverEtag && meta.etag !== serverEtag) ||
      (meta.lastModified && serverLastModified && meta.lastModified !== serverLastModified));

  if (offset > 0 && (!rangeAccepted || validatorChanged)) {
    await clearResumableDownload(url).catch(() => {});
    existingChunks = [];
    offset = 0;
    resumed = false;
    meta = {
      url,
      downloaded: 0,
      nextIndex: 0,
      etag: '',
      lastModified: '',
      total: 0,
      updatedAt: Date.now(),
    };
    if (response.status !== 200 || validatorChanged) {
      response = await fetch(url, { mode: 'cors', cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
    }
  }

  const total = parseTotal(response, offset);
  meta.etag = response.headers.get('etag') || meta.etag || '';
  meta.lastModified = response.headers.get('last-modified') || meta.lastModified || '';
  meta.total = total || meta.total || 0;
  meta.updatedAt = Date.now();

  onProgress?.(offset, meta.total, { resumed, persisted: offset });

  const reader = response.body?.getReader?.();
  let networkLoaded = 0;
  let pending = [];
  let pendingBytes = 0;

  async function flushPending() {
    if (!pendingBytes) return;
    const data = mergeBuffers(pending, pendingBytes);
    const index = Number(meta.nextIndex || 0);
    meta.nextIndex = index + 1;
    meta.downloaded = Number(meta.downloaded || 0) + data.byteLength;
    meta.updatedAt = Date.now();
    await persistChunk(url, index, data, meta).catch(() => false);
    existingChunks.push(data);
    pending = [];
    pendingBytes = 0;
  }

  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      const copy = value.slice().buffer;
      pending.push(copy);
      pendingBytes += value.byteLength;
      networkLoaded += value.byteLength;
      onProgress?.(offset + networkLoaded, meta.total, {
        resumed,
        persisted: Number(meta.downloaded || 0),
      });
      if (pendingBytes >= PERSIST_CHUNK_BYTES) await flushPending();
    }
  } else {
    const buffer = await response.arrayBuffer();
    pending.push(buffer);
    pendingBytes = buffer.byteLength;
    networkLoaded = buffer.byteLength;
    onProgress?.(offset + networkLoaded, meta.total, {
      resumed,
      persisted: Number(meta.downloaded || 0),
    });
  }
  await flushPending();

  const completedBytes = existingChunks.reduce((sum, part) => sum + part.byteLength, 0);
  if (meta.total > 0 && completedBytes !== meta.total) {
    throw new Error(
      `Incomplete download for ${url}: expected ${meta.total} bytes, got ${completedBytes}`
    );
  }

  const buffer = mergeBuffers(existingChunks, completedBytes);
  onProgress?.(completedBytes, meta.total || completedBytes, {
    resumed,
    persisted: completedBytes,
    complete: true,
  });
  return { buffer, resumed, networkLoaded };
}

export const RESUMABLE_DOWNLOAD_DB = DB_NAME;
