// Generate real Kiki FP32 WAV files on a GitHub CI runner to make listening
// review reproducible. External model loading is experimental/non-gating.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {dirname,extname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const output=join(root,'.kiki-review');
await mkdir(output,{recursive:true});
const manifest=JSON.parse(await readFile(join(root,'tests/kiki-ab-manifest.json'),'utf8'));
const cases=[
  {id:'milk-invite',version:'A',mode:'legacy'},
  {id:'milk-invite',version:'B',mode:'legacy'},
  {id:'milk-invite',version:'B',mode:'preserve'},
  {id:'cry-care',version:'A',mode:'legacy'},
  {id:'cry-care',version:'B',mode:'legacy'},
  {id:'finish-check',version:'B',mode:'preserve'},
];
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{
 try{
  const uri=new URL(req.url,'http://localhost');
  const fp=resolve(root,'.'+decodeURIComponent(uri.pathname));
  if(!fp.startsWith(root+sep))throw Error('out of root');
  if(!(await stat(fp)).isFile())throw Error('not file');
  res.writeHead(200,{'Content-Type':mime[extname(fp)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(await readFile(fp));
 }catch(err){res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:390,height:844}});
page.setDefaultTimeout(10*60*1000);
const problems=[],results=[];
page.on('pageerror',e=>problems.push('page: '+e.message));
page.on('console',m=>{if(m.type()==='error')problems.push('console: '+m.text())});
try{
 await page.goto(base+'/kiki-rhythm-review.html');
 await page.waitForFunction(()=>!!window.__kikiABReview);
 console.log('KIKI_REVIEW loading Kiki model');
 await page.evaluate(()=>window.__kikiABReview.initialize());
 console.log('KIKI_REVIEW model ready');
 for(const c of cases){
  console.log('KIKI_REVIEW synthesizing '+c.id+' '+c.version+' '+c.mode);
  const b64=await page.evaluate(async c=>{
    const wav=await window.__kikiABReview.render(c.id,c.version,c.mode);
    const data=new Uint8Array(await wav.arrayBuffer());
    let raw='';
    for(let i=0;i<data.length;i+=8192)raw+=String.fromCharCode(...data.subarray(i,i+8192));
    return btoa(raw);
  },c);
  const data=Buffer.from(b64,'base64');
  assert.equal(data.toString('ascii',0,4),'RIFF');
  assert.equal(data.toString('ascii',8,12),'WAVE');
  assert.equal(data.readUInt32LE(24),24000);
  assert(data.byteLength>48000,'empty or very short audio');
  const samples=(data.length-44)/2, seconds=samples/24000;
  let square=0,peak=0,nonzero=0;
  for(let i=44;i<data.length;i+=2){
   const sample=data.readInt16LE(i)/32768;
   square+=sample*sample;peak=Math.max(peak,Math.abs(sample));
   if(Math.abs(sample)>0.005)nonzero++;
  }
  const rms=Math.sqrt(square/samples),nonzeroRatio=nonzero/samples;
  assert(rms>0.0001,'near silent output');
  const name=c.id+'-'+c.version+'-'+c.mode+'.wav';
  await writeFile(join(output,name),data);
  results.push({...c,filename:name,seconds:Number(seconds.toFixed(3)),peak:Number(peak.toFixed(4)),rms:Number(rms.toFixed(4)),activeRatio:Number(nonzeroRatio.toFixed(4))});
 }
 await writeFile(join(output,'kiki-generation-results.json'),JSON.stringify({schemaVersion:1,model:manifest.model,voice:manifest.voice,requestedSpeed:manifest.speed,punctuationExperiment:true,interpretation:'Waveform existence and simple signal metrics only. Human judgment of prosody remains necessary.',createdAt:new Date().toISOString(),samples:results,errors:problems},null,2)+'\n');
 console.log('KIKI_REAL_AUDIO_SUCCESS '+JSON.stringify({files:results.length,results}));
}finally{
 await browser.close();await new Promise(resolve=>server.close(resolve));
}
