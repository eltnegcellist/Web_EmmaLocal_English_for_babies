import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {VISUAL_CUE_CATALOG as catalog} from './src/visual-cue-catalog.js';
import {createVisualCueController,resolveVisualCue} from './src/visual-cue-controller.js';
import {bindVisualCueSettings} from './src/visual-cue-settings.js';
// Exercise the real settings binding, including persistence and preview migration.
function settingsFixture(saved={}, storageOverride){
 const dom=new JSDOM(readFileSync('index.html','utf8'),{url:'https://settings.test/'});
 const enabled=dom.window.document.getElementById('visualCueEnabled'),motion=dom.window.document.getElementById('visualCueMotion');
 const storage=storageOverride||dom.window.localStorage;
 for(const [key,value] of Object.entries(saved))storage.setItem(key,value);
 const applied=[];
 const binding=bindVisualCueSettings({enabled,motion,storage,configure:p=>applied.push(p)});
 const change=(input,checked)=>{input.checked=checked;input.dispatchEvent(new dom.window.Event('change'));};
 return {enabled,motion,storage,applied,binding,change};
}
{
 const f=settingsFixture();
 assert(f.enabled.checked,'new installation enables Visual Cue');assert(f.motion.checked&&!f.motion.disabled);
 assert.deepEqual(f.applied.at(-1),{mode:'visual',motion:true});
 f.change(f.motion,false);f.change(f.enabled,false);
 assert.equal(f.storage.getItem('emma_visual_cue_enabled'),'false');assert.equal(f.storage.getItem('emma_visual_cue_mode'),'emma');
 assert(f.motion.disabled);assert.deepEqual(f.applied.at(-1),{mode:'emma',motion:false});
 const reloaded=settingsFixture(Object.fromEntries(Object.entries(f.storage)));
 assert(!reloaded.enabled.checked&&!reloaded.motion.checked&&reloaded.motion.disabled,'reload preserves opt-out and independent motion preference');
 reloaded.change(reloaded.enabled,true);assert(!reloaded.motion.disabled&&!reloaded.motion.checked);
 assert.deepEqual(reloaded.applied.at(-1),{mode:'visual',motion:false});
 for(const mode of ['emma','visual'])assert.equal(settingsFixture({emma_visual_cue_mode:mode}).enabled.checked,mode==='visual','legacy selection is respected');
 assert(settingsFixture({emma_visual_cue_enabled:'true',emma_visual_cue_mode:'emma'}).enabled.checked,'new preference takes precedence');
 const blocked=settingsFixture({}, {getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});
 assert(blocked.enabled.checked);blocked.change(blocked.enabled,false);assert.equal(blocked.applied.at(-1).mode,'emma','storage failure still allows session opt-out');
}
const art=JSON.parse(readFileSync('assets/visual-cue/artwork/manifest.json'));
const motion=JSON.parse(readFileSync('assets/visual-cue/motion-variants/manifest.json'));
const hug=JSON.parse(readFileSync('assets/visual-cue/prototypes/hug-face/manifest.json'));
assert.equal(hug.status,'accepted-still');assert.equal(hug.humanApproval,true);
art.assets.push({id:hug.id,status:'accepted',kind:'illustration'});motion.assets.push(hug.motion);
const oldGestures=JSON.parse(readFileSync('assets/emma-gestures/manifest.json'));
assert(oldGestures.states.every(s=>s.status==='withdrawn'));
for(const state of ['calm','celebrate'])for(const suffix of ['', '-poster']){
 const svg=new JSDOM(readFileSync(`assets/emma-background-cues/${state}${suffix}.svg`,'utf8'),{contentType:'image/svg+xml'}).window.document;
 assert.equal(svg.documentElement.dataset.emmaBackdrop,state);assert(!svg.querySelector('[data-emma-gesture]'));
}
for(const a of Object.values(catalog.assets)){
 const candidate=motion.assets.find(x=>x.id===a.id);
 if(candidate){assert.equal(candidate.status,'motion-candidate');assert.equal(art.assets.find(x=>x.id===candidate.baseAssetId).status,'accepted');assert.equal(a.approvalStatus,'motion-candidate');}
 else assert.equal(art.assets.find(x=>x.id===a.id).status,'accepted');
 assert(existsSync(a.image));assert(existsSync(a.poster));
}
assert(!catalog.assets['cup-sip']);assert(!catalog.assets['wake-daylight']);
assert(!catalog.assets['hug-arms']);assert.equal(catalog.assets['hug-face-cuddle'].kind,'animation');
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
}
assert.equal(resolveVisualCue("Here's your book! Turn the page. What comes next?").assetId,'page');
assert.equal(resolveVisualCue("Let's pause changing. We have time. I'm right here.").assetId,'diaper-v2');
assert.equal(resolveVisualCue("That diaper is changed! All finished now! Let's get cozy.").assetId,'diaper-v2');
assert.equal(resolveVisualCue("Let's pat your back. Maybe a little burp. There!").assetId,'care-burp');
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
controller.configure({mode:'emma'});pending.shift().resolve();await settle();assert(hosts.every(h=>h.hidden),'switching off cancels in-flight media without hiding Emma');
controller.preload(assetText);assert.equal(pending.length,0,'off does not preload illustrations');
controller.configure({mode:'visual'});assert.equal(pending.length,1,'switching back on renders current cue');
controller.stop();pending.shift().resolve();await settle();assert(hosts.every(h=>h.hidden),'stop invalidates a pending image');
token=controller.begin(assetText);pending.shift().reject(Error('missing'));await settle();assert(hosts.every(h=>h.hidden),'broken image falls back');
token=controller.begin(assetText);pending.shift().resolve();await settle();assert(hosts.every(h=>!h.hidden&&h.querySelector('img')),'home and cloned play avatar both render');
const calmText=rows.find(r=>r.binding.state==='calm').text;
const oldToken=token;token=controller.begin(calmText);await settle();controller.end(oldToken);assert(hosts.every(h=>h.querySelector('[data-emma-backdrop="calm"]')),'stale ending cannot clear a newer clip');
const paintIds=hosts.flatMap(h=>[...h.querySelectorAll('[id]')].map(n=>n.id));assert.equal(new Set(paintIds).size,paintIds.length,'background paint IDs are unique across home/play');
assert(hosts.every(h=>!h.closest('.avatar').classList.contains('has-visual-cue')&&h.closest('.avatar').classList.contains('has-emma-background')),'background never hides canonical Emma');
controller.configure({mode:'visual',motion:false});await settle();assert(hosts.every(h=>h.querySelector('svg').dataset.motion==='off'));
assert(hosts.every(h=>!h.closest('.avatar').hasAttribute('data-visual-motion')),'background motion setting never overrides canonical Emma');
controller.end(token);assert(hosts.every(h=>!h.closest('.avatar').hasAttribute('data-visual-motion')));assert(hosts.every(h=>h.querySelector('[data-emma-backdrop="calm"]')),'audio end leaves current illustration visible');
controller.nextUtteranceFinished();assert(hosts.every(h=>h.hidden),'parent utterance completion clears the held illustration');
controller.configure({mode:'visual',motion:true});media.matches=true;media.listener();token=controller.begin(assetText);assert(pending.at(-1).url.includes('/posters/'));pending.shift().resolve();await settle();
document.hidden=true;document.dispatchEvent(new dom.window.Event('visibilitychange'));assert(hosts.every(h=>h.hidden));document.hidden=false;media.listener();await settle();assert(hosts.every(h=>h.hidden),'returning to the tab does not restart stale animation');
for(const state of ['neutral','smile','listen','ask','invite']){controller.begin(rows.find(r=>r.binding.state===state).text);await settle();assert(hosts.every(h=>h.hidden),state+' keeps baseline Emma');}
controller.begin('unknown');await settle();assert(hosts.every(h=>h.hidden));
const appSource=readFileSync('src/app.js','utf8');assert.match(appSource,/function handleCapturedUtterance\(audio\)\s*\{[\s\S]*?visualCue\.nextUtteranceFinished\(\);/,'VAD endpoint clears the previous visual cue');
controller.dispose();
console.log('Visual Cue UI: approval holds, exact phrases, questions, unknown fallback, async cancellation, two avatar surfaces, settings, reduced motion and visibility PASS');
