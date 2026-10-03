export function nextPhrase(phrases,previous,random=Math.random) {
  const choices=phrases.filter(text=>text!==previous);
  return choices[Math.floor(random()*choices.length)];
}
export function installFeatureScreens({stop,prepare,speak,preload,history,isSpeaking,avatar}) {
  const $=id=>document.getElementById(id);
  const dialog=$('featureDialog'), body=$('featureBody'), title=$('featureTitle');
  let generation=0,kind='';
  const button=(text,handler,className='outline-button')=>{
    const el=document.createElement('button');el.type='button';el.textContent=text;el.className=className;el.addEventListener('click',handler);return el;
  };
  const text=(value,tag='p')=>{const el=document.createElement(tag);el.textContent=value;return el;};
  async function close(){generation++;kind='';await stop();dialog.close();}
  function requestClose(){if(kind!=='play'||confirm('おとなの方へ：遊びを終えて戻りますか？会話は自動で始まりません。'))close();}
  $('featureClose').addEventListener('click',requestClose);
  dialog.addEventListener('cancel',event=>{event.preventDefault();requestClose();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open){generation++;stop(); if(kind==='play')showTopics();}});
  async function open(type){generation++;kind=type;await stop();body.replaceChildren();title.textContent=type==='play'?'押して聞く':'会話履歴';dialog.showModal();}
  async function showHistory(){
    body.replaceChildren(text('録音は保存しません。端末内の日本語・英語を見返せます。再生で履歴は増えません。'));
    const token=++generation;
    try {
      const entries=await history.list();if(token!==generation)return;
      body.append(button('すべて削除',async()=>{if(confirm('すべての履歴を削除しますか？')){try{await stop();await history.delete();showHistory();}catch(error){body.append(text(`削除できませんでした：${error.message}`));}}}));
      if(!entries.length)body.append(text('履歴はまだありません。'));
      for(const entry of entries){
        const card=document.createElement('article');card.className='card';
        card.append(text(entry.createdAt,'small'),text(entry.japaneseText),text(entry.englishText));
        card.append(button('もう一度聞く',async()=>{
          if(isSpeaking())return;
          try {await prepare();if(token!==generation)return;await speak(entry.englishText);}catch(error){if(token===generation)card.append(text(`再生できませんでした：${error.message}`));}
        }),button('停止',stop),button('削除',async()=>{if(confirm('この履歴を削除しますか？')){try{await stop();await history.delete(entry.id);showHistory();}catch(error){body.append(text(`削除できませんでした：${error.message}`));}}}));body.append(card);
      }
    } catch(error){body.append(text(`履歴を開けませんでした：${error.message}`));}
  }
  let topics;
  async function showTopics(){
    const token=++generation;
    body.replaceChildren(text('親子で一緒に聞いて、まねして、交互に押して遊びましょう。押すのは赤ちゃんでも、おとなでもかまいません。マイクは使いません。学習効果が実証された機能ではありません。'));
    try {
      topics ||= await fetch(new URL('../shared/play-topics.json',import.meta.url)).then(response=>{if(!response.ok)throw Error('話題を読み込めません');return response.json();});
      if(token!==generation)return;
      for(const topic of topics.topics)body.append(button(topic.label,()=>playTopic(topic),'primary-button'));
    }catch(error){body.append(text(error.message));}
  }
  async function playTopic(topic){
    const token=++generation;await stop();
    body.replaceChildren(button('話題を選ぶ',async()=>{await stop();showTopics();}));
    const tap=button('声を準備しています…',async()=>{
      if(tap.disabled||isSpeaking())return;
      tap.disabled=true;const phrase=nextPhrase(topic.phrases,previous);previous=phrase;
      label.textContent=phrase;
      try{await speak(phrase);}catch(error){if(token===generation)label.textContent=`再生できませんでした：${error.message}`;}
      finally{if(token===generation)tap.disabled=false;}
    },'play-tap');
    let previous='';const label=text('押して聞く','span');
    const face=avatar();face.setAttribute('aria-hidden','true');face.classList.add('play-avatar');
    tap.replaceChildren(face,text(topic.label,'span'),label,text('一緒にまねする・交互に押す','small'));tap.disabled=true;body.append(tap);
    try{await prepare();if(token!==generation)return;await preload(topic.phrases);if(token!==generation)return;label.textContent='押して聞く';tap.disabled=false;}
    catch(error){if(token===generation)label.textContent=`準備できませんでした：${error.message}`;}
  }
  $('playButton').addEventListener('click',async()=>{await open('play');showTopics();});
  $('historyButton').addEventListener('click',async()=>{await open('history');showHistory();});
  return {isOpen:()=>dialog.open || Boolean(kind)};
}
