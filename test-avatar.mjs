import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('./index.html');
const app = read('./src/app.js');
const assets = readdirSync(new URL('./assets/emma-face/', import.meta.url)).filter(x => x.endsWith('.svg'));
assert.equal(assets.length, 12);
const inline = [...html.matchAll(/<svg\b[^>]*data-avatar-frame="([^"]+)"[\s\S]*?<\/svg>/g)];
assert.equal(inline.length, 12);
for (const [svg, name] of inline) {
  const canonical = svg.replace(/ data-avatar-frame="[^"]+"/, '').replace(/ aria-hidden="true"/, '').replace(/ class="hidden"/, '');
  assert.equal(canonical, read('./assets/emma-face/' + name).trim(), `${name}: inline geometry must match its source`);
  assert.match(svg, /fill="var\(--face, #ffffff\)"/);
  assert.match(svg, /stroke="var\(--dark, #080808\)" stroke-width="8" stroke-opacity="0.65"/);
}
assert.match(app, /ui.colorMode.value = localStorage.getItem\(STORAGE.colorMode\) \|\| 'mono_red'/);

const frames = assets.map(name => ({ dataset: { avatarFrame: name }, hidden: false,
  classList: { toggle(cls, hidden) { this.owner.hidden = hidden; } } }));
frames.forEach(frame => { frame.classList.owner = frame; });
const rootStyle = new Map();
const saved = new Map();
let tick;
const context = {
  ui: { aiAvatarFace: { querySelectorAll: () => frames }, colorMode: {value:'mono_red'}, vividPalette:{value:'sunshine'} },
  STORAGE: {colorMode:'emma_color_mode', vivid:'emma_vivid_palette'},
  localStorage: {getItem:key => saved.get(key)},
  document: {documentElement:{style:{setProperty:(key,value)=>rootStyle.set(key,value)}}},
  setInterval:fn => {tick=fn;return 1;}, clearInterval:()=>{}, appearanceTimer:null,
  Date:{now:()=>0}, avatarVisualState:'idle', avatarBlinkFrame:'open', avatarMouthLevel:'small',
};
const frameCode=app.slice(app.indexOf('function avatarFrameName()'), app.indexOf('function startAvatarBlinkLoop()'));
const colorCode=app.slice(app.indexOf('function applyAppearance()'), app.indexOf('function sanitizePlainName('));
runInNewContext(frameCode + colorCode + '\napplyAppearance(); renderAvatarFrame();', context);
assert.equal(rootStyle.get('--face'), '#ffffff');
assert.equal(rootStyle.get('--accent'), '#e00000');
for(const mode of ['soft','mono_red','vivid','color_shift']) {
  saved.set('emma_color_mode',mode);
  for(const palette of ['sunshine','ocean','candy','forest']) {
    saved.set('emma_vivid_palette',palette);
    runInNewContext('applyAppearance()',context);
    assert.equal(context.ui.colorMode.value,mode, 'saved selection must be preserved');
    assert.ok(rootStyle.get('--face'));
  }
}
const firstHue=rootStyle.get('--face');context.Date.now=()=>40000;tick();
assert.notEqual(rootStyle.get('--face'),firstHue,'time shift must change the palette');
for(const state of ['idle','speaking']) for(const blink of ['open','half','closed']) for(const mouth of ['small','medium','large']) {
  Object.assign(context,{avatarVisualState:state,avatarBlinkFrame:blink,avatarMouthLevel:mouth});
  runInNewContext('renderAvatarFrame()',context);
  const visible=frames.filter(frame=>!frame.hidden);
  assert.equal(visible.length,1,'exactly one complete expression must be visible');
  const expected=state==='idle' ? `emma-face-idle-${blink}.svg` : `emma-face-talk-${mouth}${blink==='open'?'':'-'+blink}.svg`;
  assert.equal(visible[0].dataset.avatarFrame,expected);
}
console.log('Avatar: 12 inline frames, palette defaults/selections/time shift, outlines, and mouth/blink combinations OK');
