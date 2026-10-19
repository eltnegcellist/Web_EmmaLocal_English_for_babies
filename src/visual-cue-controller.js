import { VISUAL_CUE_CATALOG } from './visual-cue-catalog.js';
import { createEmmaGesture } from './emma-gestures.js';
export const normalizeCueText=text=>String(text||'').replaceAll('’',"'").trim().replace(/\s+/g,' ').toLowerCase();
export function resolveVisualCue(text,catalog=VISUAL_CUE_CATALOG){return catalog.bindings[normalizeCueText(text)]||null;}

/** Optional, audio-owned overlay. Playback tokens and decode generations are separate. */
export function createVisualCueController({document=globalThis.document,baseUrl=new URL('../',import.meta.url),catalog=VISUAL_CUE_CATALOG,loadImage,media=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'),onChange=()=>{}}={}){
 let mode='emma',motion=true,serial=0,generation=0,current=null,disposed=false;
 const hosts=()=>[...document.querySelectorAll('[data-visual-cue-host]')];
 const clear=()=>{for(const host of hosts()){host.replaceChildren();host.hidden=true;host.closest('.avatar')?.classList.remove('has-visual-cue');}onChange(null);};
 const decode=loadImage||((url)=>new Promise((resolve,reject)=>{
  const img=new document.defaultView.Image();let timer=setTimeout(()=>reject(Error('Visual cue image timeout')),8000);
  img.onload=()=>{clearTimeout(timer);resolve(img);};img.onerror=()=>{clearTimeout(timer);reject(Error('Visual cue image unavailable'));};img.src=url;
 }));
 async function render(){
  const version=++generation;clear();
  if(disposed||mode!=='visual'||!current||document.hidden)return;
  const p=current.plan;if(!p)return;
  const animate=motion&&!media?.matches;
  let element;
  try{
   if(p.type==='emma'){element=createEmmaGesture(p.state,document);element.dataset.motion=animate?'on':'off';element.classList.add('visual-cue-emma');}
   else {
    const a=catalog.assets[p.assetId];if(!a)return;
    const path=animate?a.image:a.poster;
    await decode(new URL(path,baseUrl).href);
    element=document.createElement('img');element.src=new URL(path,baseUrl).href;element.alt='';element.className='visual-cue-image';element.dataset.assetId=a.id;
   }
  }catch{return;}
  if(version!==generation||!current||disposed||mode!=='visual'||document.hidden)return;
  for(const host of hosts()){host.replaceChildren(element.cloneNode(true));host.hidden=false;host.closest('.avatar')?.classList.add('has-visual-cue');}
  onChange(p);
 }
 const stop=()=>{serial++;generation++;current=null;clear();};
 const visibility=()=>{if(document.hidden)stop();};
 const reduction=()=>{void render();};
 document.addEventListener('visibilitychange',visibility);media?.addEventListener?.('change',reduction);
 return {
  configure(settings={}){mode=settings.mode==='visual'?'visual':'emma';motion=settings.motion!==false;void render();},
  begin(text){const token=++serial;current={token,plan:resolveVisualCue(text,catalog)};void render();return token;},
  end(token){if(current?.token===token)stop();},stop,
  preload(text){const p=resolveVisualCue(text,catalog);if(mode!=='visual'||p?.type!=='asset')return;const a=catalog.assets[p.assetId];if(a)decode(new URL(motion&&!media?.matches?a.image:a.poster,baseUrl).href).catch(()=>{});},
  dispose(){stop();disposed=true;document.removeEventListener('visibilitychange',visibility);media?.removeEventListener?.('change',reduction);}
 };
}
