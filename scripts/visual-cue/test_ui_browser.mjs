import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.VISUAL_CUE_UI_BASE||'http://127.0.0.1:8781';
const out='assets/emma-background-cues/qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.VISUAL_CUE_CHROME_EXECUTABLE?{executablePath:process.env.VISUAL_CUE_CHROME_EXECUTABLE}:{})});
const checks=[],errors=[];let completed=false;
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,...(detail?{detail}:{})});assert(pass,name);};
const context=await browser.newContext({viewport:{width:1200,height:1100},serviceWorkers:'block',locale:'ja-JP'});
await context.addInitScript(()=>{Math.random=()=>0;});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const visibleFrame='#defaultEmma [data-avatar-frame]:not(.hidden)';
const headRect=svg=>{const s=svg.getBoundingClientRect(),r=svg.querySelector('path[d^="M98,420"]').getBoundingClientRect();return [(r.left-s.left)/s.width,(r.top-s.top)/s.height,r.width/s.width,r.height/s.height];};
try{
 await page.goto(base+'/visual-cue-ui-preview.html');await page.waitForSelector('.comparison-card:nth-child(3)');await page.waitForSelector('#example option:nth-child(16)',{state:'attached'});
 check('twelve-canonical-frames-in-player',await page.locator('#defaultEmma [data-avatar-frame]').count()===12);
 check('no-gesture-replacement-svg',await page.locator('[data-emma-gesture]').count()===0);
 for(const size of [220,256,320]){
  await page.addStyleTag({content:`.comparisons{grid-template-columns:repeat(3,${size}px)}.comparison-card{width:${size}px;padding:0}.comparison-card .avatar{width:${size}px;height:${size}px}`});
  const reference=await page.locator('.comparison-card[data-example-state="baseline"] [data-avatar-frame]:not(.hidden)').evaluate(headRect);
  for(const state of ['calm','celebrate']){
   const card=page.locator(`.comparison-card[data-example-state="${state}"]`);
   const actual=await card.locator('[data-avatar-frame]:not(.hidden)').evaluate(headRect);
   check(`canonical-face-unchanged-${state}-${size}`,actual.every((x,i)=>Math.abs(x-reference[i])<.001));
   const svg=card.locator('[data-emma-backdrop]');
   const motion=await svg.evaluate(node=>{const animations=node.getAnimations({subtree:true});animations.forEach(a=>{a.pause();a.currentTime=0;});const before=getComputedStyle(node.querySelector('.eb-symbol')).transform;animations.forEach(a=>a.currentTime=2400);return before!==getComputedStyle(node.querySelector('.eb-symbol')).transform;});
   check(`background-symbols-move-${state}-${size}`,motion);
  }
  if(size===220)await page.locator('#comparisons').screenshot({path:out+'/comparison-220.png'});
 }
 await page.uncheck('#motion');check('background-motion-off',await page.locator('#comparisons').evaluate(n=>n.getAnimations({subtree:true}).length===0));
 await page.check('#motion');await page.emulateMedia({reducedMotion:'reduce'});check('os-reduction-stops-background',await page.locator('#comparisons').evaluate(n=>n.getAnimations({subtree:true}).length===0));await page.emulateMedia({reducedMotion:'no-preference'});
 await page.uncheck('#motion');await page.selectOption('#example',{label:'安心：ハート案'});
 await page.evaluate(()=>{window.frameLog=[];const root=document.getElementById('defaultEmma');window.frameProbe=new MutationObserver(()=>{const f=root.querySelector('[data-avatar-frame]:not(.hidden)');if(f)window.frameLog.push(f.dataset.avatarFrame);});frameProbe.observe(root,{subtree:true,attributes:true,attributeFilter:['class']});});
 await page.click('#play');await page.waitForSelector('.has-emma-background [data-emma-backdrop="calm"]');
 check('background-keeps-existing-face-visible',await page.locator(visibleFrame).evaluate(n=>getComputedStyle(n).visibility==='visible'));
 check('background-is-behind-face',await page.locator('[data-visual-cue-host]').evaluate(n=>getComputedStyle(n).zIndex==='-1'));
 check('background-static-while-speaking',await page.locator('[data-visual-cue-host]').evaluate(n=>n.getAnimations({subtree:true}).length===0));
 await page.selectOption('#mode','emma');check('baseline-comparison-has-no-background',await page.locator('.has-emma-background').count()===0);
 check('comparison-does-not-stop-mouth',await page.locator(visibleFrame).getAttribute('data-avatar-frame').then(x=>x.startsWith('emma-face-talk-')));
 await page.selectOption('#mode','visual');await page.waitForSelector('.has-emma-background');await page.screenshot({path:out+'/hearts-audio.png',fullPage:true});
 await page.waitForSelector('#play:not([disabled])',{timeout:15000});
 const frames=await page.evaluate(()=>{frameProbe.disconnect();return [...new Set(frameLog)];});
 check('real-audio-drives-small-medium-large-mouth',['small','medium','large'].every(x=>frames.some(f=>f.startsWith(`emma-face-talk-${x}`))),frames);
 check('blink-half-and-closed-preserved-during-audio',['half','closed'].every(x=>frames.some(f=>f.includes('-talk-')&&f.endsWith('-'+x+'.svg'))),frames);
 check('audio-end-keeps-background',await page.locator('.has-emma-background').count()===1);
  check('audio-end-restores-idle-mouth',(await page.locator(visibleFrame).getAttribute('data-avatar-frame')).startsWith('emma-face-idle-'));
 await page.check('#motion');await page.selectOption('#example',{label:'ほめる：星案'});await page.click('#play');await page.waitForSelector('.has-emma-background [data-emma-backdrop="celebrate"]');await page.screenshot({path:out+'/stars-audio.png',fullPage:true});await page.click('#stop');check('stop-removes-background',await page.locator('.has-emma-background').count()===0);
 await page.selectOption('#example',{label:'聞く（追加表現なし）'});await page.click('#play');await page.waitForFunction(()=>document.querySelector('#defaultEmma [data-avatar-frame]:not(.hidden)')?.dataset.avatarFrame.startsWith('emma-face-talk-'));check('listen-retains-baseline-without-extra-symbol',await page.locator('[data-visual-cue-host]:not([hidden])').count()===0);await page.click('#stop');
 await page.selectOption('#example',{label:'足のキック'});await page.click('#play');await page.waitForSelector('.has-visual-cue img[data-asset-id="kick"]');await page.click('#stop');check('accepted-artwork-still-switches-and-stops',await page.locator('.has-visual-cue').count()===0);
 await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForSelector('.comparison-card:nth-child(3)');check('mobile-no-overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:out+'/preview-mobile.png',fullPage:true});
 // The actual app retains its own original frame/blink/RMS code, not the preview helper.
 await context.addInitScript(()=>{localStorage.setItem('emma_web_setup_revision','moonshine-streaming-qwen3-prerecorded-1202-v11');localStorage.setItem('emma_web_tutorial_completed_v1','true');localStorage.setItem('emma_semantic_enabled','false');});
 await page.goto(base+'/index.html');await page.waitForSelector('#homeScreen:not(.hidden)');await page.click('#settingsButton');
 check('production-visual-cue-default-on',await page.locator('#visualCueEnabled').isChecked());
 check('production-motion-default-on',await page.locator('#visualCueMotion').isChecked()&&await page.locator('#visualCueMotion').isEnabled());
 await page.locator('#visualCueEnabled').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/app-visual-cue-settings-mobile.png',fullPage:false});
 await page.click('#settingsBackButton');
 await page.click('#playButton');await page.waitForSelector('.play-tap:not([disabled])',{timeout:120000});await page.click('.play-topic-change');await page.getByRole('button',{name:'泣く・ぐずぐず',exact:true}).click();await page.waitForSelector('.play-tap:not([disabled])');await page.getByRole('button',{name:'3文',exact:true}).click();await page.click('.play-tap');await page.waitForSelector('.play-avatar.has-emma-background');
 check('actual-app-calming-hearts-behind-canonical-face',await page.locator('.play-avatar .emma-face-frame [data-avatar-frame]:not(.hidden)').evaluate(n=>getComputedStyle(n).visibility==='visible'));
 check('actual-app-original-mouth-still-moving',await page.locator('.play-avatar [data-avatar-frame]:not(.hidden)').getAttribute('data-avatar-frame').then(x=>x.startsWith('emma-face-talk-')));
 check('actual-app-no-new-arms',await page.locator('#featureDialog [data-emma-gesture]').count()===0);await page.screenshot({path:out+'/app-calming-mobile.png',fullPage:true});
 await page.click('.play-topic-change');check('topic-change-cancels-background',await page.locator('.has-emma-background').count()===0);page.once('dialog',d=>d.accept());await page.click('#featureClose');
 await page.click('#settingsButton');await page.uncheck('#visualCueEnabled');await page.click('#settingsBackButton');await page.click('#playButton');await page.waitForSelector('.play-tap:not([disabled])');await page.click('.play-tap');await page.waitForSelector('.play-tap.is-speaking');check('baseline-mode-has-no-extra-visuals',await page.locator('.has-emma-background,.has-visual-cue').count()===0);page.once('dialog',d=>d.accept());await page.click('#featureClose');
 await page.reload();await page.waitForSelector('#homeScreen:not(.hidden)');await page.click('#settingsButton');
 check('production-opt-out-survives-reload',!await page.locator('#visualCueEnabled').isChecked());
 check('production-off-disables-motion-control',await page.locator('#visualCueMotion').isDisabled());
 await page.check('#visualCueEnabled');await page.uncheck('#visualCueMotion');await page.reload();await page.waitForSelector('#homeScreen:not(.hidden)');await page.click('#settingsButton');
 check('production-on-survives-reload',await page.locator('#visualCueEnabled').isChecked());
 check('production-independent-motion-preference',!await page.locator('#visualCueMotion').isChecked()&&await page.locator('#visualCueMotion').isEnabled());
 check('production-settings-mobile-no-overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.click('#settingsBackButton');await page.click('#playButton');await page.waitForSelector('.play-tap:not([disabled])');await page.click('.play-tap');await page.waitForSelector('.play-avatar.has-emma-background');
 check('production-motion-off-retains-static-cue',await page.locator('.play-avatar [data-emma-backdrop]').getAttribute('data-motion')==='off');
 page.once('dialog',d=>d.accept());await page.click('#featureClose');
 check('no-browser-errors',errors.length===0,errors);completed=true;
}catch(error){errors.push(error.message);throw error;}finally{
 await writeFile(out+'/browser-report.json',JSON.stringify({checks,errors,passed:completed&&checks.every(c=>c.pass)&&!errors.length},null,2)+'\n');await browser.close();
}
console.log(`Existing Emma + background: ${checks.length} browser checks PASS`);
