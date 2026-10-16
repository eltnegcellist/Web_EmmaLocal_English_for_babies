// Visual Cue V1: only approved object-level illustrations. No classifier or
// English-bank changes; scenes come from the authoritative Ruri reply route.
// The shared atlas was drawn for this application, not copied from a retail book.
export const VISUAL_CUE_ASSET='./assets/visual-cue/approved/visual-cue-atlas.webp';
export const VISUAL_CUE_MODE_KEY='emma_visual_cue_display_mode';
export const VISUAL_CUE_MODES=Object.freeze({EMMA:'emma',ILLUSTRATION:'illustration'});
const TOPIC_ART={
  milk:{id:'milk',label:'哺乳瓶',position:'0% 0%'},
  drink:{id:'milk',label:'哺乳瓶',position:'0% 0%'},
  book:{id:'book',label:'絵本',position:'100% 0%'},
  hands:{id:'clap',label:'拍手する手',position:'0% 100%'},
  feet:{id:'kick',label:'動かす足',position:'100% 100%'}
};
export function normalizeVisualCueMode(value){
  return value===VISUAL_CUE_MODES.ILLUSTRATION ? VISUAL_CUE_MODES.ILLUSTRATION : VISUAL_CUE_MODES.EMMA;
}
export function replyTopic(reply){
  if(!reply||typeof reply!=='object')return null;
  const direct=typeof reply.topic==='string'?reply.topic:null;
  if(direct)return direct;
  const scene=typeof reply.scene==='string'?reply.scene:'';
  if(scene.startsWith('combined:'))return scene.split(':')[1]||null;
  if(scene.startsWith('interaction:')||scene==='generic')return null;
  return scene||null;
}
export function cueForReply(reply){
  const topic=replyTopic(reply);
  const candidate=TOPIC_ART[topic];
  if(!candidate||typeof reply?.english!=='string')return null;
  const english=reply.english;
  // The available hand/foot pictures show specific motions; do not claim
  // those motions from a mere 'hands' or 'feet' topic label.
  if(candidate.id==='clap'&&!/\bclap(?:s|ped|ping)?\b/i.test(english))return null;
  if(candidate.id==='kick'&&!/\bkick(?:s|ed|ing)?\b/i.test(english))return null;
  // Bottle and book depict objects, not a completed sip / page-turn action.
  return candidate;
}
