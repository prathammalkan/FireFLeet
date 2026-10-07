// FireFleet Service Worker
// EDGE-02 FIX: Correct icon paths (SVG not PNG)
// EDGE-03 FIX: Versioned cache name — update SW_VERSION on each deploy
// SEC-02 FIX: Never cache navigation responses (HTML) — they contain auth-gated content

const SW_VERSION = 'v4';
const STATIC_CACHE = `firefleet-static-${SW_VERSION}`;
const ASSET_CACHE = `firefleet-assets-${SW_VERSION}`;

// Only cache truly static, public, non-auth assets
const PRECACHE_ASSETS = [
  '/manifest.json',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // addAll fails silently per-item if an asset 404s; use individual adds with error handling
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Failed to precache:', url, err);
          })
        )
      );
    })
  );
  // Take control immediately without waiting for old SW to be released
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== ASSET_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET requests (POST/PUT/DELETE must never be intercepted)
  if (request.method !== 'GET') return;

  // 2. Skip cross-origin requests except our own assets
  if (url.origin !== self.location.origin) return;

  // 3. SEC-02 FIX: NEVER cache navigation (HTML page) requests.
  //    These are auth-protected and contain/display financial data.
  //    Always fetch from network; if offline, show a plain offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        // Return a minimal offline HTML page (no cached financial data)
        return new Response(
          `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>FireFleet — Offline</title>
  <style>
    body{margin:0;min-height:100dvh;display:flex;flex-direction:column;align-items:center;
         justify-content:center;background:#0a0a0f;color:#fff;font-family:-apple-system,sans-serif;
         text-align:center;padding:2rem}
    h1{font-size:1.5rem;font-weight:900;margin-bottom:.5rem}
    p{color:#9ca3af;font-size:.9rem;margin-bottom:2rem}
    button{padding:.75rem 1.5rem;border-radius:1rem;background:#f97316;color:#fff;
           font-weight:700;border:none;font-size:1rem;cursor:pointer}
  </style>
</head>
<body>
  <div style="font-size:3rem;margin-bottom:1rem">📡</div>
  <h1>You're offline</h1>
  <p>FireFleet needs a connection to securely load your financial data.</p>
  <button onclick="location.reload()">Retry</button>
</body>
</html>`,
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-store',
            },
          }
        );
      })
    );
    return;
  }

  // 4. Skip Supabase API calls — must always go to network
  if (url.hostname.includes('supabase.co')) return;

  // 5. Static assets (JS, CSS, fonts, icons) — cache-first strategy
  //    These contain no personal data and are safe to cache.
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname === '/manifest.json';

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok && response.status === 200) {
            const clone = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
  }
  // All other requests (API routes, auth, etc.) go straight to network
});
