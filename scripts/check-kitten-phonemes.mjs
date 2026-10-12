// Offline check of the ACTUAL Kitten phonemizer used by Web Lite (not TTS audio).
// GitHub CI supplies CMUdict via the Python package: no live dictionary download.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {COMBINED_REPLIES} from '../src/interaction/ruri-routing.js';
import {allLiteReplyTemplatesForValidation} from '../src/lite-response-engine.js';
import {INTERACTION_REPLIES} from '../src/interaction/response.js';
const path=process.env.CMU_DICT_FILE;
if(!path)throw Error('CMU_DICT_FILE must be the offline pronunciation dictionary path');
const cmu=await readFile(path,'utf8');
const oldFetch=globalThis.fetch;
globalThis.fetch=async()=>({ok:true,text:async()=>cmu});
try{
 const {phonemize}=await import('../src/vendor/kitten/phonemizer.js');
 const all=[
  ...allLiteReplyTemplatesForValidation(),
  ...Object.values(INTERACTION_REPLIES).flat(),
  ...Object.values(COMBINED_REPLIES).flat()
 ];
 assert.equal(all.length,642);
 const failures=[];
 for(const [i,template] of all.entries()){
  try{
   const input=template.replaceAll('{name}','Hana');
   const ipa=await phonemize(input);
   if(typeof ipa!=='string'||ipa.length<5||ipa.includes('undefined')||ipa.includes('NaN'))throw Error('invalid phonetic output '+ipa);
   if(/[\{\}]/.test(ipa))throw Error('unconverted placeholders '+ipa);
  }catch(error){failures.push({index:i,english:template,error:String(error)});}
 }
 console.log('ACTUAL_KITTEN_PHONEMIZER',{sets:all.length,success:all.length-failures.length,failures:failures.slice(0,12)});
 assert.equal(failures.length,0,'phonemizer errors');
}finally{globalThis.fetch=oldFetch;}
