const CACHE='hoztools-v9-3-domain',PREFIX='hoztools-',OFFLINE='/offline.html';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll([OFFLINE]))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith('/'))return;
 if(request.mode!=='navigate'&&!/\.(?:js|css|png|svg|ttf|woff2?|mjs|bcmap)$/.test(url.pathname))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(request);if(response.ok&&response.type==='basic'){const copy=response.clone();event.waitUntil(cache.put(request,copy).catch(()=>{}))}return response}catch{const cached=await cache.match(request);if(cached)return cached;if(request.mode==='navigate')return await cache.match(OFFLINE);return Response.error()}})());
});
