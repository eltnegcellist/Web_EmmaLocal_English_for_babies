// Functional UI checks only; no accuracy study or classifier tuning.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});
const base=process.env.SEMANTIC_TEST_URL || 'http://127.0.0.1:8765/';
const errors=[],results={};let activePage;
async function ready(page){await page.waitForFunction(()=>/判定できます|できません|HTTP |error|Error|failed|no available|途中/.test(document.querySelector('[data-semantic="status"]').textContent),null,{timeout:180000});assert.match(await page.locator('[data-semantic="status"]').innerText(),/判定できます/);}
async function typeJapanese(page,text='お風呂に入って温まろう'){
 const input=page.locator('[data-semantic="input"]');await input.click();assert.equal(await input.evaluate(e=>document.activeElement===e),true);
 await page.keyboard.press('ControlOrMeta+A');await page.keyboard.insertText(text);assert.equal(await input.inputValue(),text);
 // Preserve composed text while IME input events and model progress occur.
 await input.dispatchEvent('compositionstart');await input.dispatchEvent('compositionupdate',{data:text});await input.dispatchEvent('compositionend',{data:text});assert.equal(await input.inputValue(),text);
}
async function reply(page){await page.locator('[data-semantic="try"]').click();await page.waitForFunction(()=>document.querySelector('[data-semantic="result"]').textContent.includes('選んだ話題：bath'),null,{timeout:180000});assert.match(await page.locator('[data-semantic="result"]').innerText(),/既存ライブラリの英語：.+/);}
try {
 await mkdir('.semantic-test-results',{recursive:true});
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();activePage=page;page.on('pageerror',e=>errors.push(e.message));
 const assetRequests=[];page.on('request',r=>{if(r.url().includes('/semantic-assets/'))assetRequests.push(r.url());});
 await page.goto(new URL('index.html',base).href);
 assert.equal(await page.locator('#onboardingSemanticOff').isChecked(),false);
 assert.equal(await page.locator('#semanticPanel').isVisible(),false);assert.equal(assetRequests.length,0,'no model download before the user starts setup');
 await page.locator('label').filter({has:page.locator('#onboardingSemanticOff')}).click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('emma_semantic_enabled')),'false');await page.reload();assert.equal(await page.locator('#onboardingSemanticOff').isChecked(),true);
 assert.equal(assetRequests.length,0);results.defaultOnLazyOptOut=true;console.log('Default-on, initial opt-out and saved preference: OK');
 await page.evaluate(()=>{localStorage.setItem('emma_web_setup_revision','moonshine-streaming-kitten-int8-kiki-v10');localStorage.setItem('emma_web_tutorial_completed_v1','true');sessionStorage.setItem('emma_asr_reload','small');});
 await page.goto(new URL('index.html',base).href);await page.locator('#settingsButton').click();assert.equal(await page.locator('#semanticEnabled').isChecked(),false);
 assert.equal(await page.locator('#semanticPanel').isVisible(),false);assert.equal(await page.locator('#onboardingScreen a[href="./semantic-test.html"]').count(),0);
 for(let i=0;i<4;i++)await page.locator('#developerUnlockTrigger').click();assert.equal(await page.locator('#semanticPanel').isVisible(),false);await page.locator('#developerUnlockTrigger').click();assert.equal(await page.locator('#semanticPanel').isVisible(),true);results.fiveTapOnly=true;
 await page.locator('#semanticPanel summary').click();await typeJapanese(page);results.actualJapaneseKeyboard=true;
 await page.locator('label').filter({has:page.locator('#semanticEnabled')}).click();await ready(page);await reply(page);results.actualAppSettings=true;
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'.semantic-test-results/semantic-app-settings.png',fullPage:true});console.log('Five taps, actual app input and WASM reply: OK');
 await page.locator('[data-semantic="cancel"]').click();assert.equal(await page.locator('#semanticEnabled').isChecked(),false);await page.getByText('意味で話題を判定する',{exact:true}).click();assert.equal(await page.locator('#semanticEnabled').isChecked(),true);await ready(page);results.cancelRetry=true;console.log('Cancel / re-enable: OK');
 await page.goto(new URL('semantic-test.html',base).href);assert.equal(await page.locator('[data-semantic="input"]').isVisible(),true);await typeJapanese(page);await reply(page);results.standalone=await page.locator('[data-semantic="result"]').innerText();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'.semantic-test-results/semantic-mobile.png',fullPage:true});console.log('Standalone Japanese keyboard / IME events and reply: OK');
 await page.locator('[data-semantic="mode"]').selectOption('guard');await ready(page);await reply(page);results.guard=true;
 await page.locator('[data-semantic="mode"]').selectOption('lite');await page.waitForFunction(()=>document.querySelector('[data-semantic="status"]').textContent.includes('従来Lite'));await reply(page);results.lite=true;
 await page.locator('[data-semantic="mode"]').selectOption('semantic');await ready(page);
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
 await context.setOffline(true);results.offline=await page.evaluate(async()=>{const {SemanticLiteClient}=await import('./src/semantic/client.js');const c=new SemanticLiteClient();try{return(await c.predict('お風呂に入って温まろう')).topic.id;}finally{c.cancel();}});assert.equal(results.offline,'bath');await context.setOffline(false);
 const failed=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await failed.route('**/src/semantic-assets-manifest.json',route=>route.fulfill({status:404,body:'missing'}));const fpage=await failed.newPage();
 await fpage.goto(new URL('semantic-test.html',base).href);await typeJapanese(fpage);await reply(fpage);assert.match(await fpage.locator('[data-semantic="status"]').innerText(),/従来Lite/);results.missingAssetsFallback=true;await failed.close();
 assert.deepEqual(errors,[]);results.pageErrors=errors;results.url=base;results.scope='functional only; no new accuracy benchmark';await writeFile('.semantic-test-results/functional-smoke.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
} catch(error) {if(activePage){console.log('Current UI',await activePage.locator('[data-semantic="status"]').textContent().catch(()=>null));await activePage.screenshot({path:'.semantic-test-results/semantic-failure.png',fullPage:true}).catch(()=>{});}throw error;}
finally{await browser.close();}
