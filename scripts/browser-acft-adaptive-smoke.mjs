import assert from 'node:assert/strict';
import {chromium} from 'playwright';
// Use the same PAGE-level WASM startup as the Galaxy S25 successful benchmark.
// The nested classic-Worker startup was not supported in our browser test.
const browser=await chromium.launch({headless:true});
const origin=process.env.ACFT_ORIGIN||'http://127.0.0.1:8765';
try{
 const page=await browser.newPage();
 await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(async()=>{
   await navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'});
   await navigator.serviceWorker.ready;
 });
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>crossOriginIsolated&&typeof SharedArrayBuffer==='function',null,{timeout:20000});
 const result=await page.evaluate(async()=>{
   const src=new URL('./multilingual-assets/runtime/acft-whispercpp.js',location.href);
   const check=await fetch(src,{cache:'no-store'});
   if(!check.ok)throw Error('Native WASM JS unavailable '+check.status);
   const ready=new Promise((resolve,reject)=>{
     const Module={print:()=>{},printErr:()=>{},
       onRuntimeInitialized:()=>{
         const functions=['acft_init','acft_run','acft_status','acft_result',
           'acft_timings','acft_detected_language'];
         const missing=functions.filter(name=>typeof Module[name]!=='function');
         if(missing.length)reject(Error('Missing native API: '+missing.join(',')));
         else resolve({isolated:crossOriginIsolated,exported:functions,
           notLoadedYet:Module.acft_timings()===''});
       }};
     window.Module=Module;
     const script=document.createElement('script');
     script.src=src.href;script.async=true;
     script.onerror=()=>reject(Error('Native JS bundle script failed to load'));
     document.head.append(script);
   });
   return await ready;
 });
 assert.equal(result.isolated,true);
 assert.equal(result.notLoadedYet,true);
 console.log('PASS: optimized ACFT native WASM bootstrap on isolated page, detected-language API available',JSON.stringify(result));
}finally{await browser.close();}
