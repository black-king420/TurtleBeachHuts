/* Turtle Beach Huts Karachi — service worker
   Strategy: precache the app shell, cache-first for images/fonts/CDN libs,
   network-first for pages (so updates show up), offline fallback page.
   Firebase / Firestore / Google API calls are never cached. */
const VERSION = 'tbhk-v1.3.0';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const PRECACHE = [
  './', 'index.html', 'home.html', 'beach-hut.html', 'gallery.html', 'packages.html',
  'booking.html', 'contact.html', 'auth.html', 'offline.html', '404.html',
  'css/style.css', 'css/app.css', 'css/auth.css',
  'js/main.js', 'js/app.js', 'js/catalog.js', 'js/content.js', 'js/session.js',
  'vendor/bootstrap/bootstrap.min.css', 'vendor/bootstrap/bootstrap.bundle.min.js', 'vendor/fontawesome/css/all.min.css',
  'vendor/swiper/swiper-bundle.min.css', 'vendor/swiper/swiper-bundle.min.js', 'vendor/aos/aos.css', 'vendor/aos/aos.js', 'js/auth.js', 'js/data-store.js', 'js/firebase-config.js',
  'manifest.json', 'images/logo.png', 'images/icons/icon-192.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL).then(c => Promise.allSettled(PRECACHE.map(u => c.add(u)))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

const NEVER_CACHE = /(firestore|firebaseio|identitytoolkit|securetoken|googleapis\.com\/(identitytoolkit|v1)|google-analytics|\/__\/auth)/i;

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (NEVER_CACHE.test(url.href)) return;
  if (req.headers.has('range')) return; // let video seeking hit the network

  // Pages: network-first, fall back to cache, then offline page
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(RUNTIME).then(c => c.put(req, copy));
        return res;
      }).catch(async () => (await caches.match(req, { ignoreSearch: true })) || caches.match('offline.html'))
    );
    return;
  }

  // Everything else: stale-while-revalidate (fast + self-updating)
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(RUNTIME).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
