/* MinusOne service worker — cache-first so the app works offline once installed */
const CACHE = 'minusone-v2';
const ASSETS = [
  '.', 'index.html', 'manifest.json',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/neuemontreal/NeueMontreal-Regular.otf',
  'fonts/neuemontreal/NeueMontreal-Italic.otf',
  'fonts/neuemontreal/NeueMontreal-Medium.otf',
  'fonts/neuemontreal/NeueMontreal-Bold.otf',
  'fonts/diatype/ABCDiatypeMono-Regular-Trial.otf',
  'fonts/diatype/ABCDiatypeMono-Medium-Trial.otf',
  'fonts/diatype/ABCDiatypeMono-Bold-Trial.otf'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  // navigations: network-first so app updates arrive; fall back to cache offline
  if(e.request.mode === 'navigate'){
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('index.html', copy));
        return res;
      }).catch(() => caches.match('index.html'))
    );
    return;
  }
  // static assets: cache-first
  e.respondWith(
    caches.match(e.request, {ignoreSearch:true}).then(hit =>
      hit || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
    ).catch(() => caches.match('index.html'))
  );
});
