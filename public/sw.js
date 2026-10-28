// FireFleet Service Worker v6
// SEC-02: Navigation requests (HTML) are never cached — they contain auth-gated content
// PERF: Content-hashed static assets use cache-first
// SEC: Only same-origin requests with OK responses are stored in cache

const SW_VERSION = 'v6';
const STATIC_CACHE = `firefleet-static-${SW_VERSION}`;
const ASSET_CACHE = `firefleet-assets-${SW_VERSION}`;

// Only truly static, public, non-auth assets
const PRECACHE_ASSETS = [
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
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
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET requests (POST/PUT/DELETE must never be intercepted)
  if (request.method !== 'GET') return;

  // 2. Skip cross-origin requests (Supabase API, Google OAuth, etc.)
  if (url.origin !== self.location.origin) return;

  // 3. SEC-02: NEVER cache navigation (HTML page) requests.
  //    These are auth-protected and display financial data.
  //    Always fetch from network; if offline, show branded offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => offlinePage())
    );
    return;
  }

  // 4. Static Next.js chunks — cache-first (content-hashed filenames)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            // SEC: Only cache same-origin, successful responses
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  // 5. Icons + manifest — cache-first
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  // 6. All other same-origin requests (API routes, auth callbacks) — network only
});

// ── Message handler ────────────────────────────────────────────────────────
// Allow pages to send { type: 'SKIP_WAITING' } to force SW update
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Offline page ──────────────────────────────────────────────────────────────
function offlinePage() {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>FireFleet — Offline</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{min-height:100dvh;display:flex;flex-direction:column;align-items:center;
         justify-content:center;background:#0a0a0f;color:#fff;
         font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         text-align:center;padding:2rem;-webkit-font-smoothing:antialiased}
    .icon{font-size:3.5rem;margin-bottom:1.25rem;animation:float 3s ease-in-out infinite}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
    h1{font-size:1.5rem;font-weight:900;margin-bottom:.5rem;letter-spacing:-.02em}
    p{color:#9ca3af;font-size:.9rem;margin-bottom:2rem;line-height:1.6;max-width:280px}
    button{padding:.875rem 2rem;border-radius:1rem;background:linear-gradient(135deg,#f97316,#ea580c);
           color:#fff;font-weight:700;border:none;font-size:1rem;cursor:pointer;
           box-shadow:0 8px 24px rgba(249,115,22,.3);transition:opacity .15s;touch-action:manipulation}
    button:active{opacity:.8}
    .hint{margin-top:1.5rem;font-size:.75rem;color:#4b5563}
  </style>
</head>
<body>
  <div class="icon">📡</div>
  <h1>You're offline</h1>
  <p>FireFleet needs a connection to securely load your financial data.</p>
  <button onclick="location.reload()">Retry</button>
  <p class="hint">Your data is safe in the cloud and will load once you're back online.</p>
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
}
