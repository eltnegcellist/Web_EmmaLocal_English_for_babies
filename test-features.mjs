import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexedDB } from 'fake-indexeddb';
import { JSDOM } from 'jsdom';
import { ConversationHistory, createHistoryEntry, historyEnabled } from './src/conversation-history.js';
import { installFeatureScreens, nextPhrase } from './src/feature-screens.js';
const topics=JSON.parse(readFileSync(new URL('./shared/play-topics.json',import.meta.url)));
for(const topic of topics.topics){
  assert.equal(new Set(topic.phrases).size,topic.phrases.length);
  for(const phrase of topic.phrases){assert(phrase.trim().split(/\s+/).length<=8);assert(!/you are|you have|you're/i.test(phrase));}
  for(let i=0;i<30;i++)assert.notEqual(nextPhrase(topic.phrases,topic.phrases[i%topic.phrases.length]),topic.phrases[i%topic.phrases.length]);
}
const dom=new JSDOM(readFileSync(new URL('./index.html',import.meta.url),'utf8'),{url:'https://example.test/'});
const {window}=dom;globalThis.document=window.document;
const storage=window.localStorage;
assert.equal(historyEnabled(storage),true);storage.setItem('emma_history_enabled','false');assert.equal(historyEnabled(storage),false);
const history=new ConversationHistory(indexedDB);
const entries=Array.from({length:1002},(_,i)=>({...createHistoryEntry('session','足を見て','Hello, little feet!','feet'),createdAt:new Date(1700000000000+i).toISOString()}));
await Promise.all(entries.map(e=>history.append(e)));
let stored=await history.list();assert.equal(stored.length,1000);assert.equal(stored[0].id,entries[1001].id);assert(!stored.some(e=>e.id===entries[0].id));
assert.equal(stored[0].englishText,'Hello, little feet!');assert(!Object.keys(stored[0]).some(key=>/audio|blob/i.test(key)));
await history.delete(stored[0].id);assert.equal((await history.list()).length,999);
// Explicit OFF preserves old entries.
assert.equal(historyEnabled(storage),false);assert.equal((await history.list()).length,999);
await history.delete();assert.deepEqual(await history.list(),[]);
await assert.rejects(new ConversationHistory(null).list());
const $=id=>document.getElementById(id);
$('featureDialog').showModal=function(){this.open=true;};$('featureDialog').close=function(){this.open=false;};
globalThis.confirm=()=>true;globalThis.fetch=async()=>({ok:true,json:async()=>topics});
let stops=0,spoken=[],busy=false,finish;
const features=installFeatureScreens({stop:async()=>{stops++;busy=false;finish?.();},prepare:async()=>{},preload:async()=>{},history,isSpeaking:()=>busy,
  speak:async text=>{spoken.push(text);busy=true;await new Promise(resolve=>finish=resolve);busy=false;},avatar:()=>document.createElement('div')});
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
$('playButton').click();await settle();assert(features.isOpen());assert(stops>0);
[...$('featureBody').querySelectorAll('button')].find(el=>el.textContent==='て・おてて').click();await settle();
const tap=$('featureBody').querySelector('.play-tap');assert.equal(tap.disabled,false);
tap.click();tap.click();tap.click();await settle();assert.equal(spoken.length,1);assert.equal(tap.disabled,true);
finish();await settle();tap.click();await settle();assert.equal(spoken.length,2);assert.notEqual(spoken[0],spoken[1]);
$('featureClose').click();await settle();assert.equal(features.isOpen(),false);assert(stops>=3);
assert.deepEqual(await history.list(),[],'play must not create history');
assert(!$('settingsScreen').querySelector('#playButton'),'play entry is on main');
console.log('Features: IndexedDB retention/pruning/deletion/OFF, shared phrases, mode exit, repeated taps and no play history OK');
