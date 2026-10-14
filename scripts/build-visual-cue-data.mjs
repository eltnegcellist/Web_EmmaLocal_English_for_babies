// Offline authoring only: reads fixed English banks but does not affect UI/TTS.
import {allLiteReplyGroupsForPhonemeAudit} from '../src/lite-response-engine.js';
import {INTERACTION_REPLIES} from '../src/interaction/response.js';
import {COMBINED_REPLIES} from '../src/interaction/ruri-routing.js';
import {readFileSync,writeFileSync} from 'node:fs';

export function normalized(text) {
 return String(text).replace(/\{(?:name|baby_name|ai_name)\}\s*,?\s*/gi,"").replace(/^\s*,\s*/,"").trim();
}
export function splitSentences(text){return (String(text).match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[]).map(x=>x.trim()).filter(Boolean);}
const topicCues={
  "generic": "social.greeting",
  "bath": "subject.bath",
  "milk": "subject.milk",
  "sleep": "action.sleep",
  "wake": "action.wake",
  "diaper": "subject.diaper",
  "clothes": "subject.clothes",
  "hug": "action.hug",
  "hands": "subject.hands",
  "feet": "subject.feet",
  "smile": "observed.smile",
  "cry": "observed.cry",
  "voice": "observed.voice",
  "tummy": "subject.tummy",
  "play": "subject.toy",
  "outside": "subject.outside",
  "rain": "subject.rain",
  "sun": "subject.sun",
  "food": "subject.food",
  "book": "subject.book",
  "music": "subject.music",
  "drink": "subject.drink",
  "greeting": "social.greeting"
};
const interactionCues={
  "affection": "social.affection",
  "praise": "social.praise",
  "achievement": "social.achievement",
  "effort": "social.effort",
  "encouragement": "social.encouragement",
  "invitation": "dialogue.invitation",
  "start": "dialogue.start",
  "finish": "dialogue.finish",
  "finish_check": "dialogue.finish-check",
  "care": "social.care",
  "inquiry": "dialogue.inquiry",
  "reassurance": "social.reassurance",
  "repeat": "dialogue.repeat",
  "pause": "dialogue.pause"
};
const literalTopicAnchors={
 "generic": /\b(hi|hello|morning|wave)\b/,
 "bath": /\b(bath|water|splash|wash|towel)\b/,
 "milk": /\b(milk|bottle|sip|sips)\b/,
 "sleep": /\b(sleep|rest|night|dream|bed|cozy)\b/,
 "wake": /\b(wake|awake|waking|morning)\b/,
 "diaper": /\b(diaper|wipe|bottom|fresh|clean)\b/,
 "clothes": /\b(clothes|shirt|sock|socks|sleeve|dressed)\b/,
 "hug": /\b(hug|hugs|cuddle|arms)\b/,
 "hands": /\b(hand|hands|finger|fingers|clap|wave|wiggle)\b/,
 "feet": /\b(feet|foot|toes|kick)\b/,
 "smile": /\b(smile|smiling|grin|giggle|cheeks)\b/,
 "cry": /\b(cry|crying|tears)\b/,
 "voice": /\b(voice|sound|ooh|ahh|talk|babble)\b/,
 "tummy": /\b(tummy|burp|belly)\b/,
 "play": /\b(play|toy|game|peekaboo)\b/,
 "outside": /\b(outside|outdoors|park|stroll|sky)\b|\bout we go\b/,
 "rain": /\b(rain|rainy|pitter|drip|drop)\b/,
 "sun": /\b(sun|sunny|sunshine|bright|glow)\b/,
 "food": /\b(food|meal|spoon|bite|yummy)\b/,
 "book": /\b(book|page|story|picture)\b/,
 "music": /\b(music|song|sing|la-la|tap)\b/,
 "drink": /\b(drink|bottle|sip|sips)\b/,
 "greeting": /\b(hello|hi|morning|wave)\b/,
};
export function inferVisualCue(english,kind,scene,strictSentence=false){
 const t=String(english).toLowerCase(), topic=(kind==="combined"?scene.split("|")[0]:(kind==="topic"||kind==="press")?scene:null), inter=(kind==="combined"?scene.split("|")[1]:kind==="interaction"?scene:null);
 let base=topic?topicCues[topic]||"attention.look":null, social=inter?interactionCues[inter]||"attention.listen":null;
 if(topic==="cry")base="social.reassurance";
 const sceneCue=(!strictSentence || (topic && Boolean(literalTopicAnchors[topic]?.test(t))))?base:null;
 const cues=[];
 const add=(pattern,cue)=>{if(pattern.test(t)&&!cues.includes(cue))cues.push(cue);};
 // Explicit semantics from this exact English text take precedence over generic topic fallback.
 add(/\b(turn|flip)\b.{0,22}\bpages?\b|\bpages?\b.{0,15}\b(turn|flip)\b/,"action.turn-page");
 add(/\bclap(?:ping)?\b/,"action.clap");
 add(/\bwave(?:s|d|ing)?\b/,"action.wave");
 add(/\bkick(?:s|ed|ing)?\b/,"action.kick");
 add(/\b(drank|drinking|sipping)\b/,"action.sip");
 if(splitSentences(t).some(x=>/\b(sip|sips)\b/.test(x)&&!/\?$/.test(x)&&!/\b(maybe|might|could|would)\b/.test(x)))add(/\b(sip|sips)\b/,"action.sip");
 add(/\b(splash|splish|splosh)\b/,"action.splash");
 add(/\b(wash|washing|rinse|rinsing|bathe|bathing)\b/,"action.wash");
 add(/\b(wipe|wiping)\b/,"action.wipe");
 add(/\b(dress|dressed|sock|socks|sleeves?|clothes on|arm in)\b/,"action.dress");
 add(/\bopen\b.{0,45}\bclose\b|\bclose\b.{0,45}\bopen\b/,"action.open-close");
 add(/\bwiggle\b/,"action.wiggle");
 add(/\b(squeeze|squeezing)\b/,"action.squeeze");
 add(/\b(cuddle|cuddles|hug|hugs|hugging)\b/,"action.hug");
 if(topic==="play"||topic==="outside")add(/\b(you sit|baby sits|sit down, baby)\b/,"action.sit");
 add(/\b(sing|singing|sang)\b/,"action.sing");
 if(topic!=="rain")add(/\b(tap|tapping)\b/,"action.tap");
 add(/\b(dance|dancing)\b/,"action.dance");
 add(/\b(peekaboo|peek-a-boo|peek,\s*peek)\b/,"action.peekaboo");
 if(topic!=="wake")add(/\b(sleep|sleeping|night-night|dream|dreams|rest|resting)\b/,"action.sleep");
 if(topic!=="generic"||/\b(wake|waking|awake)\b/.test(t))add(/\b(wake|waking|awake|good morning)\b/,"action.wake");
 add(/\b(eat|eating|chew|chewing|bite)\b/,"action.eat");
 if(!/\b(?:maybe|might|could)\b.{0,24}\bburp\b|\bis that a burp\?/.test(t))add(/\b(burp|burping|burped)\b/,"action.burp");
 add(/\b(read|reading)\b/,"action.read");
 add(/\b(count|counting)\b/,"action.count");
 add(/\b(smile|smiling|grin|gigg|laugh)\w*/,"observed.smile");
 if(!/\b(?:are you crying|you can cry|can you cry|no tears|don\x27t cry|crying is okay)\b/.test(t))add(/\b(cry|crying|cries|tears)\b/,"observed.cry");
 add(/\b(babble|coo|cooing|ooh|ahh)\b/,"observed.voice");
 add(/\b(rain|pitter-patter|raindrops?)\b/,"subject.rain");
 add(topic==="sun"?/\b(sun|sunny|sunshine)\b/:/\b(sun|sunny)\b/,"subject.sun");
 add(/\b(look|see|watch)\b/,"attention.look");
 add(/\b(listen|hear)\b/,"attention.listen");
 add(/\b(again|repeat|more)\b/,"dialogue.repeat");
 add(/\b(all done|finished|finish|done now)\b/,"dialogue.finish");
 if(/\b(?:all done|finished|done yet|had enough)\?/.test(t)){
 const n=cues.indexOf("dialogue.finish");if(n>=0)cues.splice(n,1);
 if(!cues.includes("dialogue.finish-check"))cues.push("dialogue.finish-check");
 }
 add(/\b(want|shall we|would you|ready|can we|let's)\b/,"dialogue.invitation");
 add(/\b(great|good job|well done|wonderful|bravo)\b/,"social.praise");
 add(/\b(love you|sweetheart|precious|darling|adorable)\b/,"social.affection");
 add(/\b(right here|it's okay|you are safe|here with you|take your time)\b/,"social.reassurance");
 // Current grouping is a useful contextual hint, but does not define every sentence's meaning.
 let primary=null;
 if(kind==="interaction")primary=social;
 else if(strictSentence){
   primary=cues.find(c=>c.startsWith("action.")||c.startsWith("observed."))||cues.find(c=>c.startsWith("subject."))||cues.find(c=>c.startsWith("dialogue.")||c.startsWith("social.")||c.startsWith("attention."))||sceneCue||social||"emma.neutral";
 }else primary=cues.find(c=>c.startsWith("action.")||c.startsWith("observed."))||base||social||cues[0]||"attention.look";
 if(kind==="combined"&&/finish_check/.test(scene))primary="dialogue.finish-check";
 if(topic==="cry"&&kind!=="interaction")primary="social.reassurance";
 const secondary=[];
 for(const c of [sceneCue,social,...cues])if(c&&c!==primary&&!secondary.includes(c)&&secondary.length<4)secondary.push(c);
 if(primary==="dialogue.finish-check"){
  const n=secondary.indexOf("dialogue.finish");if(n>=0)secondary.splice(n,1);
 }
 const renderer=primary.startsWith("action.")?(secondary.some(c=>c.startsWith("subject."))?"composite":"motion"):primary.startsWith("subject.")?"illustration":"emma";
 return {primaryCue:primary,secondaryCues:secondary,renderPreference:renderer};
}
export function createVisualCueData(rows,previousPhrases=[],previousAssignments=[],reviewedOverrides=[]){
 const oldBySlot=new Map(previousPhrases.map(r=>[r.sourceKind+"\0"+r.sourceKey+"\0"+r.sourceIndex,r]));
 const oldByText=new Map(previousPhrases.map(r=>[r.sourceKind+"\0"+r.sourceKey+"\0"+r.text,r]));
 const oldAssigned=new Map(previousAssignments.map(a=>[a.phraseId,a]));
 const assigned=new Set();let maximum=0;
 for(const p of previousPhrases){const m=/^vc_(\d+)$/.exec(p.phraseId||"");if(m)maximum=Math.max(maximum,Number(m[1]));}
 let reusedExact=0,reusedSlot=0,newIds=0;
 const sourceRows=rows.map(r=>({sourceKind:r.kind,sourceKey:r.scene,sourceIndex:r.index,text:normalized(r.english)}));
 const reservedExact=new Set(sourceRows.map(row=>oldByText.get(row.sourceKind+"\0"+row.sourceKey+"\0"+row.text)?.phraseId).filter(Boolean));
 const output=sourceRows.map(row=>{
  let old=oldByText.get(row.sourceKind+"\0"+row.sourceKey+"\0"+row.text);
  if(old&&!assigned.has(old.phraseId)){reusedExact++;}
  else old=null;
  if(!old){const slot=oldBySlot.get(row.sourceKind+"\0"+row.sourceKey+"\0"+row.sourceIndex);if(slot&&!assigned.has(slot.phraseId)&&!reservedExact.has(slot.phraseId)){old=slot;reusedSlot++;}}
  let phraseId=old?.phraseId;
  if(!phraseId){maximum++;phraseId="vc_"+String(maximum).padStart(6,"0");newIds++;}
  assigned.add(phraseId);return {phraseId,...row};
 });
 const overrides=new Map(reviewedOverrides.map(x=>[x.phraseId,x]));
 const consumed=new Set();
 const assignments=output.map(p=>{
  const {phraseId,sourceKind,sourceKey,text}=p;
  const suggestion=inferVisualCue(text,sourceKind,sourceKey);
  const old=oldAssigned.get(phraseId);
  const override=overrides.get(phraseId);
  if(override&&override.text!==text)throw Error("Reviewed cue override changed text: "+phraseId);
  if(override)consumed.add(phraseId);
  if(!override&&old&&old.text===text&&old.reviewStatus==="reviewed")return old;
  const a={phraseId,sourceKind,sourceKey,text,...suggestion,reviewStatus:"generated"};
  if(sourceKind==="press")a.sentenceCues=splitSentences(text).map((s,i)=>({index:i,...inferVisualCue(s,sourceKind,sourceKey,true)}));
  if(override){a.primaryCue=override.primaryCue;a.secondaryCues=[...override.secondaryCues];a.renderPreference=override.renderPreference;a.reviewStatus="reviewed";}
  return a;
 });
 for(const id of overrides.keys())if(!consumed.has(id))throw Error("Unused reviewed cue override "+id);
 const counts={topic:0,interaction:0,combined:0,press:0};for(const row of output)counts[row.sourceKind]++;
 const pressSentences=new Set(sourceRows.filter(r=>r.sourceKind==="press").flatMap(r=>splitSentences(r.text)));
 const snapshot={schemaVersion:1,counts,uniquePhraseCount:new Set(sourceRows.map(r=>r.text)).size,uniquePressSentenceCount:pressSentences.size,rows:sourceRows.map(x=>({...x}))};
 const phrases={schemaVersion:1,rows:output};
 const draft={schemaVersion:2,revision:"initial-generated-draft-not-reviewed",assignments};
 return {snapshot,phrases,draft,reconciliation:{reusedExact,reusedSlot,newIds}};
}
export function currentBankRows(){
 const topics=allLiteReplyGroupsForPhonemeAudit();
 const press=JSON.parse(readFileSync(new URL('../shared/play-topics.json',import.meta.url),'utf8')).topics;
 const rows=[];
 for(const [kind,group] of [['topic',topics],['interaction',INTERACTION_REPLIES],['combined',COMBINED_REPLIES]])
  for(const [scene,arr] of Object.entries(group))arr.forEach((english,i)=>rows.push({kind,scene,index:i+1,english}));
 for(const group of press)group.phrases.forEach((english,i)=>rows.push({kind:'press',scene:group.id,index:i+1,english}));
 return rows;
}
const isCLI=process.argv[1] && import.meta.url === new URL('file://'+process.argv[1]).href;
if(isCLI){
 const check=process.argv.includes('--check');
 const read=(path)=>{try{return JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));}catch(err){if(err.code==='ENOENT')return null;throw err;}};
 const oldPhrases=read('../shared/visual-cue-phrases.json')?.rows||[];
 const oldAssignments=read('../shared/visual-cue-assignments.draft.json')?.assignments||[];
 const reviewedOverrides=read('../shared/visual-cue-reviewed-overrides.json')?.overrides||[];
 const data=createVisualCueData(currentBankRows(),oldPhrases,oldAssignments,reviewedOverrides);
 const registry=read('../shared/visual-cue-namespaces.json');
 if(!registry || registry.schemaVersion!==2)throw Error('Visual Cue registry is missing');
 const used=new Set([registry.safeFallback]);
 for(const a of data.draft.assignments){
  used.add(a.primaryCue);
  for(const cue of a.secondaryCues||[])used.add(cue);
  for(const part of a.sentenceCues||[]){
   used.add(part.primaryCue);
   for(const cue of part.secondaryCues||[])used.add(cue);
  }
 }
 registry.cues=[...used].sort().map(id=>({id,assetStatus:'not-created',reviewStatus:'generated'}));
 for(const [file,value] of [['../shared/visual-cue-corpus.snapshot.json',data.snapshot],['../shared/visual-cue-phrases.json',data.phrases],['../shared/visual-cue-assignments.draft.json',data.draft],['../shared/visual-cue-namespaces.json',registry]]){
  const path=new URL(file,import.meta.url);const output=JSON.stringify(value,null,2)+'\n';
  if(check){if(readFileSync(path,'utf8')!==output)throw Error(file+' differs from English bank: review and explicitly regenerate');}
  else writeFileSync(path,output);
 }
 console.log(JSON.stringify({counts:data.snapshot.counts,uniquePressSentenceCount:data.snapshot.uniquePressSentenceCount,ids:data.reconciliation,mode:check?'check':'write'}));
}
