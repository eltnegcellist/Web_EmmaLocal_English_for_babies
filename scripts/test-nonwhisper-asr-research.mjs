// Non-Whisper research routing safety regression (no downloading models).
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LANGUAGES} from '../src/multilingual/core.js';
import {LANGUAGE_ROUTES,MOONSHINE_TRIAL_LANGUAGES,MOONSHINE_TRIAL_SIZES,WASM_CDN_URL} from '../experimental/asr-alternatives/model-matrix.js';
assert.deepEqual(Object.keys(LANGUAGE_ROUTES).sort(),[...LANGUAGES].sort());
assert.deepEqual([...MOONSHINE_TRIAL_LANGUAGES].sort(),['de','en','ja']);
assert.deepEqual([...MOONSHINE_TRIAL_SIZES],['tiny','small']);
assert(WASM_CDN_URL.includes('@0.1.5/'),'Pin the documented WASM package version');
for(const lang of LANGUAGES){
 const route=LANGUAGE_ROUTES[lang];
 assert(route.primary&&route.name&&route.source.startsWith('https://'));
 if(MOONSHINE_TRIAL_LANGUAGES.includes(lang)){
  assert.equal(route.license,'MIT');
  assert.equal(route.status,'prototype');
 }else{
  assert.equal(route.status,'research','Unintegrated languages must stay research-only');
 }
}
const script=await readFile(new URL('../experimental/asr-alternatives/moonshine-live.js',import.meta.url),'utf8');
assert(script.includes(".language(language)")&&script.includes(".modelArch("));
assert(script.includes("lastTranscriptionLatencyMs"),'Expose latency, not just text');
assert(script.includes("not uploaded")||script.includes('not uploaded')||script.includes('音声は'));
assert(script.includes('await transcriber.stop()'),'Stop should flush before display');
const page=await readFile(new URL('../moonshine-streaming-benchmark.html',import.meta.url),'utf8');
assert(page.includes('Moonshine Streaming'));
assert(page.includes('フランス語')&&page.includes('韓国語')&&page.includes('タイ語'));
assert(page.includes("lastTranscriptionLatencyMs"),'Must warn about different metrics');
assert(!page.includes('Moonshineは6言語すべて対応'));
console.log('PASS: research language coverage, missing-language guard, external version pin and streaming metrics');
