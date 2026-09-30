import { clearResumableDownload, downloadResumable } from '../../resumable-download.js';
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

async function fetchBuffer(url, onProgress, background) {
  const result = await downloadResumable(url, {
    background,
    onProgress: (loaded, total, meta) => {
      onProgress?.(loaded, total, !!meta?.resumed);
    },
  });
  return result.buffer;
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
  const cacheKey = `${repoId.replace('/', '__')}__${filename.replace(/\\/g, '_')}`;
  const url = hfUrl(repoId, filename);
  const cached = await cacheGet(cacheKey);
  if (cached) {
    await clearResumableDownload(url).catch(() => {});
    onProgress?.(cached.byteLength, cached.byteLength, true, false);
    return cached;
  }
  const buffer = await fetchBuffer(
    url,
    (loaded, total, resumed) => onProgress?.(loaded, total, false, resumed),
    {
      cacheName: CACHE_DIR_NAME,
      cacheKey: '/' + cacheKey,
    }
  );
  await cacheSet(cacheKey, buffer);
  await clearResumableDownload(url).catch(() => {});
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
  const emit = (kind, loaded, total, cached, resumed = false) => {
    progress[kind] = { loaded, total: total || progress[kind].total || 0 };
    opts.onProgress?.({
      kind,
      loaded,
      total,
      cached: !!cached,
      resumed: !!resumed,
      modelLoaded: progress.model.loaded,
      modelTotal: progress.model.total,
      voicesLoaded: progress.voices.loaded,
      voicesTotal: progress.voices.total,
    });
  };

  opts.onStage?.('download');
  const [modelBuffer, voicesBuffer] = await Promise.all([
    fetchCached(repoId, modelFile, (loaded, total, cached, resumed) => emit('model', loaded, total, cached, resumed)),
    fetchCached(repoId, voicesFile, (loaded, total, cached, resumed) => emit('voices', loaded, total, cached, resumed)),
  ]);
  opts.onStage?.('download-complete');
  return { modelBuffer, voicesBuffer, config };
}
