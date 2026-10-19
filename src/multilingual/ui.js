import {LANGUAGES,LANGUAGE_NAMES,LANGUAGE_KEY,resolveLanguage} from './core.js';
import {translate} from './translations.js';
export function installLanguageUI({document=globalThis.document,storage=globalThis.localStorage,
  languages=globalThis.navigator?.languages||[],onChange=async()=>{}}={}) {
  let saved;try{saved=storage.getItem(LANGUAGE_KEY);}catch{}
  const initial=resolveLanguage({saved,languages});let language=initial.language,needsChoice=initial.needsChoice;
  const originals=new WeakMap(),attributes=new WeakMap(),selectors=[];
  const wordmark=document.querySelector('#onboardingScreen .brand-wordmark');
  const japaneseWordmark=wordmark?.innerHTML;
  const productNames={ja:'みつことば',en:'Mitsukotoba',de:'Mitsukotoba',
    fr:'Mitsukotoba',ko:'미츠코토바',th:'มิตสึโคโตบะ'};
  const title='言語を選択';
  const status=document.createElement('p');status.className='small multilingual-status';status.setAttribute('aria-live','polite');
  status.id='languageModelStatus';
  const note=document.createElement('p');note.className='small multilingual-mode-note';
  let busy=false;
  function setStatus(key,{loaded,total}={}){
    status.dataset.message=key;status.dataset.loaded=loaded??'';status.dataset.total=total??'';
    status.textContent=translate(key,language)+(total?` ${(loaded/1e6).toFixed(1)} / ${(total/1e6).toFixed(1)} MB`:'');
  }
  async function choose(next){
    if(busy||!LANGUAGES.includes(next))return;busy=true;selectors.forEach(s=>s.disabled=true);
    try{
      await onChange(next,{commit:()=>{language=next;needsChoice=false;try{storage.setItem(LANGUAGE_KEY,next);}catch{}apply();}});
    }catch(error){console.error('Language preparation:',error);setStatus('モデルを準備できませんでした。再試行してください。');}
    finally{busy=false;selectors.forEach(s=>s.disabled=false);apply();}
  }
  function picker(id){
    const wrap=document.createElement('label');wrap.className='language-picker';
    const label=document.createElement('span');label.textContent=title;wrap.append(label);
    const select=document.createElement('select');select.id=id;select.setAttribute('aria-label',title);
    const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Select language';placeholder.disabled=true;select.append(placeholder);
    for(const code of LANGUAGES){const option=document.createElement('option');option.value=code;option.textContent=LANGUAGE_NAMES[code];select.append(option);}
    select.value=needsChoice?'':language;select.addEventListener('change',()=>choose(select.value));selectors.push(select);wrap.append(select);return wrap;
  }
  document.querySelector('#onboardingScreen .brand-row')?.after(picker('onboardingLanguage'));
  document.querySelector('#homeScreen .topbar')?.after(picker('homeLanguage'));
  const settings=document.querySelector('#settingsScreen .subpage-header');
  const settingsCard=document.createElement('article');settingsCard.className='card language-settings';
  settingsCard.append(picker('settingsLanguage'),note,status);
  const retry=document.createElement('button');retry.type='button';retry.className='outline-button';retry.textContent='準備する';
  retry.addEventListener('click',()=>choose(language));settingsCard.append(retry);settings?.after(settingsCard);
  const about=document.querySelector('#aboutScreen .screen-content');
  const localizedAbout=document.createElement('article');localizedAbout.className='card translated-about';
  for(const message of ['説明','会話は翻訳ではなく、親・赤ちゃん・Emmaが同じ時間を共有するためのものです。短い英語を日々の育児に添えます。','この端末で音声を処理します。モデルは必要なときだけ取得し、保存済みのものは再利用します。']){
    const p=document.createElement(message==='説明'?'h2':'p');p.textContent=message;localizedAbout.append(p);
  }
  about?.querySelector('header')?.after(localizedAbout);
  function eligible(node){
    const parent=node.parentElement;
    if(parent?.closest('.history-japanese,.history-english')&&!parent.closest('.history-label'))return false;
    return !parent?.closest('script,style,svg,.brand-wordmark,[data-no-i18n],#reply,#replyJapanese,#featureBody .history-entry');
  }
  function text(node){
    if(!eligible(node))return;
    const current=node.textContent,previous=originals.get(node);
    const source=previous&&current===previous.translated?previous.source:current;
    const translated=translate(source,language);originals.set(node,{source,translated});
    if(current!==translated)node.textContent=translated;
  }
  function walk(root){
    if(root.nodeType===3){text(root);return;}
    if(!root.querySelectorAll)return;
    const walker=document.createTreeWalker(root,4);let node;while(node=walker.nextNode())text(node);
    for(const el of [root,...root.querySelectorAll('[aria-label],[placeholder],[title],[alt]')]){
      if(!el.getAttribute||el.closest?.('[data-no-i18n],svg'))continue;
      const old=attributes.get(el)||{};
      for(const key of ['aria-label','placeholder','title','alt'])if(el.hasAttribute(key)){
        const value=el.getAttribute(key),prev=old[key],source=prev&&value===prev.translated?prev.source:value;
        const translated=translate(source,language);old[key]={source,translated};if(value!==translated)el.setAttribute(key,translated);
      }attributes.set(el,old);
    }
  }
  function apply(){
    document.documentElement.lang=language;document.documentElement.dataset.appLanguage=language;
    document.title=productNames[language]+' Web';
    if(wordmark){
      if(language==='ja'&&wordmark.dataset.localized==='true')wordmark.innerHTML=japaneseWordmark;
      else if(language!=='ja')wordmark.textContent=productNames[language];
      wordmark.dataset.localized=String(language!=='ja');
      wordmark.classList.toggle('brand-wordmark-localized',language!=='ja');
    }
    selectors.forEach(s=>s.value=needsChoice?'':language);
    note.textContent=translate(language==='en'?'英語表示で、さまざまな言語の音声を自動認識します。':'選択した言語で話しかけると、短い英語で返します。',language);
    const sub=document.querySelector('#prepareEmmaButton .button-sub');
    if(sub)sub.textContent=translate('初回のみ必要なモデルを準備します',language)+(language==='ja'?'':' · ~387 MB');
    localizedAbout.hidden=language==='ja';
    if(about)for(const child of about.children)if(child!==localizedAbout&&child.tagName!=='HEADER')child.hidden=language!=='ja';
    const firstButton=document.getElementById('prepareEmmaButton');if(firstButton&&!busy)firstButton.disabled=needsChoice;
    const high=document.querySelector('#onboardingHighPerformance')?.closest('.lite-compact-setting');if(high)high.hidden=true;
    const asrNote=document.getElementById('asrModelStatus')?.nextElementSibling;
    if(asrNote)asrNote.hidden=language!=='ja';
    for(const id of ['asrModel','asrModelStatus','semanticEnabled']){
      const el=document.getElementById(id);const row=el?.closest('label')||el;if(row)row.hidden=language!=='ja';
    }
    for(const id of ['replyJapanese','storageProtectionStatus','modelCacheStatus','modelCacheHistoryStatus']){
      const el=document.getElementById(id);if(el)el.hidden=language!=='ja';
    }
    const semanticHelp=document.querySelector('a[href*="topic-guide.html"]')?.closest('article');
    if(semanticHelp)semanticHelp.hidden=language!=='ja';
    walk(document.body);
    if(status.dataset.message)setStatus(status.dataset.message,{loaded:Number(status.dataset.loaded),total:Number(status.dataset.total)});
  }
  const observer=new MutationObserver(records=>{
    for(const r of records){if(r.type==='characterData')text(r.target);else if(r.type==='childList')for(const n of r.addedNodes)walk(n);}
  });observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  apply();
  if(needsChoice)setStatus('はじめに言語を選んでください。');
  return {get language(){return language;},get needsChoice(){return needsChoice;},apply,setStatus,choose,
    confirm(){if(needsChoice)return false;try{storage.setItem(LANGUAGE_KEY,language);}catch{}return true;},
    translate:text=>translate(text,language),dispose:()=>observer.disconnect()};
}
