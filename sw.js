const CACHE_NAME = 'shot-designer-v3';
const ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/canvas-manager.js',
  './js/touch-handler.js',
  './js/pdf-loader.js',
  './js/actor-icon.js',
  './js/camera-icon.js',
  './js/movement-arrow.js',
  './js/export-manager.js',
  './js/history-manager.js',
  './js/trail-manager.js',
  './js/text-tool.js',
  './manifest.json',
];

// CDN assets to cache
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/fabric@6.0.2/dist/index.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache local assets first
      return cache.addAll(ASSETS).then(() => {
        // Cache CDN assets (don't fail install if CDN is down)
        return Promise.allSettled(
          CDN_ASSETS.map(url => cache.add(url))
        );
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
