import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.VISUAL_CUE_LIVE_URL;assert(base,'Set VISUAL_CUE_LIVE_URL');
const out='assets/visual-cue/live-app-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
await context.addInitScript(()=>{Math.random=()=>0;window.originalStore=localStorage;localStorage.setItem('emma_visual_cue_enabled','false');});
const page=await context.newPage(),errors=[],checks=[];let passed=false;
page.on('pageerror',e=>errors.push(e.message));
const check=(name,value)=>{checks.push({name,pass:!!value});assert(value,name);};
try{
 await page.goto(base);await page.waitForSelector('#onboardingScreen:not(.hidden)');
 check('normal-first-run-screen',await page.locator('#prepareEmmaButton').isVisible());
 check('no-trial-panels-or-entry-flag',await page.locator('#trialPanel,.trial-banner').count()===0&&await page.locator('html').getAttribute('data-visual-cue-trial')===null);
 check('default-visual-cue-on',await page.locator('#visualCueEnabled').isChecked());
 check('production-opt-out-not-overwritten',await page.evaluate(()=>localStorage.getItem('emma_visual_cue_enabled')==='true'&&originalStore.getItem('emma_visual_cue_enabled')==='false'));
 await page.evaluate(()=>Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Service Worker activation timed out')),20000))]));await page.reload();await page.waitForSelector('#onboardingScreen:not(.hidden)');
 check('service-worker-controls-full-app',await page.evaluate(()=>navigator.serviceWorker.controller!==null));
 check('asr-isolation-headers-and-shared-buffer',await page.evaluate(()=>crossOriginIsolated&&typeof SharedArrayBuffer==='function'));
 await page.screenshot({path:out+'/onboarding-mobile.png',fullPage:false});
 // Returning-user state for playback/settings checks only; the published app
 // above must show real onboarding and never write these flags automatically.
 await page.evaluate(()=>{localStorage.setItem('emma_web_setup_revision','moonshine-streaming-qwen3-prerecorded-1202-v11');localStorage.setItem('emma_web_tutorial_completed_v1','true');localStorage.setItem('emma_semantic_enabled','false');});
 await page.reload();await page.waitForSelector('#homeScreen:not(.hidden)');
 check('normal-returning-home-without-preview-panel',await page.locator('#trialPanel').count()===0);
 await page.click('#settingsButton');await page.locator('#visualCueEnabled').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/settings-mobile.png',fullPage:false});
 await page.uncheck('#visualCueEnabled');await page.reload();await page.waitForSelector('#homeScreen:not(.hidden)');await page.click('#settingsButton');
 check('off-persists-in-real-app',!await page.locator('#visualCueEnabled').isChecked());
 await page.check('#visualCueEnabled');await page.click('#settingsBackButton');await page.waitForSelector('#homeScreen:not(.hidden)');
 check('back-from-settings-after-reload',true);
 await page.click('#playButton');await page.waitForSelector('.play-tap:not([disabled])',{timeout:120000});await page.click('.play-topic-change');await page.getByRole('button',{name:'抱っこ・ぎゅー',exact:true}).click();await page.getByRole('button',{name:'3文',exact:true}).click();await page.waitForSelector('.play-tap:not([disabled])');await page.click('.play-tap');
 await page.waitForSelector('.play-avatar img[data-asset-id="hug-face-cuddle"]');
 check('real-audio-displays-face-hug-animation',await page.locator('.play-tap.is-speaking').count()===1);
 await page.screenshot({path:out+'/hug-playing-mobile.png',fullPage:false});
 check('mobile-no-overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 check('no-browser-errors',errors.length===0);passed=true;
}finally{await writeFile(out+'/browser-report.json',JSON.stringify({passed,checks,errors},null,2)+'\n');await browser.close();}
console.log(`Full application: ${checks.length} browser checks PASS`);
