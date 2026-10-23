import assert from 'node:assert/strict';
import {chromium} from 'playwright';

function pcmWav(seconds=1.6,rate=16000){
 const samples=Math.floor(seconds*rate),data=Buffer.alloc(44+samples*2);
 data.write('RIFF',0);data.writeUInt32LE(36+samples*2,4);
 data.write('WAVE',8);data.write('fmt ',12);data.writeUInt32LE(16,16);
 data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);
 data.writeUInt32LE(rate,24);data.writeUInt32LE(rate*2,28);
 data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);
 data.write('data',36);data.writeUInt32LE(samples*2,40);
 // Silence is deliberate; validate inference plumbing, not ASR accuracy.
 return data;
}
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/asr-alternatives-benchmark.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.crossOriginIsolated&&
  document.getElementById('load')&&!document.getElementById('load').disabled,
  undefined,{timeout:60000});
 await page.selectOption('#language','de');
 await page.selectOption('#arch','TinyStreaming');
 await page.click('#load');
 await page.waitForFunction(()=>document.getElementById('status').textContent.includes('準備完了')||
  document.getElementById('status').textContent.includes('エラー'),
  undefined,{timeout:300000});
 const modelStatus=await page.locator('#status').textContent();
 assert.match(modelStatus,/準備完了/,'German TinyStreaming load: '+modelStatus);
 await page.locator('#file').setInputFiles({name:'1.6sec-silence.wav',mimeType:'audio/wav',buffer:pcmWav()});
 await page.waitForFunction(()=>document.getElementById('status').textContent.includes('ファイル準備完了')||
  document.getElementById('status').textContent.includes('エラー'),
  undefined,{timeout:45000});
 const fileStatus=await page.locator('#status').textContent();
 assert.match(fileStatus,/ファイル準備完了/,fileStatus);
 await page.click('#transcribe');
 await page.waitForFunction(()=>document.getElementById('report').textContent.length>0||
  document.getElementById('status').textContent.includes('エラー'),
  undefined,{timeout:240000});
 const raw=await page.locator('#report').textContent();
 assert(raw,'ASR must emit report: '+await page.locator('#status').textContent());
 const result=JSON.parse(raw);
 assert.equal(result.language,'de');
 assert.equal(result.arch,'TinyStreaming');
 assert.equal(result.mode,'file');
 assert(result.inferenceMs>0,'inferenceMs missing');
 assert(Math.abs(result.audioSeconds-1.6)<.02,'audio duration mismatch');
 assert.deepEqual(errors,[]);
 console.log('PASS German MIT Moonshine TinyStreaming downloaded, loaded and native WASM inference completed:',JSON.stringify({
  loadMs:result.modelLoadMs,inferenceMs:result.inferenceMs,
  rtf:result.rtFactor,audioSeconds:result.audioSeconds,transcript:result.transcript
 }));
}finally{await browser.close();}
