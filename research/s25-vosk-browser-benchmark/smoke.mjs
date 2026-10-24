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
console.log('Vosk WASM model bootstrap OK, Android S25 runtime still unmeasured.');
await browser.close();
