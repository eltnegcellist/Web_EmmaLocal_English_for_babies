import { chromium } from 'playwright';
// Native Linux Chromium smoke; does not substitute for Galaxy S25 Android Chrome.
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:412,height:915}});
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
try{
  await page.goto('http://127.0.0.1:8765/research/s25-vosk-browser-benchmark/compare.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>crossOriginIsolated,{timeout:40000});
  const res=await fetch('https://raw.githubusercontent.com/alphacep/vosk-api/master/python/example/test.wav');
  if(!res.ok)throw Error('Reference WAV inaccessible '+res.status);
  await page.locator('#audioFile').setInputFiles({name:'upstream-test.wav',mimeType:'audio/wav',buffer:Buffer.from(await res.arrayBuffer())});
  await page.waitForFunction(()=>(document.querySelector('#audioInfo')?.textContent||'').includes('16kHz'),{timeout:30000});
  await page.selectOption('#engine','moonshine');
  await page.locator('#load').click();
  try{
    await page.waitForFunction(()=>{
      const s=document.querySelector('#status')?.textContent||'';
      return s.includes('準備完了')||s.includes('読み込みエラー');
    },null,{timeout:420000});
  }catch(e){
    console.error('Moonshine model init timed out. Last status:',await page.locator('#status').textContent());
    throw e;
  }
  const loadStatus=await page.locator('#status').textContent();
  console.log('Moonshine full init:',loadStatus);
  if(!loadStatus.includes('準備完了'))throw Error('Moonshine full model initialization failed: '+loadStatus);
  await page.locator('#run').click();
  await page.waitForFunction(()=>{
    const s=document.querySelector('#status')?.textContent||'';
    return s.includes('完了。p50')||s.includes('測定エラー');
  },null,{timeout:170000});
  const outcome=await page.locator('#status').textContent();
  console.log('Moonshine full inference:',outcome);
  if(!outcome.includes('完了。p50'))throw Error('Moonshine inference failed: '+outcome);
  const iterations=await page.locator('#transcripts').textContent();
  if(!iterations.includes('#3'))throw Error('Expected three Moonshine recognitions');
  console.log('Moonshine Small Streaming browser worker: model+3 utterances PASSED. This is not Galaxy S25 performance.');
}finally{
  console.log('Browser error diagnostics:',errors.slice(-15));
  await browser.close();
}
