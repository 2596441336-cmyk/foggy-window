/* 离线缓存：只缓存本站文件。网页优先走网络（更新能马上生效），断网时用缓存。 */
const VERSION = 'foggy-v1';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/scenes.js', 'js/glass.js', 'js/audio.js', 'js/app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try { const res = await withTimeout(fetch(req), 4000); if (res && res.ok) cache.put(req, res.clone()); return res; }
    catch (err) { const hit = await cache.match(req, { ignoreSearch: true }); if (hit) return hit; if (req.mode === 'navigate') { const idx = await cache.match('index.html'); if (idx) return idx; } throw err; }
  })());
});
