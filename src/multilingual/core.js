import {classifyEmbedding,decodeHead} from '../semantic/core.js';
export const LANGUAGES=['ja','de','fr','ko','th','en'];
export const LANGUAGE_KEY='mitsukotoba_language_v1';
// 'auto' follows browser preferences; 'manual' keeps the user's own choice.
export const LANGUAGE_MODE_KEY='mitsukotoba_language_mode_v2';
export function browserLanguages(navigatorInfo=globalThis.navigator,intl=globalThis.Intl) {
  const tags=[];
  // navigator.languages is ordered from most to least preferred.
  for(const tag of navigatorInfo?.languages||[])if(tag&&!tags.includes(tag))tags.push(tag);
  // Some embedded browsers expose navigator.language but not languages.
  const primary=navigatorInfo?.language;
  if(primary&&!tags.includes(primary))tags.push(primary);
  // Use the browser's Intl locale only if Navigator supplies nothing.
  if(!tags.length) {
    try {const locale=intl?.DateTimeFormat?.().resolvedOptions().locale;if(locale)tags.push(locale);}catch{}
  }
  return tags;
}
export const LANGUAGE_NAMES={ja:'日本語',de:'Deutsch',fr:'Français',ko:'한국어',th:'ไทย',en:'English'};
export function resolveLanguage({saved=null,languages=[],region=null}={}) {
  if(LANGUAGES.includes(saved))return {language:saved,needsChoice:false,source:'saved'};
  for(const tag of languages){const code=String(tag).toLowerCase().split(/[-_]/)[0];
    if(LANGUAGES.includes(code))return {language:code,needsChoice:false,source:'device'};}
  const candidate={JP:'ja',DE:'de',AT:'de',FR:'fr',KR:'ko',TH:'th',US:'en',GB:'en',AU:'en',NZ:'en',IE:'en'}[String(region||'').toUpperCase()];
  // No supported browser locale: use English instead of blocking setup.
  return candidate ? {language:candidate,needsChoice:false,source:'region'} : {language:'en',needsChoice:false,source:'fallback'};
}
export function modelRoute(language){return language==='ja'?'japanese':'multilingual';}
// UI language and microphone language are separate. A selected language is
// always a direct Whisper language hint; only the explicit experimental option
// opts into an extra language-detection model pass.
export const SPEECH_DETECTION_KEY='mitsukotoba_speech_detection_v1';
export function speechLanguage(language){
  return language==='auto' ? null : language;
}
export function meaningfulSpeech(text){return /[\p{L}\p{N}]/u.test(String(text||'').trim());}
export function decodeE5Heads(buffers,config) {
  return Object.fromEntries(Object.entries(config.heads).map(([name,meta])=>[name,decodeHead(buffers[name],meta)]));
}
export function classifyE5(embedding,heads) {
  const result=classifyEmbedding(embedding,heads,{threshold:0,margin:0});
  return {...result,source:'e5'};
}
// Pin the measured E5 policy independently of the existing Japanese thresholds.
export function selectE5Axes(topic,interaction,allowInteraction=true) {
  const valid=p=>Number.isFinite(p?.probability)&&p.probability>=0&&p.probability<=1&&Number.isFinite(p?.margin);
  return {topic:valid(topic)&&topic.id!=='generic'?topic.id:null,
    interaction:allowInteraction&&valid(interaction)&&interaction.id!=='none'?interaction.id:null};
}
