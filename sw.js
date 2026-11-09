/* =========================================================
   QANDEL — service worker
   ---------------------------------------------------------
   Two responsibilities, nothing more:

   1. Make the game installable and playable offline.
   2. Never serve a stale build. The cache name carries a
      version string; bumping it retires every old entry on
      the next activation.

   Strategy per request type:
     · navigations  → network first, cache as fallback
                      (a deploy is picked up immediately, but
                       the game still opens with no network)
     · same-origin  → cache first, network as fallback
       assets         (scripts, styles and icons never change
                       mid-session)
     · cross-origin → network only, never cached
                      (Google Fonts returns opaque responses
                       that render blank when replayed from
                       Cache Storage)

   Anything that is not a GET is passed straight through.
   The game has no backend, but the worker stays honest.
   ========================================================= */

const VERSION = 'qandel-v7';
const CACHE   = VERSION;

/* The shell — every file the game needs to boot and be
   playable without a network. levels.js and game.js are
   large, but they are the game; caching them is the whole
   point. */
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './i18n.js',
  './levels.js',
  './game.js',
  './manifest.webmanifest',
  './assets/bg.png',
  './icons/icon.svg',
  './icons/maskable.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png'
];

/* The shell is non-negotiable: if any of these fail to
   cache, the install is allowed to fail. A half-cached game
   is worse than no game. */
const REQUIRED = [
  './index.html',
  './styles.css',
  './i18n.js',
  './levels.js',
  './game.js'
];

/* =========================================================
   INSTALL
   Each asset is added individually. A missing optional
   asset — an icon that was never generated, a manifest that
   was not shipped — is logged and skipped, so the install
   still succeeds and the game is still installable. Only a
   missing shell file fails the install.
   ========================================================= */
self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE).then(function(cache){
      return Promise.all(
        PRECACHE.map(function(url){
          return cache.add(new Request(url, { cache: 'reload' }))
            .catch(function(){
              console.warn('[qandel sw] skipped (not cached):', url);
            });
        })
      ).then(function(){
        return Promise.all(REQUIRED.map(function(url){
          return cache.match(url).then(function(hit){
            if(!hit) throw new Error('shell file missing from cache: ' + url);
          });
        }));
      });
    }).then(function(){
      return self.skipWaiting();
    })
  );
});

/* =========================================================
   ACTIVATE
   Every cache whose name is not the current CACHE is
   deleted, then this worker claims the open tabs so the
   game switches over without a reload.
   ========================================================= */
self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.map(function(key){
          if(key !== CACHE) return caches.delete(key);
        })
      );
    }).then(function(){
      return self.clients.claim();
    })
  );
});

/* =========================================================
   FETCH
   ========================================================= */
self.addEventListener('fetch', function(event){
  const req = event.request;

  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.protocol !== 'http:' && url.protocol !== 'https:') return;

  /* ---- navigations: network first, cache as fallback ---- */
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

  /* ---- cross-origin: never cached ---- */
  if(url.origin !== self.location.origin) return;

  /* ---- same-origin assets: cache first ---- */
  event.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        if(res && res.status === 200 && res.type === 'basic'){
          const copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});

/* =========================================================
   MESSAGE CHANNEL
   The page can ask the worker to activate a waiting build
   immediately, which is what the "update" flow in game.js
   uses.
   ========================================================= */
self.addEventListener('message', function(event){
  if(event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});