export function nextPhrase(phrases,previous,random=Math.random) {
  const choices=phrases.filter(text=>text!==previous);
  const pool=choices.length ? choices : phrases;
  return pool[Math.floor(random()*pool.length)];
}

export function allTopicPhrases(data) {
  return [...new Set((data?.topics||[]).flatMap(topic=>topic.phrases||[]))];
}

export function localHistoryStamp(value) {
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return {key:'unknown',dateLabel:'日時不明',timeLabel:'--:--'};
  const year=date.getFullYear(),month=date.getMonth()+1,day=date.getDate();
  return {
    key:`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
    dateLabel:new Intl.DateTimeFormat(undefined,{year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(date),
    timeLabel:new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit',hour12:false}).format(date)
  };
}

export function installFeatureScreens({stop,prepare,speak,history,isSpeaking,avatar}) {
  const $=id=>document.getElementById(id);
  const dialog=$('featureDialog'), body=$('featureBody'), title=$('featureTitle');
  let generation=0,kind='';
  const button=(value,handler,className='outline-button')=>{
    const el=document.createElement('button');el.type='button';el.textContent=value;el.className=className;el.addEventListener('click',handler);return el;
  };
  const text=(value,tag='p',className='')=>{const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;};
  async function close(){generation++;kind='';await stop();dialog.close();}
  function requestClose(){if(kind!=='play'||confirm('おとなの方へ：遊びを終えて戻りますか？会話は自動で始まりません。'))close();}
  $('featureClose').addEventListener('click',requestClose);
  dialog.addEventListener('cancel',event=>{event.preventDefault();requestClose();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open){generation++;stop(); if(kind==='play')startAllTopics();}});
  async function open(type){generation++;kind=type;await stop();body.replaceChildren();title.textContent=type==='play'?'押して聞く':'会話履歴';dialog.showModal();}

  async function showHistory(){
    body.replaceChildren(text('録音は保存しません。端末内の日本語・英語を日付ごとに見返せます。再生で履歴は増えません。'));
    const token=++generation;
    try {
      const entries=await history.list();if(token!==generation)return;
      body.append(button('すべて削除',async()=>{if(confirm('すべての履歴を削除しますか？')){try{await stop();await history.delete();showHistory();}catch(error){body.append(text(`削除できませんでした：${error.message}`));}}}));
      if(!entries.length){body.append(text('履歴はまだありません。'));return;}
      let currentDay='';
      for(const entry of entries){
        const stamp=localHistoryStamp(entry.createdAt);
        if(stamp.key!==currentDay){
          currentDay=stamp.key;
          body.append(text(stamp.dateLabel,'h2','history-date-heading'));
        }
        const card=document.createElement('article');card.className='card history-card';
        card.append(text(stamp.timeLabel,'time','history-time'));
        const jp=text(entry.japaneseText);jp.prepend(text('日本語（音声認識）','span','history-label'));
        const en=text(entry.englishText);en.prepend(text('再生した英語','span','history-label'));
        card.append(jp,en);
        card.append(
          button('もう一度聞く',async()=>{
            if(isSpeaking())return;
            try {await prepare();if(token!==generation)return;await speak(entry.englishText);}
            catch(error){if(token===generation)card.append(text(`再生できませんでした：${error.message}`));}
          }),
          button('停止',stop),
          button('削除',async()=>{if(confirm('この履歴を削除しますか？')){try{await stop();await history.delete(entry.id);showHistory();}catch(error){body.append(text(`削除できませんでした：${error.message}`));}}})
        );
        body.append(card);
      }
    } catch(error){body.append(text(`履歴を開けませんでした：${error.message}`));}
  }

  let topics;
  async function loadTopics(){
    topics ||= await fetch(new URL('../shared/play-topics.json',import.meta.url)).then(response=>{
      if(!response.ok)throw Error('話題を読み込めません');
      return response.json();
    });
    return topics;
  }
  async function showTopics(){
    const token=++generation;
    body.replaceChildren(text('話題を絞ることも、すべての話題を混ぜて遊ぶこともできます。'));
    try {
      const data=await loadTopics();if(token!==generation)return;
      body.append(button('すべての話題',()=>playTopic(null),'primary-button'));
      for(const topic of data.topics)body.append(button(topic.label,()=>playTopic(topic),'outline-button'));
    }catch(error){body.append(text(error.message));}
  }
  async function startAllTopics(){
    const token=++generation;
    body.replaceChildren(text('親子で一緒に聞いて、まねして、交互に押して遊びましょう。マイクは使いません。'));
    try{
      const data=await loadTopics();if(token!==generation)return;
      await playTopic(null,data);
    }catch(error){if(token===generation)body.append(text(error.message));}
  }
  async function playTopic(topic,loadedData=null){
    const token=++generation;await stop();
    const data=loadedData||await loadTopics();if(token!==generation)return;
    const phrases=topic?.phrases||allTopicPhrases(data);
    const topicLabel=topic?.label||'すべての話題';
    body.replaceChildren(button('話題を変更',async()=>{await stop();showTopics();}));
    const tap=button('声を準備しています…',async()=>{
      if(tap.disabled||isSpeaking())return;
      tap.disabled=true;
      const phrase=nextPhrase(phrases,previous);previous=phrase;
      label.textContent=phrase;
      try{await speak(phrase);}catch(error){if(token===generation)label.textContent=`再生できませんでした：${error.message}`;}
      finally{if(token===generation)tap.disabled=false;}
    },'play-tap');
    let previous='';const label=text('声を準備しています…','span');
    const face=avatar();face.setAttribute('aria-hidden','true');face.classList.add('play-avatar');
    tap.replaceChildren(face,text(topicLabel,'span','play-topic-label'),label,text('一緒にまねする・交互に押す','small'));
    tap.disabled=true;body.append(tap);
    try{
      await prepare();if(token!==generation)return;
      label.textContent='押して聞く';tap.disabled=false;
    }catch(error){if(token===generation)label.textContent=`準備できませんでした：${error.message}`;}
  }
  $('playButton').addEventListener('click',async()=>{await open('play');startAllTopics();});
  $('historyButton').addEventListener('click',async()=>{await open('history');showHistory();});
  return {isOpen:()=>dialog.open || Boolean(kind)};
}
