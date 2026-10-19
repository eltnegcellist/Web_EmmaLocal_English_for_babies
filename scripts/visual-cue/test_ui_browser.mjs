import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const base=process.env.VISUAL_CUE_UI_BASE||'http://127.0.0.1:8781';
const out='assets/emma-gestures/qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.VISUAL_CUE_CHROME_EXECUTABLE?{executablePath:process.env.VISUAL_CUE_CHROME_EXECUTABLE}:{})});
let completed=false;const checks=[],errors=[];const check=(name,ok,detail)=>{checks.push({name,pass:!!ok,...(detail?{detail}:{})});assert(ok,name);};
const context=await browser.newContext({viewport:{width:1200,height:1100},serviceWorkers:'block'});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base+'/visual-cue-ui-preview.html');await page.waitForSelector('.gesture:nth-child(7) svg');
 for(const size of [220,256,320]){
  await page.addStyleTag({content:`.gestures{grid-template-columns:repeat(3,${size}px)}.gesture{padding:0;width:${size}px}.gesture svg{max-width:none;width:${size}px;height:${size}px}`});
  await page.evaluate(()=>document.getAnimations().forEach(a=>{a.pause();a.currentTime=0;}));
  const phases={};
  for(const svg of await page.locator('.gesture svg').all()){
   const key=await svg.getAttribute('data-emma-gesture');const before=await svg.screenshot();
   await svg.evaluate(node=>node.getAnimations({subtree:true}).forEach(a=>a.currentTime=Number(a.effect.getTiming().duration)/2));
   const after=await svg.screenshot();check(`gesture-${key}-moves-${size}`,createHash('sha256').update(before).digest('hex')!==createHash('sha256').update(after).digest('hex'));
   phases[key]=await svg.evaluate(node=>[...node.querySelectorAll('.eg-arm')].map(a=>getComputedStyle(a).transform));
   const fits=await svg.evaluate(node=>{const b=node.getBoundingClientRect();return [...node.querySelectorAll('.eg-arm')].every(a=>{const r=a.getBoundingClientRect();return r.left>=b.left-1&&r.right<=b.right+1&&r.top>=b.top-1&&r.bottom<=b.bottom+1;});});check(`gesture-${key}-unclipped-${size}`,fits);
  }
  check(`seven-distinct-poses-${size}`,new Set(Object.values(phases).map(x=>x.join('|'))).size===7);
  if(size===220)await page.locator('#gestures').screenshot({path:out+'/seven-gestures-220.png'});
 }
 await page.uncheck('#motion');check('motion-setting-stops-all-seven',await page.locator('#gestures').evaluate(n=>n.getAnimations({subtree:true}).length===0));
 await page.check('#motion');await page.emulateMedia({reducedMotion:'reduce'});check('os-reduction-stops-all-seven',await page.locator('#gestures').evaluate(n=>n.getAnimations({subtree:true}).length===0));await page.emulateMedia({reducedMotion:'no-preference'});
 await page.selectOption('#example',{label:'kick'});await page.click('#play');await page.waitForSelector('.has-visual-cue img');check('recorded-audio-starts-kick',await page.locator('.has-visual-cue img').getAttribute('data-asset-id')==='kick');
 await page.click('#stop');check('preview-stop-restores-emma',await page.locator('.has-visual-cue').count()===0);
 await page.selectOption('#example',{label:'Emma / listen'});await page.click('#play');await page.waitForSelector('.has-visual-cue [data-emma-gesture="listen"]');await page.waitForSelector('#play:not([disabled])',{timeout:15000});check('actual-audio-end-restores-emma',await page.locator('.has-visual-cue').count()===0);
 await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForSelector('.gesture:nth-child(7)');check('preview-mobile-no-overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:out+'/ui-mobile.png',fullPage:true});
 // Exercise the actual app and its actual recorded bank/worker; no ASR/model mock.
 await context.addInitScript(()=>{localStorage.setItem('emma_web_setup_revision','moonshine-streaming-qwen3-prerecorded-1202-v11');localStorage.setItem('emma_web_tutorial_completed_v1','true');localStorage.setItem('emma_semantic_enabled','false');});
 await page.goto(base+'/index.html');await page.waitForSelector('#homeScreen:not(.hidden)');
 await page.click('#settingsButton');await page.selectOption('#visualCueMode','visual');await page.uncheck('#visualCueMotion');await page.check('#visualCueMotion');await page.click('#settingsBackButton');
 check('setting-persists',await page.evaluate(()=>localStorage.getItem('emma_visual_cue_mode')==='visual'));
 await page.click('#playButton');await page.waitForSelector('.play-tap:not([disabled])',{timeout:120000});await page.click('.play-tap');await page.waitForSelector('.play-avatar.has-visual-cue',{timeout:15000});
 check('actual-play-avatar-uses-cue',await page.locator('.play-avatar .visual-cue-host:not([hidden])').count()===1);await page.screenshot({path:out+'/app-play-mobile.png',fullPage:true});
 await page.waitForSelector('.play-tap:not([disabled])',{timeout:15000});check('actual-play-end-restores-face',await page.locator('.has-visual-cue').count()===0);
 await page.getByRole('button',{name:'3文',exact:true}).click();await page.click('.play-tap');await page.waitForSelector('.play-avatar.has-visual-cue');await page.click('.play-topic-change');await page.waitForSelector('.play-avatar',{state:'detached'});check('topic-change-cancels-cue',await page.locator('.has-visual-cue').count()===0);
 page.once('dialog',d=>d.accept());await page.click('#featureClose');
 await page.click('#settingsButton');check('visual-setting-survives-navigation',await page.locator('#visualCueMode').inputValue()==='visual');await page.selectOption('#visualCueMode','emma');await page.click('#settingsBackButton');
 await page.click('#playButton');await page.waitForSelector('.play-tap:not([disabled])');await page.click('.play-tap');await page.waitForSelector('.play-tap.is-speaking');check('emma-mode-keeps-original-face',await page.locator('.has-visual-cue').count()===0);page.once('dialog',d=>d.accept());await page.click('#featureClose');
 await page.click('#settingsButton');await page.selectOption('#visualCueMode','visual');await page.click('#settingsBackButton');
 // Typed-input debug path uses the real reply engine, TTS worker and AudioContext.
 await page.evaluate(()=>{document.getElementById('debugInput').value='ミルクを飲もうね';document.getElementById('debugReplyButton').click();});
 await page.waitForSelector('#avatar.has-visual-cue',{timeout:15000});check('actual-home-audio-uses-cue',await page.locator('#avatar .visual-cue-host:not([hidden])').count()===1);await page.screenshot({path:out+'/app-home-mobile.png',fullPage:true});
 await page.waitForFunction(()=>!document.getElementById('avatar').classList.contains('has-visual-cue'),{timeout:15000});check('home-audio-end-restores-face',await page.locator('#avatar.has-visual-cue').count()===0);
 await page.evaluate(async()=>{const {ConversationHistory,createHistoryEntry}=await import('./src/conversation-history.js');const history=new ConversationHistory();await history.append(createHistoryEntry('visual-cue-browser-test','絵本を見よう','Book time!','book'));});
 await page.click('#settingsButton');await page.click('#historyButton');await page.waitForSelector('.history-replay');await page.click('.history-replay');await page.waitForSelector('#avatar.has-visual-cue',{state:'attached'});await page.click('#featureClose');check('history-close-cancels-cue',await page.locator('.has-visual-cue').count()===0);
 check('history-replay-does-not-duplicate-entry',await page.evaluate(async()=>{const {ConversationHistory}=await import('./src/conversation-history.js');return(await new ConversationHistory().list()).length===1;}));
 check('no-browser-exceptions',errors.length===0,errors);completed=true;
}catch(error){errors.push(error.message);throw error;}finally{
 await writeFile(out+'/browser-report.json',JSON.stringify({checks,errors,passed:completed&&checks.every(c=>c.pass)&&errors.length===0},null,2)+'\n');await browser.close();
}
console.log(`Visual Cue browser: ${checks.length} checks PASS`);
