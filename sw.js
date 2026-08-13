/* 改動 index.html 後把 VERSION 加一號，否則使用者會拿到舊快取 */
const VERSION = 'v2';
const CACHE   = 'luzhou-vote-' + VERSION;
const ASSETS  = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys()
      .then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  // Firebase / TDX 一律走網路，不進快取
  if(url.origin !== location.origin) return;

  // 導覽請求：先連網，失敗才用快取 —— 改版才不會卡在舊頁面
  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req)
        .then(r=>{ caches.open(CACHE).then(c=>c.put('./index.html', r.clone())); return r; })
        .catch(()=>caches.match('./index.html'))
    );
    return;
  }

  // 靜態資源：快取優先，背景補網路
  e.respondWith(
    caches.match(req).then(hit =>
      hit || fetch(req).then(r=>{
        if(r.ok) caches.open(CACHE).then(c=>c.put(req, r.clone()));
        return r;
      })
    )
  );
});
