import assert from 'node:assert/strict';
import {
  JAPANESE_RESUME_GREETINGS,
  chooseJapaneseResumeGreeting
} from './src/resume-greeting.js';

assert.equal(JAPANESE_RESUME_GREETINGS.length, 3);
assert.ok(JAPANESE_RESUME_GREETINGS.every(text => /[ぁ-んァ-ン一-龥]/.test(text)));
assert.equal(chooseJapaneseResumeGreeting(null, () => 0), JAPANESE_RESUME_GREETINGS[0]);
assert.equal(chooseJapaneseResumeGreeting(null, () => 0.999), JAPANESE_RESUME_GREETINGS[2]);
for (const previous of JAPANESE_RESUME_GREETINGS) {
  for (const index of [0, 0.5, 0.999]) {
    const greeting = chooseJapaneseResumeGreeting(previous, () => index);
    assert.notEqual(greeting, previous);
    assert.ok(JAPANESE_RESUME_GREETINGS.includes(greeting));
  }
}
console.log('Japanese resume greeting selection OK');
