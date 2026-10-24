import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LANGUAGE_UI, ROUTES, WHISPER_5S, WHISPER_CONTEXT_SECONDS,
  proposedRoute, whisperWindows, mayDeployModel
} from './policy.mjs';

test('all six production UI languages have explicit policy routes', () => {
  assert.deepEqual(LANGUAGE_UI,['ja','de','fr','ko','th','en']);
  assert.deepEqual(Object.keys(ROUTES).sort(),[...LANGUAGE_UI].sort());
});
test('Moonshine, Vosk and Thai specialist adoption priorities are explicit', () => {
  assert.equal(ROUTES.ja.family,'moonshine');
  assert.equal(ROUTES.en.family,'moonshine');
  assert.equal(ROUTES.de.family,'moonshine');
  assert.equal(ROUTES.fr.family,'vosk');
  assert.equal(ROUTES.th.family,'sherpa-onnx');
  assert.notEqual(ROUTES.ko.family,'vosk');
  assert.equal(ROUTES.ko.asr,WHISPER_5S);
});
test('Japanese Ruri is preserved; E5 locale choices exclude lower-performing variants', () => {
  assert.equal(ROUTES.ja.semantic,'ruri-70m-existing');
  for (const lang of ['en','de','ko'])
    assert.equal(ROUTES[lang].semanticSelection,'locale-interaction-candidate');
  for (const lang of ['fr','th'])
    assert.equal(ROUTES[lang].semanticSelection,'shared-retrained-interaction-preferred');
});
test('English UI does NOT silently become an English-only recognizer', () => {
  const initial=proposedRoute('en');
  assert.equal(initial.autoDetectLanguage,true);
  assert.equal(initial.speechLocale,null);
  assert.equal(initial.asr,WHISPER_5S);
  assert.equal(proposedRoute('en','th').family,'sherpa-onnx');
  assert.equal(proposedRoute('en','fr').family,'vosk');
  assert.equal(proposedRoute('en','en').family,'moonshine');
  assert.equal(proposedRoute('en','xx').asr,WHISPER_5S);
  assert.equal(proposedRoute('de','fr').family,'moonshine');
});
test('Whisper uses <=5s overlapping windows; no audio is truncated', () => {
  assert.equal(WHISPER_CONTEXT_SECONDS,5);
  for (const duration of [0.2,2,5,5.8,10,12.7,59]) {
    const chunks=whisperWindows(duration);
    assert.equal(chunks[0].startSeconds,0);
    assert.equal(chunks.at(-1).endSeconds,duration);
    for (let i=0;i<chunks.length;i++) {
      assert.ok(chunks[i].endSeconds-chunks[i].startSeconds<=5+1e-8);
      assert.ok(chunks[i].endSeconds>chunks[i].startSeconds);
      if (i) assert.ok(chunks[i].startSeconds<=chunks[i-1].endSeconds);
    }
  }
});
test('research selections do not imply deployable model assets', () => {
  assert.equal(mayDeployModel('ja'),true);
  for (const lang of ['en','de','fr','ko','th'])
    assert.equal(mayDeployModel(lang),false);
  assert.equal(mayDeployModel('invalid'),false);
  assert.throws(()=>proposedRoute('invalid'));
  assert.throws(()=>whisperWindows(0));
});
