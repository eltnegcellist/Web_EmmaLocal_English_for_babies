import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { SOFT_PALETTES, VIVID_PALETTES, normalizeSoftPalette, normalizeVividPalette } from './src/emma-color-palettes.js';

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
  ui: { aiAvatarFace: { querySelectorAll: () => frames }, colorMode: {value:'mono_red'}, vividPalette:{value:'coral'}, softPalette:{value:'peach'} },
  STORAGE: {colorMode:'emma_color_mode', vivid:'emma_vivid_palette', soft:'emma_soft_palette'},
  SOFT_PALETTES, VIVID_PALETTES, normalizeSoftPalette, normalizeVividPalette,
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
  for(const palette of ['coral','blue','honey','berry','sunshine','ocean','candy','forest']) {
    saved.set('emma_vivid_palette',palette);
    runInNewContext('applyAppearance()',context);
    assert.equal(context.ui.colorMode.value,mode, 'saved selection must be preserved');
    assert.ok(rootStyle.get('--face'));
  }
}
for(const [key,palette] of Object.entries(SOFT_PALETTES)) {
  saved.set('emma_color_mode','soft');
  saved.set('emma_soft_palette',key);
  runInNewContext('applyAppearance()',context);
  assert.equal(context.ui.softPalette.value,key);
  assert.equal(rootStyle.get('--face'),palette.face);
  assert.equal(rootStyle.get('--accent'),palette.accent);
  assert.match(html,new RegExp(`<option value="${key}">${palette.label}</option>`));
}
assert.equal(new Set(Object.values(SOFT_PALETTES).map(p=>p.accent)).size,4);
for(const [key,palette] of Object.entries(VIVID_PALETTES)) {
  saved.set('emma_color_mode','vivid');
  saved.set('emma_vivid_palette',key);
  runInNewContext('applyAppearance()',context);
  assert.equal(rootStyle.get('--face'),'#ffffff','vivid face and body must stay white');
  assert.equal(rootStyle.get('--accent'),palette.accent);
  assert.match(html,new RegExp(`<option value="${key}">${palette.label}</option>`));
}
for(const [old,current] of Object.entries({sunshine:'honey',ocean:'blue',candy:'coral',forest:'berry'})) {
  saved.set('emma_vivid_palette',old);
  runInNewContext('applyAppearance()',context);
  assert.equal(context.ui.vividPalette.value,current);
  assert.equal(rootStyle.get('--accent'),VIVID_PALETTES[current].accent);
}
assert.equal(normalizeSoftPalette('unknown'),'peach');
assert.equal(normalizeVividPalette('unknown'),'coral');
saved.set('emma_color_mode','color_shift');
runInNewContext('applyAppearance()',context);
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
