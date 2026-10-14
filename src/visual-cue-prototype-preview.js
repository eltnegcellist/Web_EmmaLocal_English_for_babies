// Preview only. Not loaded by src/app.js and never affects recording, Ruri or TTS.
const grid=document.getElementById('cueGrid');
const toggle=document.getElementById('motionToggle');
let entries=[];
function renderPreview(list){
 const frag=document.createDocumentFragment();
 for(const item of list){
  const card=document.createElement('article');card.className='vc-card';card.dataset.cue=item.cueId;
  const header=document.createElement('header');header.className='vc-card-header';
  const no=document.createElement('span');no.className='vc-card-index';no.textContent=String(item.order).padStart(2,'0')+' / 12';
  const chip=document.createElement('span');chip.className='vc-card-status';chip.textContent=item.mode==='emma'?'Emmaを再利用':'SVG試作';
  header.append(no,chip);
  const stage=document.createElement('div');stage.className='vc-stage';stage.dataset.cue=item.cueId;stage.dataset.type=item.mode;
  stage.setAttribute('role','img');stage.setAttribute('aria-label',item.title+'。'+item.example);
  const img=document.createElement('img');img.src='./'+item.image;img.alt='';img.width=480;img.height=360;img.loading='eager';
  img.addEventListener('error',()=>{stage.textContent='素材の読み込みに失敗しました';stage.setAttribute('role','status');});
  const deco=document.createElement('span');deco.className='vc-decor';deco.setAttribute('aria-hidden','true');
  stage.append(img,deco);
  const content=document.createElement('div');content.className='vc-card-body';
  const title=document.createElement('h2');title.textContent=item.title;
  const phrase=document.createElement('p');phrase.className='vc-english';phrase.lang='en';phrase.textContent=item.example;
  const code=document.createElement('code');code.className='vc-code';code.textContent=item.cueId;
  content.append(title,phrase,code);card.append(header,stage,content);frag.append(card);
 }
 grid.replaceChildren(frag);
}
fetch('./shared/visual-cue-prototype-manifest.json',{cache:'no-cache'})
 .then(res=>{if(!res.ok)throw Error(String(res.status));return res.json();})
 .then(manifest=>{
  if(manifest.schemaVersion!==1 || manifest.entries?.length!==12)throw Error('試作リストが正しくありません');
  entries=manifest.entries;
  renderPreview(entries);
 })
 .catch(()=>{grid.textContent='試作リストを読み込めませんでした。Webサーバーからページを開いてください。';});
toggle.addEventListener('click',()=>{
 const html=document.documentElement;
 const motion=html.dataset.motion==='on'?'off':'on';
 html.dataset.motion=motion;
 toggle.textContent=motion==='on'?'停止する':'再開する';
 toggle.setAttribute('aria-label',motion==='on'?'アニメーションを停止':'アニメーションを再開');
 toggle.setAttribute('aria-pressed',String(motion==='on'));
});
if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
 document.documentElement.dataset.motion='off';
 toggle.textContent='再開する';
 toggle.setAttribute('aria-label','アニメーションを再開');
 toggle.setAttribute('aria-pressed','false');
}
