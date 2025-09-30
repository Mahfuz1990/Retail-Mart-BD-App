const CACHE = 'rmbd-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './data/app-config.json',
  './data/products.json'
];

self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(CACHE).then(cache=> cache.addAll(ASSETS)).then(()=> self.skipWaiting())
  );
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=> Promise.all(keys.filter(k=>k!==CACHE).map(k=> caches.delete(k))))
      .then(()=> self.clients.claim())
  );
});

self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);

  // HTML navigation: Network first
  if(e.request.mode === 'navigate'){
    e.respondWith(
      fetch(e.request).then(res=>{
        const copy = res.clone();
        caches.open(CACHE).then(c=> c.put(e.request, copy));
        return res;
      }).catch(()=> caches.match(e.request).then(r=> r || caches.match('./index.html')))
    );
    return;
  }

  // JSON (data): Stale-While-Revalidate
  if(url.pathname.includes('/data/')){
    e.respondWith(
      caches.match(e.request).then(cached=>{
        const fetchPromise = fetch(e.request).then(res=>{
          if(res && res.ok){
            const copy = res.clone();
            caches.open(CACHE).then(c=> c.put(e.request, copy));
          }
          return res;
        }).catch(()=> cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Images and others: Cache First
  if(e.request.destination === 'image'){
    e.respondWith(
      caches.match(e.request).then(cached=> cached || fetch(e.request).then(res=>{
        const copy = res.clone();
        caches.open(CACHE).then(c=> c.put(e.request, copy));
        return res;
      }).catch(()=> cached))
    );
    return;
  }

  // Default: try network, fallback cache
  e.respondWith(
    fetch(e.request).catch(()=> caches.match(e.request))
  );
});

// Receive message to skipWaiting (update flow)
self.addEventListener('message', (event)=>{
  if(event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});