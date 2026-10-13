import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSemanticController} from './src/semantic/controller.js';
import {isInteractionEnabled, INTERACTION_SETTING_KEY} from './src/interaction/setting.js';
import { LiteResponseEngine, splitSentences } from './src/lite-response-engine.js';
import { INTERACTION_REPLIES } from './src/interaction/response.js';
import { COMBINED_REPLIES, selectRuriAxes, combinedCandidates } from './src/interaction/ruri-routing.js';
import {describeRuriTurn, appendRuriTurn} from './src/interaction/diagnostics.js';

const topics=['drink','bath','milk','sleep','wake','diaper','clothes','hug','hands','feet',
  'smile','cry','voice','tummy','play','outside','rain','sun','food','book','music'];
const labels=['affection','praise','achievement','effort','encouragement','invitation','start',
  'finish','finish_check','care','inquiry','reassurance','repeat','pause'];
assert.equal(Object.keys(INTERACTION_REPLIES).length,14);
assert.equal(Object.keys(COMBINED_REPLIES).length,135,'135 curated meaningful pair types');
assert.equal(Object.values(COMBINED_REPLIES).flat().length,495,'new 90 English sets added');
assert.equal(new Set(Object.keys(COMBINED_REPLIES).map(s=>s.split('|')[0])).size,21,'21 concrete Ruri topics represented, including drink');
const onlySeen=new Set();
for(const [key,replies] of Object.entries(COMBINED_REPLIES)){
  const [topic,interaction]=key.split('|');
  assert.ok([...topics,'drink'].includes(topic),key);
  assert.ok(labels.includes(interaction),key);
  assert.equal(replies.length,(['milk|affection','milk|praise','milk|invitation','milk|finish','milk|finish_check','diaper|invitation','diaper|finish','diaper|finish_check','sleep|invitation','sleep|reassurance','play|invitation','cry|reassurance','smile|affection','book|invitation','bath|invitation','wake|affection','music|invitation','drink|invitation'].includes(key)?8:3),key);
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
// Regression: infant-directed phrases remain concrete and consistent across editions.
assert.ok(COMBINED_REPLIES["milk|praise"].includes("You drank your milk! Little sips are great. Well done today!"));
assert.ok(COMBINED_REPLIES["milk|praise"].includes("Those sips went well! You took little sips! Good job, baby!"));
assert.ok(COMBINED_REPLIES["milk|invitation"].includes("Let's settle down together. Your bottle is ready. Want a little sip?"));
assert.ok(COMBINED_REPLIES["drink|invitation"].includes("Let's take a break. There's a drink here. Want a little sip?"));
assert.ok(COMBINED_REPLIES["cry|reassurance"].includes("Are you upset, baby? Come for a cuddle. I'm here with you."));
assert.ok(COMBINED_REPLIES["smile|affection"].includes("Look at those dimples! What a happy face. I love that smile!"));
assert.ok(!Object.values(COMBINED_REPLIES).flat().some(english=>/fancy a sip|you managed those sips|having big feelings|i treasure you|that was lovely drinking/i.test(english)));

const topic=(id,margin=.7)=>({id,margin,probability:.93});
const interaction=(id,probability=.92)=>({id,probability,margin:.55});
function answer(japanese,t,i,enable=true){return new LiteResponseEngine().respondRuri(japanese,'',t,i,enable);}
for(const [text,t,i] of [
  ['ミルクを上手に飲めたね','milk','praise'],
  ['ミルク飲んだね、かわいいね','milk','affection'],
  ['ミルクは終わったかな','milk','finish_check'],
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
// Both present but pairing not curated -> current Topic; no fabricated concatenation.
assert.equal(answer('irrelevant text',topic('rain'),interaction('praise')).scene,'rain');
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
// Per-turn audit does not store transcript or baby name, but explains routing.
const missing=answer('この文字列は判定に無関係',topic('rain'),interaction('praise'));
const missingAudit=describeRuriTurn({prediction:{topic:topic('rain'),interaction:interaction('praise')},response:missing,at:'test'});
assert.equal(missingAudit.reason,'pair_missing');
assert.equal(missingAudit.route,'rain');
assert.equal(missingAudit.topicStatus,'accepted');
assert.equal(missingAudit.interactionStatus,'accepted');
const weakAudit=describeRuriTurn({prediction:{topic:topic('milk'),interaction:interaction('finish_check',.47)},
  response:answer('ミルク終わった？',topic('milk'),interaction('finish_check',.47)),at:'test'});
assert.equal(weakAudit.reason,'topic_only');
assert.equal(weakAudit.interactionStatus,'low_probability');
const disabledAudit=describeRuriTurn({prediction:{topic:topic('milk'),interaction:interaction('affection')},
  response:answer('ミルクかわいいね',topic('milk'),interaction('affection'),false),interactionEnabled:false,at:'test'});
assert.equal(disabledAudit.interactionStatus,'disabled');
const combinedAudit=describeRuriTurn({prediction:{topic:topic('milk'),interaction:interaction('affection')},
  response:answer('ミルクかわいいね',topic('milk'),interaction('affection')),at:'test'});
assert.equal(combinedAudit.reason,'combined');
assert.equal(combinedAudit.route,'combined:milk:affection');
assert.equal('transcript' in combinedAudit,false);
let rolling=[];
for(let n=0;n<25;n++)rolling=appendRuriTurn(rolling,{n});
assert.equal(rolling.length,20);
assert.equal(rolling[0].n,5);
assert.equal(control.snapshot.routingHistory.length,3);
assert.ok(control.snapshot.routingHistory.every(r=>typeof r.at==='string' && !('transcript' in r)));
// Infant-directed naturalness regression: concrete actions and gentle reactions.
const reviewed=[...Object.values(INTERACTION_REPLIES).flat(),...Object.values(COMBINED_REPLIES).flat()];
assert.ok(INTERACTION_REPLIES.affection.includes('Look at you! My sweet baby. I love you!'));
assert.ok(INTERACTION_REPLIES.effort.includes("You're trying again! Look at you go! I'm here!"));
assert.ok(COMBINED_REPLIES['milk|achievement'].includes("You drank some milk! Good job, baby! I'm right here."));
assert.ok(COMBINED_REPLIES['milk|repeat'].includes("Want more milk? Just a little? Take your time."));
assert.ok(COMBINED_REPLIES['book|inquiry'].includes("Look at this picture! What do you see? Let's look again!"));
for(const english of reviewed) {
  assert.ok(!/that worked out|i see your effort|you can decide|absolutely adorable/i.test(english),english);
}
const playTopics=JSON.parse(readFileSync(new URL('./shared/play-topics.json',import.meta.url),'utf8'));
const playReplies=playTopics.topics.flatMap(x=>x.phrases);
assert.equal(playReplies.length,110);
assert.ok(playReplies.filter(x=>/nice and slow/i.test(x)).length<=2,'avoid stock phrase fatigue');
// An exhausted high-frequency bank is followed by six alternating single-axis
// choices (interaction, topic), then the least-recently-used combination.
const rotating=new LiteResponseEngine();
const paired=new Set();
for(let i=0;i<8;i++){
  const result=rotating.respondRuri('ミルク飲んでかわいいね','',topic('milk'),interaction('affection'));
  assert.equal(result.scene,'combined:milk:affection');
  assert.equal(result.selectionReason,'combined');
  assert.ok(!paired.has(result.english),'no pair repeats before all eight are used');
  paired.add(result.english);
}
assert.equal(paired.size,8);
for(let i=0;i<6;i++){
  const result=rotating.respondRuri('ミルク飲んでかわいいね','',topic('milk'),interaction('affection'));
  assert.equal(result.selectionReason,i%2===0?'diversity_interaction':'diversity_topic');
  assert.equal(result.scene,i%2===0?'interaction:affection':'milk');
}
const next=rotating.respondRuri('ミルク飲んでかわいいね','',topic('milk'),interaction('affection'));
assert.equal(next.scene,'combined:milk:affection');
assert.ok(paired.has(next.english),'after all variants have been used a pair can be reused');
const savedVariety=rotating.exportReplyDiversityState();
assert.equal(savedVariety.history.length,15);
assert.equal('transcript' in savedVariety,false);
const restored=new LiteResponseEngine({diversityState:JSON.parse(JSON.stringify(savedVariety))});
const restoredReply=restored.respondRuri('ミルク飲んでかわいいね','',topic('milk'),interaction('affection'));
assert.equal(restoredReply.scene,'combined:milk:affection');
assert.notEqual(restoredReply.english,next.english,'restart preserves recent-reply avoidance');
const midCycle=new LiteResponseEngine();
const first=midCycle.respondRuri('ミルクだよ','',topic('milk'),interaction('affection'));
const replica=new LiteResponseEngine({diversityState:midCycle.exportReplyDiversityState()});
assert.notEqual(replica.respondRuri('ミルクだよ','',topic('milk'),interaction('affection')).english,first.english);
assert.equal(rotating.exportReplyDiversityState().history.length,15);
// Repeated common stock 3-word phrases are penalized across all English banks.
// Only the unlockable developer settings may expose the OFF switch.
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const toggleAt=html.indexOf('id="interactionExperimental"');
const developerAt=html.indexOf('id="developerTools" class="hidden developer-tools-card"');
assert.ok(developerAt>html.indexOf('<h2>返答と話題</h2>'));
assert.ok(toggleAt>developerAt);
assert.equal(html.match(/id="interactionExperimental"/g)?.length,1);
assert.ok(html.slice(html.indexOf('<h2>返答と話題</h2>'),developerAt).includes('id="semanticEnabled"'));
assert.ok(!html.slice(html.indexOf('<h2>返答と話題</h2>'),developerAt).includes('id="interactionExperimental"'));
console.log('Interaction default-on / explicit saved OFF / developer-only toggle: PASS');
console.log('Ruri-only Topic×Interaction 135 pairs / 495 English sets, independent heads, fallback, no keywords: PASS');
