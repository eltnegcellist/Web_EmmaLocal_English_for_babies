import {classifyEmbedding,decodeHead} from '../semantic/core.js';
export const LANGUAGES=['ja','de','fr','ko','th','en'];
export const LANGUAGE_KEY='mitsukotoba_language_v1';
export const LANGUAGE_NAMES={ja:'日本語',de:'Deutsch',fr:'Français',ko:'한국어',th:'ไทย',en:'English · Multilingual'};
export function resolveLanguage({saved=null,languages=[],region=null}={}) {
  if(LANGUAGES.includes(saved))return {language:saved,needsChoice:false,source:'saved'};
  for(const tag of languages){const code=String(tag).toLowerCase().split(/[-_]/)[0];
    if(LANGUAGES.includes(code))return {language:code,needsChoice:false,source:'device'};}
  const candidate={JP:'ja',DE:'de',AT:'de',FR:'fr',KR:'ko',TH:'th',US:'en',GB:'en',AU:'en',NZ:'en',IE:'en'}[String(region||'').toUpperCase()];
  return candidate ? {language:candidate,needsChoice:false,source:'region'} : {language:'en',needsChoice:true,source:'choice'};
}
export function modelRoute(language){return language==='ja'?'japanese':'multilingual';}
export function speechLanguage(language){return language==='en'?null:language;}
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
