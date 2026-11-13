// Sanitas service worker: caches the app so it opens instantly; food data always comes fresh from the network.
const CACHE = 'sanitas-v22';
const SHELL = ['./', 'index.html', 'app.js', 'cosmetics.js', 'animal.js', 'special.js', 'produce.js', 'env.js', 'other.js', 'clothing.js', 'info.js', 'native.js', 'ui.js', 'archivo.woff2', 'archivo-ext.woff2', 'archivo-vi.woff2', 'i18n.js', 'i18n-dict.js', 'healthdb.js', 'labelscan.js', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png',
  'barcode.js', 'zxing_reader.wasm'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Only handle the app's own files. Food databases, USDA and the label-reader CDN go straight to the network.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => { if (r.ok){ const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{}); } return r; })
      .catch(() => caches.match(e.request).then(m => m || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
