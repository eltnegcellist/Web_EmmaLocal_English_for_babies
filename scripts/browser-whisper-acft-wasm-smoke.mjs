// Experimental headless-browser smoke: no user audio and no 264MB model.
// Ensures compiled whisper.cpp WASM starts with COOP/COEP and exposes API.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const origin=process.env.ACFT_CPP_TEST_ORIGIN||'http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/whisper-acft-cached-benchmark.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>
    window.crossOriginIsolated && typeof window.Module?.acft_init==='function' &&
    typeof window.Module?.acft_run==='function' &&
    typeof window.Module?.acft_status==='function' &&
    typeof window.Module?.acft_result==='function' &&
    typeof window.Module?.acft_timings==='function',
    {timeout:120000});
  const actual=await page.evaluate(()=>({
    isolated:window.crossOriginIsolated,
    sharedArrayBuffer:typeof SharedArrayBuffer,
    modelFileField:!!document.getElementById('modelFile'),
    audioFileField:!!document.getElementById('audioFile'),
    timeWindowField:!!document.getElementById('window'),
    build:document.getElementById('build').textContent,
    wasmReady:document.getElementById('status').textContent
  }));
  assert.equal(actual.isolated,true);
  assert.equal(actual.sharedArrayBuffer,'function');
  assert(actual.modelFileField&&actual.audioFileField&&actual.timeWindowField);
  assert.match(actual.build,/acft-cpp-encoder-profile-v2/);
  assert.match(actual.wasmReady,/WASM起動完了/);
  assert.deepEqual(errors,[]);
  console.log('PASS: native whisper.cpp WASM runtime initialized in COI Chromium:',JSON.stringify(actual));
}finally{await browser.close();}
