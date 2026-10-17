#!/usr/bin/env node
// Synthetic AAC integration test: NOT a human listening test.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,mkdtemp,copyFile,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const scripts=fileURLToPath(new URL('.',import.meta.url));
const runTool=resolve(scripts,'apply-reviewed-voice-replacements.mjs');
const evidence=JSON.parse(await readFile(resolve(scripts,'../research/voice-content-26-human-verdicts-20261018.json'),'utf8'));
const ledger=JSON.parse(await readFile(resolve(scripts,'../research/voice-content-26-review-20261015.json'),'utf8'));
assert.equal(evidence.verdicts.length,26);
assert.deepEqual(evidence.verdicts.filter(x=>x.decision==='misread').map(x=>x.number),[9,11,14,16,17]);
assert.equal(evidence.verdicts.filter(x=>x.decision==='match').length,21);
for(const x of evidence.verdicts)assert.ok(ledger.entries.some(y=>y.number===x.number));
for(const name of ['ffmpeg','ffprobe']) {
  try{execFileSync(name,['-version'],{stdio:'ignore'});}
  catch{console.log('SKIP synthetic audio test: '+name+' is unavailable');process.exit(0);}
}
const tmp=await mkdtemp(join(tmpdir(),'mitsukotoba-five-'));
const web=join(tmp,'web'),android=join(tmp,'android'),newDir=join(tmp,'new');
const roots=[join(web,'assets/voice-1202'),join(android,'app/src/main/assets/voice-1202')];
const args=['--web-root',web,'--android-root',android,'--replacement-dir',newDir];
const sha=b=>createHash('sha256').update(b).digest('hex');
function execute(additional=[],expectFail=false){
  try{
    const result=execFileSync(process.execPath,[runTool,...args,...additional],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
    if(expectFail)throw Error('Expected command failure');
    return JSON.parse(result);
  }catch(e){if(expectFail && e.status!==undefined)return;throw e;}
}
try{
  await mkdir(newDir,{recursive:true});
  for(const root of roots)await mkdir(join(root,'clips'),{recursive:true});
  const oldPath=join(tmp,'old.m4a'),newPath=join(tmp,'new.m4a');
  for(const [freq,path] of [[440,oldPath],[660,newPath]])
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi',
      '-i','sine=frequency='+freq+':duration=0.8','-ar','24000',
      '-c:a','aac','-profile:a','aac_low','-b:a','64k','-y',path]);
  const oldBytes=await readFile(oldPath),newBytes=await readFile(newPath);
  const entries=[];
  for(const row of evidence.verdicts.filter(x=>x.decision==='misread')){
    const english=ledger.entries.find(x=>x.number===row.number).expected;
    const id=sha(Buffer.from(english.trim().replace(/\s+/g,' '))).slice(0,24);
    const filename='clips/'+id+'.m4a';
    entries.push({id,text:english,file:filename,seed:1202,codec:'AAC-LC',
      bytes:oldBytes.length,sha256:sha(oldBytes)});
    for(const root of roots)await copyFile(oldPath,join(root,filename));
    await copyFile(newPath,join(newDir,row.number+'.m4a'));
  }
  for(let i=0;i<1100;i++){
    const text='Other sample #'+i+'.',id=sha(Buffer.from(text)).slice(0,24);
    entries.push({text,id,file:'clips/'+id+'.m4a',seed:1202,codec:'AAC-LC',
      bytes:0,sha256:sha(Buffer.alloc(0))});
  }
  const original={schemaVersion:1,generationSeed:1202,sampleRate:24000,
    totalBytes:5*oldBytes.length,entries};
  for(const root of roots)await writeFile(join(root,'manifest.json'),JSON.stringify(original));
  const plan=execute();
  assert.equal(plan.status,'DRY_RUN_NO_WRITES');
  for(const root of roots)assert.deepEqual(
    JSON.parse(await readFile(join(root,'manifest.json'),'utf8')),original);
  const applied=execute(['--apply']);
  assert.equal(applied.status,'REPLACED_REQUIRES_HUMAN_RELISTEN');
  assert.equal(applied.replacements.length,5);
  assert.equal(applied.counts.untouched,1100);
  const results=await Promise.all(roots.map(async root=>
    JSON.parse(await readFile(join(root,'manifest.json'),'utf8'))));
  assert.deepEqual(results[0],results[1]);
  assert.equal(results[0].totalBytes,5*newBytes.length);
  for(let i=0;i<1105;i++){
    if(i>=5)assert.deepEqual(results[0].entries[i],original.entries[i]);
    else {
      assert.equal(results[0].entries[i].sha256,sha(newBytes));
      for(const root of roots)assert.equal(
        sha(await readFile(join(root,results[0].entries[i].file))),sha(newBytes));
    }
  }
  execute([],true); // no byte-identical replacement allowed
  await writeFile(join(newDir,'99.m4a'),newBytes);
  execute([],true); // unexpected sixth candidate must fail
  console.log('Five-clip replacement integration test: PASS (synthetic audio only)');
}finally{await rm(tmp,{recursive:true,force:true});}
