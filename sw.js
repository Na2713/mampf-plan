// ===== Service Worker: macht die App installierbar und startet sie auch ohne Internet =====
// WICHTIG: Bei jeder Änderung an den App-Dateien VERSION erhöhen, und neue Dateien in DATEIEN eintragen.

const VERSION = "mampf-plan-v2";

const DATEIEN = [
  "./",
  "./index.html",
  "./style.css",
  "./config.js",
  "./db.js",
  "./figuren.js",
  "./regeln.js",
  "./person.js",
  "./admin.js",
  "./admin-woche.js",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js",
];

// Beim Installieren alle Dateien in den Zwischenspeicher legen
self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

// Alte Zwischenspeicher aufräumen
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(namen => Promise.all(namen.filter(n => n !== VERSION).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Erst im Internet nachsehen (immer die neueste Version), nach 3 Sekunden oder offline aus dem Speicher
self.addEventListener("fetch", event => {
  const anfrage = event.request;
  if (anfrage.method !== "GET") return;
  const url = new URL(anfrage.url);
  const eigeneDatei = url.origin === self.location.origin;
  const bibliothek = url.href.startsWith("https://cdn.jsdelivr.net/");
  if (!eigeneDatei && !bibliothek) return; // Datenbank-Anfragen (Supabase) nie zwischenspeichern

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const ausSpeicher = () => cache.match(anfrage, { ignoreSearch: true });
    try {
      const antwort = await Promise.race([
        fetch(anfrage),
        new Promise((_, nein) => setTimeout(() => nein(new Error("zu langsam")), 3000)),
      ]);
      if (antwort.ok) cache.put(anfrage, antwort.clone());
      return antwort;
    } catch (err) {
      return (await ausSpeicher()) || (await cache.match("./index.html")) || Response.error();
    }
  })());
});
