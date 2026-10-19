const CACHE='emma-web-shell-v148-private-asr-intro';
const SHELL=['./src/multilingual/core.js','./src/multilingual/translations.js','./src/multilingual/ui.js','./src/multilingual/about-page.js','./src/multilingual/client.js','./src/multilingual/worker.js','./src/multilingual/assets.js','./src/multilingual/assets.json','./src/multilingual/semantic-client.js','./src/prerecorded-voice.js?v=20261015-recorded-only','./src/prerecorded-voice.js','./assets/voice-1202/manifest.json','./semantic-test.html','./src/semantic/panel.js','./src/semantic/controller.js','./src/semantic/core.js','./src/semantic/client.js','./src/semantic/worker.js','./src/semantic/download.js', './src/semantic/tokenize.js','./src/semantic-assets-manifest.json','./src/conversation-history.js','./src/feature-screens.js','./src/app-navigation.js','./shared/play-topics.json','./','./index.html','./topic-guide.html','./reset.html','./styles.css','./manifest.webmanifest','./icons/mitsukotoba-baby-abc-v2-192.png','./assets/mitsukotoba-parent.png','./assets/mitsukotoba-baby.png','./assets/mitsukotoba-ai.png','./assets/emma-face/emma-face-idle-open.svg','./assets/emma-face/emma-face-idle-half.svg','./assets/emma-face/emma-face-idle-closed.svg','./assets/emma-face/emma-face-talk-small.svg','./assets/emma-face/emma-face-talk-medium.svg','./assets/emma-face/emma-face-talk-large.svg','./assets/emma-face/emma-face-talk-small-half.svg','./assets/emma-face/emma-face-talk-small-closed.svg','./assets/emma-face/emma-face-talk-medium-half.svg','./assets/emma-face/emma-face-talk-medium-closed.svg','./assets/emma-face/emma-face-talk-large-half.svg','./assets/emma-face/emma-face-talk-large-closed.svg','./src/app.js','./src/asr-worker.js','./src/moonshine-keyterm-bias.js','./src/asr-client.js','./src/turn-revisions.js','./src/emma-color-palettes.js','./src/resumable-download.js','./src/moonshine-module.js','./src/audio-capture.js','./src/silero-capture.js','./src/silero-endpoint.js','./src/silero-worker.js','./src/lite-response-engine.js','./src/interaction/diagnostics.js','./src/interaction/diversity.js','./src/interaction/frequent-replies.js','./src/interaction/supplemental-replies.js','./src/interaction/ruri-routing.js','./src/interaction/response.js','./src/lite-topic-matcher.js','./src/lite-phonetic-scene-matcher.js','./src/tts-worker.js','./worklets/pcm-capture-worklet.js'];

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

  // The voice worker owns a checksum-verified cache; avoid duplicate media storage.
  if(url.pathname.includes('/assets/voice-1202/')) {
    event.respondWith(fetch(event.request).then(withIsolationHeaders));
    return;
  }

  // Silero has its own SHA-256-verified model cache in the VAD worker.
  // Avoid a second, unverified copy in the shell cache.
  if(url.pathname.includes('/assets/vad/')) {
    event.respondWith(fetch(event.request).then(withIsolationHeaders));
    return;
  }

  // These are opt-in, SHA-256-verified assets cached by the semantic worker.
  // Do not duplicate ~93 MB into the ordinary shell cache.
  if(url.pathname.includes('/semantic-assets/') || url.pathname.includes('/multilingual-assets/')) {
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
        // Online-first Web: never boot stale application logic on network failure.
        .catch(()=>Response.error())
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
        {title:meta.title||'Preparing speech models'}
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
    const title=String(message.title||'Preparing speech models').slice(0,110);
    const id='mitsukotoba-model-'+bgHash(url);
    event.waitUntil(saveBgMeta({id,url,cacheName,cacheKey,title}));
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
