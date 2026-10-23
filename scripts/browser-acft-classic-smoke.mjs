// Regression: LiteRT's importScripts() requires a classic Worker, while
// our benchmark helper is an ES module loaded via dynamic import().
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const origin=process.env.ACFT_TEST_ORIGIN||'http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  await page.goto(origin+'/whisper-acft-benchmark.html',{waitUntil:'domcontentloaded'});
  const values=await page.evaluate(()=>new Promise((resolve,reject)=>{
    const w=new Worker('./src/multilingual/acft-encoder-worker.js',{type:'classic'});
    const timeout=setTimeout(()=>{w.terminate();reject(Error('Worker capability check timeout'));},20000);
    w.onerror=event=>{clearTimeout(timeout);w.terminate();reject(Error(event.message||'Worker startup failed'));};
    w.onmessage=({data})=>{
      clearTimeout(timeout);w.terminate();
      if(data.type==='error')reject(Error(data.error));
      else resolve(data);
    };
    w.postMessage({action:'capabilities'});
  }));
  assert.equal(values.type,'capabilities');
  assert.equal(values.classicImportScripts,true,'Classic Worker must support importScripts');
  assert.equal(values.dynamicModuleImport,true,'Dynamic import of ES helper must succeed');
  assert.match(values.build,/decoder-mask4d-v5/);
  console.log('PASS: Classic Worker supports importScripts and ES module dynamic import in Chromium');
  if(process.env.ACFT_RUNTIME_SMOKE==='1'){
    const runtime=await page.evaluate(()=>new Promise((resolve,reject)=>{
      const w=new Worker('./src/multilingual/acft-encoder-worker.js',{type:'classic'});
      const timeout=setTimeout(()=>{w.terminate();reject(Error('LiteRT runtime init timed out'));},120000);
      w.onerror=e=>{clearTimeout(timeout);w.terminate();reject(Error(e.message||'Worker runtime crash'));};
      w.onmessage=({data})=>{
        if(data.type==='runtime-ready'){
          clearTimeout(timeout);w.terminate();resolve(data);
        }else if(data.type==='error'){
          clearTimeout(timeout);w.terminate();reject(Error(data.stage+': '+data.error));
        }
      };
      w.postMessage({action:'runtime-smoke',model:'base5'});
    }));
    assert.equal(runtime.type,'runtime-ready');
    assert.equal(runtime.classicImportScripts,true);
    assert.match(runtime.build,/decoder-mask4d-v5/);
    console.log('PASS: actual LiteRT 2.5.3 WASM successfully initialized in Chromium, base='+runtime.wasmBase);
  }
}finally{await browser.close();}
