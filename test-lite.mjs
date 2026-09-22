import { LiteResponseEngine, splitSentences } from './src/lite-response-engine.js';
import { toSpokenEnglish, withChanSuffix } from './src/name-pronunciation.js';

const cases=[
  ['お風呂入ろうね','bath'],
  ['ミルク飲もうね','milk'],
  ['おやすみ、ねんねしよう','sleep'],
  ['おはよう、起きたね','wake'],
  ['おむつ替えよう','diaper'],
  ['お洋服だね','clothes'],
  ['抱っこしようね','hug'],
  ['おてて握ってるね','hands'],
  ['あんよキックしてるね','feet'],
  ['ニコニコだね','smile'],
  ['泣いちゃったね','cry'],
  ['クーイングしてるね','voice'],
  ['げっぷ出たね','tummy'],
  ['おもちゃで遊ぼう','play'],
  ['お散歩に行こう','outside'],
  ['雨が降ってきたね','rain'],
  ['今日はいい天気だね','sun'],
  ['離乳食食べよう','food'],
  ['ページめくろうね','book'],
  ['歌おうね','music'],
  ['今日はゆっくりしようね','generic']
];

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
