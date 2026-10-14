// Offline meaning-risk audit. NOT a substitute for checking the English with a person.
export function auditVisualCueSemantics(assignments, reviewedOverrides){
 const findings=[],blockers=[];
 const record=(severity,category,a,detail,index=null)=>{
  const issue={severity,category,phraseId:a.phraseId,sourceKind:a.sourceKind,sourceKey:a.sourceKey,text:a.text,detail};
  if(index!==null)issue.sentenceIndex=index;
  if(severity==="blocker")blockers.push(issue);else findings.push(issue);
 };
 const textSentences=text=>(String(text).match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[]).map(x=>x.trim()).filter(Boolean);
 const ids=new Set();
 const reviewed=new Map(reviewedOverrides.map(x=>[x.phraseId,x]));
 let confirmed=0;
 for(const a of assignments){
  if(ids.has(a.phraseId))record("blocker","duplicate-id",a,"Visual phrase IDs must be unique");
  ids.add(a.phraseId);
  const t=a.text.toLowerCase(),cryContext=a.sourceKey==="cry"||a.sourceKey.startsWith("cry|");
  if(a.reviewStatus==="reviewed"){
   confirmed++;
   const o=reviewed.get(a.phraseId);
   if(!o||o.text!==a.text||o.primaryCue!==a.primaryCue)record("blocker","review-override-drift",a,"Reviewed assignment missing current and exact-text override");
  }
  if(a.sourceKey==="wake"&&a.primaryCue==="action.sleep")record("blocker","past-rest-mistaken-as-sleep",a,"Baby is awake, not depicted asleep");
  if(cryContext&&a.primaryCue==="observed.cry")record("blocker","unverified-baby-distress",a,"Cry topic must render supporting Emma as primary");
  if(cryContext&&a.sourceKind==="press"&&a.sentenceCues?.some(s=>s.primaryCue==="observed.cry"))record("blocker","press-cry-assertion",a,"Press sentence must not assume an actively crying child");
  if(a.sourceKey.includes("finish_check")&&(a.primaryCue!=="dialogue.finish-check"||a.secondaryCues?.includes("dialogue.finish")))record("blocker","finish-question-depicted-as-completed",a,"Finish-check must not display completed action");
  if(a.sourceKey==="rain"&&a.primaryCue==="action.tap")record("blocker","rain-as-hand-tapping",a,"Rain tapping is not a baby tap gesture");
  if(a.sourceKey==="milk"&&a.primaryCue==="action.eat")record("blocker","milk-as-solid-food",a,"Milk flavor does not imply eating solids");
  if(a.primaryCue==="action.open-close"&&!/\bopen\b[\s\S]{0,45}\bclose\b|\bclose\b[\s\S]{0,45}\bopen\b/i.test(t))record("blocker","close-means-proximity",a,"Open-close animation requires explicit opening and closing");
  if(a.primaryCue==="action.burp"&&/\b(maybe|might|could)\b.{0,24}\bburp\b|\bis that a burp\?/i.test(t))record("blocker","hypothetical-burp-as-action",a,"A possible burp is not a completed event");
  if(a.primaryCue==="action.peekaboo"&&/\btake a peek\b/i.test(t)&&!/peekaboo|peek-a-boo/i.test(t))record("blocker","peek-as-peekaboo",a,"Inspection is not a peekaboo game");
  if(a.primaryCue==="action.sit"&&/\bi(?:'ll| will) sit\b/i.test(t))record("blocker","adult-sitting-depicted-as-baby",a,"Speaker action is not baby motor development");
  if(/\{(?:name|baby_name|ai_name)\}/i.test(t))record("blocker","placeholder-survived",a,"Placeholder support has been retired");
  if(a.primaryCue==="subject.sun"&&!a.sourceKey.includes("sun")&&/\bsunshine\b/i.test(t))record("caution","figurative-sunshine",a,"May be affectionate nickname rather than sunlight");
  if(a.primaryCue==="observed.smile"&&!/\b(smile|smiling|grin|giggl|laugh|dimple|cheerful)\w*/i.test(t))record("caution","smile-not-explicit",a,"Check whether a smile is actually described");
  if(a.primaryCue.startsWith("action.")&&/\?/.test(t))record("caution","action-plus-question",a,"Check that future or interrogative action is not treated as completed");
  if(a.secondaryCues?.filter(x=>x.startsWith("action.")).length>=2)record("caution","multiple-actions",a,"Check whether composition, not one dominant action, is needed");
  if(/(\byou(?:'re| are) my sunshine\b|\blittle star\b|\bmy sunshine\b)/i.test(t))record("caution","metaphorical-language",a,"Avoid depicting literal weather/star for affectionate metaphor");
  if(a.sourceKind==="press"){
   const lines=textSentences(a.text);
   if(lines.length!==3||a.sentenceCues?.length!==3)record("blocker","press-sentence-coverage",a,"Expected exactly three independent sentence cues");
   else for(let j=0;j<3;j++){
    const c=a.sentenceCues.find(x=>x.index===j);
    if(!c){record("blocker","press-missing-index",a,"Missing sentence cue",j);continue;}
    const sentence=lines[j].toLowerCase();
    if(c.primaryCue==="observed.cry"&&!/\b(cry|crying|tears|sob)\b/.test(sentence))record("blocker","press-implied-distress",a,"One sentence cannot infer crying from a topic",j);
    if(c.primaryCue==="action.sip"&&/\?/.test(sentence)&&!/\b(sips|drank|drinking)\b/.test(sentence))record("blocker","press-sip-question-action",a,"A question about a sip is not a sip",j);
    if(c.primaryCue.startsWith("subject.")&&/^(nice and|here we go|there you go|take your time|all done)[.!?]?$/.test(sentence))record("caution","press-generic-scene",a,"Generic sentence should not force topical illustration",j);
   }
  }
 }
 for(const [id,o] of reviewed.entries())if(!ids.has(id))blockers.push({severity:"blocker",category:"orphan-reviewed-override",phraseId:id,detail:o.reason});
 const priority={"action-plus-question":2,"multiple-actions":2,"figurative-sunshine":2,"metaphorical-language":2,"smile-not-explicit":2,"press-generic-scene":1};
 findings.sort((a,b)=>(priority[b.category]||0)-(priority[a.category]||0)||a.phraseId.localeCompare(b.phraseId)||a.category.localeCompare(b.category));
 const grouped={};for(const e of [...blockers,...findings])grouped[e.category]=(grouped[e.category]||0)+1;
 return {schemaVersion:1,status:"automated-semantic-audit-with-manually-reviewed-exceptions",
 summary:{totalSets:assignments.length,reviewed:confirmed,autoGenerated:assignments.length-confirmed,pressSets:assignments.filter(x=>x.sourceKind==="press").length,blockerCount:blockers.length,cautionCount:findings.length,byCategory:grouped},
 blockers,reviewQueue:findings};
}
if(process.argv[1]?.endsWith('audit-visual-cue-semantics.mjs')){
 const {readFileSync,writeFileSync}=await import('node:fs');
 const load=n=>JSON.parse(readFileSync(new URL('../shared/'+n,import.meta.url),'utf8'));
 const input=load('visual-cue-assignments.draft.json').assignments;
 const overrides=load('visual-cue-reviewed-overrides.json').overrides;
 const report=auditVisualCueSemantics(input,overrides);
 const output=JSON.stringify(report,null,2)+'\n';
 const path=new URL('../shared/visual-cue-semantic-audit.json',import.meta.url);
 if(process.argv.includes('--check')){if(readFileSync(path,'utf8')!==output)throw Error('Visual Cue semantic report stale');}
 else writeFileSync(path,output);
 console.log(JSON.stringify(report.summary));
 if(report.blockers.length)throw Error('Unresolved visual meaning blockers: '+report.blockers.length);
}
