import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const origin=process.env.ORIGIN||'http://127.0.0.1:8766';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage();
 const issues=[];
 page.on('pageerror',error=>issues.push(error.message));
 await page.goto(origin+'/moonshine-streaming-benchmark.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>self.crossOriginIsolated&&document.getElementById('status')?.textContent.includes('起動可能'),null,{timeout:25000});
 const report=await page.evaluate(()=>({
  ci:self.crossOriginIsolated,
  languageOptions:[...document.querySelectorAll('#language option')].map(x=>x.value),
  sizeOptions:[...document.querySelectorAll('#size option')].map(x=>x.value),
  build:document.getElementById('build').textContent,
  status:document.getElementById('status').textContent
 }));
 assert(report.ci===true);
 assert.deepEqual(report.languageOptions,['ja','de','en']);
 assert.deepEqual(report.sizeOptions,['tiny','small']);
 assert.match(report.build,/moonshine-streaming-research-v1/);
 assert.deepEqual(issues,[]);
 console.log('PASS Moonshine research page isolation and exact supported-languages UI',JSON.stringify(report));

 if(process.env.TEST_MOONSHINE_CDN==='1'){
  const checked=await page.evaluate(async()=>{
   const sdk=await import('https://cdn.jsdelivr.net/npm/@moonshine-ai/moonshine-wasm@0.1.5/dist/index.js');
   return {transcriber:typeof sdk.MicTranscriber,smallStreaming:sdk.ModelArch?.SmallStreaming,tinyStreaming:sdk.ModelArch?.TinyStreaming};
  });
  assert.equal(checked.transcriber,'function');
  assert.equal(typeof checked.smallStreaming,'number');
  assert.equal(typeof checked.tinyStreaming,'number');
  console.log('PASS: exact pinned Moonshine CDN export API',JSON.stringify(checked));
 }
}finally{await browser.close()}
