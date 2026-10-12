export function nextPhrase(phrases,previous,random=Math.random) {
  const choices=phrases.filter(text=>text!==previous);
  const pool=choices.length ? choices : phrases;
  return pool[Math.floor(random()*pool.length)];
}

export function allTopicPhrases(data) {
  return [...new Set((data?.topics||[]).flatMap(topic=>topic.phrases||[]))];
}

export function singleSentencePhrases(phrases) {
  return [...new Set(
    (phrases||[]).flatMap(phrase =>
      (String(phrase).match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[])
        .map(sentence=>sentence.trim())
        .filter(Boolean)
    )
  )];
}

export function phrasesForSentenceCount(phrases,sentenceCount) {
  return Number(sentenceCount)===3 ? phrases : singleSentencePhrases(phrases);
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

export function installFeatureScreens({stop,prepare,speak,history,isSpeaking,avatar,playSentenceCount=()=>1,setPlaySentenceCount=()=>{}}) {
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
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open){generation++;stop(); if(kind==='play')showTopics();}});
  async function open(type){generation++;kind=type;await stop();body.replaceChildren();title.textContent=type==='play'?'押して聞く':'会話履歴';dialog.showModal();}

  async function showHistory(selecting=false){
    const token=++generation;
    const selectedIds=new Set();
    const checkboxes=[];
    let replayId=null, replayButton=null, replayTicket=0;
    body.replaceChildren(text('日本語・英語の履歴を日付ごとに表示します。録音は保存せず、再生しても履歴は増えません。','p','history-description'));
    try {
      const entries=await history.list();
      if(token!==generation)return;
      const toolbar=document.createElement('div');
      toolbar.className='history-toolbar';
      const updateSelection=()=>{
        count.textContent=`${selectedIds.size}件選択中`;
        removeButton.disabled=selectedIds.size===0;
        removeButton.textContent=`${selectedIds.size}件を削除`;
        selectAll.textContent=selectedIds.size===entries.length?'選択を解除':'すべて選択';
      };
      const count=text('0件選択中','span','history-selected-count');
      const selectAll=button('すべて選択',()=>{
        if(selectedIds.size===entries.length)selectedIds.clear();
        else entries.forEach(entry=>selectedIds.add(entry.id));
        checkboxes.forEach(({entry,check})=>{check.checked=selectedIds.has(entry.id);});
        updateSelection();
      },'text-button');
      const removeButton=button('0件を削除',async()=>{
        if(!selectedIds.size)return;
        if(!confirm(`選択した${selectedIds.size}件の履歴を削除しますか？`))return;
        try {
          await stop();
          if(token!==generation)return;
          await history.deleteMany([...selectedIds]);
          if(token===generation)showHistory();
        }catch(error){if(token===generation)body.prepend(text(`削除できませんでした：${error.message}`));}
      },'outline-button');
      if(selecting){
        toolbar.append(count,selectAll,removeButton,button('キャンセル',()=>showHistory(),'text-button'));
        updateSelection();
      }else{
        const deleteMode=button('削除',async()=>{await stop();if(token===generation)showHistory(true);},'outline-button');
        deleteMode.disabled=entries.length===0;
        toolbar.append(deleteMode);
      }
      body.append(toolbar);
      if(!entries.length){body.append(text('履歴はまだありません。'));return;}
      let currentDay='';
      for(const entry of entries){
        const stamp=localHistoryStamp(entry.createdAt);
        if(stamp.key!==currentDay){
          currentDay=stamp.key;
          body.append(text(stamp.dateLabel,'h2','history-date-heading'));
        }
        const card=document.createElement('article');
        card.className='card history-card';
        const header=document.createElement('div');header.className='history-card-header';
        header.append(text(stamp.timeLabel,'time','history-time'));
        if(selecting){
          const check=document.createElement('input');check.type='checkbox';
          check.className='history-select';check.setAttribute('aria-label',`${stamp.timeLabel}の履歴を選択`);
          check.addEventListener('change',()=>{if(check.checked)selectedIds.add(entry.id);else selectedIds.delete(entry.id);updateSelection();});
          checkboxes.push({entry,check});
          header.append(check);
          card.classList.add('history-selectable');
          card.addEventListener('click',event=>{
            if(event.target===check)return;
            check.checked=!check.checked;
            check.dispatchEvent(new Event('change'));
          });
        }else{
          const replay=button('▶',async()=>{
            const stopping=replayId===entry.id;
            const ticket=++replayTicket;
            if(replayButton){replayButton.textContent='▶';replayButton.setAttribute('aria-label','もう一度聞く');}
            replayId=null;replayButton=null;
            if(stopping){await stop();return;}
            replayId=entry.id;replayButton=replay;
            replay.textContent='■';replay.setAttribute('aria-label','再生を停止');
            try {
              await stop();
              if(token!==generation||ticket!==replayTicket)return;
              await prepare();
              if(token!==generation||ticket!==replayTicket)return;
              await speak(entry.englishText);
            }catch(error){
              if(token===generation&&ticket===replayTicket)card.append(text(`再生できませんでした：${error.message}`));
            }finally{
              if(token===generation&&ticket===replayTicket){
                replayId=null;replayButton=null;
                replay.textContent='▶';replay.setAttribute('aria-label','もう一度聞く');
              }
            }
          },'history-replay');
          replay.setAttribute('aria-label','もう一度聞く');
          replay.setAttribute('title','もう一度聞く・再生中は停止');
          header.append(replay);
        }
        const jp=text(entry.japaneseText,'p','history-japanese');jp.prepend(text('聞き取った言葉','span','history-label'));
        const en=text(entry.englishText,'p','history-english');en.prepend(text('再生した英語','span','history-label'));
        card.append(header,jp,en);
        body.append(card);
      }
    }catch(error){if(token===generation)body.append(text(`履歴を開けませんでした：${error.message}`));}
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
    const topicButton=button('話題を変更',async()=>{await stop();showTopics();});
    topicButton.classList.add('play-topic-change');

    const sentenceToolbar=document.createElement('div');
    sentenceToolbar.className='play-sentence-toolbar';
    sentenceToolbar.append(text('1回','span','play-sentence-prefix'));
    const sentenceButtons=document.createElement('div');
    sentenceButtons.className='play-sentence-toggle';
    const oneButton=button('1文',()=>applySentenceCount(1),'play-sentence-option');
    const threeButton=button('3文',()=>applySentenceCount(3),'play-sentence-option');
    sentenceButtons.append(oneButton,threeButton);
    sentenceToolbar.append(sentenceButtons);

    function renderSentenceCount(){
      const count=playSentenceCount()===3?3:1;
      oneButton.classList.toggle('selected',count===1);
      threeButton.classList.toggle('selected',count===3);
      oneButton.setAttribute('aria-pressed',String(count===1));
      threeButton.setAttribute('aria-pressed',String(count===3));
    }
    function applySentenceCount(count){
      if(isSpeaking())return;
      setPlaySentenceCount(count===3?3:1);
      previous='';
      renderSentenceCount();
    }
    renderSentenceCount();

    const tap=button('声を準備しています…',async()=>{
      if(tap.disabled||isSpeaking())return;
      tap.disabled=true;
      const candidates=phrasesForSentenceCount(phrases,playSentenceCount());
      const phrase=nextPhrase(candidates,previous);previous=phrase;
      englishText.textContent=phrase;
      actionLabel.textContent='一緒に聞こう';
      tap.classList.add('is-speaking');
      try{await speak(phrase);}catch(error){if(token===generation)englishText.textContent=`再生できませんでした：${error.message}`;}
      finally{
        if(token===generation){
          tap.classList.remove('is-speaking');
          actionLabel.textContent='押して聞く';
          tap.disabled=false;
        }
      }
    },'play-tap');
    let previous='';
    const actionLabel=text('声を準備しています…','span','play-action-label');
    const englishText=text('','span','play-english-text');
    const face=avatar();face.setAttribute('aria-hidden','true');face.classList.add('play-avatar');
    tap.replaceChildren(
      face,
      text(topicLabel,'span','play-topic-label'),
      actionLabel,
      englishText,
      text('親子で一緒に聞く・まねする・交互に押す','small','play-help')
    );
    tap.disabled=true;
    body.replaceChildren(topicButton,sentenceToolbar,tap);
    try{
      await prepare();if(token!==generation)return;
      actionLabel.textContent='押して聞く';tap.disabled=false;
    }catch(error){if(token===generation)actionLabel.textContent=`準備できませんでした：${error.message}`;}
  }
  $('playButton').addEventListener('click',async()=>{await open('play');startAllTopics();});
  $('historyButton').addEventListener('click',async()=>{await open('history');showHistory();});
  return {isOpen:()=>dialog.open || Boolean(kind)};
}
