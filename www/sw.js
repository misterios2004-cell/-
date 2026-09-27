// Офлайн-кэш установленного веб-приложения. Увеличьте версию при изменении файлов.
const CACHE = 'lisi-nory-v3';
const FILES = ['./', 'index.html', 'css/style.css', 'vendor/three.min.js', 'vendor/capacitor.js', 'manifest.webmanifest',
  'js/main.js', 'js/theme.js', 'js/core.js', 'js/data.js', 'js/models.js', 'js/world.js', 'js/effects.js', 'js/battle.js', 'js/ai.js', 'js/ui.js', 'js/icons.js',
  'icons/icon-192.png', 'icons/apple-touch-icon.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Сначала сеть, без неё — кэш.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
