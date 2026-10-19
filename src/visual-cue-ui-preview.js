import {createVisualCueController} from './visual-cue-controller.js?v=20261019-bust-v2';
import {createEmmaGesture} from './emma-gestures.js?v=20261019-bust-v2';
const $=id=>document.getElementById(id);
const examples=await fetch('./shared/visual-cue-ui-examples.json').then(r=>r.json());
$('defaultEmma').innerHTML=await fetch('./assets/emma-face/emma-face-idle-open.svg').then(r=>r.text());
const labels={neutral:'待機',smile:'にっこり',calm:'安心させる',celebrate:'ほめる',listen:'聞く',ask:'たずねる',invite:'誘う'};
for(const [key,label] of Object.entries(labels)){const card=document.createElement('div');card.className='gesture';card.append(createEmmaGesture(key));const text=document.createElement('span');text.textContent=label;card.append(text);$('gestures').append(card);}
for(const [index,e] of examples.entries()){const option=document.createElement('option');option.value=index;option.textContent=e.label;$('example').append(option);}
let audio=null,epoch=0;
const cue=createVisualCueController({onChange:p=>{$('status').textContent=p?'英語を再生中 · '+(p.type==='emma'?'Emmaの身振り':p.assetId):'Emmaを表示中';}});
function configure(){cue.configure({mode:$('mode').value,motion:$('motion').checked});for(const svg of document.querySelectorAll('#gestures svg'))svg.dataset.motion=$('motion').checked?'on':'off';}
function stop(){epoch++;if(audio){audio.pause();audio.src='';audio=null;}cue.stop();$('play').disabled=false;}
function select(){stop();$('english').textContent=examples[Number($('example').value)].text;}
$('mode').addEventListener('change',configure);$('motion').addEventListener('change',configure);$('example').addEventListener('change',select);$('stop').addEventListener('click',stop);
$('play').addEventListener('click',async()=>{
 stop();const run=epoch,e=examples[Number($('example').value)];const playingAudio=new Audio(new URL('../'+e.audio,import.meta.url));audio=playingAudio;let token;
 playingAudio.addEventListener('playing',()=>{if(run===epoch)token=cue.begin(e.text);},{once:true});
 playingAudio.addEventListener('ended',()=>{if(run===epoch){cue.end(token);$('play').disabled=false;}});
 playingAudio.addEventListener('error',()=>{if(run===epoch){stop();$('status').textContent='音声を読み込めませんでした';}});
 $('play').disabled=true;cue.preload(e.text);
 try{await playingAudio.play();}catch{if(run===epoch){stop();$('status').textContent='再生ボタンをもう一度押してください';}}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});configure();select();
