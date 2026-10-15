import assert from 'node:assert/strict';
import {applySupportedKeyterms} from './src/moonshine-keyterm-bias.js';
const applied=[];
const fake={setKeyterms(terms){
  if(terms.includes('喃語'))throw Error('tokenizer unsupported');
  applied.splice(0,applied.length,...terms);
}};
const output=applySupportedKeyterms(fake,['ミルク','喃語','しゃっくり','ご機嫌']);
assert.deepEqual(output.applied,['ミルク','しゃっくり','ご機嫌']);
assert.deepEqual(output.skipped.map(x=>x.term),['喃語']);
assert.deepEqual(applied,output.applied);
assert.deepEqual(applySupportedKeyterms(fake,[]).applied,[]);
console.log('Moonshine keyterms: unsupported terms skipped without losing valid childcare vocabulary PASS');
