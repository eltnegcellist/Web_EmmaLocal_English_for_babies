import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { SOFT_PALETTES, VIVID_PALETTES, normalizeSoftPalette, normalizeVividPalette, normalizeColorSettings, shiftingPalette } from './src/emma-color-palettes.js';

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
assert.doesNotMatch(html, /<option value="mono_red">/);
assert.equal(normalizeColorSettings(null,null).mode,'vivid');
assert.equal(normalizeColorSettings(null,null).vivid,'coral');

const frames = assets.map(name => ({ dataset: { avatarFrame: name }, hidden: false,
  classList: { toggle(cls, hidden) { this.owner.hidden = hidden; } } }));
frames.forEach(frame => { frame.classList.owner = frame; });
const rootStyle = new Map();
const saved = new Map();
let tick;
const context = {
  ui: { aiAvatarFace: { querySelectorAll: () => frames }, colorMode: {value:'vivid'}, vividPalette:{value:'coral'}, softPalette:{value:'peach'} },
  STORAGE: {colorMode:'emma_color_mode', vivid:'emma_vivid_palette', soft:'emma_soft_palette'},
  SOFT_PALETTES, VIVID_PALETTES, normalizeSoftPalette, normalizeVividPalette, normalizeColorSettings, shiftingPalette,
  localStorage: {getItem:key => saved.get(key),setItem:(key,value)=>saved.set(key,value)},
  document: {documentElement:{style:{setProperty:(key,value)=>rootStyle.set(key,value)}}},
  setInterval:fn => {tick=fn;return 1;}, clearInterval:()=>{}, appearanceTimer:null,
  Date:{now:()=>0}, avatarVisualState:'idle', avatarBlinkFrame:'open', avatarMouthLevel:'small',
};
const frameCode=app.slice(app.indexOf('function avatarFrameName()'), app.indexOf('function startAvatarBlinkLoop()'));
const colorCode=app.slice(app.indexOf('function applyAppearance()'), app.indexOf('function sanitizePlainName('));
runInNewContext(frameCode + colorCode + '\napplyAppearance(); renderAvatarFrame();', context);
assert.equal(rootStyle.get('--face'), '#ffffff');
assert.equal(rootStyle.get('--accent'), VIVID_PALETTES.coral.accent);
saved.set('emma_color_mode','mono_red');
saved.set('emma_vivid_palette','blue');
runInNewContext('applyAppearance()',context);
assert.equal(saved.get('emma_color_mode'),'vivid');
assert.equal(saved.get('emma_vivid_palette'),'coral');
assert.equal(rootStyle.get('--accent'),VIVID_PALETTES.coral.accent);
runInNewContext('applyAppearance()',context);
assert.equal(rootStyle.get('--accent'),VIVID_PALETTES.coral.accent);
for(const mode of ['soft','vivid','color_shift']) {
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
const firstAccent=rootStyle.get('--accent');context.Date.now=()=>40000;tick();
assert.equal(rootStyle.get('--face'),'#ffffff');
assert.notEqual(rootStyle.get('--accent'),firstAccent,'time shift must change only the accent');
for (const [hue, key] of [[0,'coral'],[90,'honey'],[180,'blue'],[270,'berry'],[360,'coral'],[-90,'berry']]) {
  assert.equal(shiftingPalette(hue).accent,VIVID_PALETTES[key].accent);
}
assert.equal(shiftingPalette(45).accent,'#db652d');
for(let hue=0;hue<360;hue+=0.5) {
  const palette=shiftingPalette(hue);
  for(const paint of ['face','dark','blush','mouth','tongue']) assert.equal(palette[paint],VIVID_PALETTES.coral[paint]);
}
assert.equal(shiftingPalette(359.999).accent,shiftingPalette(0).accent,'cycle boundary must be seamless');
for(const state of ['idle','speaking']) for(const blink of ['open','half','closed']) for(const mouth of ['small','medium','large']) {
  Object.assign(context,{avatarVisualState:state,avatarBlinkFrame:blink,avatarMouthLevel:mouth});
  runInNewContext('renderAvatarFrame()',context);
  const visible=frames.filter(frame=>!frame.hidden);
  assert.equal(visible.length,1,'exactly one complete expression must be visible');
  const expected=state==='idle' ? `emma-face-idle-${blink}.svg` : `emma-face-talk-${mouth}${blink==='open'?'':'-'+blink}.svg`;
  assert.equal(visible[0].dataset.avatarFrame,expected);
}
console.log('Avatar: 12 inline frames, palette defaults/selections/time shift, outlines, and mouth/blink combinations OK');
