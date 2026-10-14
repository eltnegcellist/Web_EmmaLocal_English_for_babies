import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile,stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
// This fixture tests settings after setup; follow the current release revision.
const setupRevision=(await readFile(join(root,'src/app.js'),'utf8')).match(/const CURRENT_SETUP_REVISION = '([^']+)'/)?.[1];
assert(setupRevision,'Current app setup revision must exist');
const generated=join(root,'tests/generated/silero');await mkdir(generated,{recursive:true});
const cases=[];
for(const path of (process.env.VAD_TEST_MANIFESTS||'').split(',').filter(Boolean)){
 const manifest=JSON.parse(await readFile(path,'utf8')),benchmark=resolve(dirname(path),'..');
 for(const c of manifest.cases){const name=`${cases.length}.wav`;await copyFile(join(benchmark,c.path),join(generated,name));cases.push({...c,url:`/tests/generated/silero/${name}`});}
}
if(!cases.length){
 const wav=Buffer.alloc(44+16000*4*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
 await writeFile(join(generated,'silence.wav'),wav);cases.push({id:'silence',negative:true,url:'/tests/generated/silero/silence.wav'});
}
await writeFile(join(generated,'harness.html'),`<!doctype html><html><body>Silero test<script type="module">
import {SileroCaptureDetector} from '/src/silero-capture.js';
window.testReady=true;
window.replay=async url=>{
 const wav=await(await fetch(url)).arrayBuffer(),view=new DataView(wav);let pos=12,pcm;
 while(pos<wav.byteLength){const tag=String.fromCharCode(...new Uint8Array(wav,pos,4)),n=view.getUint32(pos+4,true);if(tag==='data'){pcm=Float32Array.from({length:n/2},(_,i)=>view.getInt16(pos+8+i*2,true)/32768);break;}pos+=8+n+(n%2);}
 const events=[];let failure;
 const detector=await SileroCaptureDetector.create({sampleRate:16000,onError:error=>failure=error.message,onResult:event=>{if(event.audio){const expected=pcm.slice(event.startSample,event.endSample);if(expected.length!==event.audio.length || expected.some((n,i)=>n!==event.audio[i]))throw Error('Captured PCM changed');events.push({event:event.event,start:event.startSample/16000,end:event.endSample/16000,samples:event.audio.length});}else events.push({event:event.event});}});
 try{for(let i=0;i<pcm.length;i+=128){detector.push(pcm.slice(i,i+128));while(detector.pending>0&&!detector.closed)await new Promise(resolve=>setTimeout(resolve,2));if(failure)throw Error(failure);}return events;}finally{detector.close();}
};
window.fallback=async()=>{
 const {EmmaMicrophone,AdaptiveEndpointDetector}=await import('/src/audio-capture.js');const input=new AudioContext(),destination=input.createMediaStreamDestination();navigator.mediaDevices.getUserMedia=async()=>destination.stream;
 const warnings=[],mic=new EmmaMicrophone({endpointMode:'silero',onWarning:s=>warnings.push(s)});
 try{await mic.start();return {legacy:mic.vad instanceof AdaptiveEndpointDetector,warnings};}finally{await mic.stop();await input.close();}
};
</script></body></html>`);
const server=createServer(async(req,res)=>{
 try{const file=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!file.startsWith(root+'/'))throw Error('outside');const path=(await stat(file)).isDirectory()?join(file,'index.html'):file;
 const data=await readFile(path);const type=path.endsWith('.wasm')?'application/wasm':/\.(js|mjs)$/.test(path)?'text/javascript':path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.png')?'image/png':path.endsWith('.json')?'application/json':'application/octet-stream';
 res.writeHead(200,{'Content-Type':type,'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cache-Control':'public, max-age=3600'});res.end(data);
 }catch{res.writeHead(404);res.end('missing');}
});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.VAD_BROWSER_CHANNEL||'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const results={scope:'Actual WASM model, raw waveform retention, rollback and model failure; no ASR accuracy claims',cases:[]};
try{
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/tests/generated/silero/harness.html');await page.waitForFunction(()=>window.testReady);
 for(const c of cases){
  const events=await page.evaluate(url=>window.replay(url),c.url);if(c.negative)assert.equal(events.length,0,c.id+' background must not trigger speech');else {assert(events.some(e=>e.event==='speech-start'),c.id+' must start speech');assert(events.some(e=>e.event==='utterance'),c.id+' must end speech');}
  results.cases.push({id:c.id,negative:c.negative,events});console.log(c.id,JSON.stringify(events));
 }
 assert.deepEqual(errors,[]);
 const failed=await browser.newContext({serviceWorkers:'block'});await failed.route('**/assets/vad/silero_vad.onnx',route=>route.fulfill({status:404,body:'missing'}));const fp=await failed.newPage();await fp.goto(base+'/tests/generated/silero/harness.html');await fp.waitForFunction(()=>window.testReady);
 results.missingModelFallback=await fp.evaluate(()=>window.fallback());assert(results.missingModelFallback.legacy);assert.equal(results.missingModelFallback.warnings.length,1);await failed.close();
 await context.addInitScript(revision=>{localStorage.setItem('emma_web_setup_revision',revision);localStorage.setItem('emma_web_tutorial_completed_v1','true');localStorage.setItem('emma_semantic_enabled','false');sessionStorage.setItem('emma_asr_reload','small');},setupRevision);
 await page.goto(base+'/index.html');await page.locator('#settingsButton').click();await page.locator('#endpointMode').selectOption('legacy');assert.equal(await page.evaluate(()=>localStorage.getItem('emma_endpoint_mode')),'legacy');
 await page.locator('#endpointMode').scrollIntoViewIfNeeded();await page.screenshot({path:join(generated,'settings-legacy.png')});await page.reload();await page.locator('#settingsButton').click();assert.equal(await page.locator('#endpointMode').inputValue(),'legacy');
 await page.locator('#endpointMode').selectOption('silero');assert.equal(await page.evaluate(()=>localStorage.getItem('emma_endpoint_mode')),'silero');assert.equal(await page.locator('#asrModel').inputValue(),'small');
 await page.locator('#endpointMode').scrollIntoViewIfNeeded();await page.screenshot({path:join(generated,'settings-silero.png')});results.settingsPersisted=true;results.asrUnchanged=true;results.pageErrors=errors;assert.deepEqual(errors,[]);
 await writeFile(join(generated,'results.json'),JSON.stringify(results,null,2)+'\n');console.log('Actual WASM inference, exact raw PCM, missing-model fallback and persisted settings: OK');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
