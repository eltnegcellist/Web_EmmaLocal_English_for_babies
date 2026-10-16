import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const port=Number(process.env.VISUAL_CUE_LIVE_PORT||8879);
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{stdio:'ignore'});
let browser;
try{
 browser=await chromium.launch({headless:true});
 const url='http://127.0.0.1:'+port+'/index.html';
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(()=>localStorage.setItem('emma_visual_cue_display_mode','illustration'));
 const page=await ctx.newPage();
 let loaded=false;
 for(let i=0;i<30&&!loaded;i++){
  try {await page.goto(url,{timeout:3500,waitUntil:'domcontentloaded'});loaded=true;}
  catch {await new Promise(resolve=>setTimeout(resolve,200));}
 }
 assert.ok(loaded,'Local server never started');
 await page.waitForFunction(()=>document.getElementById('visualCueDisplayMode')?.value==='illustration',{timeout:20000});
 assert.equal(await page.locator('#visualCueDisplayMode').inputValue(),'illustration');
 const sample=await page.evaluate(async()=>{
  const img=new Image();
  img.src='./assets/visual-cue/approved/visual-cue-atlas.webp';
  await img.decode();
  const avatar=document.getElementById('avatar');
  const face=document.getElementById('aiAvatarFace');
  const icon=document.getElementById('visualCuePicture');
  if(!avatar||!face||!icon)throw Error('Missing main-screen avatar target');
  return {width:img.naturalWidth,height:img.naturalHeight,display:getComputedStyle(face).display,
    pictureParent:icon.parentElement?.id,faceParent:face.parentElement?.id,
    bg:getComputedStyle(icon).backgroundImage};
 });
 assert.equal(sample.width,768);
 assert.equal(sample.height,768);
 assert.equal(sample.pictureParent,sample.faceParent);
 assert.equal(sample.pictureParent,'avatar');
 assert.ok(sample.bg.includes('visual-cue-atlas.webp'),sample.bg);
 await page.locator('#visualCueDisplayMode').evaluate(el=>{el.value='emma';el.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.waitForFunction(()=>localStorage.getItem('emma_visual_cue_display_mode')==='emma');
 await page.reload();
 await page.waitForFunction(()=>document.getElementById('visualCueDisplayMode')?.value==='emma');
 assert.equal(await page.locator('#visualCueDisplayMode').inputValue(),'emma');
 await page.locator('#visualCueDisplayMode').evaluate(el=>{el.value='illustration';el.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.waitForFunction(()=>localStorage.getItem('emma_visual_cue_display_mode')==='illustration');
 // Illustration is not shown without a supported, committed reply (no false positive).
 assert.ok(await page.locator('#visualCuePicture').evaluate(e=>e.classList.contains('hidden')));
 await ctx.close();
 console.log('Main face: approved image decoded, same avatar area, mode persists, unsupported turn leaves Emma visible');
}finally{if(browser)await browser.close();server.kill('SIGTERM');}
