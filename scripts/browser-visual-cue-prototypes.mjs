import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const port=Number(process.env.VISUAL_CUE_PORT||8876);
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{stdio:'ignore'});
let browser;
try{
 browser=await chromium.launch({headless:true});
 const base='http://127.0.0.1:'+port+'/visual-cue-prototypes.html';
 const context=await browser.newContext({viewport:{width:1280,height:940}});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 let loaded=false;
 for(let i=0;i<35&&!loaded;i++){
  try{await page.goto(base,{timeout:2000});loaded=true;}
  catch{await new Promise(ok=>setTimeout(ok,200));}
 }
 assert.ok(loaded,'Local gallery preview server failed to start');
 await page.waitForSelector('.vc-card:nth-child(12)',{timeout:10000});
 assert.equal(await page.locator('.vc-card').count(),12);
 assert.equal(await page.locator('.vc-card[data-cue="action.sip"]').count(),1);
 assert.equal(await page.locator('.vc-card[data-cue="dialogue.finish-check"]').count(),1);
 assert.equal(await page.locator('.vc-stage img').count(),12);
 const imageStatus=await page.locator('.vc-stage img').evaluateAll(nodes=>nodes.map(img=>({src:img.getAttribute('src'),ok:img.complete&&img.naturalWidth>0})));
 assert.ok(imageStatus.every(x=>x.ok),JSON.stringify(imageStatus.filter(x=>!x.ok)));
 assert.deepEqual(errors,[]);
 assert.equal(await page.locator('#motionToggle').getAttribute('aria-pressed'),'true');
 await page.locator('#motionToggle').click();
 assert.equal(await page.locator('html').getAttribute('data-motion'),'off');
 assert.equal(await page.locator('#motionToggle').getAttribute('aria-pressed'),'false');
 await page.locator('#motionToggle').click();
 assert.equal(await page.locator('html').getAttribute('data-motion'),'on');
 await mkdir('.visual-cue-results',{recursive:true});
 await page.screenshot({path:'.visual-cue-results/desktop.png',fullPage:true,animations:'disabled'});
 const mobile=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',deviceScaleFactor:1});
 const m=await mobile.newPage();await m.goto(base);
 await m.waitForSelector('.vc-card:nth-child(12)');
 assert.equal(await m.locator('html').getAttribute('data-motion'),'off');
 assert.ok(await m.locator('#motionToggle').isVisible());
 assert.equal(await m.locator('.vc-card').count(),12);
 await m.screenshot({path:'.visual-cue-results/mobile.png',fullPage:true,animations:'disabled'});
 await mobile.close();
 await context.close();
 console.log('Visual Cue: 12 cards, 12 loaded images, pause/restart, reduced-motion and screenshots OK');
}finally{if(browser)await browser.close();server.kill('SIGTERM');}
