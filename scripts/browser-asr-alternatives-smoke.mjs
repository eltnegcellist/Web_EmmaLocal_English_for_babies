import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 const errors=[];
 page.on('pageerror', e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/asr-alternatives-benchmark.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.crossOriginIsolated===true
  && document.querySelector('#load')?.disabled===false,undefined,{timeout:45000});
 const catalog=await page.evaluate(async()=>{
  const {loadEmmaMoonshineModule}=await import('./src/moonshine-module.js');
  const mod=await loadEmmaMoonshineModule();
  const arch=[2,4];const langs=['ja','de','en','es'];
  return langs.map(lang=>arch.map(id=>{
   try{
    const raw=mod.sttDependencies(lang,String(id),false);
    const parsed=JSON.parse(raw);
    const assets=parsed.groups?.reduce((n,g)=>n+(g.files?.length||0),0)||0;
    return {lang,id,assets};
   }catch(e){return {lang,id,error:String(e.message||e)}}
  })).flat();
 });
 for(const c of catalog){
  assert(c.assets>0, 'Catalog lacks '+c.lang+'/'+c.id+': '+(c.error||'empty manifest'));
 }
 assert.deepEqual(errors,[]);
 console.log('PASS Moonshine v0.1.5 WASM boot + model catalog:',JSON.stringify(catalog));
}catch(e){console.error('Moonshine alternative smoke failed:',e);process.exitCode=1;
}finally{await browser.close();}
