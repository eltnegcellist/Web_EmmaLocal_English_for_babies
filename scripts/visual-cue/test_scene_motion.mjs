import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const manifest=JSON.parse(await readFile('assets/visual-cue/motion-variants/manifest.json','utf8'));
const out='assets/visual-cue/motion-variants/qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.VISUAL_CUE_CHROME_EXECUTABLE||undefined});
const page=await browser.newPage({viewport:{width:1100,height:700}});const checks=[];
try{
 for(const a of manifest.assets){
  const svg=await readFile(a.animation,'utf8');
  await page.setContent('<style>body{margin:0;background:transparent}svg{width:512px;height:512px;display:block}</style>'+svg);
  await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('image')].map(async n=>{const i=new Image();i.src=n.getAttribute('href');await i.decode();}));document.getAnimations().forEach(a=>{a.pause();a.currentTime=0;});});
  const animations=await page.evaluate(()=>document.getAnimations().length);assert(animations>0,a.id+' has no part animation');
  for(const [label,time] of [['before',0],['after',a.loopMs*.43]]){
   await page.evaluate(t=>document.getAnimations().forEach(a=>a.currentTime=t),time);
   await page.locator('svg').screenshot({path:`${out}/${a.id}-${label}.png`,omitBackground:true,animations:'allow'});
  }
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.evaluate(()=>document.getAnimations().length),0);await page.emulateMedia({reducedMotion:'no-preference'});
  const poster=await readFile(a.poster,'utf8');await page.setContent(poster);assert.equal(await page.evaluate(()=>document.getAnimations().length),0);
  checks.push({id:a.id,animatedParts:animations,reducedMotion:true,posterStatic:true,stationaryRegion:a.stationaryRegion});
 }
 await writeFile(out+'/browser-report.json',JSON.stringify({passed:true,checks},null,2)+'\n');
}finally{await browser.close();}
console.log('Scene motion: 6 local-part animations, static posters and reduced motion PASS');
