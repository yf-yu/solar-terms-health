
'use strict';

const SW_VERSION = 'v3.4.0';
const SW_CACHE_PREFIX = 'solar-terms-health-';
const SW_CACHE = SW_CACHE_PREFIX + SW_VERSION;

const SW_CORE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/data.js',
  './js/app.js',
  './js/journal-ux.js',
  './js/pwa-update.js',
  './js/tools.js',
  './js/wellness-integration.js',
  './js/constitution.js',
  './icons/web-app-manifest-192x192.png',
  './icons/web-app-manifest-512x512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.ico'
];

function swURL(path) {
  return new URL(path, self.registration.scope).href;
}

const SW_OFFLINE_URL = swURL('./index.html');

/* ── 安裝：所有必要檔案成功後才完成 ── */

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SW_CACHE);

    const requests = SW_CORE_FILES.map(path => {
      return new Request(swURL(path), {
        cache: 'reload'
      });
    });

    await cache.addAll(requests);

    // 不呼叫 skipWaiting()。
    // 等使用者按下「立即更新」再啟用。
  })());
});

/* ── 啟用：清除本專案舊版快取 ── */

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();

    const oldCaches = names.filter(name => {
      const isOurCache =
        name.startsWith(SW_CACHE_PREFIX) ||
        /^solar-v\d/.test(name);

      return isOurCache && name !== SW_CACHE;
    });

    await Promise.all(
      oldCaches.map(name => caches.delete(name))
    );

    await self.clients.claim();
  })());
});

/* ── 網站範圍判斷 ── */

function swInsideApp(request) {
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);

  return (
    url.origin === scope.origin &&
    url.pathname.startsWith(scope.pathname)
  );
}

function swCanCache(response) {
  return (
    response &&
    response.ok &&
    response.type === 'basic'
  );
}

/* ── 網路優先 ── */

async function swNetworkFirst(request) {
  const cache = await caches.open(SW_CACHE);

  try {
    const response = await fetch(request);

    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }

    if (swCanCache(response)) {
      try {
        await cache.put(request, response.clone());
      } catch (error) {
        console.warn('快取寫入失敗', error);
      }
    }

    return response;
  } catch (error) {
    const cached = await cache.match(request, {
      ignoreSearch: true
    });

    if (cached) return cached;

    if (request.mode === 'navigate') {
      const fallback = await cache.match(SW_OFFLINE_URL);

      if (fallback) return fallback;
    }

    return Response.error();
  }
}

/* ── 快取優先 ── */

async function swCacheFirst(request) {
  const cache = await caches.open(SW_CACHE);

  const cached = await cache.match(request);

  if (cached) return cached;

  try {
    const response = await fetch(request);

    if (swCanCache(response)) {
      try {
        await cache.put(request, response.clone());
      } catch (error) {
        console.warn('圖片快取失敗', error);
      }
    }

    return response;
  } catch {
    return Response.error();
  }
}

/* ── 請求處理 ── */

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;
  if (!swInsideApp(request)) return;

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(swNetworkFirst(request));
    return;
  }

  const isProgramFile =
    /\.(js|css|html|json)$/i.test(url.pathname);

  if (isProgramFile) {
    event.respondWith(swNetworkFirst(request));
    return;
  }

  event.respondWith(swCacheFirst(request));
});

/* ── 使用者確認後啟用新版 ── */

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
