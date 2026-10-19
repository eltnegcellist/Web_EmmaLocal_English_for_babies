// Dedicated public test entry. Uses the application's real worker, voice bank,
// playback cancellation, face animation, play screen and Visual Cue controller.
import {createTrialStorage} from './visual-cue-trial-storage.js';
for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{configurable:true,value:createTrialStorage(window[key])});
const defaults={emma_semantic_enabled:'false',emma_history_enabled:'false',emma_visual_cue_mode:'visual'};
for(const [key,value] of Object.entries(defaults))if(localStorage.getItem(key)===null)localStorage.setItem(key,value);
const {visualCueTrial:app}=await import('./app.js?v=20261020-static-motion-v2');
if(!app)throw Error('テスト文書を開いてください');
for(const id of ['fullResetButton','semanticEnabled','asrModel','endpointMode','onboardingHighPerformance']){const input=document.getElementById(id);if(input)input.disabled=true;}
const data=await fetch(new URL('../shared/visual-cue-trial-data.json?v=20261020-static-motion-v2',import.meta.url)).then(r=>{if(!r.ok)throw Error('英文一覧を読み込めません');return r.json();});
const $=id=>document.getElementById(id);
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
const coverageUrl=document.documentElement.dataset.coverageUrl||'./visual-cue-coverage.html';
const banner=make('aside',null,'trial-banner');banner.append(make('strong','Visual Cue テスト版'));
const link=make('a','英文の網羅率・全動画の割当を見る');link.href=coverageUrl;banner.append(link);const quickStop=make('button','停止');quickStop.id='trialQuickStop';banner.append(quickStop);document.body.prepend(banner);
const panel=make('section',null,'card trial-panel');panel.id='trialPanel';
panel.append(make('h2','すべての英文で試す'),make('p','「押して聞く」はアプリと同じ操作です。ここでは全1,091件から英文を選び、音声と表示を確かめられます。マイクの準備は不要です。'));
const controls=make('div',null,'trial-filters');
const label=(text,node)=>{const l=make('label',text);l.append(node);return l;};
const filter=make('select');filter.id='trialFilter';
const categories=[['all','すべて'],['converted','以前の静止画から動作へ変更'],['animation','採用済み動画'],['motionCandidate','新しい部品別動作（確認候補）'],['background','ハート・星（確認候補）'],['still','静止画（残した理由も表示）'],['baseline','通常Emma（追加アニメーションなし）']];
for(const [value,text] of categories){const o=make('option',text);o.value=value;filter.append(o);}
const target=make('select');target.id='trialTarget';
const search=make('input');search.id='trialSearch';search.type='search';search.placeholder='例：kick / book / milk';
controls.append(label('表示の種類',filter),label('素材・背景',target),label('英文を探す',search));panel.append(controls);
const count=make('p',null,'trial-note');count.id='trialCount';count.setAttribute('role','status');panel.append(count);
const select=make('select');select.id='trialPhrase';select.size=5;panel.append(label('再生する英文',select));
const sentence=make('p',null,'trial-selected');sentence.id='trialSelected';panel.append(sentence);
const detail=make('p',null,'trial-note');detail.id='trialBinding';panel.append(detail);
const buttons=make('div',null,'trial-buttons');
const play=make('button','この英文を再生','primary-button');play.id='trialPlay';
const stop=make('button','停止','outline-button');stop.id='trialStop';
const next=make('button','次の英文','outline-button');next.id='trialNext';buttons.append(play,stop,next);panel.append(buttons);
const compare=make('div',null,'trial-filters');const mode=make('select');mode.id='trialMode';
for(const [value,text] of [['visual','イラスト・背景あり'],['emma','従来のEmmaのみ']]){const o=make('option',text);o.value=value;mode.append(o);}
const motion=make('input');motion.type='checkbox';motion.id='trialMotion';const motionLabel=label('イラスト・背景を動かす ',motion);
compare.append(label('同じ音声で表示を比較',mode),motionLabel);panel.append(compare);
const status=make('p','英文を選んで再生してください。','trial-note');status.id='trialStatus';status.setAttribute('role','status');panel.append(status);
panel.append(make('p','3文の録音には全体で1つの表示を使います。英文との意味対応とハート・星は確認候補です。コップ動画・起床動画・撤回した手の動作は自動表示しません。','trial-note'));
const home=document.querySelector('#homeScreen .screen-content');home.append(panel);
let filtered=[],generation=0;
const params=new URLSearchParams(location.search);
const initial=data.rows.find(r=>r.id===params.get('phrase'));
const matchesCategory=r=>filter.value==='all'||(filter.value==='converted'?r.staticConverted:r.category===filter.value);
function options(){
 const previous=target.value;target.replaceChildren();const all=make('option','すべて');all.value='';target.append(all);
 const eligible=data.rows.filter(matchesCategory);
 for(const key of [...new Set(eligible.map(r=>r.target))]){const rows=eligible.filter(r=>r.target===key);const o=make('option',`${rows[0].label}（${rows.length}件）`);o.value=key;target.append(o);}
 if([...target.options].some(o=>o.value===previous))target.value=previous;
}
function selection(){
 generation++;void app.stop();play.disabled=!select.value;
 const row=filtered.find(r=>r.id===select.value);sentence.textContent=row?.text||'該当する英文はありません。';detail.textContent=row?`${row.label} ・ ${row.category==='animation'?'採用済み素材／意味対応は候補':row.category==='motionCandidate'?'新しい部品別動作・確認候補':row.category==='background'?'背景は確認候補':'追加動画なし'}${row.changeReason?' ／ '+row.changeReason:''}`:'';
 if(row)app.preload(row.text);
 status.textContent='英文を選んで再生してください。';
}
function render(preferred){
 const query=search.value.trim().toLowerCase();
 filtered=data.rows.filter(r=>matchesCategory(r)&&(!target.value||r.target===target.value)&&r.text.toLowerCase().includes(query));
 select.replaceChildren();for(const row of filtered){const o=make('option',row.text);o.value=row.id;select.append(o);}
 if(preferred&&filtered.some(r=>r.id===preferred))select.value=preferred;else select.selectedIndex=filtered.length?0:-1;
 count.textContent=`${filtered.length.toLocaleString()}件 / 全${data.rows.length.toLocaleString()}件`;selection();
}
filter.addEventListener('change',()=>{options();render();});target.addEventListener('change',()=>render());search.addEventListener('input',()=>render());select.addEventListener('change',selection);
play.addEventListener('click',async()=>{
 const row=filtered.find(r=>r.id===select.value);if(!row)return;
 const ticket=++generation;play.disabled=true;status.textContent='音声を準備しています…';
 $('avatar').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});
 try{await app.play(row.text);if(ticket===generation)status.textContent='再生が終わりました。';}
 catch(error){if(ticket===generation)status.textContent=`再生できませんでした：${error.message}`;}
 finally{if(ticket===generation)play.disabled=false;}
});
stop.addEventListener('click',()=>{generation++;void app.stop();play.disabled=!select.value;status.textContent='停止しました。';});
quickStop.addEventListener('click',()=>stop.click());
next.addEventListener('click',()=>{if(!filtered.length)return;select.selectedIndex=(select.selectedIndex+1)%filtered.length;selection();});
const actualMode=$('visualCueMode'),actualMotion=$('visualCueMotion');mode.value=actualMode.value;motion.checked=actualMotion.checked;
mode.addEventListener('change',()=>{actualMode.value=mode.value;actualMode.dispatchEvent(new Event('change'));});
motion.addEventListener('change',()=>{actualMotion.checked=motion.checked;actualMotion.dispatchEvent(new Event('change'));});
actualMode.addEventListener('change',()=>mode.value=actualMode.value);actualMotion.addEventListener('change',()=>motion.checked=actualMotion.checked);
document.addEventListener('visibilitychange',()=>{if(document.hidden){generation++;void app.stop();play.disabled=!select.value;status.textContent='停止しました。';}});
options();if(initial){filter.value=initial.category;options();target.value=initial.target;}else if(params.get('target'))target.value=params.get('target');
render(initial?.id);
