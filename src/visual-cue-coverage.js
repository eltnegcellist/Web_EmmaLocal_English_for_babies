const data=await fetch('./shared/visual-cue-trial-data.json?v=20261020-static-motion-v2').then(r=>{if(!r.ok)throw Error('対応表を読み込めません');return r.json();});
const report=data.report,$=id=>document.getElementById(id),trial=document.documentElement.dataset.trialUrl;
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const labels={animation:'採用済み物体動画',motionCandidate:'新しい部品別動作6候補',background:'背景2候補',still:'静止画',baseline:'通常Emma'};
const trialLink=(text,query)=>{const a=node('a',text);const url=new URL(trial,location.href);for(const [key,value] of Object.entries(query))url.searchParams.set(key,value);a.href=url.href;return a;};
$('trialLink').href=trial;
$('denominator').textContent=`全${report.total.toLocaleString()}件＝3文応答${report.uniqueReplySets}種類＋単文${report.singleSentences}種類（元914セットの重複1件を除外）`;
for(const [key,m] of Object.entries(report.metrics)){const box=node('div');box.className='metric';box.dataset.category=key;box.append(node('span',labels[key]),node('strong',`${m.count}件`),node('span',`${m.percent.toFixed(2)}%`));$('metrics').append(box);const segment=node('div');segment.style.width=`${m.percent}%`;$('coverageBar').append(segment);}
$('missing').textContent=`以前の静止画${report.staticConversion.before}件から${report.staticConversion.converted}件を動作へ切り替えました。新規動作とハート・星の候補も含めた追加アニメーションの未割当：${report.noAddedAnimation.count}件（${report.noAddedAnimation.percent.toFixed(2)}%）。静止表示を残す${report.staticConversion.remaining}件には終了・待機・保留・動作不一致などの理由があります。`;
$('movieSummary').textContent=`採用済み${report.approvedMovies}種類のうち、英文への割当があるのは${report.usedApprovedMovies}種類です。${report.approvedMovies-report.usedApprovedMovies}種類は0件です。別に、新しい部品別動作${report.motionCandidateCount}種類を確認候補として追加しました。`;
$('voiceBankReference').textContent=`参考：音声バンク全体は${report.voiceBankReference.total}件です。応答コーパス外のAndroid用・自己紹介・旧原文等14件には追加動画割当がありません。これらも含めた未割当は${report.voiceBankReference.noAddedAnimation}件（${report.voiceBankReference.noAddedAnimationPercent.toFixed(2)}%）です。`;
for(const movie of report.animations){
 const tr=node('tr');tr.dataset.asset=movie.id;tr.classList.toggle('zero',movie.count===0);tr.classList.toggle('held',movie.status!=='accepted'&&movie.status!=='motion-candidate');
 const title=node('td',movie.label),count=node('td');
 if(movie.count)count.append(trialLink(String(movie.count),{target:movie.id}));else count.textContent='0';
 const status=movie.status==='motion-candidate'?'新規動作・確認候補':movie.status!=='accepted'?'保留・実行時対象外':!movie.runtimeEligible?'意味対応未完成・対象外':movie.count?'素材採用済み・意味対応は候補':'素材採用済み・英文割当なし';
 tr.append(title,count,node('td',`${movie.percent.toFixed(2)}%`),node('td',status));$('movies').append(tr);
}
for(const movie of report.animations.filter(a=>a.status==='motion-candidate')){
 const card=node('article');card.className='motion-card';card.dataset.motion=movie.id;
 const images=node('div');images.className='motion-pair';
 for(const [label,path] of [['静止原画','assets/visual-cue/artwork/stills/'+movie.baseAssetId+'.webp'],['動作候補',movie.image]]){const figure=node('figure'),img=node('img');img.src='./'+path;img.alt=movie.label+'：'+label;if(label==='動作候補')img.dataset.motionId=movie.id;img.width=220;img.height=220;figure.append(img,node('figcaption',label));images.append(figure);}
 card.append(node('h3',movie.label),images,trialLink(`${movie.count}件の英文で試す`,{target:movie.id}));$('motionGallery').append(card);
}
for(const b of report.backgrounds){const tr=node('tr'),count=node('td');count.append(trialLink(String(b.count),{target:b.id}));tr.append(node('td',b.label),count,node('td',`${(b.count/report.total*100).toFixed(2)}%`),node('td','意味の確認待ち'));$('backgrounds').append(tr);}
let shown=50,filtered=[];
function render(reset=true){
 if(reset)shown=50;const category=$('category').value,query=$('search').value.trim().toLowerCase();
 const matches=r=>category==='all'||(category==='converted'?r.staticConverted:category==='no-animation'?['still','baseline'].includes(r.category):r.category===category);
 filtered=data.rows.filter(r=>matches(r)&&r.text.toLowerCase().includes(query));
 $('phrases').replaceChildren();for(const row of filtered.slice(0,shown)){const card=node('article');card.className='phrase';card.append(node('p',row.text),node('small',`${labels[row.category]} / ${row.label} `),trialLink('この英文を試す',{phrase:row.id}));if(row.changeReason)card.append(node('p',row.changeReason));$('phrases').append(card);}
 $('resultCount').textContent=`${filtered.length}件が該当 / ${Math.min(shown,filtered.length)}件を表示`;$('more').hidden=shown>=filtered.length;
}
$('category').addEventListener('change',()=>render());$('search').addEventListener('input',()=>render());$('more').addEventListener('click',()=>{shown+=50;render(false);});render();

let motionPaused=false;$('motionToggle').addEventListener('click',()=>{motionPaused=!motionPaused;for(const img of document.querySelectorAll('[data-motion-id]')){const a=report.animations.find(a=>a.id===img.dataset.motionId);img.src='./'+(motionPaused?a.poster:a.image);}$('motionToggle').textContent=motionPaused?'候補の動きを再開する':'候補の動きを止める';$('motionToggle').setAttribute('aria-pressed',String(motionPaused));});
