// Integrity and provenance checks; this does not certify human pronunciation.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const load=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const report=await load('research/voice-five-candidates-20261018.json');
const manifest=await load('assets/voice-1202/manifest.json');
const audit=await load('research/voice-content-26-human-verdicts-20261018.json');
const ledger=await load('research/voice-content-26-review-20261015.json');
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(report.audioIssuesResolved,false);
assert.equal(audit.audioIssuesResolved,false);
assert.deepEqual(report.candidates.map(r=>r.number),[9,11,14,16,17]);
assert.equal(manifest.entries.filter(e=>e.repair?.date==='2026-10-18').length,5);
assert.deepEqual(report.scope,{total:1105,reviewed:5,audioRerecorded:1,textAlignedToOriginalAudio:4,untouched:1100});
const twoRepeatText={11:'Little sips, baby! Sip, sip! High five!',14:'Sip, sip! Nice little sips! No need to rush!',16:'Cuddle, cuddle! My sweet baby! I love you!',17:"All done eating? Wipe, wipe? Let's have a look!"};
for(const r of report.candidates){
 assert.equal(r.canonicalText,ledger.entries.find(e=>e.number===r.number).expected);
 assert.equal(r.humanVerdict,'pending');
 assert.equal(r.seed,1202);
 assert.equal(r.referenceSha256,manifest.referenceSha256);
 assert.equal(r.modelRevision,manifest.modelRevision);
 const entry=manifest.entries.find(e=>e.text===r.canonicalText);
 assert.equal(entry.file,r.file);assert.equal(entry.sha256,r.sha256);
 assert.equal(entry.original_sha256,r.rawSha256);
 assert.equal(entry.duration_seconds,r.durationSeconds);
 assert.equal(entry.bytes,r.bytes);assert.equal(entry.repair.humanVerdict,'pending');
 const bytes=await readFile(new URL('assets/voice-1202/'+r.file,root));
 assert.equal(hash(bytes),r.sha256);assert.equal(bytes.length,r.bytes);
 const previous=await readFile(new URL(`assets/voice-repair-review-20261018/original/${r.number}.m4a`,root));
 assert.equal(hash(previous),r.previousSha256);
 if(twoRepeatText[r.number]){
  assert.equal(r.canonicalText,twoRepeatText[r.number]);
  assert.equal(r.resolution,'text-aligned-to-original-two-repeats');
  assert.equal(r.audioEdited,false);
  assert.equal(r.assembly,null);assert.equal(r.segments,undefined);
  assert.equal(r.sha256,r.previousSha256);
  assert.deepEqual(bytes,previous,'Two-repeat text must use the original unedited full recording');
  assert.equal(ledger.entries.find(e=>e.number===r.number).originalExpected,r.previousCanonicalText);
 }else{
  assert.equal(r.number,9);assert.notEqual(r.previousSha256,r.sha256);
  assert.equal(r.sha256,'aa716dbe31e226525c0cdc07eac7bdd558b958c0a75b91c0d36e726079734f2f','Keep the improved coo recording');
 }
}
console.log('Improved coo retained; four two-repeat texts use byte-identical original recordings without copy/paste: PASS.');
