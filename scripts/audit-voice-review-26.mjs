#!/usr/bin/env node
// Issue #101: check locally exported 26-clip human verdicts. Never auto-approve release.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

export function summarizeVoiceReview(ledger,exported) {
  if(!Array.isArray(ledger?.entries) || ledger.entries.length!==26)
    throw Error('Expected the 26-clip source ledger');
  const results=exported?.results;
  if(!results || typeof results!=='object' || Array.isArray(results))
    throw Error('Missing exported results map');
  const ids=new Set(ledger.entries.map(x=>String(x.number)));
  if(ids.size!==26)throw Error('Duplicate ledger IDs');
  if(Object.keys(results).some(k=>!ids.has(k)))throw Error('Unknown reviewer entry');
  const counts={match:0,misread:0,unclear:0,pending:0};
  const needsRerecord=[];
  for(const item of ledger.entries) {
    const row=results[String(item.number)];
    if(row && row.expected!==item.expected)
      throw Error('Mismatched expected phrase for clip '+item.number);
    const decision=row?.decision||'pending';
    if(!Object.hasOwn(counts,decision))throw Error('Invalid verdict for clip '+item.number);
    counts[decision]++;
    if(decision==='misread')needsRerecord.push(item.number);
  }
  const reviewed=counts.match+counts.misread;
  return {
    status:'HUMAN_REVIEW_SUMMARY_NOT_RELEASE_APPROVAL',
    total:26,confirmed_verdicts:reviewed,match:counts.match,
    misread:counts.misread,unclear:counts.unclear,pending:counts.pending,
    adjudication_complete:reviewed===26,
    rerecord_required:counts.misread,
    rerecord_clip_numbers:needsRerecord,
    audio_issues_resolved:counts.match===26
  };
}

async function main() {
  const input=process.argv[2];
  if(!input || process.argv.length>4) {
    console.error('Usage: node scripts/audit-voice-review-26.mjs PRIVATE-review-export.json [summary-output.json]');
    process.exitCode=2;return;
  }
  const ledger=JSON.parse(await readFile(new URL('../research/voice-content-26-review-20261015.json',import.meta.url),'utf8'));
  const exported=JSON.parse(await readFile(input,'utf8'));
  const summary=summarizeVoiceReview(ledger,exported);
  console.log(JSON.stringify(summary,null,2));
  if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(summary,null,2)+'\n');
  if(!summary.adjudication_complete || !summary.audio_issues_resolved)process.exitCode=1;
}
if(process.argv[1] && fileURLToPath(import.meta.url)===fileURLToPath(new URL('file://'+process.argv[1])))
  await main();
