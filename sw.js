const CACHE = 'concursos-shell-v6';
const SHELL = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Solo cachea el "shell" de la app (HTML/manifest). Las peticiones a
// r.jina.ai (búsqueda de concursos) y a otros sitios siempre van a la red,
// para que la lista de concursos y la lectura de convocatorias estén al día.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // deja pasar peticiones externas
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
