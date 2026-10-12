#!/usr/bin/env node
// Checks structure/style only. Does not certify meaning, Kiki pronunciation, or human approval.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const labels=['affection','praise','achievement','effort','encouragement','invitation','start','finish','finish_check','care','inquiry','reassurance','repeat','pause'];
const style={sentences:3,total_words_min:6,total_words_max:12,words_per_sentence_max:4};

export function validateBank(bank) {
  const errors=[];
  if (!bank || typeof bank!=='object' || Array.isArray(bank)) return ['root must be an object'];
  if (bank.schema_version!==1) errors.push('schema_version must be 1');
  for (const [key,val] of Object.entries(style)) if (bank.style?.[key]!==val) errors.push('style.'+key+' must be '+val);
  if (!bank.replies || typeof bank.replies!=='object' || Array.isArray(bank.replies)) return [...errors,'replies must be an object'];
  const actual=Object.keys(bank.replies);
  for (const id of labels) if (!actual.includes(id)) errors.push('missing class: '+id);
  for (const id of actual) if (!labels.includes(id)) errors.push('unknown class: '+id);
  const globalSeen=new Map();
  for (const id of labels) {
    const values=bank.replies[id];
    if (!Array.isArray(values)) continue;
    if (values.length<5 || values.length>8) errors.push(id+': expected 5-8 approved replies, got '+values.length);
    for (const [index,set] of values.entries()) {
      const path=id+'['+index+']';
      if (typeof set!=='string'||!set.trim()) { errors.push(path+': nonempty string required');continue; }
      if (/[^\x20-\x7e]/.test(set)) errors.push(path+': non-ASCII character / emoji / newline');
      if (/\{name\}|<[^>]+>|[{}]/.test(set)) errors.push(path+': placeholder or markup forbidden');
      const txt=set.trim();
      const sentences=txt.match(/[^.!?]+[.!?]/g)||[];
      if (sentences.join('').trim()!==txt || sentences.length!==3) errors.push(path+': exactly 3 punctuated sentences required');
      const wc=txt.split(/\s+/).filter(Boolean).length;
      if (wc<6 || wc>12) errors.push(path+': words outside 6-12 ('+wc+')');
      for (const [i,s] of sentences.entries()) if (s.trim().split(/\s+/).length>4) errors.push(path+': sentence '+(i+1)+' exceeds 4 words');
      const norm=txt.replace(/\s+/g,' ').toLowerCase();
      if (globalSeen.has(norm)) errors.push(path+': duplicate of '+globalSeen.get(norm));
      else globalSeen.set(norm,path);
      if (/\b(?:stop crying|don'?t cry|be quiet|no more tears|you(?:'re| are) healthy|you(?:'re| are) safe)\b/i.test(txt)) errors.push(path+': prohibited coercion or unsupported assurance');
      if (id==='finish_check') {
        if (!sentences.some(s=>s.trim().endsWith('?'))) errors.push(path+': a question is required');
        if (/\b(?:all done|we (?:are|re) done|we finished|it(?:'s| is) finished)\s*[!.]/i.test(txt)) errors.push(path+': completion assertion in finish_check');
      }
      if ((id==='effort'||id==='encouragement') && /\byou did it\b/i.test(txt)) errors.push(path+': cannot assert completed achievement');
    }
  }
  return errors;
}
function main() {
  if (process.argv[2]==='--self-test') {
    const replies=Object.fromEntries(labels.map(id=>[id,Array(5).fill('Hello there. Here we go. All is well.')]));
    replies.finish_check[0]='All done! We did it. What a day.';
    const errors=validateBank({schema_version:1,style,replies});
    if (!errors.some(e=>e.includes('finish_check')&&e.includes('assertion'))) throw Error('self-test missed completion assertion');
    if (!errors.some(e=>e.includes('duplicate'))) throw Error('self-test missed duplicate');
    console.log('self-test OK: detected '+errors.length+' deliberate violations');
    return;
  }
  if (!process.argv[2]) {
    console.error('Usage: node scripts/validate-interaction-replies.mjs <JSON-path> | --self-test');
    process.exitCode=2;return;
  }
  let data;
  try {data=JSON.parse(readFileSync(resolve(process.argv[2]),'utf8'));}
  catch(e) {console.error('Input error: '+e.message);process.exitCode=2;return;}
  const errors=validateBank(data);
  if (errors.length) {for(const e of errors) console.error('FAIL: '+e);console.error('FAILED: '+errors.length+' issues.');process.exitCode=1;}
  else console.log('PASS: 14 classes; '+Object.values(data.replies).reduce((a,v)=>a+v.length,0)+' replies. Human review and Kiki test still required.');
}
if (process.argv[1] && resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) main();
