import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSemanticController} from './src/semantic/controller.js';
import {isInteractionEnabled, INTERACTION_SETTING_KEY} from './src/interaction/setting.js';
import { LiteResponseEngine, splitSentences } from './src/lite-response-engine.js';
import { INTERACTION_REPLIES } from './src/interaction/response.js';
import { COMBINED_REPLIES, selectRuriAxes, combinedCandidates } from './src/interaction/ruri-routing.js';

const topics=['drink','bath','milk','sleep','wake','diaper','clothes','hug','hands','feet',
  'smile','cry','voice','tummy','play','outside','rain','sun','food','book','music'];
const labels=['affection','praise','achievement','effort','encouragement','invitation','start',
  'finish','finish_check','care','inquiry','reassurance','repeat','pause'];
assert.equal(Object.keys(INTERACTION_REPLIES).length,14);
assert.equal(Object.keys(COMBINED_REPLIES).length,111,'111 curated meaningful pair types');
assert.equal(Object.values(COMBINED_REPLIES).flat().length,333,'3 variants per pair');
assert.equal(new Set(Object.keys(COMBINED_REPLIES).map(s=>s.split('|')[0])).size,21,'21 concrete Ruri topics represented, including drink');
const onlySeen=new Set();
for(const [key,replies] of Object.entries(COMBINED_REPLIES)){
  const [topic,interaction]=key.split('|');
  assert.ok([...topics,'drink'].includes(topic),key);
  assert.ok(labels.includes(interaction),key);
  assert.equal(replies.length,3,key);
  for(const english of replies){
    const sentences=splitSentences(english);
    const count=sentences.map(p=>(p.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g)||[]).length);
    assert.equal(sentences.length,3,key+': '+english);
    assert.ok(count.every(n=>n<=4),key+': '+count+' '+english);
    assert.ok(count.reduce((a,b)=>a+b,0)>=6 && count.reduce((a,b)=>a+b,0)<=12,key+': '+english);
    const keyText=english.toLowerCase();
    assert.ok(!onlySeen.has(keyText),'duplicate '+english);
    onlySeen.add(keyText);
    if(interaction==='finish_check')assert.ok(sentences.some(x=>x.trim().endsWith('?')),english);
    if(interaction==='effort'||interaction==='encouragement')assert.ok(!/you did it/i.test(english),english);
  }
}
const topic=(id,margin=.7)=>({id,margin,probability:.93});
const interaction=(id,probability=.92)=>({id,probability,margin:.55});
function answer(japanese,t,i,enable=true){return new LiteResponseEngine().respondRuri(japanese,'',t,i,enable);}
for(const [text,t,i] of [
  ['ミルクを上手に飲めたね','milk','praise'],
  ['ミルク飲もうか','milk','invitation'],
  ['おむつ終わったかな','diaper','finish_check'],
  ['泣いてるね、大丈夫だよ','cry','reassurance'],
  ['絵本読もうか','book','invitation'],
  ['お風呂おしまい','bath','finish'],
  ['雨を一緒に見よう','rain','invitation'],
  ['今日も声が出たね','voice','praise'],
]) {
  const r=answer(text,topic(t),interaction(i));
  assert.equal(r.scene,`combined:${t}:${i}`);
  assert.equal(r.combined,true);
  assert.ok(combinedCandidates(t,i).includes(r.english),'must use fixed pair reply');
}
// Nonmatching Japanese text cannot override the Ruri predictions.
assert.equal(answer('お風呂とミルクの話',topic('book'),interaction('praise')).scene,'combined:book:praise');
assert.equal(answer('かわいいね',topic('milk'),interaction('praise')).scene,'combined:milk:praise');
// Both present but pairing not curated -> current Topic; avoid unnatural concatenation.
assert.equal(answer('irrelevant text',topic('milk'),interaction('inquiry')).scene,'milk');
assert.equal(answer('かわいいね',topic('generic'),interaction('affection')).scene,'interaction:affection');
assert.equal(answer('milk',topic('milk'),interaction('none')).scene,'milk');
assert.equal(answer('milk',topic('milk'),interaction('affection'),false).scene,'milk');
assert.equal(answer('unknown',null,null).scene,'generic');
assert.equal(answer('ミルク',topic('milk',0.01),interaction('affection',0.2)).scene,'generic');
assert.equal(answer('ミルク',topic('milk',0.01),interaction('affection')).scene,'interaction:affection');
assert.equal(answer('かわいいね',topic('generic'),interaction('affection',0.1)).scene,'generic');
// A Ruri-only route does not hold past topic when Ruri is unavailable on next turn.
const engine=new LiteResponseEngine();
assert.equal(engine.respondRuri('ミルク', '',topic('milk'),interaction('none')).scene,'milk');
assert.equal(engine.respondRuri('その後、かわいいね','',topic('generic'),interaction('affection')).scene,'interaction:affection');
assert.equal(engine.respondRuri('どうかな','',null,null).scene,'generic');

// New and existing installations with an unset preference use both Ruri axes.
// A user who previously opted out stays opted out across new releases.
const saved = new Map();
const storage = {getItem: key => saved.has(key) ? saved.get(key) : null,
  setItem: (key, value) => saved.set(key,String(value))};
assert.equal(isInteractionEnabled(storage), true, 'unset preference must be ON');
const prediction = {topic:topic('milk'),interaction:interaction('praise')};
const mock = {ready:true, prepare:async()=>{}, cancel(){}, cancelPending(){},
  predict:async()=>prediction};
const control = createSemanticController({
  engine:new LiteResponseEngine(),storage,clientFactory:()=>mock,
});
assert.equal((await control.respond('ミルクを上手に飲めたね','')).scene,'combined:milk:praise');
storage.setItem(INTERACTION_SETTING_KEY,'false');
assert.equal(isInteractionEnabled(storage),false);
assert.equal((await control.respond('ミルクを上手に飲めたね','')).scene,'milk');
storage.setItem(INTERACTION_SETTING_KEY,'true');
assert.equal(isInteractionEnabled(storage),true);
assert.equal((await control.respond('ミルクを上手に飲めたね','')).scene,'combined:milk:praise');
// Ordinary settings, not developer-only, must contain the single toggle.
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const toggleAt=html.indexOf('id="interactionExperimental"');
assert.ok(toggleAt>html.indexOf('<h2>返答と話題</h2>'));
assert.ok(toggleAt<html.indexOf('id="developerTools"'));
assert.equal(html.match(/id="interactionExperimental"/g)?.length,1);
console.log('Interaction default-on / explicit saved OFF / settings exposure: PASS');
console.log('Ruri-only Topic×Interaction 111 pairs / 333 English sets, independent heads, fallback, no keywords: PASS');
