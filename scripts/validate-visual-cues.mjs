// Design-only validator. Does not import app/runtime modules or English phrase lists.
export function validateVisualCues(doc,taxonomy,{strict=false}={}){
 const errors=[],bad=(type,path)=>errors.push({type,path});
 const obj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
 const nm=/^[a-z][a-z0-9-]*$/,cue=/^([a-z][a-z0-9-]*)\.([a-z][a-z0-9-]*)$/,id=/^[a-z][a-z0-9_-]{2,}$/;
 const modes=new Set(["auto","illustration","motion","emma","composite"]);
 if(!obj(taxonomy)||taxonomy.schemaVersion!==1||!Array.isArray(taxonomy.namespaces))bad("taxonomy_invalid","root");
 const namespaces=new Set();
 for(const [i,n] of (taxonomy?.namespaces||[]).entries()){
  if(!obj(n)||typeof n.id!=="string"||!nm.test(n.id)||namespaces.has(n.id)||!modes.has(n.defaultRenderer))bad("namespace_invalid_or_duplicate","namespaces["+i+"]");
  else namespaces.add(n.id);
 }
 if(!obj(taxonomy?.safeFallback)||taxonomy.safeFallback.renderer!=="emma"||taxonomy.safeFallback.state!=="neutral")bad("fallback_invalid","safeFallback");
 if(!obj(doc)||doc.schemaVersion!==2||!Array.isArray(doc.assignments)){bad("contract_invalid","root");return errors;}
 const checkCue=(c,p)=>{if(typeof c!=="string"||!cue.test(c))bad("cue_format",p);else if(!namespaces.has(c.split(".")[0]))bad("namespace_unknown",p);};
 const checkSet=(a,p)=>{
  checkCue(a.primaryCue,p+".primaryCue");
  if(a.secondaryCues!==undefined&&!Array.isArray(a.secondaryCues)){bad("secondary_invalid",p+".secondaryCues");return;}
  const seen=new Set();
  for(const [j,c] of (a.secondaryCues||[]).entries()){
   checkCue(c,p+".secondaryCues["+j+"]");
   if(seen.has(c)||c===a.primaryCue)bad("cue_duplicate",p+".secondaryCues["+j+"]");
   seen.add(c);
  }
  if(a.renderPreference!==undefined&&!modes.has(a.renderPreference))bad("render_invalid",p+".renderPreference");
 };
 const seen=new Set(),types=new Set(["topic","interaction","combined","press"]);
 for(const [i,a] of doc.assignments.entries()){
  const p="assignments["+i+"]";
  if(!obj(a)){bad("assignment_invalid",p);continue;}
  if(typeof a.phraseId!=="string"||!id.test(a.phraseId))bad("phrase_id_invalid",p+".phraseId");
  else if(seen.has(a.phraseId))bad("phrase_id_duplicate",p+".phraseId");
  else seen.add(a.phraseId);
  if(!types.has(a.sourceKind))bad("source_kind_invalid",p+".sourceKind");
  if(typeof a.sourceKey!=="string"||!a.sourceKey.trim())bad("source_key_invalid",p+".sourceKey");
  if(a.text!==undefined&&typeof a.text!=="string")bad("text_invalid",p+".text");
  if(a.textFingerprint!==undefined&&!(typeof a.textFingerprint==="string"&&/^[a-f0-9]{64}$/.test(a.textFingerprint)))bad("fingerprint_invalid",p+".textFingerprint");
  if(!["generated","reviewed"].includes(a.reviewStatus))bad("review_invalid",p+".reviewStatus");
  if(strict&&a.reviewStatus!=="reviewed")bad("review_pending",p+".reviewStatus");
  checkSet(a,p);
  let indexes=new Set();
  if(a.sentenceCues!==undefined){
   if(!Array.isArray(a.sentenceCues)||a.sentenceCues.length<1||a.sentenceCues.length>3)bad("sentence_cues_invalid",p+".sentenceCues");
   else for(const [j,s] of a.sentenceCues.entries()){
    const sp=p+".sentenceCues["+j+"]";
    if(!obj(s)){bad("sentence_invalid",sp);continue;}
    if(!Number.isInteger(s.index)||s.index<0||s.index>2||indexes.has(s.index))bad("sentence_index_invalid_or_duplicate",sp+".index");
    indexes.add(s.index);checkSet(s,sp);
   }
  }
  if(strict&&a.sourceKind==="press"&&![0,1,2].every(n=>indexes.has(n)))bad("press_sentence_incomplete",p+".sentenceCues");
 }
 if(strict&&doc.assignments.length===0)bad("empty_release","assignments");
 return errors;
}
if (process.argv[1]?.endsWith('validate-visual-cues.mjs')) {
  const {readFileSync}=await import('node:fs');
  const paths=process.argv.slice(2).filter(x=>x!=='--strict');
  if(paths.length!==2){console.error('Usage: node scripts/validate-visual-cues.mjs <assignments.json> <namespaces.json> [--strict]');process.exitCode=2;}
  else {
    const doc=JSON.parse(readFileSync(paths[0],'utf8'));
    const taxonomy=JSON.parse(readFileSync(paths[1],'utf8'));
    const problems=validateVisualCues(doc,taxonomy,{strict:process.argv.includes('--strict')});
    if(problems.length){console.error(JSON.stringify(problems,null,2));process.exitCode=1;}
    else console.log('Visual Cue authoring contract OK ('+doc.assignments.length+' sample assignments)');
  }
}
