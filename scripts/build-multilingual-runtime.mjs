import{build}from'esbuild';
import{resolve}from'node:path';
import{mkdir,copyFile,readFile,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
const dest='multilingual-assets/runtime';await mkdir(dest,{recursive:true});
await build({entryPoints:['node_modules/@huggingface/transformers/dist/transformers.web.min.js'],bundle:true,
  platform:'browser',format:'esm',outfile:dest+'/transformers.mjs',minify:true,
  alias:{'onnxruntime-web':resolve('node_modules/onnxruntime-web/dist/ort.wasm.bundle.min.mjs'),
    'onnxruntime-common':resolve('node_modules/onnxruntime-common/dist/esm/index.js')}});
for(const name of ['ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'])await copyFile('node_modules/onnxruntime-web/dist/'+name,dest+'/'+name);
for(const [name,source] of [['LICENSE-transformers.txt','node_modules/@huggingface/transformers/LICENSE'],
 ['LICENSE-onnxruntime.txt','licenses/multilingual/ONNXRUNTIME.txt']])await copyFile(source,dest+'/'+name);
const files={};for(const name of ['transformers.mjs','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm']){
 const bytes=await readFile(dest+'/'+name);files[name]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
await writeFile(dest+'/manifest.json',JSON.stringify({transformers:'3.8.1',onnxruntime:'1.30.0',files},null,2)+'\n');
console.log('Built bundled on-device runtime, ORT 1.30.0');
