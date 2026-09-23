const CACHE='emma-web-shell-v45';
const SHELL=['./','./index.html','./reset.html','./styles.css','./manifest.webmanifest','./icons/emma.svg','./src/app.js','./src/moonshine-module.js','./src/audio-capture.js','./src/lite-response-engine.js','./src/name-pronunciation.js','./src/tts-worker.js','./worklets/pcm-capture-worklet.js','./src/vendor/kitten/index.js','./src/vendor/kitten/kitten-tts.js','./src/vendor/kitten/model-loader.js','./src/vendor/kitten/npz-loader.js','./src/vendor/kitten/phonemizer.js','./src/vendor/kitten/audio.js','./src/vendor/kitten/preprocess.js','./src/vendor/kitten/text-cleaner.js'];

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
