// Offline-only; source bank imports are deliberately in build-visual-cue-data.mjs.
export function validateVisualCueArtifacts(snapshot,phrases,draft,registry,{strict=false}={}){
 const errors=[],err=(code,path)=>errors.push({code,path});
 const obj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
 const kinds=new Set(["topic","interaction","combined","press"]),modes=new Set(["auto","illustration","motion","emma","composite"]);
 if(!obj(snapshot)||snapshot.schemaVersion!==1||!Array.isArray(snapshot.rows))err("snapshot_invalid","snapshot");
 if(!obj(phrases)||phrases.schemaVersion!==1||!Array.isArray(phrases.rows))err("phrases_invalid","phrases");
 if(!obj(draft)||draft.schemaVersion!==2||!Array.isArray(draft.assignments))err("draft_invalid","draft");
 if(!obj(registry)||registry.schemaVersion!==2||!Array.isArray(registry.cues))err("registry_invalid","registry");
 if(errors.length)return errors;
 const cueIDs=new Set(),namespaces=new Set((registry.namespaces||[]).map(n=>n.id));
 for(const [i,c] of registry.cues.entries()){
  if(!obj(c)||typeof c.id!=="string"||!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(c.id)||!namespaces.has(c.id.split(".")[0])||cueIDs.has(c.id))err("cue_registry_invalid","registry.cues["+i+"]");
  else cueIDs.add(c.id);
 }
 if(!cueIDs.has(registry.safeFallback))err("fallback_unknown","registry.safeFallback");
 const n=snapshot.rows.length;
 if(n!==phrases.rows.length||n!==draft.assignments.length)err("coverage_mismatch","root");
 const counts={topic:0,interaction:0,combined:0,press:0},ids=new Set(),slots=new Set(),texts=new Set(),pressSentences=new Set();
 const checkCue=(c,p)=>{if(!cueIDs.has(c))err("unknown_cue",p);};
 const cueFields=(a,p)=>{
  checkCue(a.primaryCue,p+".primaryCue");
  if(a.renderPreference!==undefined&&!modes.has(a.renderPreference))err("render_invalid",p);
  if(a.secondaryCues!==undefined&&!Array.isArray(a.secondaryCues))err("secondary_invalid",p);
  else {const seen=new Set([a.primaryCue]);for(const [i,c] of (a.secondaryCues||[]).entries()){checkCue(c,p+".secondaryCues["+i+"]");if(seen.has(c))err("cue_duplicate",p);seen.add(c);}}
 };
 const parts=t=>(String(t).match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[]).map(x=>x.trim()).filter(Boolean);
 for(let i=0;i<n;i++){
  const row=snapshot.rows[i],p=phrases.rows[i],a=draft.assignments[i],path="rows["+i+"]";
  if(!obj(row)||!obj(p)||!obj(a)){err("row_invalid",path);continue;}
  if(!kinds.has(row.sourceKind)||!Number.isInteger(row.sourceIndex)||row.sourceIndex<1||typeof row.sourceKey!=="string"||!row.sourceKey.trim())err("source_invalid",path);
  const slot=row.sourceKind+"\0"+row.sourceKey+"\0"+row.sourceIndex;if(slots.has(slot))err("duplicate_source_slot",path);slots.add(slot);
  if(typeof row.text!=="string"||!row.text.trim())err("text_invalid",path);
  if(/\{(?:name|ai_name|baby_name)\}/i.test(row.text||""))err("placeholder_present",path);
  if(texts.has(row.text))err("duplicate_phrase_text",path);texts.add(row.text);
  if(kinds.has(row.sourceKind))counts[row.sourceKind]++;
  if(!/^vc_\d{6,}$/.test(p.phraseId||""))err("phrase_id_invalid",path);
  if(ids.has(p.phraseId))err("duplicate_phrase_id",path);ids.add(p.phraseId);
  if(p.sourceKind!==row.sourceKind||p.sourceKey!==row.sourceKey||p.sourceIndex!==row.sourceIndex||p.text!==row.text)err("phrase_snapshot_drift",path);
  if(a.phraseId!==p.phraseId||a.sourceKind!==row.sourceKind||a.sourceKey!==row.sourceKey||a.text!==row.text)err("assignment_phrase_drift",path);
  if(!["generated","reviewed"].includes(a.reviewStatus))err("review_invalid",path);
  if(strict&&a.reviewStatus!=="reviewed")err("unreviewed",path);
  cueFields(a,path);
  if(row.sourceKind==="press"){
   const sentences=parts(row.text);if(sentences.length!==3)err("press_sentence_count",path);
   for(const s of sentences)pressSentences.add(s);
   if(!Array.isArray(a.sentenceCues)||a.sentenceCues.length!==3)err("press_sentence_coverage",path);
   else {const indices=new Set();for(const [j,c] of a.sentenceCues.entries()){
    if(!obj(c)){err("sentence_invalid",path);continue;}
    if(!Number.isInteger(c.index)||c.index<0||c.index>=3||indices.has(c.index))err("sentence_index_invalid",path+".sentenceCues["+j+"]");
    indices.add(c.index);cueFields(c,path+".sentenceCues["+j+"]");
   }if(![0,1,2].every(x=>indices.has(x)))err("press_sentence_coverage",path);}
  }
 }
 for(const k of kinds)if(counts[k]!==snapshot.counts[k])err("counts_drift","snapshot.counts."+k);
 if(pressSentences.size!==snapshot.uniquePressSentenceCount)err("press_count_drift","snapshot.uniquePressSentenceCount");
 if(texts.size!==snapshot.uniquePhraseCount)err("text_count_drift","snapshot.uniquePhraseCount");
 return errors;
}
if (process.argv[1]?.endsWith('validate-visual-cue-data.mjs')) {
 const {readFileSync}=await import('node:fs');
 const load=n=>JSON.parse(readFileSync(new URL('../shared/'+n,import.meta.url),'utf8'));
 const args=['visual-cue-corpus.snapshot.json','visual-cue-phrases.json','visual-cue-assignments.draft.json','visual-cue-namespaces.json'].map(load);
 const errors=validateVisualCueArtifacts(...args,{strict:process.argv.includes('--strict')});
 if(errors.length){console.error(JSON.stringify(errors.slice(0,50),null,2));console.error('Total:',errors.length);process.exitCode=1;}
 else console.log('914-source Visual Cue coverage and references validated');
}
