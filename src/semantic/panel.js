import { createSemanticController } from './controller.js';
const INTENT={invitation:'誘い・提案',observation:'観察',report:'報告',praise:'褒める',question:'質問',reassurance:'安心させる',generic:'対象外・不明'};
const STATE={future:'これからへの言及',ongoing:'進行中への言及',completed:'完了への言及',not_done:'未実施への言及',unspecified:'状態不明'};

export function installSemanticPanel({controller,engine,beforeChange,storage=localStorage,clientFactory,mount=document.getElementById('semanticPanel'),openInput=false}) {
  controller ||= createSemanticController({engine,beforeChange,storage,clientFactory});
  const inputId=`${mount.id}-japanese`;
  mount.innerHTML=`<h2>Semantic 診断・比較</h2>
    <p class="small muted">70M INT8で話題を選び、既存の英語を返します。WebではMacと判定が異なる場合があります。インテントと状態は参考表示です。</p>
    <label class="toggle-line"><span>意味で話題を判定する</span><span class="switch"><input data-semantic="enabled" type="checkbox"><span></span></span></label>
    <label>比較する判定方式<select data-semantic="mode"><option value="semantic">意味で判定（標準）</option><option value="guard">既存ルールを優先して意味で補う</option><option value="lite">従来Liteで判定</option></select></label>
    <div class="semantic-actions"><button data-semantic="prepare" class="outline-button compact-button">モデルを準備・再試行</button><button data-semantic="cancel" class="text-button">準備・判定を中止</button></div>
    <p data-semantic="status" class="small" role="status"></p><progress data-semantic="progress" class="hidden" max="100" value="0"></progress>
    <details ${openInput ? 'open' : ''}><summary>日本語テキストで比較する</summary><label for="${inputId}">日本語</label><textarea id="${inputId}" data-semantic="input" name="parent-speech" rows="3" inputmode="text" autocomplete="off" spellcheck="false" placeholder="ここに日本語を入力してください"></textarea><button data-semantic="try" class="outline-button compact-button">この内容で判定する</button><button data-semantic="reset" class="text-button">直前の話題をクリア</button></details>
    <div data-semantic="result" class="semantic-result" aria-live="polite"></div><a class="text-button" href="./semantic-test.html">日本語でSemanticを試すページを開く</a>`;
  const $=key=>mount.querySelector(`[data-semantic="${key}"]`);
  let renderedResponse;
  controller.subscribe(({requested,mode,status,lastResponse,result})=>{
    $('enabled').checked=requested;$('mode').value=mode;
    $('status').textContent=status.message;
    $('progress').classList.toggle('hidden',!!status.ready || !status.total);
    if(status.total){$('progress').value=Math.min(100,status.loaded/status.total*100);$('status').textContent+=` ${(status.loaded/1e6).toFixed(1)} / ${(status.total/1e6).toFixed(1)} MB`;}
    if(lastResponse===renderedResponse)return;
    renderedResponse=lastResponse;$('result').replaceChildren();
    if(!lastResponse)return;
    const lines=[['選んだ話題',lastResponse.scene],['直前の話題を使用',lastResponse.contextUsed ? 'はい' : 'いいえ'],['既存ライブラリの英語',lastResponse.english]];
    if(result?.topic)lines.push(['意味で選んだ話題',`${result.topic.id}（分類スコア ${(result.topic.probability*100).toFixed(1)}%、候補差 ${(result.topic.margin*100).toFixed(1)}ポイント）`],['インテント（参考）',INTENT[result.intent.id]],['状態（参考）',STATE[result.state.id]],['判定時間',`${result.elapsedMs.toFixed(1)} ms`]);
    for(const [label,value] of lines){const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=label+'：';p.append(strong,document.createTextNode(value||'—'));$('result').append(p);}
  });
  $('enabled').addEventListener('change',()=>controller.setEnabled($('enabled').checked,{prepare:true}));
  $('mode').addEventListener('change',()=>controller.setMode($('mode').value));
  $('prepare').addEventListener('click',()=>controller.requested ? controller.prepare({retry:true}) : controller.setEnabled(true,{prepare:true}));
  $('cancel').addEventListener('click',()=>controller.cancel());
  $('reset').addEventListener('click',()=>controller.reset());
  $('try').addEventListener('click',async()=>{
    const text=$('input').value.trim();if(!text){$('input').focus();return;}
    $('try').disabled=true;
    try{await controller.interrupt();await controller.respond(text,'');}
    finally{$('try').disabled=false;}
  });
  // Editing is available immediately; model preparation never disables the input.
  return controller;
}
