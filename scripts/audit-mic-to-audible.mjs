#!/usr/bin/env node
// Issue #101: aggregate LOCAL acoustic timing marks, not playback-API timestamps.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

function median(values) {
  const a=[...values].sort((x,y)=>x-y),mid=Math.floor(a.length/2);
  return a.length%2?a[mid]:(a[mid-1]+a[mid])/2;
}
function p95(values) {
  const a=[...values].sort((x,y)=>x-y);
  return a[Math.ceil(.95*a.length)-1];
}

export function summarizeAcousticTrials(data) {
  if(!Array.isArray(data?.trials) || !data.trials.length)throw Error('No acoustic trials');
  const byDevice=new Map();
  for(const row of data.trials) {
    if(typeof row.device!=='string' || !row.device.trim())throw Error('Missing device');
    if(typeOfSuccess(row)!=='boolean')throw Error('success must be boolean');
    const group=byDevice.get(row.device)||[];
    group.push(row);
    byDevice.set(row.device,group);
    if(!row.success) {
      if(!row.failure_reason)throw Error('Failure must have a reason');
      continue;
    }
    if(row.onset_source!=='acoustic')throw Error('Audible onset must be measured acoustically, not inferred from play()');
    const a=row.speech_start_ms,b=row.speech_end_ms,c=row.audible_onset_ms;
    if(![a,b,c].every(Number.isFinite)||!(a<=b&&b<=c))
      throw Error('Invalid speech/acoustic timestamps');
  }
  const groups=[...byDevice].map(([device,rows])=>{
    const successes=rows.filter(x=>x.success);
    const wait=successes.map(x=>x.audible_onset_ms-x.speech_end_ms);
    const full=successes.map(x=>x.audible_onset_ms-x.speech_start_ms);
    return {
      device,trials:rows.length,successes:successes.length,failures:rows.length-successes.length,
      success_pct:+(100*successes.length/rows.length).toFixed(2),
      enough_trials:rows.length>=30,
      end_to_audible_median_ms:wait.length?+median(wait).toFixed(1):null,
      end_to_audible_p95_ms:wait.length?+p95(wait).toFixed(1):null,
      start_to_audible_median_ms:full.length?+median(full).toFixed(1):null,
      start_to_audible_p95_ms:full.length?+p95(full).toFixed(1):null,
    };
  });
  return {status:'LOCAL_ACOUSTIC_RESEARCH_NOT_RELEASE_APPROVAL',
          privacy:'AGGREGATE_ONLY_NO_RAW_AUDIO_OR_WORDS',
          warning:'Acoustic timestamps must come from actual mic/speaker recording. No test data collected by this script.',
          devices:groups};
}
function typeOfSuccess(row){return typeof row.success;}
async function main() {
  if(!process.argv[2]||process.argv.length>4)
    throw Error('Usage: node scripts/audit-mic-to-audible.mjs LOCAL-trials.json [aggregate-output.json]');
  const data=JSON.parse(await readFile(process.argv[2],'utf8'));
  const summary=summarizeAcousticTrials(data);
  console.log(JSON.stringify(summary,null,2));
  if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(summary,null,2)+'\n');
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
