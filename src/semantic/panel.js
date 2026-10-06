import { SemanticLiteClient } from './client.js';
const INTENT = { invitation:'誘い・提案',observation:'観察',report:'報告',praise:'褒める',question:'質問',reassurance:'安心させる',generic:'対象外・不明' };
const STATE = { future:'これからへの言及',ongoing:'進行中への言及',completed:'完了への言及',not_done:'未実施への言及',unspecified:'状態不明' };
export function installSemanticPanel({ engine, beforeChange = async () => {}, storage = localStorage, clientFactory, mount = document.getElementById('semanticPanel') }) {
  mount.innerHTML = `<h2>Semantic Lite テスト</h2>
    <p class="small muted">親のことばの意味から話題を判定します。追加データは実行データ込み約93MB。初回に取得し、このブラウザ内で処理します。</p>
    <label class="toggle-line"><span>意味で話題を判定する</span><span class="switch"><input data-semantic="enabled" type="checkbox"><span></span></span></label>
    <label>判定方式<select data-semantic="mode"><option value="semantic">意味で判定（テスト既定）</option><option value="guard">既存ルールを優先して意味で補う</option><option value="lite">従来Liteで判定</option></select></label>
    <p class="small muted">このテスト版では、意味で話題を選んで既存の英語を返します。WebではMacと判定が異なる場合があります。インテントと状態は確認用で、英文の選び方には使いません。</p>
    <div class="semantic-actions"><button data-semantic="prepare" class="outline-button compact-button">モデルを準備・再試行</button><button data-semantic="cancel" class="text-button">準備・判定を中止</button></div>
    <p data-semantic="status" class="small" role="status">従来Liteで動作します。</p><progress data-semantic="progress" class="hidden" max="100" value="0"></progress>
    <details><summary>日本語テキストで比較する</summary><label>日本語<textarea data-semantic="input" rows="3" placeholder="お風呂に入って温まろう"></textarea></label><button data-semantic="try" class="outline-button compact-button">この内容で判定する</button><button data-semantic="reset" class="text-button">直前の話題をクリア</button></details>
    <div data-semantic="result" class="semantic-result" aria-live="polite"></div><a class="text-button" href="./semantic-test.html">Semanticテスト画面を開く</a>`;
  const $ = key => mount.querySelector(`[data-semantic="${key}"]`);
  let generation = 0, failed = false;
  $('enabled').checked = storage.getItem('emma_semantic_enabled') === 'true';
  $('mode').value = ['semantic','guard','lite'].includes(storage.getItem('emma_semantic_mode')) ? storage.getItem('emma_semantic_mode') : 'semantic';
  function status(data) {
    $('status').textContent = data.message;
    $('progress').classList.toggle('hidden', !!data.ready || !data.total);
    if (data.total) { $('progress').value = Math.min(100, data.loaded / data.total * 100); $('status').textContent += ` ${(data.loaded/1e6).toFixed(1)} / ${(data.total/1e6).toFixed(1)} MB`; }
  }
  const client = clientFactory ? clientFactory(status) : new SemanticLiteClient({ onStatus: status });
  async function prepare() {
    const token=generation;
    try { await client.prepare(); if(token===generation)failed=false; }
    catch(error) { if(token===generation){failed=true;status({ message:error.message });} }
  }
  function render(response, result) {
    $('result').replaceChildren();
    const lines = [ ['選んだ話題',response.scene],['ルール／文脈の話題',response.ruleScene],['既存ライブラリの英語',response.english] ];
    if (result?.topic) lines.push(['意味で選んだ話題',`${result.topic.id}（分類スコア ${(result.topic.probability*100).toFixed(1)}%、候補差 ${(result.topic.margin*100).toFixed(1)}ポイント）`],['インテント（参考）',INTENT[result.intent.id]],['状態（参考）',STATE[result.state.id]],['判定時間',`${result.elapsedMs.toFixed(1)} ms`]);
    for (const [label,value] of lines) { const p=document.createElement('p'),strong=document.createElement('strong'); strong.textContent=label+'：'; p.append(strong,document.createTextNode(value || '—')); $('result').append(p); }
  }
  const api = {
    client,
    get enabled() { return !failed && $('enabled').checked && $('mode').value !== 'lite'; },
    async respond(text, name, { isCurrent = () => true } = {}) {
      const token=generation, enabled=api.enabled, mode=$('mode').value;
      let result;
      if (enabled) {
        try { result=await client.predict(text); if (result.unavailable && token===generation && isCurrent()) status({message:result.message}); }
        catch(error) { if(token!==generation || !isCurrent())return null; failed=true; status({message:error.message}); }
      }
      if (token!==generation || !isCurrent()) return null;
      const response=engine.respond(text,name,result?.topic ? { topic:result.topic.id, mode } : null);
      render(response,result); return response;
    },
    cancelPending() { client.cancelPending(); }
  };
  $('prepare').addEventListener('click',prepare);
  async function changeMode() {
    const token=++generation;
    client.cancelPending();
    await beforeChange();
    if(token!==generation)return;
    engine.resetConversationContext();failed=false;
    storage.setItem('emma_semantic_enabled',String($('enabled').checked));
    storage.setItem('emma_semantic_mode',$('mode').value);
    if(api.enabled) await prepare();
    else { client.cancel(); status({message:'従来Liteで動作します。'}); }
  }
  $('enabled').addEventListener('change',changeMode);
  $('mode').addEventListener('change',changeMode);
  $('cancel').addEventListener('click',async()=>{const token=++generation;client.cancel();$('enabled').checked=false;storage.setItem('emma_semantic_enabled','false');await beforeChange();if(token===generation)status({message:'意味判定を中止しました。使うときは「意味で話題を判定する」をオンにしてください。'});});
  $('reset').addEventListener('click',async()=>{const token=++generation;client.cancelPending();await beforeChange();if(token===generation){engine.resetConversationContext();$('result').replaceChildren();}});
  $('try').addEventListener('click',async()=>{const text=$('input').value.trim();if(!text)return;await beforeChange();$('try').disabled=true;try{await api.respond(text,'');}finally{$('try').disabled=false;}});
  if(api.enabled)void prepare();
  return api;
}
