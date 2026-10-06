const CACHE='emma-web-shell-v116-manual-generic';
const SHELL=['./semantic-test.html','./src/semantic/panel.js','./src/semantic/controller.js','./src/semantic/core.js','./src/semantic/client.js','./src/semantic/worker.js','./src/semantic/download.js', './src/semantic/tokenize.js','./src/semantic-assets-manifest.json','./src/conversation-history.js','./src/feature-screens.js','./src/app-navigation.js','./shared/play-topics.json','./','./index.html','./topic-guide.html','./reset.html','./styles.css','./manifest.webmanifest','./icons/mitsukotoba-baby-abc-v2-192.png','./assets/mitsukotoba-parent.png','./assets/mitsukotoba-baby.png','./assets/mitsukotoba-ai.png','./assets/emma-face/emma-face-idle-open.svg','./assets/emma-face/emma-face-idle-half.svg','./assets/emma-face/emma-face-idle-closed.svg','./assets/emma-face/emma-face-talk-small.svg','./assets/emma-face/emma-face-talk-medium.svg','./assets/emma-face/emma-face-talk-large.svg','./assets/emma-face/emma-face-talk-small-half.svg','./assets/emma-face/emma-face-talk-small-closed.svg','./assets/emma-face/emma-face-talk-medium-half.svg','./assets/emma-face/emma-face-talk-medium-closed.svg','./assets/emma-face/emma-face-talk-large-half.svg','./assets/emma-face/emma-face-talk-large-closed.svg','./src/app.js','./src/emma-color-palettes.js','./src/resumable-download.js','./src/moonshine-module.js','./src/audio-capture.js','./src/lite-response-engine.js','./src/lite-topic-matcher.js','./src/lite-phonetic-scene-matcher.js','./src/name-pronunciation.js','./src/tts-worker.js','./worklets/pcm-capture-worklet.js','./src/vendor/kitten/index.js','./src/vendor/kitten/kitten-tts.js','./src/vendor/kitten/model-loader.js','./src/vendor/kitten/npz-loader.js','./src/vendor/kitten/phonemizer.js','./src/vendor/kitten/audio.js','./src/vendor/kitten/preprocess.js','./src/vendor/kitten/text-cleaner.js'];

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k.startsWith('emma-web-shell-')&&k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
));

function withIsolationHeaders(response) {
  if(!response) return response;
  const headers=new Headers(response.headers);
  headers.set('Cross-Origin-Opener-Policy','same-origin');
  headers.set('Cross-Origin-Embedder-Policy','require-corp');
  headers.set('Cross-Origin-Resource-Policy','same-origin');
  return new Response(response.body,{
    status:response.status,
    statusText:response.statusText,
    headers
  });
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;

  // These are opt-in, SHA-256-verified assets cached by the semantic worker.
  // Do not duplicate ~93 MB into the ordinary shell cache.
  if(url.pathname.includes('/semantic-assets/')) {
    event.respondWith(caches.match(event.request).then(cached=>cached ? withIsolationHeaders(cached) : fetch(event.request).then(withIsolationHeaders)));
    return;
  }

  const isAppCode =
    event.request.mode==='navigate' ||
    ['document','script','style','worker','audioworklet'].includes(event.request.destination) ||
    /\.(?:html|js|css)$/.test(url.pathname);

  if(isAppCode){
    event.respondWith(
      fetch(event.request,{cache:'no-store'})
        .then(response=>{
          const isolated=withIsolationHeaders(response);
          const copy=isolated.clone();
          caches.open(CACHE).then(c=>c.put(event.request,copy));
          return isolated;
        })
        .catch(()=>caches.match(event.request).then(response=>
          response ? withIsolationHeaders(response) : Response.error()
        ))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>{
      const network=fetch(event.request).then(response=>{
        const isolated=withIsolationHeaders(response);
        const copy=isolated.clone();
        caches.open(CACHE).then(c=>c.put(event.request,copy));
        return isolated;
      }).catch(()=>cached ? withIsolationHeaders(cached) : Response.error());
      return cached ? withIsolationHeaders(cached) : network;
    })
  );
});


const BACKGROUND_META_CACHE='mitsukotoba-background-model-meta-v1';

function bgHash(value){
  let hash=2166136261;
  for(let i=0;i<value.length;i++){
    hash^=value.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return (hash>>>0).toString(16);
}

function bgMetaKey(id){
  return new URL('./__model_bg_meta__/'+id,self.registration.scope).href;
}

async function saveBgMeta(meta){
  const cache=await caches.open(BACKGROUND_META_CACHE);
  await cache.put(bgMetaKey(meta.id),new Response(JSON.stringify(meta),{
    headers:{'content-type':'application/json'}
  }));
}

async function loadBgMeta(id){
  const cache=await caches.open(BACKGROUND_META_CACHE);
  const response=await cache.match(bgMetaKey(id));
  return response ? response.json() : null;
}

async function deleteBgMeta(id){
  const cache=await caches.open(BACKGROUND_META_CACHE);
  await cache.delete(bgMetaKey(id));
}

async function listBgMeta(){
  const cache=await caches.open(BACKGROUND_META_CACHE);
  const requests=await cache.keys();
  const out=[];
  for(const request of requests){
    const response=await cache.match(request);
    if(!response) continue;
    try{out.push(await response.json());}catch{}
  }
  return out;
}

async function startTrackedBackgroundDownloads(){
  if(!self.registration.backgroundFetch) return;
  const items=await listBgMeta();
  for(const meta of items){
    try{
      const existing=await self.registration.backgroundFetch.get(meta.id);
      if(existing) continue;
      const request=new Request(meta.url,{
        mode:'cors',
        credentials:'omit',
        cache:'no-store'
      });
      await self.registration.backgroundFetch.fetch(
        meta.id,
        [request],
        {title:'みつことばのモデルを準備中'}
      );
    }catch(error){
      console.warn('Background Fetch start skipped',meta.url,error);
    }
  }
}

self.addEventListener('message',event=>{
  const message=event.data||{};
  if(message.type==='track-model-download'){
    const url=String(message.url||'');
    const cacheName=String(message.cacheName||'');
    const cacheKey=String(message.cacheKey||'');
    if(!url||!cacheName||!cacheKey) return;
    const id='mitsukotoba-model-'+bgHash(url);
    event.waitUntil(saveBgMeta({id,url,cacheName,cacheKey}));
    return;
  }
  if(message.type==='start-background-downloads'){
    event.waitUntil(startTrackedBackgroundDownloads());
  }
});

self.addEventListener('backgroundfetchsuccess',event=>{
  event.waitUntil((async()=>{
    const meta=await loadBgMeta(event.registration.id);
    if(!meta) return;
    const records=await event.registration.matchAll();
    const target=await caches.open(meta.cacheName);
    for(const record of records){
      try{
        const response=await record.responseReady;
        if(response?.ok) await target.put(meta.cacheKey,response.clone());
      }catch(error){
        console.warn('Background Fetch response cache failed',error);
      }
    }
    await deleteBgMeta(meta.id);
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of clients){
      client.postMessage({type:'background-model-ready',url:meta.url});
    }
  })());
});
