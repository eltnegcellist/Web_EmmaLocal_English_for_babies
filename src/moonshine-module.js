import {
  loadMoonshineModule,
  ModelArch,
  Transcriber,
} from './vendor/moonshine/index.js';
import moonshineFactory from './vendor/moonshine/moonshine.mjs';

export { ModelArch, Transcriber };

// GitHub's blob upload limit for this connection is smaller than the 13 MB
// WASM binary. Ship the official release binary as gzip and pass its bytes to
// Emscripten, keeping the complete runtime on Emma's own static origin.
const WASM_URL = new URL('./vendor/moonshine/moonshine.wasm.gz', import.meta.url);
const WASM_SHA256 = '22fca4a5b2dc50fe36dc68e4d25fab73b0250b71f744d9fea511c3a308b2420a';
let runtimePromise;

export function loadEmmaMoonshineModule() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      if (typeof DecompressionStream !== 'function') {
        throw new Error('このブラウザはMoonshineの圧縮WASMの展開に対応していません。');
      }
      const response = await fetch(WASM_URL);
      if (!response.ok || !response.body) {
        throw new Error(`Moonshine WASMを取得できませんでした（HTTP ${response.status}）。`);
      }
      const bytes = new Uint8Array(
        await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
      );
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      const hash = [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
      if (hash !== WASM_SHA256) {
        throw new Error('Moonshine WASMの整合性を確認できませんでした。');
      }
      return loadMoonshineModule({
        factory: options => moonshineFactory({ ...options, wasmBinary: bytes }),
      });
    })().catch(error => {
      runtimePromise = undefined;
      throw error;
    });
  }
  return runtimePromise;
}
