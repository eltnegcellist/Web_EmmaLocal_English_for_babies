import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RECORDED_RESUME_GREETINGS, greetingSentences, chooseEnglishResumeGreeting} from './src/resume-greeting.js';

const source=JSON.parse(readFileSync(new URL('./shared/play-topics.json',import.meta.url),'utf8'));
const options=greetingSentences(source);
assert.equal(options.length,4);
assert.deepEqual(options,RECORDED_RESUME_GREETINGS);
assert.equal(chooseEnglishResumeGreeting(source,null,()=>0),options[0]);
assert.equal(chooseEnglishResumeGreeting(source,null,()=>0.999),options[3]);
for (const previous of options) {
  for (const position of [0,0.5,0.999]) {
    const next=chooseEnglishResumeGreeting(source,previous,()=>position);
    assert.notEqual(next,previous);
    assert.ok(options.includes(next));
  }
}
assert.equal(chooseEnglishResumeGreeting({topics:[]}),null);
assert.equal(chooseEnglishResumeGreeting({topics:[{id:'greeting',phrases:['Not a recorded voice.']}]}),null);
const app=readFileSync(new URL('./src/app.js',import.meta.url),'utf8');
assert.ok(app.includes('await speakResponse(greeting)'));
assert.ok(!/speakJapaneseResumeGreeting|speechSynthesis|SpeechSynthesisUtterance/.test(app));
console.log('Recorded English resume greetings: OK');
