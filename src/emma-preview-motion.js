// Preview of the existing main avatar, not a replacement expression system.
// Frame selection/timing/RMS thresholds are checked against app.js by tests.
export const EMMA_FRAME_FILES=['idle-open','idle-half','idle-closed',...['small','medium','large'].flatMap(s=>[`talk-${s}`,`talk-${s}-half`,`talk-${s}-closed`])].map(s=>`emma-face-${s}.svg`);
export function selectEmmaFrame(state,blink,mouth){
 if(state==='speaking')return `emma-face-talk-${mouth}${blink==='open'?'':'-'+blink}.svg`;
 if(state==='understood')return 'emma-face-idle-closed.svg';
 return `emma-face-idle-${blink}.svg`;
}
export function mouthLevelFromSamples(data){let sum=0;for(const x of data){const v=(x-128)/128;sum+=v*v;}const rms=Math.sqrt(sum/data.length);return rms<.025?'small':rms<.075?'medium':'large';}
export function createEmmaPreviewMotion(root,{random=Math.random}={}){
 let state='idle',blink='open',mouth='small',disposed=false,timer,raf;
 const render=()=>{const name=selectEmmaFrame(state,blink,mouth);for(const f of root.querySelectorAll('[data-avatar-frame]'))f.classList.toggle('hidden',f.dataset.avatarFrame!==name);};
 const schedule=()=>{timer=setTimeout(()=>{if(disposed)return;blink='half';render();timer=setTimeout(()=>{if(disposed)return;blink='closed';render();timer=setTimeout(()=>{if(disposed)return;blink='half';render();timer=setTimeout(()=>{if(disposed)return;blink='open';render();schedule();},55);},75);},55);},2800+random()*2200);};
 render();schedule();
 return {
  speak(analyser){cancelAnimationFrame(raf);state='speaking';const data=new Uint8Array(analyser.frequencyBinCount);const tick=()=>{if(disposed||state!=='speaking')return;analyser.getByteTimeDomainData(data);mouth=mouthLevelFromSamples(data);render();raf=requestAnimationFrame(tick);};tick();},
  stop(){cancelAnimationFrame(raf);state='idle';mouth='small';render();},
  dispose(){disposed=true;clearTimeout(timer);cancelAnimationFrame(raf);}
 };
}
export async function loadEmmaFrames(root,{baseUrl=new URL('../',import.meta.url),fetcher=fetch}={}){
 const document=root.ownerDocument;
 const frames=await Promise.all(EMMA_FRAME_FILES.map(async name=>{const response=await fetcher(new URL('assets/emma-face/'+name,baseUrl));if(!response.ok)throw Error('Emmaの顔素材を読み込めません');const template=document.createElement('template');template.innerHTML=await response.text();const svg=template.content.firstElementChild;svg.dataset.avatarFrame=name;svg.setAttribute('aria-hidden','true');svg.classList.add('hidden');return svg;}));
 root.replaceChildren(...frames);return frames;
}
