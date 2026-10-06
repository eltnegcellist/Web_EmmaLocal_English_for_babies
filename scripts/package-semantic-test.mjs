// Assemble the actual static app and verified INT8/runtime assets for a local test.
import { mkdir, readdir, readFile, writeFile, cp, chmod } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const target=join(root,'dist/semantic-lite-test');
const manifest=JSON.parse(await readFile(join(root,'src/semantic-assets-manifest.json')));
await mkdir(target,{recursive:true});
for(const dir of ['src','worklets','assets','icons','shared','licenses']) await cp(join(root,dir),join(target,dir),{recursive:true});
for(const file of await readdir(root)) if(/\.(html|css|webmanifest)$/.test(file)||['service-worker.js','THIRD_PARTY_NOTICES.md','LICENSE_AUDIT.md'].includes(file)) await cp(join(root,file),join(target,file));
for(const meta of Object.values(manifest.assets)) {
  const source=resolve(root,'src',meta.url);
  const path=relative(root,source);
  if(path.startsWith('..'))throw Error('Asset must stay within the app directory');
  const bytes=await readFile(source);
  if(bytes.length!==meta.bytes||createHash('sha256').update(bytes).digest('hex')!==meta.sha256)throw Error(`Asset integrity mismatch: ${path}`);
  await mkdir(resolve(target,path,'..'),{recursive:true});await writeFile(join(target,path),bytes);
}
await mkdir(join(target,'scripts'),{recursive:true});
await cp(join(root,'scripts/serve-semantic-test.py'),join(target,'scripts/serve-semantic-test.py'));
await cp(join(root,'docs/semantic-lite-web-test.md'),join(target,'TEST-README.md'));
await writeFile(join(target,'Start Test.command'),'#!/bin/zsh\ncd -- "$(dirname -- "$0")"\npython3 scripts/serve-semantic-test.py --open\n');
await chmod(join(target,'Start Test.command'),0o755);
console.log(`Local test package: ${target}\nVerified semantic assets: ${(manifest.packageBytes/1e6).toFixed(2)} MB`);
