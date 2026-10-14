import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const port=Number(process.env.VISUAL_CUE_STUDY_PORT||8878);
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{stdio:'ignore'});
let browser=null;
try{
 browser=await chromium.launch({headless:true});
 const url='http://127.0.0.1:'+port+'/visual-cue-motion-study.html';
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let loaded=false;
 for(let i=0;i<30&&!loaded;i++){
  try{await page.goto(url,{timeout:2500});loaded=true;}
  catch{await new Promise(f=>setTimeout(f,150));}
 }
 assert.ok(loaded,'Preview server failed');
 await page.waitForSelector('.study-item:nth-child(4)');
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('object')).length===4 && Array.from(document.querySelectorAll('object')).every(o=>o.contentDocument?.documentElement?.localName==='svg'),null,{timeout:15000});
 assert.equal(await page.locator('.study-item').count(),4);
 assert.equal(await page.locator('.study-stage.old img').count(),4);
 assert.equal(await page.locator('.study-stage.new object').count(),4);
 const loadedImages=await page.locator('.study-stage.old img').evaluateAll(nodes=>nodes.every(n=>n.complete&&n.naturalWidth>0));
 assert.ok(loadedImages,'Old comparison images missing');
 const samples=await page.locator('.study-stage.new object').evaluateAll(nodes=>nodes.map(obj=>{
  const doc=obj.contentDocument;
  const groups=Array.from(doc.querySelectorAll('g[id]')).filter(g=>getComputedStyle(g).animationName!=='none');
  return {groups:groups.map(g=>({id:g.id,name:getComputedStyle(g).animationName,duration:getComputedStyle(g).animationDuration}))};
 }));
 assert.deepEqual(samples.map(s=>s.groups.length),[2,1,2,2],'Moving SVG parts must be animated, not just whole cards');
 const motion1=await page.locator('object').first().evaluate(o=>getComputedStyle(o.contentDocument.getElementById('bottlePivot')).transform);
 await page.waitForTimeout(760);
 const motion2=await page.locator('object').first().evaluate(o=>getComputedStyle(o.contentDocument.getElementById('bottlePivot')).transform);
 assert.notEqual(motion1,motion2,'Bottle joint should move between sampled frames');
 await page.locator('#motionToggle').click();
 assert.equal(await page.locator('#motionToggle').getAttribute('aria-pressed'),'false');
 const state=await page.locator('object').evaluateAll(nodes=>nodes.every(o=>o.contentDocument.documentElement.classList.contains('paused') && Array.from(o.contentDocument.querySelectorAll('g[id]')).filter(g=>getComputedStyle(g).animationName!=='none').every(g=>getComputedStyle(g).animationPlayState==='paused')));
 assert.ok(state,'Embedded SVG animations must all be paused');
 await mkdir('.visual-cue-motion-results',{recursive:true});
 await page.screenshot({path:'.visual-cue-motion-results/desktop.png',fullPage:true,animations:'disabled'});
 await page.locator('#motionToggle').click();
 assert.equal(await page.locator('#motionToggle').getAttribute('aria-pressed'),'true');
 const mobile=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const m=await mobile.newPage();await m.goto(url);
 await m.waitForSelector('.study-item:nth-child(4)');
 await m.waitForFunction(()=>Array.from(document.querySelectorAll('object')).length===4&&Array.from(document.querySelectorAll('object')).every(o=>o.contentDocument?.documentElement?.localName==='svg'));
 assert.equal(await m.locator('#motionToggle').getAttribute('aria-pressed'),'false');
 assert.equal(await m.locator('.study-item').count(),4);
 await m.screenshot({path:'.visual-cue-motion-results/mobile.png',fullPage:true,animations:'disabled'});
 assert.deepEqual(errors,[]);
 await mobile.close();
 await page.close();
 console.log('Visual Cue: 4 object SVGs animated by actual moving body/object parts, toggle and reduced motion OK');
}finally{if(browser)await browser.close();server.kill('SIGTERM');}
