const CACHE="evolucao-corporal-v11.17-navfix";
const STATIC=["./","./index.html","./styles.css?v=10.8.0","./theme-v11.css?v=11.9.0","./app.js?v=10.6.1","./billing-v11.js?v=11.0.1","./ui-neon-v11.js?v=11.11.0","./config.js","./chat-v1.js?v=1.0.5","./brand-background.jpg"];

self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache=>cache.addAll(STATIC)).catch(()=>{})
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys()){
      if(key!==CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch",event=>{
  const req=event.request;
  const url=new URL(req.url);

  if(url.hostname.includes("supabase.co") || url.hostname.includes("jsdelivr.net")) return;

  if(req.mode==="navigate"){
    event.respondWith(
      fetch(req,{cache:"no-store"})
        .then(res=>{
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put("./index.html",copy)).catch(()=>{});
          return res;
        })
        .catch(()=>caches.match("./index.html"))
    );
    return;
  }

  const isCore =
    url.pathname.endsWith("/app.js") ||
    url.pathname.endsWith("/ui-neon-v11.js") ||
    url.pathname.endsWith("/chat-v1.js") ||
    url.pathname.endsWith("/styles.css") ||
    url.pathname.endsWith("/theme-v11.css") ||
    url.pathname.endsWith("/billing-v11.js") ||
    url.pathname.endsWith("/config.js") ||
    url.pathname.endsWith("/manifest.webmanifest");

  if(isCore){
    event.respondWith(
      fetch(req,{cache:"no-store"})
        .then(res=>{
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
          return res;
        })
        .catch(()=>caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached=>cached||fetch(req).then(res=>{
      const copy=res.clone();
      caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});
      return res;
    }))
  );
});
