/* =========================================================
   QANDIL — service worker
   ---------------------------------------------------------
   Two jobs, nothing more:

   1. Make the game installable and playable offline.
   2. Never serve a stale build. The cache name carries a
      version string; bumping it retires every old entry on the
      next activation.

   Strategy per request type:
     · navigations  → network first, cache as fallback
                      (so a deploy is picked up immediately,
                       but the game still opens with no network)
     · same-origin  → cache first, network as fallback
       assets         (fonts, scripts, css never change mid-run)
     · cross-origin → network only, never cached
                      (Google Fonts throws opaque responses into
                       Cache Storage if you let it, which then
                       fail to render offline)

   Anything that is not a GET is passed straight through — the
   game has no backend, but this keeps the worker honest.
   ========================================================= */

const VERSION = 'qandil-v1';
const CACHE   = VERSION;

/* The shell. Every file the game needs to boot and be playable
   without a network. levels.js and game.js are large but they are
   the game — caching them is the whole point. */
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './i18n.js',
  './levels.js',
  './game.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/maskable.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png'
];

/* ---------- install ---------- */
self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE).then(function(cache){
      /* addAll rejects the whole install if ONE file 404s, which
         would leave the game permanently un-installable. Add each
         entry individually and tolerate failures — a missing icon
         must not break the offline shell. */
      return Promise.all(
        PRECACHE.map(function(url){
          return cache.add(new Request(url, { cache: 'reload' }))
            .catch(function(){ /* ignore a single missing file */ });
        })
      );
    }).then(function(){
      /* activate this worker as soon as it is installed */
      return self.skipWaiting();
    })
  );
});

/* ---------- activate ---------- */
self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.map(function(key){
          if(key !== CACHE) return caches.delete(key);
        })
      );
    }).then(function(){
      /* take control of already-open tabs immediately */
      return self.clients.claim();
    })
  );
});

/* ---------- fetch ---------- */
self.addEventListener('fetch', function(event){
  const req = event.request;

  /* only GET is cacheable, and only http(s) */
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.protocol !== 'http:' && url.protocol !== 'https:') return;

  /* ---- navigations: network first ---- */
  if(req.mode === 'navigate'){
    event.respondWith(
      fetch(req)
        .then(function(res){
          const copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
          return res;
        })
        .catch(function(){
          return caches.match(req).then(function(hit){
            return hit || caches.match('./index.html');
          });
        })
    );
    return;
  }

  /* ---- cross-origin: never cache ---- */
  if(url.origin !== self.location.origin) return;

  /* ---- same-origin assets: cache first ---- */
  event.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        /* only cache a real, complete, same-origin response */
        if(res && res.status === 200 && res.type === 'basic'){
          const copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){
        /* offline and not cached — nothing sensible to return */
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});

/* ---------- message channel ----------
   The page can ask the worker to activate a waiting build
   immediately, which is what the "update" toast in game.js does. */
self.addEventListener('message', function(event){
  if(event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});