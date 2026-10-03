import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LiteResponseEngine, isMeaningfulUtterance, splitSentences } from './src/lite-response-engine.js';

// Shared expected results, not generated from either detector. These are text tests, not an ASR benchmark.
const contract = JSON.parse(readFileSync(new URL('./shared/lite-topic-contract.json', import.meta.url), 'utf8'));
export const topicCases = contract.cases.map(c => [c.text, c.scene]);
for (const c of contract.cases) {
  assert.equal(isMeaningfulUtterance(c.text), c.meaningful, `Gate ${c.id}: ${c.text}`);
  assert.equal(new LiteResponseEngine().respond(c.text).scene, c.scene, `Scene ${c.id}: ${c.text}`);
  if (!['generic', 'drink'].includes(c.scene)) {
    const engine = new LiteResponseEngine();
    engine.respond('ミルクの時間だよ');
    assert.equal(engine.respond(c.text).scene, c.scene, `Switch ${c.id}: ${c.text}`);
  }
}
for (const sequence of contract.sequences) {
  const engine = new LiteResponseEngine();
  for (const [index, step] of sequence.steps.entries()) {
    if (step.reset) { engine.resetConversationContext(); continue; }
    const label = `${sequence.id} turn ${index + 1}: ${step.text}`;
    assert.equal(isMeaningfulUtterance(step.text), step.meaningful, `Gate ${label}`);
    assert.equal(engine.respond(step.text).scene, step.scene, label);
  }
}
// Retain Web-specific output style checks in addition to shared topic expectations.
for (const c of contract.cases.filter(c => c.scene === 'drink')) {
  for (const name of ['', 'Hana-chan']) {
    const out = new LiteResponseEngine().respond(c.text, name);
    assert.doesNotMatch(out.english, /milk/i, c.text);
    assert.equal(splitSentences(out.english).length, 3);
    const words = out.english.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || [];
    assert.ok(words.length >= 6 && words.length <= 12, out.english);
  }
}
// Check the published HTML as well as its generating data.
const guide = readFileSync(new URL('./topic-guide.html', import.meta.url), 'utf8');
const decode = text => text.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const shown = [...guide.matchAll(/class="utterance" data-scene="([^"]+)">([^<]+)<\/span>/g)].map(([, scene, text]) => [decode(scene), decode(text)]);
const expected = contract.topics.flatMap(t => t.examples.map(text => [t.scene, text]));
assert.deepEqual(shown, expected, 'Published guide must contain exactly the shared examples in order');
for (const [scene, text] of shown) {
  assert.equal(isMeaningfulUtterance(text), true, text);
  assert.equal(new LiteResponseEngine().respond(text).scene, scene, `Published example: ${text}`);
}
console.log(`Shared contract: ${contract.cases.length} cases, ${contract.sequences.length} sequences, ${contract.topics.length} topics, ${shown.length} guide examples OK`);
