#!/usr/bin/env node
/**
 * Per-set three-level text audit: complete inventory, rule-based screening.
 * This is NOT a claim of native English human review or actual Kiki audio review.
 */
import {execFileSync} from 'node:child_process';
import {writeFileSync, mkdirSync} from 'node:fs';

const raw=execFileSync(process.execPath,['scripts/export-phoneme-corpus.mjs'],{
  encoding:'utf8',maxBuffer:8*1024*1024,
});
const corpus=JSON.parse(raw);
const rows=corpus.rows;
if(rows.length!==914)throw Error('Expected 914 complete English sets, received '+rows.length);
for(const [kind,n] of Object.entries({topic:197,interaction:112,combined:495,press:110})){
  if(corpus.counts[kind]!==n)throw Error(kind+' candidate count changed: '+corpus.counts[kind]);
}
const wordRe=/[A-Za-z]+(?:['’][A-Za-z]+)?/g;
const words=s=>s.match(wordRe)||[];
const textKey=s=>s.trim().toLowerCase().replace(/\s+/g,' ');
const critical=[
  ['awkward_set_expression',/\bthat worked out\b/i],
  ['abstract_effort_comment',/\bi see your effort\b/i],
  ['abstract_child_choice',/\byou can decide\b/i],
  ['overwrought_affection',/\babsolutely adorable\b/i],
];
const recommended=[
  ['abstract_language',/\b(celebrate|effort|decide|decision|achieve|achievement|succeed)\b/i],
  ['formulaic_readiness',/\bready when you are\b/i],
  ['artificial_emphasis',/\b(what a wonderful moment|that took some doing|we can decide)\b/i],
];
const phraseCounters=new Map();
const shingleCounters=new Map();
for(const row of rows){
  const sentences=row.english.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(Boolean);
  for(const s of sentences){
    const key=textKey(s);
    phraseCounters.set(key,(phraseCounters.get(key)||0)+1);
  }
  const ws=words(row.english).map(w=>w.toLowerCase());
  for(let i=0;i+2<ws.length;i++){
    const shingle=ws.slice(i,i+3).join(' ');
    shingleCounters.set(shingle,(shingleCounters.get(shingle)||0)+1);
  }
}
const sortedCount=map=>[...map.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
const stockSentences=new Set(sortedCount(phraseCounters)
  .filter(([phrase,n])=>n>=20 && phrase.split(' ').length>=3).map(([phrase])=>phrase));
const ledger=rows.map(row=>{
  const notes=[], w=words(row.english);
  const clauses=row.english.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(Boolean);
  if(!row.english.trim() || clauses.length!==3)notes.push('format_review');
  if(w.length>12 || w.length<6 || clauses.some(s=>words(s).length>4))notes.push('length_review');
  const criticalFlags=critical.filter(([name,re])=>re.test(row.english)).map(([name])=>name);
  notes.push(...criticalFlags);
  notes.push(...recommended.filter(([name,re])=>re.test(row.english)).map(([name])=>name));
  const repeated=clauses.filter(s=>stockSentences.has(textKey(s)));
  if(repeated.length)notes.push('repeated_stock_sentence');
  const grade=criticalFlags.length?'修正必須':notes.length?'改善推奨':'そのままでよい';
  return {id:row.id,kind:row.kind,scene:row.scene,english:row.english,grade,notes};
});
const grades=['そのままでよい','改善推奨','修正必須'];
const counts=Object.fromEntries(grades.map(g=>[g,ledger.filter(x=>x.grade===g).length]));
const categories=Object.fromEntries(['topic','interaction','combined','press'].map(kind=>
  [kind,Object.fromEntries(grades.map(g=>[g,ledger.filter(x=>x.kind===kind&&x.grade===g).length]))]));
const audit={
  schema_version:1,screening_method:'heuristic_text_screening_plus_targeted_editorial_edits',
  caveat:'NOT a claim of native-speaker review or actual Kitten/Kiki audio listening.',
  total:ledger.length,counts,categories,
  frequent_sentences:sortedCount(phraseCounters).slice(0,25),
  repeated_trigrams:sortedCount(shingleCounters).slice(0,25),
  rows:ledger,
};
const noteSummary=Object.entries(ledger.reduce((o,row)=>{
  for(const note of row.notes)o[note]=(o[note]||0)+1;return o;
},{})).sort((a,b)=>b[1]-a[1]);
const formatRow=row=>'| '+row.id.replaceAll('|','/')+' | '+row.grade+' | '
  +row.notes.join(', ')+' | '+row.english.replaceAll('|','/')+' |';
const markdown=[
  '# みつことば：914セット英文の3段階スクリーニング',
  '',
  'このレポートは全914セットを機械的に3段階分類したものです。英語ネイティブの全文人手審査やKiki音声の実聴結果ではありません。',
  '',
  '- 対象: Topic 197、Interaction 112、Topic×Interaction 495、押して聞く 110。',
  '- 判断: 明確に不自然な表現=修正必須、抽象語・頻出定型文・構成上の注意=改善推奨、その他=そのままでよい。',
  '- Shall we、beautiful、wonderful、sunshineなどは出現のみを理由として排除しません。',
  '- Kiki/Kittenへの影響は別途実際のphonemizerを使ったCIテスト・CMUdict監査で確認します。',
  '',
  '| 判定 | セット数 |', '|---|---:|',
  ...grades.map(grade=>'| '+grade+' | '+counts[grade]+' |'),
  '',
  '| 英文バンク | そのままでよい | 改善推奨 | 修正必須 |',
  '|---|---:|---:|---:|',
  ...Object.entries(categories).map(([k,v])=>'| '+k+' | '+v['そのままでよい']+' | '+v['改善推奨']+' | '+v['修正必須']+' |'),
  '',
  '## 特徴的な要修正・改善候補の種類',
  ...noteSummary.map(([n,c])=>'- '+n+': '+c+'セット'),
  '',
  '## よく現れる3語連続',
  '| 3語連続 | 出現数 |','|---|---:|',
  ...audit.repeated_trigrams.slice(0,20).map(([n,c])=>'| '+n+' | '+c+' |'),
  '',
  '## 修正必須・改善推奨から先頭最大80件',
  '| ID | 判定 | 検出理由 | 英文 |','|---|---|---|---|',
  ...ledger.filter(x=>x.grade!=='そのままでよい').slice(0,80).map(formatRow),
  '',
  '全914行の判定・英文・検出理由は infant-english-review.json に記録。',
  '',
  '## 注意点',
  '単語の難易度だけで制限せず、場面への忠実さ、親の自然な声かけ、音素の多様さを重視します。',
  '繰り返し英文は履歴ベースの選択で抑制します。既存の安心表現を一律に削除する方針ではありません。',
  ''
].join('\n');
const check=process.argv.includes('--check');
if(!check){
  mkdirSync('docs/english',{recursive:true});
  writeFileSync('docs/english/infant-english-review.json',JSON.stringify(audit,null,2)+'\n');
  writeFileSync('docs/english/INFANT_ENGLISH_REVIEW_914.md',markdown);
}
console.log(JSON.stringify({total:ledger.length,grades:counts,categories,repeated:noteSummary.slice(0,8),
  mode:check?'check':'report'}));
if(counts['修正必須']>0 && check)throw Error('Remaining mandatory phrase issues: '+counts['修正必須']);
