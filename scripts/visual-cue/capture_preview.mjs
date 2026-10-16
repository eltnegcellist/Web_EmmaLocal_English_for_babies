import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=process.env.VISUAL_CUE_PLAYWRIGHT_MODULE?require(process.env.VISUAL_CUE_PLAYWRIGHT_MODULE):require('playwright');
const base=process.env.VISUAL_CUE_PREVIEW_URL||'http://127.0.0.1:8765/assets/visual-cue/artwork/preview.html';
const output=new URL('../../assets/visual-cue/artwork/qa/browser/',import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.VISUAL_CUE_CHROME_EXECUTABLE?{executablePath:process.env.VISUAL_CUE_CHROME_EXECUTABLE}:{})});
const context=await browser.newContext({viewport:{width:1280,height:1000}});
const page=await context.newPage();const errors=[];const badResponses=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)badResponses.push([r.status(),r.url()])});
await page.goto(base);await page.waitForSelector('#gallery .card');await page.locator('#gallery img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
const {default:manifest}=await import('../../assets/visual-cue/artwork/manifest.json',{with:{type:'json'}});
const checks=[];
for(const px of [220,256,320]){
 await page.selectOption('#size',String(px));
 const dims=await page.locator('#gallery .art').first().boundingBox();
 if(Math.abs(dims.width-px)>1)throw Error('size not applied');
 await page.screenshot({path:new URL(`overview-${px}.png`,output).pathname,fullPage:true});
 checks.push({name:`css-size-${px}`,pass:true});
}
await page.selectOption('#size','256');await page.click('#layout');
for(const a of manifest.assets){
 await page.locator(`#${a.id}`).scrollIntoViewIfNeeded();
 await page.locator(`#${a.id}`).screenshot({path:new URL(`${a.id}.png`,output).pathname});
}
await page.click('#pause');
checks.push({name:'pause-uses-posters',pass:await page.locator('#gallery [data-animation]').evaluateAll(imgs=>imgs.every(i=>i.getAttribute('src')===i.dataset.poster))});
await page.click('#pause');
checks.push({name:'resume-uses-animations',pass:await page.locator('#gallery [data-animation]').evaluateAll(imgs=>imgs.every(i=>i.getAttribute('src')===i.dataset.animation))});
await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('#pause').getAttribute('aria-pressed')==='true');
checks.push({name:'reduced-motion-static',pass:await page.locator('#gallery [data-animation]').evaluateAll(imgs=>imgs.every(i=>i.getAttribute('src')===i.dataset.poster))});
await page.selectOption('#filter','draft');checks.push({name:'filter-draft',pass:await page.locator('#gallery .card:visible').count()===manifest.assets.filter(a=>a.readiness==='draft').length});
await page.selectOption('#filter','all');await page.selectOption('#background','dark');
await page.locator('#hand-wave').screenshot({path:new URL('dark-background.png',output).pathname});
await page.setViewportSize({width:390,height:844});await page.selectOption('#size','320');await page.locator('#hand-clap').scrollIntoViewIfNeeded();
await page.locator('#hand-clap').screenshot({path:new URL('mobile-390.png',output).pathname});
checks.push({name:'mobile-no-overflow',pass:await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)});
checks.push({name:'58-cues-31-concepts',pass:await page.locator('#cues tr').count()===58&&await page.locator('#primitives tr').count()===31});
checks.push({name:'all-images-decoded',pass:await page.locator('#gallery img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth===512))});
const report={url:base,browser:browser.version(),checks,errors,badResponses,passed:checks.every(c=>c.pass)&&!errors.length&&!badResponses.length};
await writeFile(new URL('report.json',output),JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
