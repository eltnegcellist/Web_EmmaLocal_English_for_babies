import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {VISUAL_CUE_CATALOG as catalog} from './src/visual-cue-catalog.js';
import {createVisualCueController,resolveVisualCue} from './src/visual-cue-controller.js';
const art=JSON.parse(readFileSync('assets/visual-cue/artwork/manifest.json'));
for(const a of Object.values(catalog.assets)){
 assert.equal(art.assets.find(x=>x.id===a.id).status,'accepted');assert(existsSync(a.image));assert(existsSync(a.poster));
}
assert(!catalog.assets['cup-sip']);assert(!catalog.assets['wake-daylight']);
assert.equal(resolveVisualCue('This text is unknown.'),null);
assert.equal(resolveVisualCue(' All   done? Is that everything? Let’s have a look. ').state,'ask');
assert.notDeepEqual(resolveVisualCue("All done? Is that everything? Let's have a look."),resolveVisualCue("Yes! You made it! That's wonderful!"));
const rows=JSON.parse(readFileSync('shared/visual-cue-runtime-review.json')).rows;
assert.equal(rows.length,914);
const voice=JSON.parse(readFileSync('assets/voice-1202/manifest.json'));
const singles=voice.entries.filter(e=>e.sources.some(s=>s.startsWith('web:press-single:')));
assert.equal(singles.length,178);for(const e of singles)assert(resolveVisualCue(e.text),e.text);
for(const text of ['Tap, tap!','Wiggle, wiggle!','Squeeze, squeeze!','One, two, three!'])assert.equal(resolveVisualCue(text).type,'emma');
for(const r of rows){
 const p=resolveVisualCue(r.text);assert.deepEqual(p,r.binding);
 if(r.text.includes('?')&&p.type==='asset')assert.notEqual(catalog.assets[p.assetId].kind,'animation','questions do not assert a completed motion');
}
const dom=new JSDOM('<div class="avatar"><div data-visual-cue-host hidden></div></div><div class="avatar play-avatar"><div data-visual-cue-host hidden></div></div>');
const {document}=dom.window;
Object.defineProperty(document,'hidden',{value:false,writable:true});
const media={matches:false,addEventListener(_,f){this.listener=f;},removeEventListener(){}};
const pending=[];
const controller=createVisualCueController({document,media,baseUrl:'https://preview.test/',loadImage:url=>new Promise((resolve,reject)=>pending.push({url,resolve,reject}))});
const hosts=[...document.querySelectorAll('[data-visual-cue-host]')];
const settle=async()=>{await Promise.resolve();await Promise.resolve();};
const assetText=rows.find(r=>r.binding.assetId==='kick').text;
let token=controller.begin(assetText);assert(hosts.every(h=>h.hidden));assert.equal(pending.length,0,'default Emma causes no media loading');
controller.configure({mode:'visual'});assert.equal(pending.length,1);
controller.stop();pending.shift().resolve();await settle();assert(hosts.every(h=>h.hidden),'stop invalidates a pending image');
token=controller.begin(assetText);pending.shift().reject(Error('missing'));await settle();assert(hosts.every(h=>h.hidden),'broken image falls back');
token=controller.begin(assetText);pending.shift().resolve();await settle();assert(hosts.every(h=>!h.hidden&&h.querySelector('img')),'home and cloned play avatar both render');
const oldToken=token;token=controller.begin("All done? Is that everything? Let's have a look.");await settle();controller.end(oldToken);assert(hosts.every(h=>h.querySelector('[data-emma-gesture="ask"]')),'stale ending cannot clear a newer clip');
controller.configure({mode:'visual',motion:false});await settle();assert(hosts.every(h=>h.querySelector('svg').dataset.motion==='off'));
assert(hosts.every(h=>h.closest('.avatar').dataset.visualMotion==='off'));
controller.end(token);assert(hosts.every(h=>!h.closest('.avatar').hasAttribute('data-visual-motion')));assert(hosts.every(h=>h.hidden),'settings change preserves the audio token for end');
controller.configure({mode:'visual',motion:true});media.matches=true;media.listener();token=controller.begin(assetText);assert(pending.at(-1).url.includes('/posters/'));pending.shift().resolve();await settle();
document.hidden=true;document.dispatchEvent(new dom.window.Event('visibilitychange'));assert(hosts.every(h=>h.hidden));document.hidden=false;media.listener();await settle();assert(hosts.every(h=>h.hidden),'returning to the tab does not restart stale animation');
controller.begin('unknown');await settle();assert(hosts.every(h=>h.hidden));
controller.dispose();
console.log('Visual Cue UI: approval holds, exact phrases, questions, unknown fallback, async cancellation, two avatar surfaces, settings, reduced motion and visibility PASS');
