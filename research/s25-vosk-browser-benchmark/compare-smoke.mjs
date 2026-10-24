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
// Diagnose URL/path/MIME and COEP policy separately from model initialization.
for(const path of [
 './moonshine-bench-worker.js',
 './whisper-bench-worker.js',
 '../../src/moonshine-module.js',
 '../../src/multilingual/assets.js',
 '../../multilingual-assets/runtime/transformers.mjs'
]){
 const r=await page.evaluate(async path=>{
   const url=new URL(path,document.baseURI).href;
   try{
     const res=await fetch(url);
     return {url,status:res.status,type:res.headers.get('content-type'),corp:res.headers.get('cross-origin-resource-policy'),
       coep:res.headers.get('cross-origin-embedder-policy'),start:(await res.text()).slice(0,65)};
   }catch(e){return{url,error:String(e)}}
 },path);
 console.log('MODULE FETCH',path,JSON.stringify(r));
}
// Determine if the COEP-enabled origin permits an ordinary module worker.
const simpleWorker=await page.evaluate(()=>new Promise(resolve=>{
 const blob=new Blob(['self.postMessage({works:true})'],{type:'text/javascript'});
 const url=URL.createObjectURL(blob);
 const w=new Worker(url,{type:'module'});
 const timeout=setTimeout(()=>{w.terminate();URL.revokeObjectURL(url);resolve({error:'timeout'})},5000);
 w.onerror=e=>{clearTimeout(timeout);w.terminate();URL.revokeObjectURL(url);resolve({error:e.message||'Worker error'})};
 w.onmessage=e=>{clearTimeout(timeout);w.terminate();URL.revokeObjectURL(url);resolve(e.data)};
}));
console.log('BASIC MODULE WORKER',JSON.stringify(simpleWorker));
// Critical regression check: every module Worker must actually launch, resolve
// its nested imports, and return a structured error or success to the caller.
for(const kind of ['moonshine','whisper']){
  const outcome=await page.evaluate(async(kind)=>{
    const url='./'+kind+'-bench-worker.js';
    const worker=new Worker(url,{type:'module'});
    try {
      const reply=await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(Error(kind+' Worker probe timeout')),90000);
        worker.onerror=e=>{clearTimeout(timeout);reject(Error('Worker startup '+(e.message||'unknown')+' at '+(e.filename||'?')))};
        worker.onmessage=({data})=>{
          if(data.id!==778 || !['reply','error'].includes(data.type))return;
          clearTimeout(timeout);
          if(data.type==='error')reject(Error(data.message));else resolve(data);
        };
        worker.postMessage({id:778,type:'probe'});
      });
      return {success:true,reply};
    }catch(error){return {success:false,message:String(error)};}
    finally{worker.terminate();}
  },kind);
  console.log('Worker import probe',kind,JSON.stringify(outcome));
  if(!outcome.success||!outcome.reply?.probed)
    throw new Error('Nested module imports failed for '+kind+': '+JSON.stringify(outcome));
}
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
