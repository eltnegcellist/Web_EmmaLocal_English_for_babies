/**
 * Browser-only model loader for Emma Web.
 * Adapted from kitten-tts-js 0.1.2 (Apache-2.0).
 * Deliberately contains no Node.js/process/fs code.
 */
const HF_BASE = 'https://huggingface.co';
const CACHE_DIR_NAME = 'kitten-tts';

export const MODELS = {
  'KittenML/kitten-tts-nano-0.8-int8': { label: 'nano int8 (~25 MB)' },
  'KittenML/kitten-tts-nano-0.8': { label: 'nano fp32 (~56 MB)' },
};

async function fetchBuffer(url) {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  return response.arrayBuffer();
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

async function fetchCached(repoId, filename) {
  const cacheKey = `${repoId.replace('/', '__')}__${filename.replace(/\//g, '_')}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;
  const buffer = await fetchBuffer(hfUrl(repoId, filename));
  await cacheSet(cacheKey, buffer);
  return buffer;
}

export async function downloadModel(repoId) {
  if (!MODELS[repoId]) {
    throw new Error(`Unknown model: ${repoId}. Available: ${Object.keys(MODELS).join(', ')}`);
  }

  const configBuffer = await fetchCached(repoId, 'config.json');
  const config = JSON.parse(new TextDecoder().decode(configBuffer));
  const modelFile = config.model_file;
  const voicesFile = config.voices || 'voices.npz';
  if (!modelFile) throw new Error(`config.json missing 'model_file' for ${repoId}`);

  const [modelBuffer, voicesBuffer] = await Promise.all([
    fetchCached(repoId, modelFile),
    fetchCached(repoId, voicesFile),
  ]);
  return { modelBuffer, voicesBuffer, config };
}
