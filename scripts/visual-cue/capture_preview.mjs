import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=process.env.VISUAL_CUE_PLAYWRIGHT_MODULE?require(process.env.VISUAL_CUE_PLAYWRIGHT_MODULE):require('playwright');
const base=process.env.VISUAL_CUE_PREVIEW_URL||'http://127.0.0.1:8765/assets/visual-cue/artwork/preview.html';
const output=new URL(process.env.VISUAL_CUE_CAPTURE_OUTPUT||'../../assets/visual-cue/artwork/qa/browser/',import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.VISUAL_CUE_CHROME_EXECUTABLE?{executablePath:process.env.VISUAL_CUE_CHROME_EXECUTABLE}:{})});
const context=await browser.newContext({viewport:{width:1280,height:1000}});
const page=await context.newPage();const errors=[];const badResponses=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)badResponses.push([r.status(),r.url()])});
if(!base.startsWith('file:'))for(let attempt=0;attempt<30;attempt++){try{const r=await fetch(base);await r.body?.cancel();if(r.ok)break}catch{}if(attempt===29)throw Error('preview server unavailable');await new Promise(r=>setTimeout(r,100))}
await page.goto(base);await page.waitForSelector('#gallery .card');await page.selectOption('#filter','all');await page.locator('#gallery img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
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
for(const id of ['hand-open-close','hand-count','hand-tap','change-zipper','hug-arms','hand-squeeze-v3','change-clothes','dress-sleeves','change-diaper-exchange','wake-quilt','care-burp','kick','page','hold-hands-squeeze']){
 await page.locator(`#${id}`).scrollIntoViewIfNeeded();
 const signatures=[];
 for(let phase=0;phase<5;phase++){
  const png=await page.locator(`#${id} [data-animation]`).screenshot({animations:'allow'});signatures.push(createHash('sha256').update(png).digest('hex'));
  await page.waitForTimeout(260);
 }
 checks.push({name:`browser-motion-${id}`,pass:new Set(signatures).size>1});
}
await page.locator('#page details summary').click();checks.push({name:'rejected-version-comparison-opens',pass:await page.locator('#page details[open] img').count()===1});await page.locator('#page details summary').click();
await page.locator('#page > a').click();await page.locator('dialog[open] img').evaluate(img=>img.decode());checks.push({name:'filmstrip-opens-in-page',pass:await page.locator('dialog[open] img').evaluate(img=>img.naturalWidth===1100)});await page.locator('dialog[open] button').click();
await page.click('#pause');
checks.push({name:'pause-uses-posters',pass:await page.locator('#gallery [data-animation]').evaluateAll(imgs=>imgs.every(i=>i.getAttribute('src')===i.dataset.poster))});
await page.click('#pause');
checks.push({name:'resume-uses-animations',pass:await page.locator('#gallery [data-animation]').evaluateAll(imgs=>imgs.every(i=>i.getAttribute('src')===i.dataset.animation))});
await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('#pause').getAttribute('aria-pressed')==='true');
checks.push({name:'reduced-motion-static',pass:await page.locator('#gallery [data-animation]').evaluateAll(imgs=>imgs.every(i=>i.getAttribute('src')===i.dataset.poster))});
await page.selectOption('#filter','draft');checks.push({name:'filter-draft',pass:await page.locator('#gallery .card:visible').count()===manifest.assets.filter(a=>a.readiness==='draft').length});
await page.selectOption('#filter','new');checks.push({name:'filter-latest-production-pass',pass:await page.locator('#gallery .card:visible').count()===manifest.assets.filter(a=>a.productionPass===manifest.productionPass).length});await page.screenshot({path:new URL('final-pass-overview.png',output).pathname,fullPage:true});
await page.locator('#cues a[href="#hand-wave"]').click();await page.waitForFunction(()=>document.querySelector('#filter').value==='all');checks.push({name:'cue-link-reveals-filtered-target',pass:await page.locator('#hand-wave').isVisible()});
await page.selectOption('#filter','all');await page.selectOption('#background','dark');
await page.locator('#hand-wave').screenshot({path:new URL('dark-background.png',output).pathname});
await page.setViewportSize({width:390,height:844});await page.selectOption('#size','320');await page.locator('#hand-clap').scrollIntoViewIfNeeded();
await page.locator('#hand-clap').screenshot({path:new URL('mobile-390.png',output).pathname});
checks.push({name:'mobile-no-overflow',pass:await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)});
checks.push({name:'58-cues-31-concepts',pass:await page.locator('#cues tr').count()===58&&await page.locator('#primitives tr').count()===31});
checks.push({name:'old-drafts-separate-from-candidates',pass:await page.locator('#archive article').count()===manifest.archivedAssets.length&&await page.locator('#gallery .card[data-readiness="draft"]').count()===0});
checks.push({name:'emma-seven-evaluations',pass:await page.locator('#emma article').count()===7});
checks.push({name:'all-images-decoded',pass:await page.locator('#gallery img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth===512))});
await page.selectOption('#filter','common');checks.push({name:'daily-scene-filter',pass:await page.locator('#gallery .card:visible').count()===manifest.commonAssetIds.length});checks.push({name:'human-feedback-and-usage-audit-visible',pass:await page.locator('#feedback tr').count()===manifest.reviewFeedback.items.length&&await page.locator('#usage tr').count()>15});
const report={url:base,browser:browser.version(),checks,errors,badResponses,passed:checks.every(c=>c.pass)&&!errors.length&&!badResponses.length};
await writeFile(new URL(base.startsWith('file:')?'offline-report.json':'report.json',output),JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
