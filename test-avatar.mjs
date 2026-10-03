import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { SOFT_PALETTES, VIVID_PALETTES, FILLED_PALETTES, normalizeFilledPalette, normalizeSoftPalette, normalizeVividPalette, normalizeColorSettings, shiftingPalette, GRADIENT_CYCLE_MS, GRADIENT_DESCRIPTIONS } from './src/emma-color-palettes.js';

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
assert.doesNotMatch(html, /<option value="color_shift">/);
assert.equal((html.match(/<option value="gradient">グラデーション<\/option>/g)||[]).length,3);
assert.equal(GRADIENT_CYCLE_MS,60000);
assert.match(html,/id="gradientDescription"/);
assert.match(app,/ui.gradientDescription.textContent=GRADIENT_DESCRIPTIONS\[mode\]/);
for(const text of Object.values(GRADIENT_DESCRIPTIONS)) assert.match(text,/60秒で一周/);
assert.equal(normalizeColorSettings(null,null).mode,'vivid');
assert.equal(normalizeColorSettings(null,null).vivid,'coral');

const frames = assets.map(name => ({ dataset: { avatarFrame: name }, hidden: false,
  classList: { toggle(cls, hidden) { this.owner.hidden = hidden; } } }));
frames.forEach(frame => { frame.classList.owner = frame; });
const rootStyle = new Map();
const saved = new Map();
let tick;
const context = {
  ui: { aiAvatarFace: { querySelectorAll: () => frames }, colorMode: {value:'vivid'}, vividPalette:{value:'coral'}, softPalette:{value:'peach'}, filledPalette:{value:'coral'} },
  STORAGE: {colorMode:'emma_color_mode', vivid:'emma_vivid_palette', soft:'emma_soft_palette',filled:'emma_filled_palette'},
  SOFT_PALETTES, VIVID_PALETTES, FILLED_PALETTES, normalizeFilledPalette, normalizeSoftPalette, normalizeVividPalette, normalizeColorSettings, shiftingPalette, GRADIENT_CYCLE_MS, GRADIENT_DESCRIPTIONS,
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
for(const mode of ['soft','vivid','filled']) {
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

for(const [key,palette] of Object.entries(FILLED_PALETTES)) {
  saved.set('emma_color_mode','filled');saved.set('emma_filled_palette',key);
  runInNewContext('applyAppearance()',context);
  assert.equal(context.ui.filledPalette.value,key);
  assert.equal(rootStyle.get('--face'),palette.face);
  assert.equal(rootStyle.get('--accent'),palette.accent);
  assert.notEqual(palette.face,'#ffffff');
  const luminance = color => [1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).reduce((sum,c,i)=>sum+c*[0.2126,0.7152,0.0722][i],0);
  assert.ok(luminance(palette.accent)<luminance(VIVID_PALETTES[key].accent),'filled accents must be deeper');
}
saved.set('emma_color_mode','color_shift');
runInNewContext('applyAppearance()',context);
assert.equal(saved.get('emma_color_mode'),'vivid');
assert.equal(saved.get('emma_vivid_palette'),'gradient');
assert.equal(rootStyle.get('--face'),'#ffffff');
for(const [mode,storage,palettes,order] of [
  ['soft','emma_soft_palette',SOFT_PALETTES,['peach','mint','sky','lavender']],
  ['vivid','emma_vivid_palette',VIVID_PALETTES,['coral','honey','blue','berry']],
  ['filled','emma_filled_palette',FILLED_PALETTES,['coral','honey','blue','berry']]
]) {
  saved.set('emma_color_mode',mode);saved.set(storage,'gradient');context.Date.now=()=>0;
  runInNewContext('applyAppearance()',context);
  const initialAccent=rootStyle.get('--accent');const initialFace=rootStyle.get('--face');
  context.Date.now=()=>30000;tick();
  assert.notEqual(rootStyle.get('--accent'),initialAccent);
  if(mode==='vivid') assert.equal(rootStyle.get('--face'),'#ffffff');
  else assert.notEqual(rootStyle.get('--face'),initialFace);
  for(let index=0;index<4;index++) for(const paint of ['face','accent','dark','blush','mouth','tongue']) {
    assert.equal(shiftingPalette(index*90,mode)[paint],palettes[order[index]][paint]);
  }
  assert.deepEqual(shiftingPalette(360,mode),shiftingPalette(0,mode));
  assert.deepEqual(shiftingPalette(359.999,mode),shiftingPalette(0,mode));
  for(let hue=0;hue<360;hue+=0.5) {
    const palette=shiftingPalette(hue,mode);
    if(mode==='vivid') assert.equal(palette.face,'#ffffff');
    else assert.notEqual(palette.face,'#ffffff');
  }
  for(const [time,index] of [[0,0],[15000,1],[30000,2],[45000,3],[60000,0]]) {
    context.Date.now=()=>time;tick();
    assert.equal(rootStyle.get('--accent'),palettes[order[index]].accent);
    assert.equal(rootStyle.get('--face'),palettes[order[index]].face);
  }
  // Fixed choices stop animating and remain independently saved.
  saved.set(storage,order[1]);runInNewContext('applyAppearance()',context);
  assert.equal(context.appearanceTimer,null);
  assert.equal(rootStyle.get('--accent'),palettes[order[1]].accent);
}
assert.equal(normalizeSoftPalette('gradient'),'gradient');
assert.equal(normalizeVividPalette('gradient'),'gradient');
assert.equal(normalizeFilledPalette('gradient'),'gradient');
assert.equal(normalizeFilledPalette('unknown'),'coral');
for(const state of ['idle','speaking']) for(const blink of ['open','half','closed']) for(const mouth of ['small','medium','large']) {
  Object.assign(context,{avatarVisualState:state,avatarBlinkFrame:blink,avatarMouthLevel:mouth});
  runInNewContext('renderAvatarFrame()',context);
  const visible=frames.filter(frame=>!frame.hidden);
  assert.equal(visible.length,1,'exactly one complete expression must be visible');
  const expected=state==='idle' ? `emma-face-idle-${blink}.svg` : `emma-face-talk-${mouth}${blink==='open'?'':'-'+blink}.svg`;
  assert.equal(visible[0].dataset.avatarFrame,expected);
}
console.log('Avatar: 12 inline frames, palette defaults/selections/time shift, outlines, and mouth/blink combinations OK');
