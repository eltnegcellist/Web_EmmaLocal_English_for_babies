const data=await fetch('./shared/visual-cue-trial-data.json').then(r=>{if(!r.ok)throw Error('対応表を読み込めません');return r.json();});
const report=data.report,$=id=>document.getElementById(id),trial=document.documentElement.dataset.trialUrl;
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const labels={animation:'採用済み物体動画',background:'背景2候補',still:'静止画',baseline:'通常Emma'};
const trialLink=(text,query)=>{const a=node('a',text);const url=new URL(trial,location.href);for(const [key,value] of Object.entries(query))url.searchParams.set(key,value);a.href=url.href;return a;};
$('trialLink').href=trial;
$('denominator').textContent=`全${report.total.toLocaleString()}件＝3文応答${report.uniqueReplySets}種類＋単文${report.singleSentences}種類（元914セットの重複1件を除外）`;
for(const [key,m] of Object.entries(report.metrics)){const box=node('div');box.className='metric';box.dataset.category=key;box.append(node('span',labels[key]),node('strong',`${m.count}件`),node('span',`${m.percent.toFixed(2)}%`));$('metrics').append(box);const segment=node('div');segment.style.width=`${m.percent}%`;$('coverageBar').append(segment);}
$('missing').textContent=`採用済み物体動画の未割当：${report.noObjectAnimation.count}件（${report.noObjectAnimation.percent.toFixed(2)}%）。ハート・星の候補も含めた追加アニメーションの未割当：${report.noAddedAnimation.count}件（${report.noAddedAnimation.percent.toFixed(2)}%）。`;
$('movieSummary').textContent=`採用済み20種類のうち、英文への割当があるのは${report.usedApprovedMovies}種類です。${report.approvedMovies-report.usedApprovedMovies}種類は0件です。`;
$('voiceBankReference').textContent=`参考：音声バンク全体は${report.voiceBankReference.total}件です。応答コーパス外のAndroid用・自己紹介・旧原文等14件には追加動画割当がありません。これらも含めた未割当は${report.voiceBankReference.noAddedAnimation}件（${report.voiceBankReference.noAddedAnimationPercent.toFixed(2)}%）です。`;
for(const movie of report.animations){
 const tr=node('tr');tr.dataset.asset=movie.id;tr.classList.toggle('zero',movie.count===0);tr.classList.toggle('held',movie.status!=='accepted');
 const title=node('td',movie.label),count=node('td');
 if(movie.count)count.append(trialLink(String(movie.count),{target:movie.id}));else count.textContent='0';
 const status=movie.status!=='accepted'?'保留・実行時対象外':!movie.runtimeEligible?'意味対応未完成・対象外':movie.count?'素材採用済み・意味対応は候補':'素材採用済み・英文割当なし';
 tr.append(title,count,node('td',`${movie.percent.toFixed(2)}%`),node('td',status));$('movies').append(tr);
}
for(const b of report.backgrounds){const tr=node('tr'),count=node('td');count.append(trialLink(String(b.count),{target:b.id}));tr.append(node('td',b.label),count,node('td',`${(b.count/report.total*100).toFixed(2)}%`),node('td','意味の確認待ち'));$('backgrounds').append(tr);}
let shown=50,filtered=[];
function render(reset=true){
 if(reset)shown=50;const category=$('category').value,query=$('search').value.trim().toLowerCase();
 const matches=r=>category==='all'||(category==='no-animation'?['still','baseline'].includes(r.category):r.category===category);
 filtered=data.rows.filter(r=>matches(r)&&r.text.toLowerCase().includes(query));
 $('phrases').replaceChildren();for(const row of filtered.slice(0,shown)){const card=node('article');card.className='phrase';card.append(node('p',row.text),node('small',`${labels[row.category]} / ${row.label} `),trialLink('この英文を試す',{phrase:row.id}));$('phrases').append(card);}
 $('resultCount').textContent=`${filtered.length}件が該当 / ${Math.min(shown,filtered.length)}件を表示`;$('more').hidden=shown>=filtered.length;
}
$('category').addEventListener('change',()=>render());$('search').addEventListener('input',()=>render());$('more').addEventListener('click',()=>{shown+=50;render(false);});render();
