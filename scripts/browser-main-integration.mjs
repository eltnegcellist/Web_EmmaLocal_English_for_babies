import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

// Run against a local isolated server or the deployed product. No microphone or
// recognition models are used: this checks real UI, recorded AAC and artwork.
const base=process.env.MAIN_TEST_URL;
assert(base,'Set MAIN_TEST_URL to the application root URL');
const output=new URL('../tests/generated/main-integration/',import.meta.url);
await mkdir(output,{recursive:true});
const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const revision=source.match(/const CURRENT_SETUP_REVISION = '([^']+)'/)[1];
const build=source.match(/const WEB_BUILD = '([^']+)'/)[1];
const browser=await chromium.launch({headless:true});
const report={passed:false,locales:[],playback:null};
try{
 for(const locale of ['ja-JP','en-US','de-DE','fr-FR','ko-KR','th-TH']){
  const context=await browser.newContext({locale,viewport:{width:390,height:844}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);
  await page.locator('#onboardingScreen:not(.hidden)').waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'),locale.slice(0,2));
  assert.equal(await page.locator('#onboardingLanguage').inputValue(),'auto');
  assert.equal(await page.locator('#homeLanguage,#explanationLanguage').count(),0);
  await page.evaluate(revision=>{
   localStorage.setItem('emma_web_setup_revision',revision);
   localStorage.setItem('emma_web_tutorial_completed_v1','true');
   localStorage.setItem('emma_semantic_enabled','false');
   localStorage.setItem('mitsukotoba_explanation_language_v1','zh');
  },revision);
  await page.reload();
  await page.locator('#homeScreen:not(.hidden)').waitFor();
  await page.click('#settingsButton');
  assert.equal(await page.locator('#webBuild').textContent(),`Web build: ${build}`);
  await page.locator('#settingsLanguage').scrollIntoViewIfNeeded();
  assert(await page.evaluate(()=>document.querySelector('#settingsScreen .settings-content').lastElementChild.matches('.language-settings')));
  assert.equal(await page.locator('#settingsLanguage').inputValue(),'auto');
  assert.equal(await page.locator('#visualCueEnabled').isChecked(),true);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:new URL(`settings-${locale}.png`,output).pathname});
  await page.uncheck('#visualCueEnabled');
  await page.reload();await page.click('#settingsButton');
  assert.equal(await page.locator('#visualCueEnabled').isChecked(),false);
  await page.check('#visualCueEnabled');
  await page.click('#settingsBackButton');
  await page.locator('#homeScreen:not(.hidden)').waitFor();
  if(locale==='ja-JP'){
   // Play the actual approved face-visible hug with its recorded English.
   await page.click('#playButton');
   await page.locator('.play-tap:not([disabled])').waitFor();
   await page.click('.play-topic-change');
   await page.getByRole('button',{name:'抱っこ・ぎゅー',exact:true}).click();
   await page.getByRole('button',{name:'3文',exact:true}).click();
   await page.locator('.play-tap:not([disabled])').click();
   await page.locator('.play-tap.is-speaking img[data-asset-id="hug-face-cuddle"]').waitFor();
   assert((await page.locator('.play-avatar img[data-asset-id="hug-face-cuddle"]').getAttribute('src')).endsWith('.webp'));
   await page.screenshot({path:new URL('hug-playing.png',output).pathname});
   await page.locator('.play-tap:not(.is-speaking):not([disabled])').waitFor();
   assert(!await page.locator('.play-english-text').textContent().then(text=>text.includes('再生できません')));
   assert(await page.evaluate(async()=>{
    for(const name of await caches.keys()){
     const cache=await caches.open(name);
     const clip=(await cache.keys()).find(request=>/voice-1202\/clips\/.*\.m4a/.test(request.url));
     if(clip&&((await (await cache.match(clip)).arrayBuffer()).byteLength>0))return true;
    }
    return false;
   }),'The real recorded AAC must have been downloaded and cached');
   report.playback='Recorded AAC and approved animated hug completed';
  }
  assert.deepEqual(errors,[]);
  report.locales.push({locale,passed:true});await context.close();
 }
 report.passed=true;
 console.log('PASS: six-language first run, Settings placement, persisted illustration switch, navigation, AAC and animated hug.');
}finally{
 await writeFile(new URL('report.json',output),JSON.stringify(report,null,2)+'\n');
 await browser.close();
}
