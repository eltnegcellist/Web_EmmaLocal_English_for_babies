// Research-only: not imported by the regular app. SVG <object> preserves internal IDs.
const list=document.getElementById('comparisonList');
const toggle=document.getElementById('motionToggle');
const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
let enabled=!reducedMotion?.matches;
const loadedSvgDocuments=new Set();
function applyMotion(){
 document.documentElement.dataset.motion=enabled?'on':'off';
 toggle.textContent=enabled?'動きを停止':'動きを再開';
 toggle.setAttribute('aria-pressed',String(enabled));
 for(const doc of loadedSvgDocuments){
  doc.documentElement.classList.toggle('paused',!enabled);
  let s=doc.getElementById('pauseMotionRule');
  if(!s){
   s=doc.createElementNS('http://www.w3.org/2000/svg','style');
   s.id='pauseMotionRule';s.textContent='svg.paused *{animation-play-state:paused!important}';
   doc.documentElement.appendChild(s);
  }
 }
}
function cardFor(item,i){
 const article=document.createElement('article');article.className='study-item';article.dataset.cue=item.cueId;
 const title=document.createElement('div');title.className='study-item-header';
 const h=document.createElement('h2');h.textContent=(i+1)+'. '+item.title;
 const code=document.createElement('code');code.textContent=item.cueId;title.append(h,code);
 const english=document.createElement('p');english.className='study-examples';english.textContent=item.english;english.lang='en';
 const scenes=document.createElement('div');scenes.className='study-scene';
 const old=document.createElement('div');old.className='study-stage old';
 const img=document.createElement('img');img.src='./'+item.old;img.alt='';img.decoding='async';
 img.onerror=()=>{old.textContent='旧版素材を読み込めませんでした';};
 old.appendChild(img);
 const newer=document.createElement('div');newer.className='study-stage new';
 const obj=document.createElement('object');obj.type='image/svg+xml';obj.data='./'+item.new;
 obj.setAttribute('aria-label',item.title+'：具体的な動きのある新案');
 obj.addEventListener('load',()=>{
  try{
   const doc=obj.contentDocument;
   if(!doc?.documentElement||doc.documentElement.localName!=='svg')throw new Error('bad svg');
   loadedSvgDocuments.add(doc);
   applyMotion();
  }catch{
   newer.replaceChildren(Object.assign(document.createElement('span'),{className:'stage-error',textContent:'新しいSVGを読み込めませんでした'}));
  }
 });
 obj.addEventListener('error',()=>{newer.textContent='素材の読み込みエラー';});
 newer.appendChild(obj);
 scenes.append(old,newer);
 const foot=document.createElement('p');foot.className='study-item-footer';foot.textContent=item.scene+'・'+item.seconds+'秒ループ。'+item.guardrail;
 article.append(title,english,scenes,foot);
 return article;
}
toggle.addEventListener('click',()=>{enabled=!enabled;applyMotion();});
reducedMotion?.addEventListener('change',e=>{if(e.matches){enabled=false;applyMotion();}});
applyMotion();
fetch('./shared/visual-cue-semireal-study.json',{cache:'no-cache'}).then(async res=>{
 if(!res.ok)throw new Error(String(res.status));
 const data=await res.json();
 if(data.schemaVersion!==1||data.entries?.length!==4)throw new Error('Invalid study data');
 const contents=data.entries.map((entry,i)=>cardFor(entry,i));
 list.replaceChildren(...contents);
}).catch(()=>{list.textContent='比較データを読み込めませんでした。Webサーバーから開いてください。';});
