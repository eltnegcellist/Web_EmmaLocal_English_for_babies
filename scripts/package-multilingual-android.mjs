// Package identical browser/Android on-device inference. Model weights stay out of the APK.
import{cp,mkdir,writeFile,readFile}from'node:fs/promises';
import{resolve,join}from'node:path';
import{fileURLToPath}from'node:url';
import{CATALOG}from'../src/multilingual/translations.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const dest=resolve(process.argv[2]||'../android-multilingual/app/src/main/assets/multilingual');
await mkdir(dest,{recursive:true});
for(const file of ['multilingual-runtime.html','src/semantic/core.js',
  ...['client.js','worker.js','core.js','assets.js','assets.json'].map(s=>'src/multilingual/'+s)]){
  await mkdir(resolve(dest,file,'..'),{recursive:true});await cp(join(root,file),join(dest,file));
}
for(const dir of ['multilingual-assets/runtime','multilingual-assets/heads','licenses/multilingual'])await cp(join(root,dir),join(dest,dir),{recursive:true});
await writeFile(join(dest,'ui-catalog.json'),JSON.stringify(CATALOG,null,2)+'\n');
const manifest=JSON.parse(await readFile(join(root,'src/multilingual/assets.json'),'utf8'));
await writeFile(join(dest,'PACKAGE.json'),JSON.stringify({runtime:manifest.runtime,models:manifest.models,
  modelBytes:manifest.assets.reduce((n,m)=>n+m.bytes,0),weightsBundled:false},null,2)+'\n');
console.log('Packaged runtime, UI catalogue and FP32 heads:',dest);
