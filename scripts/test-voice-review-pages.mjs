// DOM/integrity checks only. This does not listen to or decode the recordings.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const root=new URL('../',import.meta.url);
const ledger=JSON.parse(await readFile(new URL('research/voice-content-26-review-20261015.json',root),'utf8'));
const report=JSON.parse(await readFile(new URL('research/voice-five-candidates-20261018.json',root),'utf8'));
const globals={document:globalThis.document,localStorage:globalThis.localStorage,location:globalThis.location,fetch:globalThis.fetch};
async function loadPage(filename,seed={}){
 const html=await readFile(new URL(filename,root),'utf8');
 const dom=new JSDOM(html,{url:'http://localhost/'+filename});
 globalThis.document=dom.window.document;globalThis.localStorage=dom.window.localStorage;globalThis.location=dom.window.location;
 for(const [key,value] of Object.entries(seed))localStorage.setItem(key,JSON.stringify(value));
 globalThis.fetch=async input=>{
  const path=new URL(String(input),'http://localhost/').pathname.replace(/^\//,'');
  return new Response(await readFile(new URL(path,root)));
 };
 const script=dom.window.document.querySelector('script[type="module"]').textContent;
 await import('data:text/javascript,'+encodeURIComponent(script)+'#'+filename);
 return dom;
}
try{
 const five=await loadPage('voice-content-five-review.html');
 assert.equal(document.querySelectorAll('article').length,5);
 assert.equal(document.querySelector('#export').disabled,false);
 assert.equal(document.querySelectorAll('audio').length,10);
 const displayed=[...document.querySelectorAll('.card .text')].map(e=>e.textContent);
 assert.deepEqual(displayed,report.candidates.map(c=>c.canonicalText));
 assert.ok([...document.querySelectorAll('select')].every(e=>e.value==='pending'));
 assert.match(document.body.textContent,/2回/);
 five.window.close();
 const oldDecisions={9:{expected:ledger.entries.find(e=>e.number===9).expected,decision:'match'},
 11:{expected:ledger.entries.find(e=>e.number===11).originalExpected,decision:'match'},
 1:{expected:ledger.entries.find(e=>e.number===1).expected,decision:'match'}};
 const full=await loadPage('voice-content-review-26.html',{'voice-review-26-v1':oldDecisions});
 const cards=[...document.querySelectorAll('article')];
 for(const number of [9,11])assert.equal(cards[number-1].querySelector('select').value,'pending','Stale audio/text decisions must reset');
 assert.equal(cards[0].querySelector('select').value,'match','Unchanged original review is preserved');
 assert.equal(cards[10].querySelector('q').textContent,report.candidates.find(c=>c.number===11).canonicalText);
 full.window.close();
 console.log('Review DOM: current two-repeat text, verified assets and stale-decision reset PASS (no listening claim).');
}finally{
 for(const [key,value] of Object.entries(globals)){
  if(value===undefined)delete globalThis[key];else globalThis[key]=value;
 }
}
