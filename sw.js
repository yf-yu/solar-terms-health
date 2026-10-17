
/* =========================================================
   節氣養生｜Service Worker V3.2
   功能：
   1. 離線開啟網站
   2. 有網路時優先取得最新程式
   3. 清除舊版快取
   4. 防止快取錯誤頁面
   5. 不操作使用者的 localStorage
   ========================================================= */

'use strict';

/* ── 版本設定 ── */

// 每次正式修改網站資源時，請更新版本號。
// 例如：v3.2.1、v3.2.2。
const VERSION = 'v3.2.0';

const CACHE_PREFIX = 'solar-terms-health-';
const CACHE_NAME = CACHE_PREFIX + VERSION;

// 舊版專案使用過 solar-v5 等快取名稱。
const LEGACY_CACHE_PREFIX = 'solar-';

/* ── 必要離線資源 ── */

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',

  './css/style.css',

  './js/data.js',
  './js/app.js',
  './js/tools.js',
  './js/constitution.js',

  './icons/web-app-manifest-192x192.png',
  './icons/web-app-manifest-512x512.png'
];

/* ── URL 工具 ── */

function assetURL(path) {
  return new URL(path, self.registration.scope).href;
}

const OFFLINE_PAGE = assetURL('./index.html');

/* ── 安裝 Service Worker ── */

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // 使用重新驗證模式取得新版必要資源。
    // 任何必要檔案下載失敗，就不啟用不完整的新版本。
    const requests = CORE_ASSETS.map(path => {
      return new Request(assetURL(path), {
        cache: 'reload'
      });
    });

    await cache.addAll(requests);

    // 必要資源全部快取成功，才進入等待啟用階段。
    // 不在這裡強制 skipWaiting，避免使用中的頁面
    // 突然切換 Service Worker 版本。
  })());
});

/* ── 啟用與清理舊快取 ── */

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(key => {
          const isOurCache =
            key.startsWith(CACHE_PREFIX) ||
            key.startsWith(LEGACY_CACHE_PREFIX);

          return isOurCache && key !== CACHE_NAME;
        })
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

/* ── 判斷是否為網站內部資源 ── */

function isSameOrigin(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin;
}

function isInsideApp(request) {
  const url = new URL(request.url);

  return (
    url.origin === self.location.origin &&
    url.pathname.startsWith(
      new URL(self.registration.scope).pathname
    )
  );
}

/* ── 判斷是否為核心程式檔案 ── */

function isCoreAsset(request) {
  const requestedURL = new URL(request.url);

  return CORE_ASSETS.some(path => {
    const coreURL = new URL(
      assetURL(path)
    );

    return (
      coreURL.origin === requestedURL.origin &&
      coreURL.pathname === requestedURL.pathname
    );
  });
}

/* ── 判斷回應是否適合快取 ── */

function canCache(response) {
  return (
    response &&
    response.ok &&
    response.type === 'basic'
  );
}

/* ── 網路優先：適用 HTML / JS / CSS ── */

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);

    if (!response.ok) {
      throw new Error(
        'HTTP ' + response.status
      );
    }

    if (canCache(response)) {
      await cache.put(
        request,
        response.clone()
      );
    }

    return response;
  } catch (error) {
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    // 導覽頁面在離線時使用首頁。
    if (request.mode === 'navigate') {
      const fallback = await cache.match(OFFLINE_PAGE);

      if (fallback) {
        return fallback;
      }
    }

    return Response.error();
  }
}

/* ── 快取優先：適用圖片等靜態資源 ── */

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    if (canCache(response)) {
      await cache.put(
        request,
        response.clone()
      );
    }

    return response;
  } catch {
    return Response.error();
  }
}

/* ── 攔截網站請求 ── */

self.addEventListener('fetch', event => {
  const request = event.request;

  // 只處理 GET，避免影響其他操作。
  if (request.method !== 'GET') {
    return;
  }

  // 外部字型、第三方服務交由瀏覽器處理。
  if (!isSameOrigin(request)) {
    return;
  }

  // 不干涉 GitHub Pages 同網域的其他專案。
  if (!isInsideApp(request)) {
    return;
  }

  const url = new URL(request.url);

  // HTML 導覽一律網路優先。
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request)
    );
    return;
  }

  // JS、CSS、HTML、JSON 等重要程式資源
  // 使用網路優先，避免長期停留在舊版。
  const isProgramFile =
    /\.(?:js|css|html|json)$/i.test(url.pathname);

  if (isProgramFile || isCoreAsset(request)) {
    event.respondWith(
      networkFirst(request)
    );
    return;
  }

  // 其他同站資源（例如圖片）採快取優先。
  event.respondWith(
    cacheFirst(request)
  );
});

/* ── 接收頁面傳來的更新指令 ── */

// 預留給未來的「立即更新」按鈕。
// 只有收到頁面明確指令時才強制啟用等待中的新版。
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
