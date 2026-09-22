const CACHE='emma-web-shell-v10';
const SHELL=['./','./index.html','./styles.css','./manifest.webmanifest','./icons/emma.svg','./src/app.js','./src/audio-capture.js','./src/lite-response-engine.js','./src/name-pronunciation.js','./src/asr-worker.js','./src/tts-worker.js','./worklets/pcm-capture-worklet.js'];

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k.startsWith('emma-web-shell-')&&k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
));

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;

  const isAppCode =
    event.request.mode==='navigate' ||
    ['document','script','style'].includes(event.request.destination) ||
    /\.(?:html|js|css)$/.test(url.pathname);

  if(isAppCode){
    event.respondWith(
      fetch(event.request)
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(c=>c.put(event.request,copy));
          return response;
        })
        .catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>{
      const network=fetch(event.request).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(c=>c.put(event.request,copy));
        return response;
      }).catch(()=>cached);
      return cached || network;
    })
  );
});
