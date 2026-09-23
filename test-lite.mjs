import { LiteResponseEngine, splitSentences } from './src/lite-response-engine.js';
import { toSpokenEnglish, withChanSuffix } from './src/name-pronunciation.js';

const cases=[
  ['お風呂入ろっか','bath'],
  ['ミルク飲もっか','milk'],
  ['寝よっか','sleep'],
  ['そろそろ起きよっか','wake'],
  ['おむつ替えよっか','diaper'],
  ['着替えよっか','clothes'],
  ['抱っこする？','hug'],
  ['おてて握ってるね','hands'],
  ['あんよバタバタだね','feet'],
  ['にこって笑ったね','smile'],
  ['泣いてるね','cry'],
  ['いっぱいおしゃべりしてるね','voice'],
  ['げっぷ出たね','tummy'],
  ['一緒に遊ぼっか','play'],
  ['お散歩行こっか','outside'],
  ['雨だね','rain'],
  ['今日は晴れてるね','sun'],
  ['ごはん食べよっか','food'],
  ['絵本読もっか','book'],
  ['歌おっか','music'],
  ['寝る','sleep'],
  ['もう寝るよ','sleep'],
  ['寝たね','sleep'],
  ['寝かしつけよう','sleep'],
  ['睡眠の時間だよ','sleep'],
  ['寝ようか','sleep'],
  ['ねようか','sleep'],
  ['ねよっか','sleep'],
  ['もう寝よ','sleep'],
  ['ねんねしよっか','sleep'],
  ['眠ろうか','sleep'],
  ['眠る時間だよ','sleep'],
  ['今日はゆっくりしようね','generic']
]

for(const [input,expected] of cases){
  const engine=new LiteResponseEngine();
  const out=engine.respond(input,'Mayu');
  if(out.scene!==expected) throw new Error(`${input}: expected ${expected}, got ${out.scene}`);
  const n=splitSentences(out.english).length;
  if(n!==3) throw new Error(`${input}: sentence count ${n}, expected 3`);
  const words=(out.english.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g)||[]).length;
  if(words<6||words>12) throw new Error(`${input}: word count ${words}, expected 6-12`);
  console.log(input,'=>',out.scene,'|',out.english);
}

const names=[
  ['まゆ','','Mayu'],
  ['マユ','','Mayu'],
  ['はな','','Hana'],
  ['Hana','','Hana'],
  ['花','',''],
  ['花','Hana','Hana']
];
for(const [saved,override,expected] of names){
  const actual=toSpokenEnglish(saved,override);
  if(actual!==expected) throw new Error(`name ${saved}/${override}: expected ${expected}, got ${actual}`);
}

console.log('Android-aligned LiteResponseEngine + BabyNamePronunciation smoke test OK');


const chanNames=[
  ['Hana',true,'Hana-chan'],
  ['Hana',false,'Hana'],
  ['Hana-chan',true,'Hana-chan'],
  ['',true,'']
];
for(const [name,enabled,expected] of chanNames){
  const actual=withChanSuffix(name,enabled);
  if(actual!==expected) throw new Error(`chan suffix ${name}/${enabled}: expected ${expected}, got ${actual}`);
}

console.log('Chan suffix tests OK');


const negativeCases = [
  ['寝返りしたね','sleep'],
  ['手伝ってね','hands'],
  ['足りないね','feet'],
  ['風呂敷だね','bath'],
  ['声優さんだね','voice'],
  ['歌舞伎だね','music']
];
for (const [input,forbidden] of negativeCases) {
  const out = new LiteResponseEngine().respond(input);
  if (out.scene === forbidden) throw new Error(`${input}: should not be classified as ${forbidden}`);
}

const hunger = new LiteResponseEngine().respond('お腹すいたね');
if (hunger.scene !== 'food') throw new Error(`お腹すいたね: expected food, got ${hunger.scene}`);

console.log('Natural phrase + exclusion coverage tests OK');
