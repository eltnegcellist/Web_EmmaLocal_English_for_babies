import { mkdir, readFile, writeFile, copyFile, access, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const source = resolve(process.argv[2] || join(root, '../Android_English_character_for_baby/semantic-lite/cache/ruri70-int8-browser-candidate'));
const target = join(root, 'semantic-assets/ruri70-int8-bd500193');
const runtime = join(root, 'semantic-assets/runtime-ort1.30.0-tokenizers0.2.0');
await access(join(source, 'model.onnx')); await mkdir(target, { recursive: true }); await mkdir(runtime, { recursive: true });
const entry = join(runtime, 'entry.mjs');
await writeFile(entry, "export { Tokenizer } from '@huggingface/tokenizers'; export * as ort from 'onnxruntime-web/wasm';\n");
await build({ entryPoints: [entry], outfile: join(runtime, 'runtime.mjs'), bundle: true, platform: 'browser', format: 'esm', minify: true, target: 'es2022', legalComments: 'eof' });
await unlink(entry);
const runtimeFiles = ['runtime.mjs', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'];
for (const file of runtimeFiles.slice(1)) await copyFile(join(root, 'node_modules/onnxruntime-web/dist', file), join(runtime, file));
for (const file of ['LICENSE-ONNXRUNTIME-MIT.txt','ONNXRUNTIME-ThirdPartyNotices.txt','LICENSE-JS-TOKENIZERS-APACHE-2.0.txt']) await copyFile(join(root,'licenses/semantic',file),join(runtime,file));
const runtimeSupport = [...runtimeFiles,'LICENSE-ONNXRUNTIME-MIT.txt','ONNXRUNTIME-ThirdPartyNotices.txt','LICENSE-JS-TOKENIZERS-APACHE-2.0.txt'];
const modelFiles = ['model.onnx','tokenizer.json','tokenizer_config.json','special_tokens_map.json','config.json','heads-config.json','head-topic.f32','head-intent.f32','head-state.f32','LICENSE-APACHE-2.0.txt','LICENSE-MODERNBERT-MIT.txt','LICENSE-TOKENIZER-MIT.txt','ATTRIBUTION-CHANGES.txt','MODEL-CARD.md'];
for (const file of modelFiles) await copyFile(join(source, file), join(target, file));
const assets = {};
for (const [dir, files] of [[target, modelFiles], [runtime, runtimeSupport]]) {
  for (const file of files) {
    const bytes = await readFile(join(dir, file));
    assets[file] = { url: `../${dir.slice(root.length + 1)}/${file}`, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
}
if (assets['model.onnx'].sha256 !== 'bd500193003fdeaba8c5422a47b974b40b49a5e0c91285c76f6bd949d2205264') throw Error('Unexpected INT8 candidate; keep the measured revision.');
const loadFiles = [...runtimeFiles,'tokenizer.json','tokenizer_config.json','heads-config.json','head-topic.f32','head-intent.f32','head-state.f32','model.onnx'];
await writeFile(join(root,'src/semantic-assets-manifest.json'),JSON.stringify({ version:1, modelSha:assets['model.onnx'].sha256, sourceRevision:'07a8b0aba47d29d2ca21f89b915c1efe2c23d1cc', runtimeBase:`../${runtime.slice(root.length+1)}/`, runtimeFiles, assets, loadBytes:loadFiles.reduce((n,f)=>n+assets[f].bytes,0), packageBytes:Object.values(assets).reduce((n,f)=>n+f.bytes,0) },null,2)+'\n');
console.log('Prepared local semantic assets:',Object.values(assets).reduce((n,f)=>n+f.bytes,0),'bytes (including runtime).');
