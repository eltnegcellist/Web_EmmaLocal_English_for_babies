import { classifyEmbedding, decodeHead } from './core.js';
import { createRuriTokenizer } from './tokenize.js';
import { downloadSemanticAsset } from './download.js';
let session, tokenizer, ort, heads, config, manifest;
let initPromise;
const manifestURL = new URL('../semantic-assets-manifest.json', import.meta.url);
async function sha(buffer) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), x => x.toString(16).padStart(2, '0')).join(''); }
async function prepare() {
  if (session) return;
  const response = await fetch(manifestURL, { cache: 'no-store' });
  if (!response.ok) throw Error('テスト用のモデルデータが配置されていません。従来Liteで続けます。');
  manifest = await response.json();
  const cache = await caches.open(`mitsukotoba-semantic-${manifest.modelSha.slice(0, 16)}`);
  let loaded = 0;
  const progress = (extra, message) => self.postMessage({ type: 'progress', loaded: loaded + extra, total: manifest.loadBytes, message });
  async function asset(file) {
    const meta = manifest.assets[file], url = new URL(meta.url, manifestURL).href;
    let buffer;
    const cached = await cache.match(url);
    if (cached) {
      buffer = await cached.arrayBuffer();
      if (buffer.byteLength !== meta.bytes || await sha(buffer) !== meta.sha256) { await cache.delete(url); buffer = null; }
    }
    if (!buffer) {
      buffer = await downloadSemanticAsset(url, meta.bytes, n => progress(n, '意味判定のデータを準備しています…'));
      if (buffer.byteLength !== meta.bytes || await sha(buffer) !== meta.sha256) throw Error('意味判定データを確認できませんでした。もう一度準備してください。');
      await cache.put(url, new Response(buffer, { headers: { 'content-type': file.endsWith('.mjs') ? 'text/javascript' : file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream' } }));
    }
    loaded += meta.bytes; progress(0, '意味判定のデータを準備しています…');
    return buffer;
  }
  // Verify/cache the runtime before importing; the service worker can serve these offline.
  for (const file of manifest.runtimeFiles) await asset(file);
  const runtime = await import(new URL(manifest.assets['runtime.mjs'].url, manifestURL).href);
  ort = runtime.ort;
  ort.env.wasm.wasmPaths = new URL(manifest.runtimeBase, manifestURL).href;
  ort.env.wasm.numThreads = 1;
  const tokenJSON = JSON.parse(new TextDecoder().decode(await asset('tokenizer.json')));
  const tokenConfig = JSON.parse(new TextDecoder().decode(await asset('tokenizer_config.json')));
  // Fast tokenizer.json is authoritative: do not apply slow Llama legacy preprocessing twice.
  tokenizer = createRuriTokenizer(runtime.Tokenizer, tokenJSON, tokenConfig);
  config = JSON.parse(new TextDecoder().decode(await asset('heads-config.json')));
  heads = {};
  for (const [name, head] of Object.entries(config.heads)) heads[name] = decodeHead(await asset(head.filename), head);
  const model = await asset('model.onnx');
  progress(0, '意味判定モデルを開始しています…');
  session = await ort.InferenceSession.create(new Uint8Array(model), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
}
self.onmessage = async ({ data }) => {
  const { type, requestId } = data;
  try {
    if (type === 'init') {
      initPromise ||= prepare().catch(error => { initPromise = null; throw error; });
      await initPromise;
      self.postMessage({ type: 'result', requestId, result: { provider: 'wasm', model: 'ruri70-int8-rowwise' } });
    } else if (type === 'predict') {
      await initPromise;
      if (!session) throw Error('意味判定の準備ができていません。');
      const start = performance.now();
      const ids = tokenizer(data.text);
      if (ids.length > config.max_length) {
        self.postMessage({ type: 'result', requestId, result: { unavailable: true, reason: 'too-long', message: '長い文章は従来Liteで判定しました。' } }); return;
      }
      const tokens = BigInt64Array.from(ids, BigInt);
      const mask = BigInt64Array.from(ids, () => 1n);
      const output = await session.run({ input_ids: new ort.Tensor('int64', tokens, [1, ids.length]), attention_mask: new ort.Tensor('int64', mask, [1, ids.length]) });
      const embedding = Array.from(output.sentence_embedding.data);
      try {
        const result = classifyEmbedding(embedding, heads, config.topic_thresholds);
        const diagnostics = data.diagnostics ? { tokenIds: ids, embedding } : {};
        self.postMessage({ type: 'result', requestId, result: { ...result, elapsedMs: performance.now() - start, ...diagnostics } });
      } finally { for (const tensor of Object.values(output)) tensor.dispose(); }
    }
  } catch (error) { self.postMessage({ type: 'error', requestId, message: error.message || '意味判定でエラーが発生しました。' }); }
};
