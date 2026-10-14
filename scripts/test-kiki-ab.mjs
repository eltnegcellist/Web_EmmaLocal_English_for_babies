import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {splitKittenChunks} from '../src/vendor/kitten/sentence-chunks.js';
import {allLiteReplyTemplatesForValidation} from '../src/lite-response-engine.js';
import {INTERACTION_REPLIES} from '../src/interaction/response.js';
import {COMBINED_REPLIES} from '../src/interaction/ruri-routing.js';
const engine={_chunkText:(text,mode='legacy')=>splitKittenChunks(text,{punctuationMode:mode})};
const old=engine._chunkText('Hello, baby! Can you hear me? Here I am.');
const fresh=engine._chunkText('Hello, baby! Can you hear me? Here I am.','preserve');
assert.deepEqual(old,['Hello, baby,','Can you hear me,','Here I am,']);
assert.deepEqual(fresh,['Hello, baby!','Can you hear me?','Here I am.']);
assert.deepEqual(engine._chunkText('Are you ready?! Wow!!','preserve'),['Are you ready?!','Wow!!']);
assert.deepEqual(engine._chunkText(''),[]);
const long='hello '.repeat(95).trim()+'?';
const chunks=engine._chunkText(long,'preserve');
assert(chunks.length>1 && chunks.every(x=>x.length<=400));
assert(chunks.at(-1).endsWith('?'), 'long final segment keeps question');
assert(chunks.slice(0,-1).every(x=>x.endsWith(',')), 'intermediate long segments keep continuity');
const manifest=JSON.parse(await readFile(new URL('../tests/kiki-ab-manifest.json',import.meta.url)));
const catalog=[...allLiteReplyTemplatesForValidation(),...Object.values(INTERACTION_REPLIES).flat(),...Object.values(COMBINED_REPLIES).flat()];
assert.equal(catalog.length,804);
assert.equal(manifest.voice,'Kiki'); assert.equal(manifest.speed,0.8);
assert(manifest.cases.length>=16);
assert.equal(new Set(manifest.cases.map(x=>x.id)).size,manifest.cases.length);
for (const pair of manifest.cases) {
  assert.notEqual(pair.before,pair.after,pair.id);
  assert(catalog.includes(pair.after),'not in current phrase bank: '+pair.id);
  assert(!catalog.includes(pair.before),'old sample still in current bank: '+pair.id);
  for (const sentence of [pair.before,pair.after])
    assert.equal(sentence.match(/[^.!?]+[.!?]+/g)?.length,3,pair.id);
}
console.log('Kiki A/B manifest '+manifest.cases.length+' exact revised samples; legacy default and punctuation experiment passed.');
