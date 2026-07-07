// Service worker for Jui's SQE1 Flashcard Hub.
// Caches the app shell so the deck and all study progress UI work fully
// offline. Card progress itself lives in localStorage, not here, so it is
// untouched by cache updates.
//
// CACHE_VERSION bumped (v3 -> v4) to force existing installs to pick up
// the new index.html: 1,293 cards, reset button moved to sidebar,
// full mobile responsive layout.

const CACHE_VERSION = "jui-sqe1-v4";
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

// Navigation requests go NETWORK-FIRST so fresh deploys show up on next
// reload. Everything else (icons, manifest) is CACHE-FIRST for offline speed.
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
