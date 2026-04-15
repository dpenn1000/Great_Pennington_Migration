/* sw.js — The Great Pennington Migration
   Strategy: network-first for app shell + data, cache-first for CDN assets.
   Supabase API calls are never cached (live data only).
*/

const CACHE_NAME = 'pennington-v2';

const PRECACHE = [
  '/Great_Pennington_Migration/mobile.html',
  '/Great_Pennington_Migration/data/properties.json',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/@fontsource/cormorant-garamond@5/700.css',
];

const CDN_HOSTS = [
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'fonts.gstatic.com',
  'a.basemaps.cartocdn.com',
  'b.basemaps.cartocdn.com',
  'c.basemaps.cartocdn.com',
];

// ---- INSTALL: precache critical assets ----
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        PRECACHE.map(url => cache.add(url).catch(() => null))
      );
    }).then(() => self.skipWaiting())
  );
});

// ---- ACTIVATE: clean old caches ----
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ---- FETCH: routing strategy ----
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never cache Supabase API calls — live data only
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for CDN assets (Leaflet, fonts, map tiles)
  if (CDN_HOSTS.some(h => url.hostname === h)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Network-first for app shell + properties.json
  event.respondWith(networkFirst(event.request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(
      '<h2 style="font-family:sans-serif;padding:32px;color:#4A2608">App not yet cached — please open once while online.</h2>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}
