import {createVisualCueController} from './visual-cue-controller.js?v=20261020-visual-cue-default-on-v1';
import {createEmmaBackground} from './emma-background-cues.js?v=20261020-visual-cue-default-on-v1';
import {loadEmmaFrames,createEmmaPreviewMotion} from './emma-preview-motion.js?v=20261020-visual-cue-default-on-v1';
const $=id=>document.getElementById(id);
const examples=await fetch('./shared/visual-cue-ui-examples.json?v=20261020-visual-cue-default-on-v1').then(r=>r.json());
await loadEmmaFrames($('defaultEmma'));
const emma=createEmmaPreviewMotion($('defaultEmma'));
const labels={neutral:'待機（通常のEmma）',smile:'にっこり（通常のEmma）',calm:'安心：ハート案',celebrate:'ほめる：星案',listen:'聞く（追加表現なし）',ask:'たずねる（追加表現なし）',invite:'誘う（追加表現なし）'};
const assetLabels={milk:'ミルク',kick:'足のキック',page:'絵本：ページめくり','hand-wave':'手を振る',book:'絵本',cup:'コップ（静止画）',sleep:'眠る場面',toy:'おもちゃ','diaper-v2':'おむつ'};
for(const [key,label] of [['baseline','現在のEmma'],['calm','安心：ハート案'],['celebrate','ほめる：星案']]){
 const card=document.createElement('div');card.className='comparison-card';card.dataset.exampleState=key;
 const avatar=document.createElement('div');avatar.className='avatar';
 const face=document.createElement('div');face.className='emma-face-frame';avatar.append(face);
 const background=createEmmaBackground(key);if(background){const layer=document.createElement('div');layer.className='comparison-background';layer.append(background);avatar.prepend(layer);}
 card.append(avatar);const text=document.createElement('strong');text.textContent=label;card.append(text);$('comparisons').append(card);
 await loadEmmaFrames(face);createEmmaPreviewMotion(face);
}
for(const [index,e] of examples.entries()){
 const option=document.createElement('option');option.value=index;const state=e.label.startsWith('Emma / ')?e.label.slice(7):null;
 option.textContent=state?labels[state]:(assetLabels[e.label]||e.label);if(state)option.dataset.cueState=state;$('example').append(option);
}
$('example').selectedIndex=examples.findIndex(e=>e.label==='Emma / calm');
let source=null,audioContext=null,epoch=0;
const cue=createVisualCueController({onChange:p=>{$('status').textContent=p?(p.type==='emma'?(p.state==='calm'?'いつものEmma ＋ ハート':p.state==='celebrate'?'いつものEmma ＋ 星':'いつものEmma'):'英語に合うイラスト'):'いつものEmma';}});
function configure(){cue.configure({mode:$('mode').value,motion:$('motion').checked});for(const svg of document.querySelectorAll('#comparisons [data-emma-backdrop]'))svg.dataset.motion=$('motion').checked?'on':'off';}
function stop(){epoch++;const playing=source;source=null;if(playing)try{playing.stop();}catch{}emma.stop();cue.stop();$('play').disabled=false;}
function select(){stop();$('english').textContent=examples[Number($('example').value)].text;}
$('mode').addEventListener('change',configure);$('motion').addEventListener('change',configure);$('example').addEventListener('change',select);$('stop').addEventListener('click',stop);
$('play').addEventListener('click',async()=>{
 stop();const run=epoch,e=examples[Number($('example').value)];$('play').disabled=true;
 try{
  audioContext ||= new AudioContext({latencyHint:'interactive'});await audioContext.resume();
  const response=await fetch(new URL('../'+e.audio,import.meta.url));if(!response.ok)throw Error('音声を読み込めません');
  const decoded=await audioContext.decodeAudioData(await response.arrayBuffer());if(run!==epoch)return;
  const playing=audioContext.createBufferSource(),analyser=audioContext.createAnalyser();analyser.fftSize=256;
  playing.buffer=decoded;playing.connect(analyser).connect(audioContext.destination);source=playing;
  let token;playing.onended=()=>{if(run!==epoch)return;source=null;emma.stop();cue.end(token);$('play').disabled=false;};
  cue.preload(e.text);playing.start();emma.speak(analyser);token=cue.begin(e.text);
 }catch{if(run===epoch){stop();$('status').textContent='再生できませんでした。通信を確認して、もう一度押してください';}}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});configure();select();
