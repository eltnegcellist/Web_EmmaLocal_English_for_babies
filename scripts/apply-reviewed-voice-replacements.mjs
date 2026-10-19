#!/usr/bin/env node
/**
 * Replace only the five recordings identified by the 2026-10-18 human audit.
 * No writes without --apply. This does not generate audio or certify phonemes.
 */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,readdir,rename,unlink,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptDir=fileURLToPath(new URL('.',import.meta.url));
const REVIEW=resolve(scriptDir,'../research/voice-content-26-human-verdicts-20261018.json');
const LEDGER=resolve(scriptDir,'../research/voice-content-26-review-20261015.json');
const norm=s=>String(s).trim().replace(/\s+/g,' ');
const sha=b=>createHash('sha256').update(b).digest('hex');
const WEB_BANK='assets/voice-1202';
const ANDROID_BANK='app/src/main/assets/voice-1202';
const load=async path=>JSON.parse(await readFile(path,'utf8'));

function parseArgs(argv) {
  const args={apply:false};
  for(let i=0;i<argv.length;i++) {
    const key=argv[i];
    if(key==='--apply'){args.apply=true;continue;}
    if(key==='--help'){args.help=true;continue;}
    if(!['--web-root','--android-root','--replacement-dir'].includes(key) ||
       !argv[i+1] || argv[i+1].startsWith('--') || args[key])
      throw Error('Invalid argument: '+key);
    args[key]=resolve(argv[++i]);
  }
  if(args.help)return args;
  for(const key of ['--web-root','--android-root','--replacement-dir'])
    if(!args[key])throw Error('Missing '+key);
  if(args['--web-root']===args['--android-root'])throw Error('Web/Android roots must differ');
  return args;
}

function findEntry(manifest,text) {
  const matches=manifest.entries.filter(x=>norm(x.text)===norm(text));
  if(matches.length!==1)throw Error('Expected exactly one entry for '+text);
  const entry=matches[0];
  const id=sha(Buffer.from(norm(text),'utf8')).slice(0,24);
  if(entry.id!==id || entry.file!=='clips/'+id+'.m4a' ||
     entry.seed!==1202 || entry.codec!=='AAC-LC')
    throw Error('Unexpected audio ID/profile for '+text);
  return entry;
}

function checkAac(bytes,path) {
  if(bytes.length<16 || bytes.toString('ascii',4,8)!=='ftyp')
    throw Error('Not an M4A file: '+path);
  let info;
  try {
    info=JSON.parse(execFileSync('ffprobe',[
      '-v','error',
      '-show_entries','stream=codec_name,profile,sample_rate:format=duration',
      '-of','json',path
    ],{encoding:'utf8',timeout:20000}));
  }catch(err){throw Error('ffprobe failed; install FFmpeg: '+path+' '+err.message);}
  const good=(info.streams||[]).some(s=>s.codec_name==='aac' &&
    String(s.sample_rate)==='24000' && /^LC$/i.test(s.profile||''));
  if(!good || !(Number(info.format?.duration)>0))
    throw Error('Expected nonempty AAC-LC 24 kHz audio: '+path);
}

async function atomicPut(path,bytes) {
  const temp=path+'.voice-repair-'+process.pid+'.tmp';
  try{await writeFile(temp,bytes);await rename(temp,path);}
  finally{await unlink(temp).catch(()=>{});}
}

async function main() {
  const args=parseArgs(process.argv.slice(2));
  if(args.help){
    console.log('Usage: node scripts/apply-reviewed-voice-replacements.mjs --web-root PATH --android-root PATH --replacement-dir PATH [--apply]');
    console.log('Supply approved recordings: 9.m4a, 11.m4a, 14.m4a, 16.m4a, 17.m4a');
    return;
  }
  const review=await load(REVIEW), ledger=await load(LEDGER);
  const misreads=review.verdicts.filter(v=>v.decision==='misread');
  const ids=[9,11,14,16,17];
  if(review.reviewComplete!==true || review.audioIssuesResolved!==false ||
    review.verdicts.length!==26 ||
    JSON.stringify(misreads.map(v=>v.number))!==JSON.stringify(ids) ||
    review.verdicts.filter(v=>v.decision==='match').length!==21)
    throw Error('Review verdicts changed; audit the evidence before continuing');

  const required=ids.map(n=>n+'.m4a').sort();
  const files=(await readdir(args['--replacement-dir'])).filter(f=>f.endsWith('.m4a')).sort();
  if(JSON.stringify(files)!==JSON.stringify(required))
    throw Error('Exactly five numbered M4A files required: '+required.join(', '));

  const webBank=join(args['--web-root'],WEB_BANK);
  const androidBank=join(args['--android-root'],ANDROID_BANK);
  const webManifest=await load(join(webBank,'manifest.json'));
  const androidManifest=await load(join(androidBank,'manifest.json'));
  if(JSON.stringify(webManifest)!==JSON.stringify(androidManifest))
    throw Error('Web/Android source manifests disagree; reconcile first');
  if(webManifest.schemaVersion!==1 || webManifest.generationSeed!==1202 ||
     webManifest.sampleRate!==24000 || webManifest.entries.length!==1105)
    throw Error('Unexpected manifest voice profile or clip count');
  if(webManifest.totalBytes!==webManifest.entries.reduce((n,e)=>n+e.bytes,0))
    throw Error('Original totalBytes mismatch');

  let delta=0;
  const changes=[];
  for(const row of misreads) {
    const ledgerEntry=ledger.entries.find(e=>e.number===row.number);
    if(!ledgerEntry?.expected)throw Error('Missing ledger text for No.'+row.number);
    const entry=findEntry(webManifest,ledgerEntry.expected);
    const replacementPath=join(args['--replacement-dir'],row.number+'.m4a');
    const replacement=await readFile(replacementPath);
    checkAac(replacement,replacementPath);
    const newHash=sha(replacement);
    if(newHash===entry.sha256)throw Error('No.'+row.number+' has not changed');
    const paths=[join(webBank,entry.file),join(androidBank,entry.file)];
    for(const path of paths){
      const original=await readFile(path);
      if(original.length!==entry.bytes || sha(original)!==entry.sha256)
        throw Error('Original audio SHA/size differs from manifest: '+path);
    }
    changes.push({number:row.number,expected:ledgerEntry.expected,file:entry.file,
      oldSha256:entry.sha256,newSha256:newHash,oldBytes:entry.bytes,
      newBytes:replacement.length,paths,bytes:replacement});
    delta+=replacement.length-entry.bytes;
    entry.sha256=newHash;entry.bytes=replacement.length;
  }
  webManifest.totalBytes+=delta;
  if(webManifest.totalBytes!==webManifest.entries.reduce((n,e)=>n+e.bytes,0))
    throw Error('Updated totalBytes mismatch');
  const output=Buffer.from(JSON.stringify(webManifest,null,2)+'\n');
  if(args.apply) {
    // Validate every input first; then replace clips and write manifests last.
    // Git can restore an interrupted local operation.
    for(const change of changes)
      for(const path of change.paths)await atomicPut(path,change.bytes);
    await atomicPut(join(webBank,'manifest.json'),output);
    await atomicPut(join(androidBank,'manifest.json'),output);
  }
  console.log(JSON.stringify({
    status:args.apply?'REPLACED_REQUIRES_HUMAN_RELISTEN':'DRY_RUN_NO_WRITES',
    replacements:changes.map(({number,expected,file,oldSha256,newSha256,oldBytes,newBytes})=>
      ({number,expected,file,oldSha256,newSha256,oldBytes,newBytes})),
    counts:{total:1105,changed:changes.length,untouched:1105-changes.length},
    warning:'This checks file integrity, not pronunciation; all five require human relistening.'
  },null,2));
}
main().catch(err=>{console.error('Voice repair aborted: '+err.message);process.exitCode=1;});
