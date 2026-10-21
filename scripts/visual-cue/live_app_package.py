"""Package the normal application, including model runtimes, under /app/."""
import hashlib
import json
import posixpath
import ast
import re

STORAGE_PREFIX = 'emma_visual_cue_app_v1:'
HISTORY_NAME = 'mitsukotoba-conversation-history-visual-cue-app-v1'
SHELL_PREFIX = 'visual-cue-app-shell-'


def instance_script(storage_source):
    storage = storage_source.replace('export function createTrialStorage', 'function createScopedStorage').replace(
        'emma_visual_cue_trial_v1:', STORAGE_PREFIX)
    return '''// Separate the deployed work-branch instance from other Pages apps on this origin.
(()=>{
''' + storage + f'''
for(const key of ['localStorage','sessionStorage']){{
 Object.defineProperty(window,key,{{configurable:true,value:createScopedStorage(window[key],'{STORAGE_PREFIX}')}});
}}
const factory=window.indexedDB;
if(factory)Object.defineProperty(window,'indexedDB',{{configurable:true,value:new Proxy(factory,{{
 get(target,key){{
  if(key==='open')return (name,...args)=>target.open(name==='mitsukotoba-conversation-history'?'{HISTORY_NAME}':name,...args);
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }}
}})}});
}})();
'''


def reset_document():
    # Public model bytes may be reused; reset only this instance's user data.
    return '''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>みつことばの実装版を更新</title><main><h1>みつことばを更新しています</h1>
<p>この実装版の設定・履歴と画面キャッシュを整理します。共有の音声・モデルは再利用します。</p><p id="status" role="status"></p></main><script>
(async()=>{
 const scope=new URL('./',location.href).href;
 const full=new URLSearchParams(location.search).get('full')==='1';
 if(full){
  for(const storage of [localStorage,sessionStorage])for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(key?.startsWith('STORAGE_PREFIX'))storage.removeItem(key);}
  await new Promise(resolve=>{const r=indexedDB.deleteDatabase('HISTORY_NAME');r.onsuccess=r.onerror=r.onblocked=resolve;});
 }
 if('serviceWorker' in navigator)for(const reg of await navigator.serviceWorker.getRegistrations())if(reg.scope===scope)await reg.unregister();
 if('caches' in window)for(const key of await caches.keys()){
  if(key.startsWith('SHELL_PREFIX'))await caches.delete(key);
  else if(full){const cache=await caches.open(key);for(const request of await cache.keys())if(request.url.startsWith(scope))await cache.delete(request);}
 }
 location.replace('./');
})().catch(error=>{document.getElementById('status').textContent='更新できませんでした。ページを開き直してください。';console.error(error);});
</script></html>'''.replace('STORAGE_PREFIX', STORAGE_PREFIX).replace('HISTORY_NAME', HISTORY_NAME).replace('SHELL_PREFIX', SHELL_PREFIX)


def prepare_live_app(output, committed, tracked, runtime_files, source_commit):
    app = output / 'app'
    app.mkdir()
    files = set(runtime_files) - {'visual-cue-trial.css', 'shared/visual-cue-trial-data.json'}
    files.update(['index.html', 'service-worker.js', 'manifest.webmanifest', 'manifest.intl.webmanifest',
                  'topic-guide.html', 'semantic-test.html', 'THIRD_PARTY_NOTICES.md', 'LICENSE_AUDIT.md'])
    files.update(p for p in tracked if p.startswith(('semantic-assets/', 'multilingual-assets/', 'assets/vad/', 'licenses/')))
    for relative in sorted(files):
        path = app / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        data = committed(relative)
        if relative == 'index.html':
            html = data.decode()
            assert 'data-visual-cue-trial' not in html
            data = html.replace('<head>', '<head>\n  <script src="./app-instance.js"></script>', 1).encode()
        elif relative == 'service-worker.js':
            data = data.replace(b'emma-web-shell-', SHELL_PREFIX.encode())
        path.write_bytes(data)
    (app / 'app-instance.js').write_text(instance_script(committed('src/visual-cue-trial-storage.js').decode()))
    (app / 'reset.html').write_text(reset_document())

    # Check all pinned inference assets while assembling, before publication.
    manifest = json.loads(committed('src/semantic-assets-manifest.json'))
    for asset in manifest['assets'].values():
        relative = posixpath.normpath(posixpath.join('src', asset['url']))
        assert not relative.startswith('../')
        data = (app / relative).read_bytes()
        assert len(data) == asset['bytes'] and hashlib.sha256(data).hexdigest() == asset['sha256'], relative
    vad = (app / 'assets/vad/silero_vad.onnx').read_bytes()
    assert hashlib.sha256(vad).hexdigest() == '1a153a22f4509e292a94e67d6f9b85e8deb25b4988682b7e174c65279d8788e3'
    shell = ast.literal_eval(re.search(r'const SHELL=(\[.*?\]);', (app / 'service-worker.js').read_text()).group(1))
    for relative in shell:
        path = relative.split('?')[0].removeprefix('./') or 'index.html'
        assert (app / path).is_file(), path
    assert (app / 'src/app.js').read_bytes() == committed('src/app.js')
    published = ['app/' + p.relative_to(app).as_posix() for p in app.rglob('*') if p.is_file()]
    return sorted(published)
