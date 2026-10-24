/* Research-scope COI headers for pages AND their module worker scripts.
 * A navigation-only COEP shim leaves module workers without equivalent policy,
 * which can cause a generic Worker startup failure even when the page is isolated.
 */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  // Never rewrite third-party model downloads or cross-origin CDN assets.
  const request=event.request,url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(request.cache==='only-if-cached'&&request.mode!=='same-origin')return;
  event.respondWith((async()=>{
    const response=await fetch(request);
    if(!response.ok||response.type==='opaque'||response.type==='opaqueredirect')return response;
    const headers=new Headers(response.headers);
    headers.set('Cross-Origin-Opener-Policy','same-origin');
    headers.set('Cross-Origin-Embedder-Policy','require-corp');
    headers.set('Cross-Origin-Resource-Policy','same-origin');
    return new Response(response.body,{
      status:response.status,statusText:response.statusText,headers
    });
  })());
});
