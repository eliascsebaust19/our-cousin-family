/* eslint-disable no-restricted-globals */
const CACHE_NAME = "ocf-v2";
const OFFLINE_FALLBACK = "/offline.html";

const PRECACHE_ASSETS = [
  OFFLINE_FALLBACK,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon.svg",
  "/apple-touch-icon.png",
  "/favicon.ico",
];

// Install: precache offline fallback and essential icons
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch((err) => console.warn("PWA precache warning:", err)),
  );
});

// Activate: delete all outdated static caches and take immediate control
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Fetch: safe, privacy-preserving caching
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // PRIVACY & SECURITY: NEVER cache APIs, auth sessions, or backend services
  const isExcluded =
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("livekit.cloud") ||
    url.protocol.startsWith("ws");

  if (isExcluded) {
    return;
  }

  // Navigation requests: Network-first.
  // CRITICAL: NEVER return Response.error() because Chromium will display a raw browser crash page.
  // If the user is genuinely offline, serve the offline fallback page with 200 OK.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => {
        try {
          const cache = await caches.open(CACHE_NAME);
          const fallback = await cache.match(OFFLINE_FALLBACK);
          if (fallback) return fallback;
        } catch {}

        return new Response(
          '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Our Cousin Family</title><style>body{font-family:sans-serif;text-align:center;padding:48px 24px;background:#fbf7f0;color:#1d2b22}button{background:#1d6a4c;color:#fff;border:none;padding:12px 24px;border-radius:9999px;cursor:pointer;font-weight:600;font-size:14px}</style></head><body><h2>You are currently offline</h2><p>Please check your internet connection.</p><br><button onclick="window.location.reload()">Retry Connection</button></body></html>',
          {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          },
        );
      }),
    );
    return;
  }

  // Static immutable assets: Next.js static files, fonts, public icons/images
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico");

  if (isStatic) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((response) => {
            if (response && response.status === 200 && response.type === "basic") {
              const toCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, toCache));
            }
            return response;
          })
          .catch(() => cached || Response.error());
      }),
    );
  }
});
