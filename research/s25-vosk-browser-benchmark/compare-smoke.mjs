import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:412,height:915}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',e=>{if(e.type()==='error'||e.text().startsWith('S25 Vosk'))errors.push(e.type()+': '+e.text())});
await page.goto('http://127.0.0.1:8765/research/s25-vosk-browser-benchmark/compare.html',{waitUntil:'domcontentloaded'});
try{
  await page.waitForFunction(()=>{
    const s=document.querySelector('#isolation')?.textContent||'';
    return s.includes('有効')||s.includes('無効')||s.includes('できません');
  },{timeout:45000});
}catch(error){
  console.error('Isolation debug',{
    url:page.url(),
    text:await page.locator('#isolation').textContent().catch(()=>null),
    status:await page.locator('#status').textContent().catch(()=>null),
    sw:await page.evaluate(()=>({
      controller:navigator.serviceWorker?.controller?.scriptURL||null,
      isolated:crossOriginIsolated,
      attempts:sessionStorage.getItem('coi-benchmark-reloads'),
      readyState:document.readyState
    })).catch(e=>String(e)),
    errors
  });
  throw error;
}
const isolated=await page.evaluate(()=>crossOriginIsolated);
console.log('COI state:',isolated,'UI:',await page.locator('#isolation').textContent());
if(!isolated)throw Error('Compare page cannot turn on isolation in Chromium through service worker.');
const response=await fetch('https://raw.githubusercontent.com/alphacep/vosk-api/master/python/example/test.wav');
if(!response.ok)throw Error('Test audio unavailable: '+response.status);
const bytes=Buffer.from(await response.arrayBuffer());
await page.locator('#audioFile').setInputFiles({name:'upstream-test.wav',mimeType:'audio/wav',buffer:bytes});
await page.waitForFunction(()=>(document.querySelector('#audioInfo')?.textContent||'').includes('16kHz'),{timeout:30000});
await page.locator('#load').click();
await page.waitForFunction(()=>{
  const s=document.querySelector('#status')?.textContent||'';
  return s.includes('準備完了')||s.includes('読み込みエラー');
},{timeout:200000});
const ready=await page.locator('#status').textContent();
if(!ready.includes('準備完了'))throw Error('Vosk model loading failed: '+ready);
await page.locator('#run').click();
try {
  await page.waitForFunction(()=>{
    const s=document.querySelector('#status')?.textContent||'';
    return s.includes('完了。p50')||s.includes('測定エラー');
  },null,{timeout:75000});
} catch(err) {
  console.error('Vosk benchmark timeout diagnostic',{
    status:await page.locator('#status').textContent().catch(()=>null),
    rows:await page.locator('#rows').textContent().catch(()=>null),
    errors
  });
  throw err;
}
const status=await page.locator('#status').textContent();
if(!status.includes('完了。p50'))throw Error('Vosk final-result benchmark failed: '+status);
const obj=await page.evaluate(()=>({
  rows:[...document.querySelectorAll('#rows tr')].map(e=>e.textContent),
  resultText:document.querySelector('#transcripts')?.textContent
}));
console.log('Comparison smoke:',status,obj);
if(obj.rows.length!==1||!obj.rows[0].includes('Vosk'))throw Error('Missing comparison row');
if(!obj.resultText?.includes('#3'))throw Error('Three final result callbacks were not measured');
console.log('Research comparison HTML, COI, Vosk final-only 3x, p50/p95 passed in Linux Chromium. Moonshine/Whisper not downloaded in smoke.');
await browser.close();
if(errors.length)console.warn('Browser console diagnostics:',errors.slice(-12));
