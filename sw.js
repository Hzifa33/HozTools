/* Standalone HozTools service worker.
   migrate-tools.yml regenerates this file on every migration. */
const CACHE='hoztools-standalone-manual-v1';
const OFFLINE='/offline.html';
const STATIC_RE=/\.(?:js|mjs|css|png|jpe?g|webp|gif|svg|ico|ttf|otf|woff2?|bcmap|wasm|icc|pfb)$/i;

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    try{await cache.add(OFFLINE)}catch{}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name.startsWith('hoztools-')&&name!==CACHE).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(request.mode!=='navigate'&&!STATIC_RE.test(url.pathname))return;

  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const response=await fetch(request);
      if(response.ok&&response.type==='basic'){
        event.waitUntil(cache.put(request,response.clone()).catch(()=>{}));
      }
      return response;
    }catch{
      const cached=await cache.match(request);
      if(cached)return cached;
      if(request.mode==='navigate')return (await cache.match(OFFLINE))||Response.error();
      return Response.error();
    }
  })());
});
