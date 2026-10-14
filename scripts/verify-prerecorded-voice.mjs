#!/usr/bin/env node
// Release check: source-bank coverage and integrity of every bundled audio asset.
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {allLiteReplyGroupsForPhonemeAudit, LiteResponseEngine} from '../src/lite-response-engine.js';
import {singleSentencePhrases} from '../src/feature-screens.js';
import {normalizeVoiceText} from '../src/prerecorded-voice.js';

const root = new URL('../assets/voice-1202/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
if (manifest.schemaVersion !== 1 || manifest.generationSeed !== 1202 ||
    manifest.referenceSourceSeed !== 1202 || manifest.sampleRate !== 24000 ||
    manifest.referenceSha256 !== '49e2939ab96482595d300d52135bc57234df4a019aca773f739d2f6f8be3a8d0' ||
    manifest.modelRevision !== 'e7dd0585652209fa0d7783659aad4e8a324de11c') throw Error('Adopted voice profile differs');
const byText = new Map();
let totalBytes = 0;
for (const entry of manifest.entries) {
  const key = normalizeVoiceText(entry.text);
  const id = createHash('sha256').update(key).digest('hex').slice(0,24);
  if (byText.has(key) || entry.id !== id || entry.file !== `clips/${id}.m4a` ||
      entry.seed !== 1202 || entry.reference_sha256 !== manifest.referenceSha256 ||
      entry.sample_rate !== 24000 || entry.codec !== 'AAC-LC' || /[{}]/.test(key)) throw Error('Invalid voice entry: '+key);
  const bytes = await readFile(new URL(entry.file, root));
  if (bytes.length !== entry.bytes || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) {
    throw Error('Missing or changed audio: '+key);
  }
  totalBytes += bytes.length;
  byText.set(key,entry);
}
if (totalBytes !== manifest.totalBytes) throw Error('Audio byte total differs');
const corpus = JSON.parse(execFileSync(process.execPath, [new URL('export-phoneme-corpus.mjs', import.meta.url).pathname],
  {encoding:'utf8',maxBuffer:8*1024*1024}));
const required = new Set(corpus.rows.map(row=>row.english));
const play = JSON.parse(await readFile(new URL('../shared/play-topics.json', import.meta.url),'utf8'));
for (const topic of play.topics) for (const text of singleSentencePhrases(topic.phrases)) required.add(text);
required.add("Hi, I'm Emma."); required.add("Hi, I'm Emma. Hello, little one!");
// Check the actual style transformation too: source templates must still map to a clip.
const engine = new LiteResponseEngine();
for (const [scene,phrases] of Object.entries(allLiteReplyGroupsForPhonemeAudit())) {
  for (const text of phrases) required.add(engine.alignToBabyStyle(text,'',scene));
}
const missing = [...required].filter(text=>!byText.has(normalizeVoiceText(text)));
if (missing.length) throw Error('Regenerate adopted audio for: '+missing.join('\n'));
console.log(JSON.stringify({clips:byText.size,coveredWebUtterances:required.size,completeEnglishSets:corpus.rows.length,totalBytes,generationSeed:1202}));
