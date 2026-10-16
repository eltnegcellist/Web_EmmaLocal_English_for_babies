import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {cueForReply,normalizeVisualCueMode,VISUAL_CUE_ASSET} from '../src/visual-cue-display.js';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const app=read('src/app.js'),html=read('index.html'),css=read('styles.css'),sw=read('service-worker.js');
assert.ok(html.includes('id="visualCueDisplayMode"'));
assert.ok(html.includes('id="visualCuePicture"'));
assert.ok(html.includes('Emmaの顔を表示'));
assert.ok(html.includes('話題イラストに置き換える'));
assert.ok(app.includes('visualCueMode=normalizeVisualCueMode(localStorage.getItem(VISUAL_CUE_MODE_KEY))'));
assert.ok(app.includes('localStorage.setItem(VISUAL_CUE_MODE_KEY,visualCueMode)'));
assert.ok(app.includes('setVisualCue(null);'),'Reset when stopped, interrupted or error');
assert.ok(app.includes('queue.deferPlayback=false;'),'Only commit revised reply when playback begins');
assert.ok(css.includes('background-size:200% 200%'));
assert.ok(sw.includes(VISUAL_CUE_ASSET.replace('./','./')));
assert.equal(normalizeVisualCueMode('unexpected'),'emma');
for(const [route,english,expected] of [
 ['milk','Want a little sip?','milk'],
 ['book','Look at the book.','book'],
 ['hands','Clap, clap!','clap'],
 ['hands','Wave your fingers.',null],
 ['feet','Kick, kick!','kick'],
 ['feet','Little toes.',null],
 ['cry','Are you upset?',null],
 ['generic','Hello!',null]
])assert.equal(cueForReply({scene:route,english})?.id||null,expected);
const path=new URL('../'+VISUAL_CUE_ASSET.replace(/^\.\//,''),import.meta.url);
assert.ok(existsSync(path),'The approved transparent illustration atlas MUST be committed before merge. Expected: '+path.pathname);
console.log('Visual Cue in real conversation UI + settings and approved atlas OK');
