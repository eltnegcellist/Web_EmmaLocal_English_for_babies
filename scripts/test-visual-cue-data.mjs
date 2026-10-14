import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateVisualCueArtifacts} from './validate-visual-cue-data.mjs';
const load=n=>JSON.parse(readFileSync(new URL('../shared/'+n,import.meta.url),'utf8'));
const args=['visual-cue-corpus.snapshot.json','visual-cue-phrases.json','visual-cue-assignments.draft.json','visual-cue-namespaces.json'].map(load);
const check=(x,strict=false)=>validateVisualCueArtifacts(...x,{strict});
assert.deepEqual(check(args),[]);
assert.equal(args[0].rows.length,914);
assert.equal(args[0].uniquePressSentenceCount,178);
assert.equal(args[2].assignments.filter(x=>x.sourceKind==='press').length,110);
const counts=Object.groupBy(args[2].assignments,x=>x.reviewStatus);
assert.equal((counts.generated||[]).length+(counts.reviewed||[]).length,914);
assert.equal((counts.reviewed||[]).length,load('visual-cue-reviewed-overrides.json').overrides.length);
const negative=[
 ['duplicate_phrase_id',(s,p)=>p.rows[1].phraseId=p.rows[0].phraseId],
 ['phrase_snapshot_drift',(s,p)=>p.rows[0].text='other'],
 ['assignment_phrase_drift',(s,p,d)=>d.assignments[0].text='other'],
 ['unknown_cue',(s,p,d)=>d.assignments[0].primaryCue='action.unknown'],
 ['cue_duplicate',(s,p,d)=>d.assignments[0].secondaryCues=[d.assignments[0].primaryCue]],
 ['press_sentence_coverage',(s,p,d)=>d.assignments.find(x=>x.sourceKind==='press').sentenceCues.pop()],
 ['placeholder_present',s=>s.rows[0].text='{name}, hello'],
 ['duplicate_source_slot',s=>s.rows[1].sourceIndex=s.rows[0].sourceIndex],
 ['press_count_drift',s=>s.uniquePressSentenceCount=5]
];
for(const [target,modify] of negative){const cloned=structuredClone(args);modify(...cloned);assert.ok(check(cloned).some(e=>e.code===target),target);}
assert.ok(check(args,true).some(e=>e.code==='unreviewed'),'strict must fail until review');
console.log('Visual Cue: 914 records, 178 press snippets, 9 mutation checks OK');
