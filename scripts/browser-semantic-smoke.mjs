// Functional UI checks only; no accuracy study or classifier tuning.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});
const base=process.env.SEMANTIC_TEST_URL || 'http://127.0.0.1:8765/';
const errors=[];const results={};
async function ready(page){await page.waitForFunction(()=>document.querySelector('[data-semantic="status"]').textContent.includes('判定できます'),null,{timeout:180000});}
async function reply(page){await page.locator('[data-semantic="input"]').fill('お風呂に入って温まろう');await page.locator('[data-semantic="try"]').click();await page.waitForFunction(()=>document.querySelector('[data-semantic="result"]').textContent.includes('選んだ話題：bath'),null,{timeout:60000});assert.match(await page.locator('[data-semantic="result"]').innerText(),/既存ライブラリの英語：.+/);}
try {
 await mkdir('.semantic-test-results',{recursive:true});
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(new URL('semantic-test.html',base).href);
 assert.equal(await page.locator('[data-semantic="enabled"]').isChecked(),false);
 assert.equal(await page.locator('[data-semantic="mode"]').inputValue(),'semantic');
 await page.getByText('意味で話題を判定する',{exact:true}).click();await ready(page);
 await page.locator('summary').click();await reply(page);results.standalone=await page.locator('[data-semantic="result"]').innerText();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile overflow');
 await page.screenshot({path:'.semantic-test-results/semantic-mobile.png',fullPage:true});
 await page.locator('[data-semantic="mode"]').selectOption('guard');await ready(page);await reply(page);results.guard=true;
 await page.locator('[data-semantic="mode"]').selectOption('lite');await page.waitForFunction(()=>document.querySelector('[data-semantic="status"]').textContent.includes('従来Lite'));await reply(page);results.lite=true;
 await page.locator('[data-semantic="mode"]').selectOption('semantic');await ready(page);
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
 await context.setOffline(true);
 results.offline=await page.evaluate(async()=>{const {SemanticLiteClient}=await import('./src/semantic/client.js');const client=new SemanticLiteClient();try{return(await client.predict('お風呂に入って温まろう')).topic.id;}finally{client.cancel();}});
 assert.equal(results.offline,'bath');await context.setOffline(false);
 // Open the actual app settings without triggering ASR/TTS setup or microphone.
 await page.evaluate(()=>{localStorage.setItem('emma_web_setup_revision','moonshine-streaming-kitten-int8-kiki-v10');localStorage.setItem('emma_web_tutorial_completed_v1','true');sessionStorage.setItem('emma_asr_reload','small');});
 await page.goto(new URL('index.html',base).href);await page.locator('#settingsButton').click();await page.locator('#semanticPanel').scrollIntoViewIfNeeded();await ready(page);await page.locator('#semanticPanel summary').click();await reply(page);
 results.actualAppSettings=true;await page.screenshot({path:'.semantic-test-results/semantic-app-settings.png',fullPage:true});
 await page.locator('[data-semantic="cancel"]').click();assert.equal(await page.locator('[data-semantic="enabled"]').isChecked(),false);
 await page.getByText('意味で話題を判定する',{exact:true}).click();await ready(page);results.cancelRetry=true;
 const failed=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await failed.route('**/src/semantic-assets-manifest.json',route=>route.fulfill({status:404,body:'missing'}));const fpage=await failed.newPage();
 await fpage.goto(new URL('semantic-test.html',base).href);await fpage.getByText('意味で話題を判定する',{exact:true}).click();await fpage.waitForFunction(()=>document.querySelector('[data-semantic="status"]').textContent.includes('配置されていません'));await fpage.locator('summary').click();await reply(fpage);results.missingAssetsFallback=true;await failed.close();
 assert.deepEqual(errors,[]);results.pageErrors=errors;results.scope='functional only; no new accuracy benchmark';
 await writeFile('.semantic-test-results/functional-smoke.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
