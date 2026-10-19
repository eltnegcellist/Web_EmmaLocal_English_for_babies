/** Animate only the connected supporting arms; the approved PNG remains unchanged. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const root='assets/visual-cue/prototypes/hug-face',out='assets/visual-cue/motion-variants';
await mkdir(root+'/frames',{recursive:true});await mkdir(out,{recursive:true});
const png=await readFile(root+'/hug-face-v1.png'),image='data:image/png;base64,'+png.toString('base64');
// A smooth displacement field acts on the forearm/hand regions only. The faces,
// shoulders, necks and upper torso are rendered once outside this field.
const map=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><defs><radialGradient id="back"><stop stop-color="rgb(80%,66%,50%)"/><stop offset="1" stop-color="rgb(50%,50%,50%)" stop-opacity="0"/></radialGradient><radialGradient id="support"><stop stop-color="rgb(70%,69%,50%)"/><stop offset="1" stop-color="rgb(50%,50%,50%)" stop-opacity="0"/></radialGradient></defs><rect width="512" height="512" fill="rgb(50%,50%,50%)"/><ellipse cx="365" cy="346" rx="67" ry="59" fill="url(#back)"/><ellipse cx="343" cy="428" rx="82" ry="49" fill="url(#support)"/></svg>`;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><image id="original" width="512" height="512" href="${image}"/><clipPath id="fixed"><path d="M0 0H512V512H0Z M235 286V492H465V286Z" clip-rule="evenodd"/></clipPath><clipPath id="arms"><rect x="235" y="286" width="230" height="206"/></clipPath><filter id="cuddle" x="0" y="0" width="512" height="512" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feImage href="data:image/svg+xml;base64,${Buffer.from(map).toString('base64')}" x="0" y="0" width="512" height="512" result="field"/><feDisplacementMap in="SourceGraphic" in2="field" scale="0" xChannelSelector="R" yChannelSelector="G"><animate attributeName="scale" dur="3.2s" repeatCount="indefinite" values="0;40;40;0;0" keyTimes="0;.34;.50;.84;1" calcMode="spline" keySplines=".42 0 .58 1;0 0 1 1;.42 0 .58 1;0 0 1 1"/></feDisplacementMap></filter></defs><use href="#original" clip-path="url(#fixed)"/><g clip-path="url(#arms)"><use href="#original" filter="url(#cuddle)"/></g></svg>`;
await writeFile(root+'/hug-face-motion-source.svg',svg.replace(image,'hug-face-v1.png')+'\n');
const browser=await chromium.launch({headless:true,executablePath:process.env.VISUAL_CUE_CHROME_EXECUTABLE||undefined});
try{
 const page=await browser.newPage({viewport:{width:512,height:512},deviceScaleFactor:1});
 await page.setContent('<style>html,body{margin:0;background:transparent}</style>'+svg);
 await page.evaluate(async()=>{const i=new Image();i.src=document.querySelector('image').getAttribute('href');await i.decode();document.querySelector('svg').pauseAnimations();});
 for(let f=0;f<40;f++){
  await page.evaluate(t=>document.querySelector('svg').setCurrentTime(t),f*.08);
  await page.screenshot({path:root+'/frames/'+String(f).padStart(2,'0')+'.png',omitBackground:true,animations:'allow'});
 }
 await writeFile(root+'/motion-render.json',JSON.stringify({frameCount:40,frameMs:80,loopMs:3200,sourceSHA256:createHash('sha256').update(png).digest('hex'),movingParts:['connected forearm and hand across child back','connected lower supporting forearm and hand'],fixedParts:['both faces','heads and necks','shoulders','upper torso'],method:'SVG local displacement rendered in Chromium; no whole-image sway'},null,2)+'\n');
}finally{await browser.close();}
console.log('Hug face: 40 frames rendered. Encode with encode_hug_face_motion.py.');
