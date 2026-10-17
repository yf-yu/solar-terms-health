'use strict';

(function () {
  if (!('serviceWorker' in navigator)) return;

  let registration = null;
  let waitingWorker = null;
  let refreshing = false;
  let updateRequested = false;

  /* ── 更新提示樣式 ── */

  function createStyles() {
    if (document.getElementById('pwa-update-style')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'pwa-update-style';

    style.textContent = `
      #pwa-update-banner {
        position: fixed;
        left: 50%;
        bottom: calc(82px + env(safe-area-inset-bottom, 0px));
        transform: translate(-50%, 140%);
        width: calc(100% - 32px);
        max-width: 480px;
        box-sizing: border-box;
        background: #fff;
        color: #34483b;
        border: 1px solid #d8e3d8;
        border-radius: 16px;
        padding: 15px;
        box-shadow: 0 8px 28px rgba(0,0,0,.16);
        z-index: 99999;
        opacity: 0;
        visibility: hidden;
        transition:
          transform .3s ease,
          opacity .3s ease,
          visibility .3s ease;
      }

      #pwa-update-banner.show {
        transform: translate(-50%, 0);
        opacity: 1;
        visibility: visible;
      }

      .pwa-update-title {
        font-size: 15px;
        font-weight: 700;
        margin-bottom: 6px;
      }

      .pwa-update-desc {
        font-size: 13px;
        line-height: 1.7;
        color: #6d766d;
      }

      .pwa-update-actions {
        display: flex;
        gap: 10px;
        margin-top: 13px;
      }

      .pwa-update-btn {
        flex: 1;
        border: 1px solid #d7dfd5;
        border-radius: 10px;
        padding: 11px 10px;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }

      .pwa-update-later {
        background: #f5f6f2;
        color: #596a5b;
      }

      .pwa-update-now {
        background: #426a4d;
        color: #fff;
        border-color: #426a4d;
      }

      .pwa-update-btn:disabled {
        opacity: .55;
        cursor: wait;
      }

      @media (min-width: 700px) {
        #pwa-update-banner {
          bottom: 24px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        #pwa-update-banner {
          transition: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* ── 建立更新提示 ── */

  function createBanner() {
    let banner = document.getElementById(
      'pwa-update-banner'
    );

    if (banner) return banner;

    banner = document.createElement('aside');
    banner.id = 'pwa-update-banner';

    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');

    banner.innerHTML = `
      <div class="pwa-update-title">
        🌿 節氣養生有新版本
      </div>

      <div class="pwa-update-desc">
        新版本已準備好。
        可以現在更新，也可以等記錄完成後再更新。
      </div>

      <div class="pwa-update-actions">
        <button
          type="button"
          class="pwa-update-btn pwa-update-later"
          id="pwa-update-later">
          稍後再說
        </button>

        <button
          type="button"
          class="pwa-update-btn pwa-update-now"
          id="pwa-update-now">
          立即更新
        </button>
      </div>
    `;

    document.body.appendChild(banner);

    document.getElementById('pwa-update-later')
      .addEventListener('click', hideBanner);

    document.getElementById('pwa-update-now')
      .addEventListener('click', applyUpdate);

    return banner;
  }

  function showBanner(worker) {
    if (!worker) return;

    waitingWorker = worker;

    const banner = createBanner();

    banner.classList.add('show');
  }

  function hideBanner() {
    const banner = document.getElementById(
      'pwa-update-banner'
    );

    if (banner) {
      banner.classList.remove('show');
    }
  }

  /* ── 未儲存內容檢查 ── */

  function hasUnsavedJournal() {
    const note = document.getElementById('journal-note');

    if (note?.value.trim()) {
      return true;
    }

    // 使用者已選擇但尚未儲存的身體感受。
    if (document.querySelector('.symptom-chip.sel')) {
      return true;
    }

    return false;
  }

  /* ── 使用者確認更新 ── */

  function applyUpdate() {
    if (!waitingWorker) return;

    if (hasUnsavedJournal()) {
      const confirmed = confirm(
        '你有尚未儲存的日誌內容。\n\n' +
        '現在更新可能使這些內容消失。\n' +
        '建議先按「取消」，儲存紀錄後再更新。\n\n' +
        '確定仍要立即更新嗎？'
      );

      if (!confirmed) return;
    }

    const button = document.getElementById(
      'pwa-update-now'
    );

    if (button) {
      button.disabled = true;
      button.textContent = '正在更新…';
    }

    updateRequested = true;

    waitingWorker.postMessage({
      type: 'SKIP_WAITING'
    });
  }

  /* ── 偵測新版已安裝 ── */

  function watchInstallingWorker(reg) {
    const worker = reg.installing;

    if (!worker) return;

    worker.addEventListener('statechange', () => {
      if (
        worker.state === 'installed' &&
        navigator.serviceWorker.controller
      ) {
        showBanner(reg.waiting || worker);
      }
    });
  }

  /* ── 定期檢查版本 ── */

  function checkForUpdates() {
    if (!registration) return;

    registration.update().catch(error => {
      console.warn('檢查網站更新失敗', error);
    });
  }

  /* ── 啟動 ── */

  async function initPWAUpdate() {
    createStyles();
    createBanner();

    try {
      registration =
        await navigator.serviceWorker.ready;

      if (registration.waiting) {
        showBanner(registration.waiting);
      }

      registration.addEventListener(
        'updatefound',
        () => watchInstallingWorker(registration)
      );

      if (registration.installing) {
        watchInstallingWorker(registration);
      }

      // 開啟網站時檢查一次。
      checkForUpdates();

      // 網頁停留較久時，每小時檢查一次。
      setInterval(checkForUpdates, 60 * 60 * 1000);

      // 使用者回到網頁時再檢查。
      document.addEventListener(
        'visibilitychange',
        () => {
          if (!document.hidden) {
            checkForUpdates();
          }
        }
      );

      window.addEventListener('online', checkForUpdates);

    } catch (error) {
      console.warn('PWA 更新管理初始化失敗', error);
    }
  }

  /* ── 新版本取得控制權後重新整理 ── */

  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => {
      if (!updateRequested || refreshing) return;

      refreshing = true;
      window.location.reload();
    }
  );

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initPWAUpdate
    );
  } else {
    initPWAUpdate();
  }
})();
