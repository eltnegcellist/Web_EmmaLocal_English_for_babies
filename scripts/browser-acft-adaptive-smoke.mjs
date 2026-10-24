import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
const origin=process.env.ACFT_ORIGIN||'http://127.0.0.1:8765';
try {
 const page=await browser.newPage();
 page.on('console', msg=>{if(msg.type()==='error')console.log('BROWSER:',msg.text().slice(0,250))});
 await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(async()=>{
   await navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'});
   await navigator.serviceWorker.ready;
 });
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>crossOriginIsolated&&typeof SharedArrayBuffer==='function',null,{timeout:20000});
 const result=await page.evaluate(async()=>{
   return new Promise((resolve,reject)=>{
     const worker=new Worker(new URL('./src/multilingual/acft-native-worker.js',location.href));
     const timer=setTimeout(()=>{worker.terminate();reject(Error('WASM init worker response timed out'))},60000);
     worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error('Native worker error: '+e.message))};
     worker.onmessage=({data})=>{
       if(data.kind==='native-log')return;
       clearTimeout(timer);worker.terminate();resolve(data);
     };
     worker.postMessage({type:'init',id:13,model:new ArrayBuffer(0)});
   });
 });
 assert.equal(result.kind,'error');
 assert.match(result.error,/Invalid ACFT model byte count/);
 console.log('PASS: nested classic ASR Worker loaded native wasm under COI, reached verified-model size guard.');
}finally {await browser.close();}
