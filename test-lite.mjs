import { LiteResponseEngine, splitSentences } from './src/lite-response-engine.js';
const cases=[['お風呂入ろうね','bath'],['ミルク飲もうね','milk'],['おやすみ、ねんねしよう','sleep'],['おはよう、起きたね','wake'],['おむつ替えよう','diaper'],['お散歩に行こう','outside'],['絵本読もうね','book'],['歌おうね','music']];
const engine=new LiteResponseEngine();
for(const [input,expected] of cases){
  const out=engine.respond(input,'Mayu');
  if(out.scene!==expected) throw new Error(`${input}: expected ${expected}, got ${out.scene}`);
  const n=splitSentences(out.english).length;
  if(n<5||n>7) throw new Error(`${input}: sentence count ${n}`);
  const words=(out.english.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g)||[]).length;
  if(words<20||words>32) throw new Error(`${input}: word count ${words}`);
  console.log(input,'=>',out.scene,'|',out.english);
}
console.log('LiteResponseEngine smoke test OK');
