// Service worker for Jui's SQE1 Flashcard Hub.
// Caches the app shell so the deck and all study progress UI work fully
// offline. Card progress itself lives in localStorage, not here, so it is
// untouched by cache updates.
//
// CACHE_VERSION bumped (v2 -> v3) specifically to force every existing
// install to detect this file as changed, install a new service worker, and
// throw away the old v2 cache. Bump this string again on any future
// deploy where the fetch strategy itself needs a hard reset; routine
// content updates no longer require it (see fetch handler below).

const CACHE_VERSION = "jui-sqe1-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Strategy split by request type, so a fresh deploy is visible on the very
// next reload instead of depending on a background revalidation that may
// not have finished yet (this is what caused the last update to seem like
// it "didn't show up" until a second or third reload):
//
// - Navigation requests (the actual HTML page) go NETWORK-FIRST: always try
//   to fetch the latest deployed index.html, and only fall back to the
//   cached copy if there's no connection. This is the piece that was
//   previously cache-first and silently serving yesterday's build.
// - Everything else (manifest, icons) stays CACHE-FIRST with a background
//   revalidate, since those almost never change and cache-first keeps the
//   app opening instantly offline.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  var isNavigation = event.request.mode === "navigate" ||
    (event.request.destination === "document");

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            var copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
