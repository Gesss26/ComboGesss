// Service worker ComboGesss — aumenta VERSION a ogni rilascio per forzare l'aggiornamento
const VERSION = "cg-v4";
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const SHELL_FILES = [
  "./",
  "./index.html",
  "./statistiche-partita.js",
  "./manifest.webmanifest",
  "./tailwind.css",
  "./Splashscreen.png",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((c) => Promise.all(SHELL_FILES.map((f) => c.add(f).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Rete prima (dati sempre aggiornati), cache se offline
async function networkFirst(request, cacheName) {
  try {
    // no-cache: salta la cache HTTP del browser/GitHub Pages, così vedi subito i file nuovi
    const fresh = await fetch(request, { cache: "no-cache" });
    if (fresh && fresh.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw err;
  }
}

// Cache subito, aggiorna in background (librerie CDN, font, bandiere)
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => { if (res && (res.ok || res.type === "opaque")) cache.put(request, res.clone()); return res; })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // File dati e pagine: rete prima
    event.respondWith(networkFirst(req, url.pathname.includes("/data/") ? RUNTIME : SHELL));
    return;
  }
  event.respondWith(staleWhileRevalidate(req));
});
