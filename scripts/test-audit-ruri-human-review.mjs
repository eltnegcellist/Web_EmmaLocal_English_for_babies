import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const directory=await mkdtemp(join(tmpdir(),'ruri-human-review-contract-'));
const script=resolve('scripts/audit-ruri-human-review.mjs');
const evaluation={cases:[
 {id:'new002',text:'ぐっすり寝てるね',score_topic:true,expected_topic:'sleep',score_interaction:true,expected_interaction:null},
 {id:'new039',text:'ご機嫌ななめだね',score_topic:false,expected_topic:null,score_interaction:false,expected_interaction:null}
]};
const replies={rows:[
 {id:'new002',text:'ぐっすり寝てるね',english:'Are you sleepy?'},
 {id:'new039',text:'ご機嫌ななめだね',english:'What a smile!'}
]};
const draft={schemaVersion:1,source:{case_count:2,english_count:2},
 cases:evaluation.cases.map(x=>({id:x.id,text:x.text,topic:'',interaction:''})),
 english:replies.rows.map(x=>({...x,verdict:''}))};
const file=async(name,data)=>{const p=join(directory,name);await writeFile(p,JSON.stringify(data));return p;};
const sources=await Promise.all([file('evaluation.json',evaluation),file('meaning.json',replies)]);
const check=async(review)=>{
 const path=await file('review.json',review);
 return spawnSync(process.execPath,[script,...sources,path],{encoding:'utf8'});
};
try{
 let r=await check(draft);
 assert.equal(r.status,1,'incomplete report must fail');
 assert.match(r.stdout,/"completed": false/);
 const correct=structuredClone(draft);
 correct.cases[0].topic='sleep';correct.cases[0].interaction='none';
 correct.cases[1].topic='smile';correct.cases[1].interaction='none';
 correct.english[0].verdict='minor_mismatch';
 correct.english[1].verdict='contradiction';
 r=await check(correct);
 assert.equal(r.status,0,r.stderr);
 let result=JSON.parse(r.stdout);
 assert.equal(result.reviewStatus.completed,true);
 assert.equal(result.counts.confirmed_contradictions,1);
 assert.equal(result.comparisonWithUnapprovedProvisionalLabels.topicAgreementOnProvisionalLabeledCases.eligible,1);
 const uncertain=structuredClone(correct);uncertain.english[0].verdict='undecidable';
 r=await check(uncertain);
 assert.equal(r.status,1,'undecidable cases must fail complete gate');
 const corrupted=structuredClone(correct);corrupted.english[0].english='Different English';
 r=await check(corrupted);
 assert.equal(r.status,1);
 const invalid=structuredClone(correct);invalid.cases[0].topic='made-up-label';
 r=await check(invalid);
 assert.equal(r.status,1);
 const missing=structuredClone(correct);missing.cases.pop();
 r=await check(missing);assert.equal(r.status,1);
 console.log('Ruri human-review gate: incomplete/valid/undecidable/tampered/invalid/missing PASS');
}finally{await rm(directory,{recursive:true,force:true});}
