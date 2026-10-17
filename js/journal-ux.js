
'use strict';

/* ── 篩選狀態 ── */

const JOURNAL_UX = {
  keyword: '',
  period: '30',
  timeOfDay: 'all',
  page: 1,
  pageSize: 20
};

/* ── 基礎工具 ── */

function uxEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function uxEntryDate(entry) {
  if (entry.timestamp) {
    const date = new Date(entry.timestamp);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  if (entry.date && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
    const date = new Date(entry.date + 'T12:00:00');

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function uxEntryTime(entry) {
  const date = uxEntryDate(entry);

  if (!date) return entry.date || '未知日期';

  if (!entry.timestamp) {
    return `${entry.date}（舊紀錄，無記錄時間）`;
  }

  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function uxTimeOfDay(entry) {
  // 舊資料只有日期，不能猜測記錄時段。
  if (!entry.timestamp) return 'unknown';

  const date = uxEntryDate(entry);
  if (!date) return 'unknown';

  const hour = date.getHours();

  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'noon';
  if (hour >= 14 && hour < 18) return 'afternoon';

  return 'evening';
}

const UX_TIME_LABELS = {
  morning: '早上',
  noon: '中午',
  afternoon: '下午',
  evening: '晚上',
  unknown: '時間不明'
};

function uxIsWithinDays(entry, days) {
  if (days === 'all') return true;

  const date = uxEntryDate(entry);
  if (!date) return false;

  const now = Date.now();
  const diff = now - date.getTime();

  return diff >= 0 && diff < Number(days) * 86400000;
}

/* ── 插入日誌工具介面 ── */

function uxInitStyles() {
  if (document.getElementById('journal-ux-style')) return;

  const style = document.createElement('style');
  style.id = 'journal-ux-style';

  style.textContent = `
    .jux-panel {
      background: #fff;
      border: 1px solid #e7e4dc;
      border-radius: 16px;
      padding: 16px;
      margin: 16px 0;
    }

    .jux-title {
      font-size: 17px;
      font-weight: 700;
      color: #34483b;
      margin-bottom: 12px;
    }

    .jux-subtitle {
      font-size: 12px;
      color: #777;
      margin-top: 10px;
      line-height: 1.7;
    }

    .jux-controls {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .jux-field {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-width: 0;
    }

    .jux-field label {
      font-size: 12px;
      color: #5c625c;
    }

    .jux-input,
    .jux-select {
      width: 100%;
      box-sizing: border-box;
      padding: 11px 12px;
      font: inherit;
      font-size: 14px;
      color: #333;
      background: #fff;
      border: 1px solid #d8dbd4;
      border-radius: 10px;
    }

    .jux-input:focus,
    .jux-select:focus {
      outline: 2px solid #799b82;
      outline-offset: 1px;
    }

    .jux-search {
      grid-column: 1 / -1;
    }

    .jux-stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .jux-stat {
      background: #f6f8f3;
      border-radius: 12px;
      padding: 13px;
      min-width: 0;
    }

    .jux-stat-value {
      font-size: 24px;
      font-weight: 700;
      color: #3e674c;
      overflow-wrap: anywhere;
    }

    .jux-stat-label {
      font-size: 12px;
      color: #777;
      margin-top: 4px;
    }

    .jux-bars {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 16px;
    }

    .jux-bar-row {
      display: grid;
      grid-template-columns: 46px minmax(0, 1fr) 46px;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }

    .jux-bar-track {
      height: 9px;
      border-radius: 20px;
      background: #eef0e9;
      overflow: hidden;
    }

    .jux-bar-fill {
      height: 100%;
      border-radius: 20px;
      background: #86a98d;
    }

    .jux-bar-number {
      text-align: right;
      color: #666;
    }

    .jux-result {
      margin: 12px 0;
      font-size: 13px;
      color: #667066;
    }

    .jux-entry {
      background: #fff;
      border: 1px solid #e8e8e1;
      border-radius: 14px;
      padding: 15px;
      margin: 10px 0;
    }

    .jux-entry-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 8px;
    }

    .jux-entry-date {
      font-weight: 700;
      color: #3f5846;
      font-size: 14px;
    }

    .jux-entry-meta {
      color: #888;
      font-size: 12px;
      margin-top: 5px;
    }

    .jux-entry-note {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      line-height: 1.8;
      margin-top: 12px;
      font-size: 14px;
    }

    .jux-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 12px;
    }

    .jux-tag {
      background: #f1f5ee;
      color: #526c56;
      border-radius: 20px;
      padding: 5px 9px;
      font-size: 12px;
    }

    .jux-delete {
      border: 1px solid #e3c9c5;
      background: #fff;
      color: #a3534c;
      border-radius: 8px;
      padding: 6px 10px;
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }

    .jux-pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin: 18px 0;
      flex-wrap: wrap;
    }

    .jux-page-btn,
    .jux-reset {
      padding: 9px 13px;
      border: 1px solid #d5ded2;
      border-radius: 9px;
      background: #fff;
      color: #45644c;
      font: inherit;
      cursor: pointer;
    }

    .jux-page-btn:disabled {
      opacity: .4;
      cursor: not-allowed;
    }

    .jux-empty {
      text-align: center;
      padding: 30px 15px;
      color: #888;
      line-height: 1.8;
    }

    @media (max-width: 360px) {
      .jux-controls {
        grid-template-columns: 1fr;
      }

      .jux-search {
        grid-column: auto;
      }

      .jux-stat-value {
        font-size: 20px;
      }
    }
  `;

  document.head.appendChild(style);
}

function uxInitControls() {
  const entries = document.getElementById('journal-entries');

  if (!entries) return;

  if (document.getElementById('journal-ux-controls')) return;

  const controls = document.createElement('section');
  controls.id = 'journal-ux-controls';
  controls.className = 'jux-panel';

  controls.innerHTML = `
    <div class="jux-title">🔎 尋找我的紀錄</div>

    <div class="jux-controls">
      <div class="jux-field jux-search">
        <label for="jux-keyword">搜尋感受、節氣或備註</label>
        <input
          id="jux-keyword"
          class="jux-input"
          type="search"
          maxlength="100"
          placeholder="例如：疲倦、頭痛、睡不好">
      </div>

      <div class="jux-field">
        <label for="jux-period">查看期間</label>
        <select id="jux-period" class="jux-select">
          <option value="7">最近 7 天</option>
          <option value="30" selected>最近 30 天</option>
          <option value="all">全部紀錄</option>
        </select>
      </div>

      <div class="jux-field">
        <label for="jux-time">記錄時段</label>
        <select id="jux-time" class="jux-select">
          <option value="all">所有時段</option>
          <option value="morning">早上 05–11</option>
          <option value="noon">中午 11–14</option>
          <option value="afternoon">下午 14–18</option>
          <option value="evening">晚上及凌晨</option>
          <option value="unknown">時間不明</option>
        </select>
      </div>
    </div>

    <div style="margin-top:12px">
      <button type="button" class="jux-reset" id="jux-reset">
        清除篩選
      </button>
    </div>

    <div class="jux-subtitle">
      搜尋僅在此裝置進行，不會將個人紀錄傳送到伺服器。
    </div>
  `;

  entries.parentNode.insertBefore(controls, entries);

  const keyword = document.getElementById('jux-keyword');
  const period = document.getElementById('jux-period');
  const time = document.getElementById('jux-time');

  keyword.value = JOURNAL_UX.keyword;
  period.value = JOURNAL_UX.period;
  time.value = JOURNAL_UX.timeOfDay;

  keyword.addEventListener('input', () => {
    JOURNAL_UX.keyword = keyword.value.trim().toLowerCase();
    JOURNAL_UX.page = 1;
    renderJournal();
  });

  period.addEventListener('change', () => {
    JOURNAL_UX.period = period.value;
    JOURNAL_UX.page = 1;
    renderJournal();
  });

  time.addEventListener('change', () => {
    JOURNAL_UX.timeOfDay = time.value;
    JOURNAL_UX.page = 1;
    renderJournal();
  });

  document.getElementById('jux-reset').addEventListener('click', () => {
    JOURNAL_UX.keyword = '';
    JOURNAL_UX.period = '30';
    JOURNAL_UX.timeOfDay = 'all';
    JOURNAL_UX.page = 1;

    keyword.value = '';
    period.value = '30';
    time.value = 'all';

    renderJournal();
  });
}

/* ── 篩選紀錄 ── */

function uxFilteredEntries() {
  return journalData.filter(entry => {
    if (!uxIsWithinDays(entry, JOURNAL_UX.period)) {
      return false;
    }

    if (
      JOURNAL_UX.timeOfDay !== 'all' &&
      uxTimeOfDay(entry) !== JOURNAL_UX.timeOfDay
    ) {
      return false;
    }

    if (JOURNAL_UX.keyword) {
      const searchable = [
        entry.solar,
        entry.date,
        entry.note,
        ...(entry.symptoms || [])
      ].join(' ').toLowerCase();

      if (!searchable.includes(JOURNAL_UX.keyword)) {
        return false;
      }
    }

    return true;
  }).sort((a, b) => {
    const at = uxEntryDate(a)?.getTime() || 0;
    const bt = uxEntryDate(b)?.getTime() || 0;
    return bt - at;
  });
}

/* ── 30 天統計 ── */

function uxGetSummary() {
  const recent = journalData.filter(entry =>
    uxIsWithinDays(entry, '30')
  );

  const dates = new Set();
  const symptoms = new Map();

  const times = {
    morning: 0,
    noon: 0,
    afternoon: 0,
    evening: 0
  };

  recent.forEach(entry => {
    const date = uxEntryDate(entry);

    if (date) {
      dates.add(localDateKey(date));
    }

    (entry.symptoms || []).forEach(symptom => {
      symptoms.set(
        symptom,
        (symptoms.get(symptom) || 0) + 1
      );
    });

    const period = uxTimeOfDay(entry);

    if (Object.hasOwn(times, period)) {
      times[period]++;
    }
  });

  const topSymptom = [...symptoms.entries()]
    .sort((a, b) => b[1] - a[1])[0];

  return {
    count: recent.length,
    days: dates.size,
    topSymptom: topSymptom || null,
    times
  };
}

function uxRenderSummary() {
  const host = document.getElementById('journal-ux-summary');

  if (!host) return;

  const summary = uxGetSummary();

  const max = Math.max(1, ...Object.values(summary.times));

  host.innerHTML = `
    <div class="jux-title">🌿 最近 30 天的自己</div>

    <div class="jux-stats">
      <div class="jux-stat">
        <div class="jux-stat-value">${summary.count}</div>
        <div class="jux-stat-label">總紀錄次數</div>
      </div>

      <div class="jux-stat">
        <div class="jux-stat-value">${summary.days}</div>
        <div class="jux-stat-label">有紀錄的天數</div>
      </div>

      <div class="jux-stat">
        <div class="jux-stat-value">
          ${summary.topSymptom
            ? uxEscape(summary.topSymptom[0])
            : '—'}
        </div>
        <div class="jux-stat-label">最常記下的感受</div>
      </div>

      <div class="jux-stat">
        <div class="jux-stat-value">
          ${summary.topSymptom
            ? summary.topSymptom[1] + ' 次'
            : '—'}
        </div>
        <div class="jux-stat-label">該感受出現次數</div>
      </div>
    </div>

    <div class="jux-title" style="margin-top:20px">
      🕰️ 我的記錄時段
    </div>

    <div class="jux-bars">
      ${Object.entries(summary.times).map(([key, count]) => `
        <div class="jux-bar-row">
          <span>${UX_TIME_LABELS[key]}</span>

          <div class="jux-bar-track">
            <div
              class="jux-bar-fill"
              style="width:${count / max * 100}%">
            </div>
          </div>

          <span class="jux-bar-number">${count} 次</span>
        </div>
      `).join('')}
    </div>

    <div class="jux-subtitle">
      這是「你在哪個時段留下紀錄」的統計，
      不代表症狀一定在該時段發生。
      舊紀錄若沒有時間，不會列入時段圖。
      所有結果僅供自我觀察，不能用來診斷疾病。
    </div>
  `;
}

/* ── 單筆紀錄畫面 ── */

function uxRenderEntry(entry) {
  const labels = {
    water: '有喝水',
    veg: '有吃蔬菜',
    sleep: '睡眠達標',
    exercise: '有運動'
  };

  const habitTags = Object.entries(entry.checks || {})
    .filter(([key, done]) => labels[key] && done === true)
    .map(([key]) => `
      <span class="jux-tag">
        ✓ ${uxEscape(labels[key])}
      </span>
    `).join('');

  const symptomTags = (entry.symptoms || [])
    .map(symptom => `
      <span class="jux-tag">
        ${uxEscape(symptom)}
      </span>
    `).join('');

  return `
    <article class="jux-entry">
      <div class="jux-entry-top">
        <div>
          <div class="jux-entry-date">
            ${uxEscape(uxEntryTime(entry))}
          </div>

          <div class="jux-entry-meta">
            ${uxEscape(entry.solar || '未標記節氣')}
            ・${UX_TIME_LABELS[uxTimeOfDay(entry)]}
          </div>
        </div>

        <button
          type="button"
          class="jux-delete"
          data-jux-delete="${uxEscape(entry.id)}">
          刪除
        </button>
      </div>

      ${habitTags || symptomTags ? `
        <div class="jux-tags">
          ${habitTags}
          ${symptomTags}
        </div>
      ` : ''}

      ${entry.note ? `
        <div class="jux-entry-note">
          ${uxEscape(entry.note)}
        </div>
      ` : ''}
    </article>
  `;
}

/* ── 覆蓋原本的日誌顯示功能 ── */

renderJournal = function () {
  const entriesHost = document.getElementById('journal-entries');
  const insightsHost = document.getElementById('journal-insights');

  if (!entriesHost || !insightsHost) return;

  uxInitStyles();
  uxInitControls();

  let summaryHost = document.getElementById('journal-ux-summary');

  if (!summaryHost) {
    summaryHost = document.createElement('section');
    summaryHost.id = 'journal-ux-summary';
    summaryHost.className = 'jux-panel';

    const controls = document.getElementById('journal-ux-controls');
    controls.parentNode.insertBefore(summaryHost, controls);
  }

  const todayLabel = document.getElementById('journal-today-label');

  if (todayLabel) {
    todayLabel.textContent =
      `隨時記下此刻（${getCurrentSolar().term.name}）`;
  }

  // V3.1 發現舊資料異常時會停止寫入；
  // V3.3 也維持相同保護。
  if (journalLoadError) {
    summaryHost.innerHTML = '';
    insightsHost.textContent =
      '⚠️ 原有日誌資料格式異常，已停止操作以避免覆蓋。';

    entriesHost.textContent =
      '請保留原本的瀏覽器資料，不要清除網站資料。';

    return;
  }

  uxRenderSummary();

  const filtered = uxFilteredEntries();

  insightsHost.textContent =
    `目前共 ${journalData.length} 筆紀錄。` +
    '最近 30 天的統計顯示於下方，僅供自我觀察。';

  let resultHost = document.getElementById('journal-ux-result');

  if (!resultHost) {
    resultHost = document.createElement('div');
    resultHost.id = 'journal-ux-result';
    resultHost.className = 'jux-result';

    entriesHost.parentNode.insertBefore(resultHost, entriesHost);
  }

  resultHost.textContent =
    `找到 ${filtered.length} 筆符合條件的紀錄`;

  if (!filtered.length) {
    entriesHost.innerHTML = `
      <div class="jux-empty">
        🌱 目前沒有符合條件的紀錄。
        <div>可以更換日期、時段或搜尋關鍵字。</div>
      </div>
    `;

    return;
  }

  const totalPages = Math.ceil(
    filtered.length / JOURNAL_UX.pageSize
  );

  JOURNAL_UX.page = Math.min(
    Math.max(1, JOURNAL_UX.page),
    totalPages
  );

  const start = (
    JOURNAL_UX.page - 1
  ) * JOURNAL_UX.pageSize;

  const pageEntries = filtered.slice(
    start,
    start + JOURNAL_UX.pageSize
  );

  entriesHost.innerHTML = pageEntries
    .map(uxRenderEntry)
    .join('');

  // 刪除按鈕沿用 V3.1 原本的安全刪除函式。
  entriesHost.querySelectorAll('[data-jux-delete]')
    .forEach(button => {
      button.addEventListener('click', () => {
        deleteJournal(button.dataset.juxDelete);
      });
    });

  if (totalPages > 1) {
    const pagination = document.createElement('div');
    pagination.className = 'jux-pagination';

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'jux-page-btn';
    prev.textContent = '← 上一頁';
    prev.disabled = JOURNAL_UX.page === 1;

    prev.addEventListener('click', () => {
      JOURNAL_UX.page--;
      renderJournal();
    });

    const indicator = document.createElement('span');
    indicator.textContent =
      `${JOURNAL_UX.page} / ${totalPages} 頁`;

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'jux-page-btn';
    next.textContent = '下一頁 →';
    next.disabled = JOURNAL_UX.page === totalPages;

    next.addEventListener('click', () => {
      JOURNAL_UX.page++;
      renderJournal();
    });

    pagination.append(prev, indicator, next);
    entriesHost.appendChild(pagination);
  }
};

/* ── 頁面啟動 ── */

document.addEventListener('DOMContentLoaded', () => {
  // app.js 已載入後，確保日誌頁可使用新版顯示。
  const journalPage = document.getElementById('page-journal');

  if (journalPage && journalPage.classList.contains('active')) {
    renderJournal();
  }
});
