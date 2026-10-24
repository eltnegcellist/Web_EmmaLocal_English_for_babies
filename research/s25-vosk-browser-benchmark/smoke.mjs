/* CI smoke: launch the actual page and load Vosk WASM in headless Chromium.
   No Galaxy S25 is connected; this confirms browser compatibility only. */
import { chromium } from 'playwright';
const browser = await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page = await browser.newPage({permissions:['microphone']});
const errors=[];
page.on('pageerror', err => errors.push(String(err)));
page.on('console', msg => { if (msg.type()==='error') errors.push('console: '+msg.text()); });
const address='http://127.0.0.1:8765/index.html';
await page.goto(address,{waitUntil:'load',timeout:60000});
await page.locator('#load').click();
await page.waitForFunction(()=>{
  const s=document.querySelector('#status')?.textContent||'';
  return s.includes('Vosk準備完了')||s.includes('モデルの読み込み失敗');
},{timeout:210000});
const s=await page.locator('#status').textContent();
console.log('S25 browser smoke status:',s,'javascript errors:',errors.slice(-5));
if(!s.includes('Vosk準備完了'))throw new Error('Vosk headless Chromium load failed: '+s);
if(await page.locator('#record').isDisabled())throw new Error('Recording button not enabled after loading model');
console.log('Vosk WASM model bootstrap OK.');
const audioUrl='https://raw.githubusercontent.com/alphacep/vosk-api/master/python/example/test.wav';
const response=await fetch(audioUrl);
if(!response.ok)throw new Error('Could not retrieve upstream test WAV for worker smoke: '+response.status);
const wav=Buffer.from(await response.arrayBuffer());
await page.locator('#audioFile').setInputFiles({name:'vosk-upstream-test.wav',mimeType:'audio/wav',buffer:wav});
await page.waitForFunction(()=>(document.querySelector('#status')?.textContent||'').includes('音声の読込完了'),{timeout:30000});
await page.locator('#run').click();
await page.waitForFunction(()=>{
  const s=document.querySelector('#status')?.textContent||'';
  return s.includes('完了。中央値')||s.includes('測定失敗');
},{timeout:120000});
const final=await page.locator('#status').textContent();
console.log('Vosk real recognition smoke:',final);
if(!final.includes('完了。中央値'))throw new Error('Vosk 3-run browser recognition failed: '+final);
const median=Number(await page.locator('#p50').textContent());
if(!(median>0&&median<100000))throw new Error('No valid browser Vosk median: '+median);
console.log('Vosk 3-run audio recognition and p50/p95 calculation verified in Linux Chromium; S25 runtime still unmeasured.');
await browser.close();
