import {LANGUAGES,LANGUAGE_NAMES,LANGUAGE_KEY,LANGUAGE_MODE_KEY,resolveLanguage,browserLanguages} from './core.js';
import {translate} from './translations.js?v=20261020-ui-audit-v3';
import {renderLocalizedAbout} from './about-page.js';
export function installLanguageUI({document=globalThis.document,storage=globalThis.localStorage,
  languages=undefined,onChange=async()=>{},onExplanationsChange=()=>{}}={}) {
  let saved,savedMode;try{saved=storage.getItem(LANGUAGE_KEY);savedMode=storage.getItem(LANGUAGE_MODE_KEY);}catch{}
  // A pre-existing saved selection is treated as manual (legacy migration).
  // New visitors and users who explicitly choose Auto follow the browser.
  const initialMode=LANGUAGES.includes(saved)&&savedMode!=='auto'?'manual':'auto';
  let mode=initialMode;
  const detected=()=>resolveLanguage({languages:languages??browserLanguages()});
  const initial=resolveLanguage({saved:mode==='manual'?saved:null,languages:languages??browserLanguages()});
  let language=initial.language,needsChoice=initial.needsChoice;
  const explanationKey='mitsukotoba_explanation_language_v1';
  let explanationPreference='follow';
  try{
    const savedExplanation=storage.getItem(explanationKey);
    if(['follow','zh','none'].includes(savedExplanation))explanationPreference=savedExplanation;
  }catch{}
  const originals=new WeakMap(),attributes=new WeakMap(),selectors=[];
  const wordmark=document.querySelector('#onboardingScreen .brand-wordmark');
  const japaneseWordmark=wordmark?.innerHTML;
  const productNames=Object.fromEntries(LANGUAGES.map(code=>[code,code==='ja'?'みつことば':'CooTrio']));
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
    if(busy||(next!=='auto'&&!LANGUAGES.includes(next)))return;
    const automatic=next==='auto',resolved=automatic?detected().language:next;
    busy=true;selectors.forEach(s=>s.disabled=true);
    try{
      await onChange(resolved,{commit:()=>{
        language=resolved;mode=automatic?'auto':'manual';needsChoice=false;
        try{storage.setItem(LANGUAGE_KEY,resolved);storage.setItem(LANGUAGE_MODE_KEY,mode);}catch{}
        apply();onExplanationsChange();
      }});
    }catch(error){
      console.error('Language preparation:',error);
      const details=String(error?.message||'');
      const storageFailure=/モデルを端末に保存できませんでした|QuotaExceeded|Unexpected internal error/i.test(details);
      const isolationFailure=['このブラウザではMoonshineに必要なService Workerを利用できません。','Moonshineに必要なブラウザ分離を有効にできませんでした。通常のブラウザタブで開き直してください。']
        .find(message=>details.includes(message));
      setStatus(isolationFailure||
        (storageFailure?'モデル保存に失敗しました。空き容量を確認して再試行してください。':'モデルを準備できませんでした。再試行してください。'));
      status.title=language==='ja'?details:translate(isolationFailure||'モデルを準備できませんでした。再試行してください。',language);
    }
    finally{busy=false;selectors.forEach(s=>s.disabled=false);apply();}
  }
  function picker(id){
    const wrap=document.createElement('label');wrap.className='language-picker';
    const label=document.createElement('span');label.textContent=title;wrap.append(label);
    const select=document.createElement('select');select.id=id;select.setAttribute('aria-label',title);
    const automatic=document.createElement('option');automatic.value='auto';select.append(automatic);
    for(const code of LANGUAGES){const option=document.createElement('option');option.value=code;option.textContent=LANGUAGE_NAMES[code];select.append(option);}
    select.value=mode==='auto'?'auto':language;select.addEventListener('change',()=>choose(select.value));selectors.push(select);wrap.append(select);return wrap;
  }
  document.querySelector('#onboardingScreen .brand-row')?.after(picker('onboardingLanguage'));
  document.querySelector('#homeScreen .topbar')?.after(picker('homeLanguage'));
  const settings=document.querySelector('#settingsScreen .subpage-header');
  const settingsCard=document.createElement('article');settingsCard.className='card language-settings';
  settingsCard.append(picker('settingsLanguage'),note,status);
  const explanationSetting=document.createElement('label');
  explanationSetting.className='language-picker explanation-language-setting';
  const explanationLabel=document.createElement('span');
  const explanationSelect=document.createElement('select');
  explanationSelect.id='explanationLanguage';
  for(const value of ['follow','zh','none']){
    const option=document.createElement('option');option.value=value;explanationSelect.append(option);
  }
  explanationSelect.value=explanationPreference;
  explanationSelect.addEventListener('change',()=>{
    explanationPreference=explanationSelect.value;
    try{storage.setItem(explanationKey,explanationPreference);}catch{}
    apply();onExplanationsChange();
  });
  explanationSetting.append(explanationLabel,explanationSelect);
  settingsCard.append(explanationSetting);
  const retry=document.createElement('button');retry.type='button';retry.className='outline-button';retry.textContent='準備する';
  retry.addEventListener('click',()=>choose(language));settingsCard.append(retry);settings?.after(settingsCard);
  const about=document.querySelector('#aboutScreen .screen-content');
  let localizedAbout=null,localizedAboutLanguage=null;
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
    document.title=productNames[language];
    const manifest=document.querySelector('link[rel="manifest"]');
    if(manifest)manifest.setAttribute('href',language==='ja'
      ? './manifest.webmanifest?v=20261020-cootrio-r1'
      : './manifest.intl.webmanifest?v=20261020-cootrio-r1');
    const description=document.querySelector('meta[name="description"]');
    if(description)description.setAttribute('content',language==='ja'
      ? '親と赤ちゃんとAI、3人でつくる英語アプリ'
      : 'CooTrio — English moments for parents and babies, with AI.');
    const appleTitle=document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if(appleTitle)appleTitle.setAttribute('content',productNames[language]);
    if(wordmark){
      if(language==='ja'&&wordmark.dataset.localized==='true')wordmark.innerHTML=japaneseWordmark;
      else if(language!=='ja')wordmark.textContent=productNames[language];
      wordmark.dataset.localized=String(language!=='ja');
      wordmark.classList.toggle('brand-wordmark-localized',language!=='ja');
    }
    selectors.forEach(s=>{
      s.value=mode==='auto'?'auto':language;
      s.querySelector('option[value="auto"]').textContent=translate('自動（ブラウザ設定）',language)+' · '+LANGUAGE_NAMES[detected().language];
    });
    explanationLabel.textContent=translate('英文の場面説明',language);
    explanationSelect.options[0].textContent=translate('表示言語に合わせる',language);
    explanationSelect.options[1].textContent=translate('中文（説明のみ）',language);
    explanationSelect.options[2].textContent=translate('説明を表示しない',language);
    note.textContent=translate(language==='en'?'英語表示で、さまざまな言語の音声を自動認識します。':'選択した言語で話しかけると、短い英語で返します。',language);
    const sub=document.querySelector('#prepareEmmaButton .button-sub');
    if(sub)sub.textContent=translate('初回のみ必要なモデルを準備します',language)+(language==='ja'?'':' · ~387 MB');
    // Keep the original full Japanese research page intact, and render a
    // substantial localized page (including all 6 source links) for other languages.
    if(about&&language!=='ja'&&localizedAboutLanguage!==language){
      localizedAbout?.remove();
      localizedAbout=renderLocalizedAbout(document,language);
      about.querySelector('header')?.after(localizedAbout);
      localizedAboutLanguage=language;
    }
    if(localizedAbout)localizedAbout.hidden=language==='ja';
    if(about)for(const child of about.children) {
      if(child!==localizedAbout&&child.tagName!=='HEADER')child.hidden=language!=='ja';
    }
    const firstButton=document.getElementById('prepareEmmaButton');if(firstButton&&!busy)firstButton.disabled=needsChoice;
    const high=document.querySelector('#onboardingHighPerformance')?.closest('.lite-compact-setting');if(high)high.hidden=true;
    const asrNote=document.getElementById('asrModelStatus')?.nextElementSibling;
    if(asrNote)asrNote.hidden=language!=='ja';
    for(const id of ['asrModel','asrModelStatus','semanticEnabled']){
      const el=document.getElementById(id);const row=el?.closest('label')||el;if(row)row.hidden=language!=='ja';
    }
    const hint=document.getElementById('replyJapanese');
    if(hint){
      // Context notes also appear in supported non-English UI locales.
      // English requires no same-language explanation; the underlying reply
      // remains available in its original English text.
      hint.hidden=(explanationPreference==='none'||(explanationPreference==='follow'&&language==='en'));
      hint.setAttribute('aria-label',translate('英文の場面説明',language));
    }
    for(const id of ['storageProtectionStatus','modelCacheStatus','modelCacheHistoryStatus']){
      const el=document.getElementById(id);if(el)el.hidden=language!=='ja';
    }
    const semanticHelp=document.querySelector('a[href*="topic-guide.html"]')?.closest('article');
    if(semanticHelp)semanticHelp.hidden=language!=='ja';
    walk(document.body);
    if(status.dataset.message)setStatus(status.dataset.message,{loaded:Number(status.dataset.loaded),total:Number(status.dataset.total)});
  }
  const observer=new MutationObserver(records=>{
    for(const r of records){if(r.type==='characterData')text(r.target);else if(r.type==='attributes')walk(r.target);else if(r.type==='childList')for(const n of r.addedNodes)walk(n);}
  });observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','placeholder','title','alt']});
  apply();
  return {get language(){return language;},
    get explanationLanguage(){return explanationPreference==='follow'?language:explanationPreference;},
    get needsChoice(){return needsChoice;},get mode(){return mode;},apply,setStatus,choose,
    confirm(){
      try{storage.setItem(LANGUAGE_KEY,language);storage.setItem(LANGUAGE_MODE_KEY,mode);}catch{}
      return true;
    },
    translate:text=>translate(text,language),dispose:()=>observer.disconnect()};
}
