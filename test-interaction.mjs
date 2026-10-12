import assert from 'node:assert/strict';
import { LiteResponseEngine } from './src/lite-response-engine.js';
import { selectInteraction, INTERACTION_REPLIES } from './src/interaction/response.js';

const examples = {
  affection:'かわいいね', praise:'よくできたね', achievement:'できたね',
  effort:'頑張ってるね', encouragement:'頑張ってね', invitation:'一緒にやろうか',
  start:'始めるよ', finish:'終わったね', finish_check:'終わったかな',
  care:'お疲れさま', inquiry:'どうしたの', reassurance:'大丈夫だよ',
  repeat:'もう一回', pause:'少し待ってね'
};
assert.equal(Object.keys(examples).length,14);
for (const [id,text] of Object.entries(examples)) {
  const engine = new LiteResponseEngine();
  assert.equal(selectInteraction(text,{id,probability:.85,margin:.6},false),id,text);
  const answer=engine.respond(text,'',null,{id,probability:.85,margin:.6});
  assert.equal(answer.scene,'interaction:'+id,text);
  assert.ok(INTERACTION_REPLIES[id].includes(answer.english));
  assert.equal(answer.english.split(/(?<=[.!?])\s+/).length,3);
}
for (const [text,id] of [['大丈夫？','reassurance'],['終わったかな','finish'],['まだ終わってないね','finish'],['できなかったね','achievement']]) {
  assert.equal(selectInteraction(text,{id,probability:.99,margin:.95}),null,'unsafe '+text);
}
for (const [text,id,topic] of [['ミルク飲もうか','invitation','milk'],['おむつ終わったね','finish','diaper'],['抱っこしようね','reassurance','hug'],['絵本読もうか','invitation','book']]) {
  const engine=new LiteResponseEngine();
  const result=engine.respond(text,'',null,{id,probability:.99,margin:.9});
  assert.equal(result.scene,topic,'explicit topic '+text);
}
const engine = new LiteResponseEngine();
assert.equal(engine.respond('ミルク飲もうね').scene,'milk');
const interaction=engine.respond('かわいいね','',null,{id:'affection',probability:.9,margin:.6});
assert.equal(interaction.scene,'interaction:affection','interaction beats held previous Topic');
assert.equal(engine.respond('どうかな').scene,'generic','interaction clears stale Topic');
assert.notEqual(new LiteResponseEngine().respond('かわいいね').scene,'interaction:affection','default without head remains legacy behavior');
console.log('Interaction guarded routing and 14 class reply sets: OK');
