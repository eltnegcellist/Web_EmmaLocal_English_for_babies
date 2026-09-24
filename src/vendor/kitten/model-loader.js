/**
 * Browser-only model loader for Emma Web.
 * Adapted from kitten-tts-js 0.1.2 (Apache-2.0).
 * Deliberately contains no Node.js/process/fs code.
 */
const HF_BASE = 'https://huggingface.co';
const CACHE_DIR_NAME = 'kitten-tts';

export const MODELS = {
  'KittenML/kitten-tts-nano-0.8-int8': { label: 'nano int8 (~25 MB)' },
  'KittenML/kitten-tts-nano-0.8-fp32': { label: 'nano fp32 (~60 MB)' },
  'KittenML/kitten-tts-micro-0.8': { label: 'micro (~41 MB)' },
  'KittenML/kitten-tts-mini-0.8': { label: 'mini (~80 MB)' },
};

async function fetchBuffer(url, onProgress) {
  const response = await fetch(url, { mode: 'cors', cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);

  const total = Number(response.headers.get('content-length')) || 0;
  if (!response.body?.getReader) {
    const buffer = await response.arrayBuffer();
    onProgress?.(buffer.byteLength, total || buffer.byteLength);
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value?.byteLength) {
      chunks.push(value);
      loaded += value.byteLength;
      onProgress?.(loaded, total);
    }
  }

  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onProgress?.(loaded, total || loaded);
  return merged.buffer;
}

async function cacheGet(cacheKey) {
  if (typeof caches === 'undefined') return null;
  const cache = await caches.open(CACHE_DIR_NAME);
  const response = await cache.match('/' + cacheKey);
  return response ? response.arrayBuffer() : null;
}

async function cacheSet(cacheKey, buffer) {
  if (typeof caches === 'undefined') return;
  const cache = await caches.open(CACHE_DIR_NAME);
  await cache.put('/' + cacheKey, new Response(buffer));
}

function hfUrl(repoId, filename) {
  return `${HF_BASE}/${repoId}/resolve/main/${filename}`;
}

async function fetchCached(repoId, filename, onProgress) {
  const cacheKey = `${repoId.replace('/', '__')}__${filename.replace(/\//g, '_')}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    onProgress?.(cached.byteLength, cached.byteLength, true);
    return cached;
  }
  const buffer = await fetchBuffer(hfUrl(repoId, filename), (loaded, total) => {
    onProgress?.(loaded, total, false);
  });
  await cacheSet(cacheKey, buffer);
  return buffer;
}

export async function downloadModel(repoId, opts = {}) {
  if (!MODELS[repoId]) {
    throw new Error(`Unknown model: ${repoId}. Available: ${Object.keys(MODELS).join(', ')}`);
  }

  opts.onStage?.('config');
  const configBuffer = await fetchCached(repoId, 'config.json');
  const config = JSON.parse(new TextDecoder().decode(configBuffer));
  const modelFile = config.model_file;
  const voicesFile = config.voices || 'voices.npz';
  if (!modelFile) throw new Error(`config.json missing 'model_file' for ${repoId}`);

  const progress = {
    model: { loaded: 0, total: 0 },
    voices: { loaded: 0, total: 0 },
  };
  const emit = (kind, loaded, total, cached) => {
    progress[kind] = { loaded, total: total || progress[kind].total || 0 };
    opts.onProgress?.({
      kind,
      loaded,
      total,
      cached: !!cached,
      modelLoaded: progress.model.loaded,
      modelTotal: progress.model.total,
      voicesLoaded: progress.voices.loaded,
      voicesTotal: progress.voices.total,
    });
  };

  opts.onStage?.('download');
  const [modelBuffer, voicesBuffer] = await Promise.all([
    fetchCached(repoId, modelFile, (loaded, total, cached) => emit('model', loaded, total, cached)),
    fetchCached(repoId, voicesFile, (loaded, total, cached) => emit('voices', loaded, total, cached)),
  ]);
  opts.onStage?.('download-complete');
  return { modelBuffer, voicesBuffer, config };
}
