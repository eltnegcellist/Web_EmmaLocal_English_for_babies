#!/usr/bin/env node
// Issue #101 research-only. No raw audio, patient details, case text or English
// is written to aggregate. Human verdicts remain untrusted until signed off.
import {readFile,writeFile} from 'node:fs/promises';
const args=process.argv.slice(2);
if(args.length<3||args.length>4){
 console.error('Usage: node scripts/audit-ruri-human-review.mjs <evaluation.json> <english-meaning-review.json> <human-review.json> [aggregate.json]');
 process.exit(2);
}
const [ev,phrases,submitted]=await Promise.all(args.slice(0,3).map(async path=>JSON.parse(await readFile(path,'utf8'))));
const die=message=>{throw Error('Human review invalid: '+message)};
const topics=new Set(['generic','bath','milk','sleep','wake','diaper','clothes','hug','hands','feet','smile','cry','voice','tummy','play','outside','rain','sun','food','book','music','drink']);
const interactions=new Set(['none','affection','praise','achievement','effort','encouragement','invitation','start','finish','finish_check','care','inquiry','reassurance','repeat','pause']);
const verdicts=new Set(['appropriate','minor_mismatch','contradiction','undecidable']);
if(!Array.isArray(ev.cases)||!Array.isArray(phrases.rows)||!Array.isArray(submitted.cases)||!Array.isArray(submitted.english))die('arrays missing');
if(submitted.schemaVersion!==1)die('schemaVersion must be 1');
if(ev.cases.length===0||phrases.rows.length===0)die('no source cases');
if(submitted.source?.case_count!==ev.cases.length||submitted.source?.english_count!==phrases.rows.length)die('source counts do not match');
function idMap(rows,name,keyer){
 const map=new Map();
 for(const row of rows){
  const key=keyer(row);
  if(map.has(key))die(name+' duplicate');
  map.set(key,row);
 }
 return map;
}
const key=r=>r.id+'\0'+r.english;
const expectedCase=idMap(ev.cases,'expected case',r=>r.id),reviewCase=idMap(submitted.cases,'submitted case',r=>r.id);
const expectedEnglish=idMap(phrases.rows,'expected reply',key),reviewEnglish=idMap(submitted.english,'submitted reply',key);
if(expectedCase.size!==reviewCase.size||expectedEnglish.size!==reviewEnglish.size)die('submission count does not cover source');
const states={unreviewed_topic:0,unreviewed_interaction:0,unreviewed_english:0,undecidable_english:0,confirmed_contradictions:0,minor_mismatch:0,appropriate:0};
let topicMatch=0,topicEligible=0,interactionMatch=0,interactionEligible=0;
const criticalIds=['new002','new011','new031','new038','new039','new073','new085','new094','new097','new125','new126','new128','new129','new136'];
const reviewedCritical=new Set();
for(const [id,source] of expectedCase){
 const row=reviewCase.get(id);
 if(!row||row.text!==source.text)die('case text/ID mismatch for '+id);
 if(!row.topic)states.unreviewed_topic++;
 else if(!topics.has(row.topic))die('unknown Topic for '+id);
 if(!row.interaction)states.unreviewed_interaction++;
 else if(!interactions.has(row.interaction))die('unknown Interaction for '+id);
 if(row.topic&&row.interaction&&criticalIds.includes(id))reviewedCritical.add(id);
 if(source.score_topic&&row.topic){
  topicEligible++;if((source.expected_topic??'generic')===row.topic)topicMatch++;
 }
 if(source.score_interaction&&row.interaction){
  interactionEligible++;if((source.expected_interaction??'none')===row.interaction)interactionMatch++;
 }
}
for(const [id,source] of expectedEnglish){
 const row=reviewEnglish.get(id);
 if(!row||row.text!==source.text||row.english!==source.english)die('reply text, ID or English mismatch');
 if(!row.verdict)states.unreviewed_english++;
 else if(!verdicts.has(row.verdict))die('invalid English verdict');
 if(row.verdict==='undecidable')states.undecidable_english++;
 if(row.verdict==='contradiction')states.confirmed_contradictions++;
 if(row.verdict==='minor_mismatch')states.minor_mismatch++;
 if(row.verdict==='appropriate')states.appropriate++;
}
const allLabeled=states.unreviewed_topic===0&&states.unreviewed_interaction===0;
const allEnglishReviewed=states.unreviewed_english===0&&states.undecidable_english===0;
const summary={
 schemaVersion:1,status:'RESEARCH_ONLY_HUMAN_ANNOTATION_NOT_RELEASE_APPROVAL',
 source:{cases:ev.cases.length,englishPairs:phrases.rows.length},
 reviewStatus:{
  casesFullyLabeled:ev.cases.length-[...reviewCase.values()].filter(x=>!x.topic||!x.interaction).length,
  englishPairsAdjudicated:phrases.rows.length-states.unreviewed_english-states.undecidable_english,
  criticalCaseLabelsReviewed:reviewedCritical.size,
  criticalCaseLabelsTotal:criticalIds.filter(x=>expectedCase.has(x)).length,
  completed:allLabeled&&allEnglishReviewed
 },
 counts:states,
 comparisonWithUnapprovedProvisionalLabels:{
  caveat:'This is agreement with provisional synthetic labels, NOT accuracy on caregiver speech.',
  topicAgreementOnProvisionalLabeledCases:{agree:topicMatch,eligible:topicEligible},
  interactionAgreementOnProvisionalLabeledCases:{agree:interactionMatch,eligible:interactionEligible}
 },
 warnings:[
 'No audio, caregiver speech, Android device, Web parity, or acoustic delay was evaluated by this command.',
 'Review correctness must be independently verified; submitted fields do not authenticate a human.',
 'Even completed review does not authorize new thresholds, head weights, or app release.'
 ]
};
const output=JSON.stringify(summary,null,2)+'\n';
if(args[3])await writeFile(args[3],output);
console.log(output.trim());
if(!summary.reviewStatus.completed)process.exitCode=1;
