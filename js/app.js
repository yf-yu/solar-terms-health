/* ── 基礎工具 ── */

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function readLocalJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeLocalJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    showToast('儲存失敗，請檢查瀏覽器儲存空間');
    return false;
  }
}

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function makeRecordId() {
  if (globalThis.crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return `rec-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function safeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/* ── Service Worker ── */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .catch(err => console.warn('Service Worker 註冊失敗', err));
  });
}

/* ── 節氣日期計算 ── */

function getSolarDatesInRange(year) {
  const table = window.SOLAR_DATES?.[year] || null;

  return window.SOLAR_TERMS.map((st, i) => {
    const [month, day] = table
      ? table[i]
      : [st.month, st.day];

    return {
      term: st,
      date: new Date(year, month - 1, day)
    };
  });
}

function getCurrentSolar(now = new Date()) {
  const year = now.getFullYear();

  const all = [
    ...getSolarDatesInRange(year - 1),
    ...getSolarDatesInRange(year),
    ...getSolarDatesInRange(year + 1)
  ].sort((a, b) => a.date - b.date);

  let current = all[0];
  let next = all[all.length - 1];

  for (const item of all) {
    if (item.date <= now) {
      current = item;
    } else {
      next = item;
      break;
    }
  }

  return {
    term: current.term,
    daysIn: Math.max(
      0,
      Math.floor((now - current.date) / 86400000)
    ),
    next: {
      term: next.term,
      date: next.date,
      daysLeft: Math.max(
        0,
        Math.ceil((next.date - now) / 86400000)
      )
    }
  };
}

function getNextSolar(now = new Date()) {
  return getCurrentSolar(now).next;
}

/* ── 首頁 ── */

function initHome() {
  const now = new Date();
  const { term, daysIn, next } = getCurrentSolar(now);

  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  document.getElementById('hero-date').textContent =
    `${now.getFullYear()}年 ${now.getMonth() + 1}月${now.getDate()}日 星期${weekdays[now.getDay()]}`;

  document.getElementById('hero-solar-name').textContent = term.name;
  document.getElementById('hero-solar-en').textContent = term.en.toUpperCase();
  document.getElementById('hero-summary').textContent = term.summary;

  document.getElementById('hero-days-text').textContent =
    `已入${term.name} ${daysIn} 天 · ${next.term.name}還有 ${next.daysLeft} 天`;

  const actions = document.getElementById('today-actions');

  actions.innerHTML = `
    <div class="action-card">
      <span class="action-icon">🥢</span>
      <div class="action-info">
        <div class="action-cat">飲食建議</div>
        <div class="action-title">今日適合食材</div>
        <div class="action-desc">${escapeHTML(term.diet)}</div>
        <div class="action-tip">以上食材依傳統養生建議，可依個人情況適量食用</div>
      </div>
    </div>

    <div class="action-card">
      <span class="action-icon">🌙</span>
      <div class="action-info">
        <div class="action-cat">起居建議</div>
        <div class="action-title">睡眠作息</div>
        <div class="action-desc">${escapeHTML(term.sleep)}</div>
      </div>
    </div>

    <div class="action-card">
      <span class="action-icon">🤸</span>
      <div class="action-info">
        <div class="action-cat">運動建議</div>
        <div class="action-title">適合的活動</div>
        <div class="action-desc">${escapeHTML(term.exercise)}</div>
      </div>
    </div>

    <div class="action-card">
      <span class="action-icon">⚠️</span>
      <div class="action-info">
        <div class="action-cat">注意事項</div>
        <div class="action-title">這時節要避免</div>
        <div class="action-desc">${escapeHTML(term.avoid)}</div>
      </div>
    </div>

    <div class="action-card">
      <span class="action-icon">📜</span>
      <div class="action-info">
        <div class="action-cat">內經智慧</div>
        <div class="action-title">古人說</div>
        <div class="action-desc">「${escapeHTML(term.classic)}」</div>
        <div class="action-tip">
          ${escapeHTML(term.classicSrc)}
          （養生建議，非醫療診斷）
        </div>
      </div>
    </div>

    ${term.symptoms?.length ? `
      <div class="action-card">
        <span class="action-icon">🎯</span>
        <div class="action-info">
          <div class="action-cat">穴位小提示</div>
          <div class="action-title">
            這時節常見不適：
            ${term.symptoms.map(s => escapeHTML(s.name)).join('・')}
          </div>
          <div class="action-desc">
            點「知識庫」→「${escapeHTML(term.name)}」查看穴位說明
          </div>
        </div>
      </div>
    ` : ''}
  `;

  if (window.QUOTES?.length) {
    const index = Math.floor(Date.now() / 86400000) % window.QUOTES.length;
    document.getElementById('daily-quote').textContent = window.QUOTES[index];
  }
}

/* ── 知識庫 ── */

function filterLibrary() {
  const q = document.getElementById('lib-search')?.value.trim() || '';
  let visible = 0;

  document.querySelectorAll('.solar-item').forEach(el => {
    const name = el.dataset.name || '';
    const matched = !q || name.includes(q);

    el.style.display = matched ? '' : 'none';
    if (matched) visible++;
  });

  let empty = document.getElementById('lib-empty');

  if (!empty) {
    empty = document.createElement('div');
    empty.id = 'lib-empty';
    empty.textContent = '找不到符合的節氣';
    empty.style.cssText =
      'text-align:center;padding:24px;color:var(--muted)';
    document.getElementById('solar-list').appendChild(empty);
  }

  empty.style.display = visible ? 'none' : 'block';
}

function initLibrary() {
  const { term } = getCurrentSolar();

  document.querySelectorAll('.solar-item').forEach(el => {
    const current = el.dataset.name === term.name;

    el.classList.toggle('current', current);

    const oldBadge = el.querySelector('.solar-item-badge');

    if (current && !oldBadge) {
      const badge = document.createElement('div');
      badge.className = 'solar-item-badge';
      badge.textContent = '當前節氣';
      el.appendChild(badge);
    } else if (!current && oldBadge) {
      oldBadge.remove();
    }
  });
}

function openDetail(name) {
  const st = window.SOLAR_TERMS.find(item => item.name === name);
  if (!st) return;

  document.getElementById('detail-name').textContent = st.name;
  document.title = `${st.name}｜節氣養生建議 - 節氣養生`;

  const acuHtml = st.symptoms?.length ? `
    <div class="detail-card">
      <div class="detail-card-title">🎯 常見不適・穴位按摩</div>
      <div class="detail-card-body">
        以下為傳統養生參考，不構成醫療建議。
      </div>
      <div class="acupoint-grid">
        ${st.symptoms.map(s => `
          <div class="acu-card">
            <div class="acu-header">
              <span class="acu-icon">${escapeHTML(s.icon)}</span>
              <span class="acu-symptom">${escapeHTML(s.name)}</span>
            </div>
            <div class="acu-name">穴位：${escapeHTML(s.acupoint)}</div>
            <div class="acu-location">📍 位置：${escapeHTML(s.location)}</div>
            <div class="acu-method">按摩方式：${escapeHTML(s.method)}</div>
          </div>
        `).join('')}
      </div>
      <div class="acu-disclaimer">
        如有不適請停止並諮詢醫療專業人員。
      </div>
    </div>
  ` : '';

  const seasonNames = {
    spring: '春季',
    summer: '夏季',
    autumn: '秋季',
    winter: '冬季'
  };

  document.getElementById('detail-body').innerHTML = `
    <div class="detail-card">
      <div class="detail-card-title">🌿 節氣概覽</div>
      <div class="detail-card-body">
        ${escapeHTML(st.summary)}
        <br><br>
        通常在 ${st.month}月${st.day}日前後，
        屬${seasonNames[st.season] || ''}節氣。
      </div>
    </div>

    <div class="detail-card">
      <div class="detail-card-title">🥢 飲食建議</div>
      <div class="detail-card-body">${escapeHTML(st.diet)}</div>
    </div>

    <div class="detail-card">
      <div class="detail-card-title">🌙 起居建議</div>
      <div class="detail-card-body">${escapeHTML(st.sleep)}</div>
    </div>

    <div class="detail-card">
      <div class="detail-card-title">🤸 運動建議</div>
      <div class="detail-card-body">${escapeHTML(st.exercise)}</div>
    </div>

    <div class="detail-card">
      <div class="detail-card-title">⚠️ 注意事項</div>
      <div class="detail-card-body">${escapeHTML(st.avoid)}</div>
    </div>

    ${acuHtml}

    <div class="detail-card">
      <div class="detail-card-title">📜 《黃帝內經》智慧</div>
      <div class="detail-quote">
        「${escapeHTML(st.classic)}」
        <cite>${escapeHTML(st.classicSrc)}</cite>
      </div>
    </div>

    ${st.classicExtra ? `
      <div class="detail-card">
        <div class="detail-card-title">📚 《傷寒論》相關記載</div>
        <div class="detail-card-body">${escapeHTML(st.classicExtra)}</div>
      </div>
    ` : ''}

    <div class="detail-card">
      <div class="detail-card-body">
        本頁為傳統文化養生知識，不構成醫療診斷。
      </div>
    </div>
  `;

  document.getElementById('page-library').style.display = 'none';
  document.getElementById('solar-detail').classList.add('open');

  const hash = '#solar=' + encodeURIComponent(name);

  if (location.hash !== hash) {
    history.pushState({ solar: name }, '', hash);
  }

  window.scrollTo(0, 0);
}

function closeDetail() {
  document.getElementById('solar-detail').classList.remove('open');
  document.getElementById('page-library').style.display = '';

  document.title = '二十四節氣知識庫｜節氣養生';

  if (location.hash.startsWith('#solar=')) {
    history.replaceState({ page: 'library' }, '', '#library');
  }
}

/* =========================================================
   個人日誌｜記憶系統 V3
   ========================================================= */

const JOURNAL_KEY = 'st_journal';
const JOURNAL_PAGE_SIZE = 30;

let journalData = [];
let journalPage = 1;

function normalizeJournalEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const date = typeof entry.date === 'string'
    ? entry.date
    : '';

  const timestamp = typeof entry.timestamp === 'string'
    ? entry.timestamp
    : '';

  const parsedDate = safeDate(timestamp || `${date}T12:00:00`);

  return {
    id: entry.id != null
      ? String(entry.id)
      : makeRecordId(),

    date: date || (
      parsedDate ? localDateKey(parsedDate) : ''
    ),

    timestamp: timestamp || (
      parsedDate ? parsedDate.toISOString() : ''
    ),

    solar: String(entry.solar || ''),

    checks: {
      water: entry.checks?.water === true,
      veg: entry.checks?.veg === true,
      sleep: entry.checks?.sleep === true,
      exercise: entry.checks?.exercise === true
    },

    symptoms: Array.isArray(entry.symptoms)
      ? entry.symptoms.filter(x => typeof x === 'string').slice(0, 30)
      : [],

    note: String(entry.note || '').slice(0, 10000)
  };
}

function loadJournalData() {
  const raw = readLocalJSON(JOURNAL_KEY, []);

  // 舊版若為日期物件，轉成陣列。
  let entries = [];

  if (Array.isArray(raw)) {
    entries = raw;
  } else if (raw && typeof raw === 'object') {
    entries = Object.entries(raw).map(([date, value]) => ({
      ...value,
      date: value?.date || date
    }));
  }

  journalData = entries
    .map(normalizeJournalEntry)
    .filter(Boolean)
    .sort((a, b) =>
      String(b.timestamp).localeCompare(String(a.timestamp))
    );
}

loadJournalData();

function saveJournal() {
  const now = new Date();
  const { term } = getCurrentSolar(now);

  const checks = {
    water: document.getElementById('chk-water')?.classList.contains('on') || false,
    veg: document.getElementById('chk-veg')?.classList.contains('on') || false,
    sleep: document.getElementById('chk-sleep')?.classList.contains('on') || false,
    exercise: document.getElementById('chk-exercise')?.classList.contains('on') || false
  };

  const symptoms = [
    ...document.querySelectorAll('.symptom-chip.sel')
  ].map(el => el.textContent.trim());

  const noteInput = document.getElementById('journal-note');
  const note = noteInput?.value.trim() || '';

  if (!symptoms.length && !note && !Object.values(checks).some(Boolean)) {
    showToast('先選擇一項感受，或寫下此刻的想法');
    return;
  }

  const entry = {
    id: makeRecordId(),
    date: localDateKey(now),
    timestamp: now.toISOString(),
    solar: term.name,
    checks,
    symptoms,
    note
  };

  const updated = [entry, ...journalData];

  if (!writeLocalJSON(JOURNAL_KEY, updated)) return;

  journalData = updated;
  journalPage = 1;

  if (noteInput) noteInput.value = '';

  document.querySelectorAll('.symptom-chip.sel').forEach(el => {
    el.classList.remove('sel');
  });

  // 不清除習慣勾選，方便一天內重複紀錄
  renderJournal();
  showToast('✓ 已記下此刻的狀態');
}

function journalTime(entry) {
  const date = safeDate(entry.timestamp || `${entry.date}T12:00:00`);

  if (!date) return entry.date || '未知日期';

  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function getJournalInsights() {
  const now = Date.now();
  const sevenDays = 7 * 86400000;

  const recent = journalData.filter(entry => {
    const date = safeDate(entry.timestamp);
    return date && date.getTime() <= now &&
      now - date.getTime() < sevenDays;
  });

  const symptomCounts = {};

  recent.forEach(entry => {
    entry.symptoms.forEach(symptom => {
      symptomCounts[symptom] =
        (symptomCounts[symptom] || 0) + 1;
    });
  });

  const top = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return {
    count: recent.length,
    top
  };
}

function renderJournal() {
  const container = document.getElementById('journal-entries');
  const insights = document.getElementById('journal-insights');

  if (!container || !insights) return;

  const { term } = getCurrentSolar();

  const label = document.getElementById('journal-today-label');
  if (label) label.textContent = `隨時記下此刻（${term.name}）`;

  const result = getJournalInsights();

  insights.textContent = result.count
    ? `最近 7 天共有 ${result.count} 筆紀錄。${
        result.top.length
          ? '常出現的感受：' +
            result.top.map(([name, count]) =>
              `${name}（${count} 次）`
            ).join('、') + '。'
          : '持續記錄，慢慢認識自己的生活節奏。'
      }這些只是觀察統計，不能用來診斷疾病。`
    : '最近七天還沒有紀錄，從此刻開始觀察自己吧。';

  if (!journalData.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:24px;color:var(--muted)">
        還沒有任何紀錄，從今天開始吧！
      </div>
    `;
    return;
  }

  const checkLabels = {
    water: '喝水 ✓',
    veg: '蔬菜 ✓',
    sleep: '睡眠 ✓',
    exercise: '運動 ✓'
  };

  const totalPages = Math.ceil(journalData.length / JOURNAL_PAGE_SIZE);
  journalPage = Math.min(Math.max(1, journalPage), totalPages);

  const start = (journalPage - 1) * JOURNAL_PAGE_SIZE;
  const records = journalData.slice(
    start,
    start + JOURNAL_PAGE_SIZE
  );

  container.innerHTML = records.map(entry => {
    const checks = Object.entries(entry.checks)
      .filter(([, done]) => done)
      .map(([key]) => `
        <span class="entry-check">
          ${escapeHTML(checkLabels[key] || key)}
        </span>
      `).join('');

    return `
      <div class="journal-entry">
        <div class="entry-date">
          ${escapeHTML(journalTime(entry))}
        </div>

        <div class="entry-solar">
          📅 ${escapeHTML(entry.solar)}
        </div>

        ${checks ? `
          <div class="entry-checks">${checks}</div>
        ` : ''}

        ${entry.symptoms.length ? `
          <div class="entry-symptoms">
            身體感覺：
            ${escapeHTML(entry.symptoms.join('・'))}
          </div>
        ` : ''}

        ${entry.note ? `
          <div class="entry-note">
            ${escapeHTML(entry.note)}
          </div>
        ` : ''}

        <button
          type="button"
          class="journal-delete"
          data-delete-journal="${escapeHTML(entry.id)}">
          刪除這筆
        </button>
      </div>
    `;
  }).join('');

  if (totalPages > 1) {
    container.insertAdjacentHTML('beforeend', `
      <div style="display:flex;justify-content:center;align-items:center;gap:12px;padding:18px">
        <button type="button" id="journal-prev" ${journalPage === 1 ? 'disabled' : ''}>
          ← 上一頁
        </button>

        <span>第 ${journalPage} / ${totalPages} 頁</span>

        <button type="button" id="journal-next" ${journalPage === totalPages ? 'disabled' : ''}>
          下一頁 →
        </button>
      </div>
    `);
  }

  container.querySelectorAll('[data-delete-journal]').forEach(button => {
    button.addEventListener('click', () => {
      deleteJournal(button.dataset.deleteJournal);
    });
  });

  document.getElementById('journal-prev')?.addEventListener('click', () => {
    journalPage--;
    renderJournal();
  });

  document.getElementById('journal-next')?.addEventListener('click', () => {
    journalPage++;
    renderJournal();
  });
}

function deleteJournal(id) {
  if (!confirm('確定刪除這筆紀錄？此操作無法復原。')) return;

  const updated = journalData.filter(entry => entry.id !== String(id));

  if (!writeLocalJSON(JOURNAL_KEY, updated)) return;

  journalData = updated;
  renderJournal();
  showToast('紀錄已刪除');
}

/* ── JSON 備份 ── */

function exportJournal() {
  const data = {
    app: 'solar-terms-health',
    version: 3,
    exportedAt: new Date().toISOString(),
    entries: journalData
  };

  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: 'application/json;charset=utf-8' }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `節氣自我紀錄-${localDateKey()}.json`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);

  showToast('✓ 備份檔案已產生');
}

async function importJournal(input) {
  const file = input.files?.[0];
  if (!file) return;

  try {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('檔案不可超過 5MB');
    }

    const data = JSON.parse(await file.text());

    if (!data || !Array.isArray(data.entries)) {
      throw new Error('不是有效的日誌備份檔');
    }

    if (data.entries.length > 10000) {
      throw new Error('單次匯入最多 10000 筆');
    }

    if (!data.entries.every(entry =>
      entry &&
      typeof entry === 'object' &&
      typeof entry.date === 'string' &&
      Array.isArray(entry.symptoms) &&
      typeof entry.note === 'string'
    )) {
      throw new Error('備份資料格式不正確');
    }

    const imported = data.entries
      .map(normalizeJournalEntry)
      .filter(Boolean);

    if (!confirm(
      `準備匯入 ${imported.length} 筆紀錄。\n會與現有紀錄合併，不會直接清除舊資料。確定嗎？`
    )) return;

    const existing = new Set(
      journalData.map(entry => entry.id)
    );

    const updated = [...journalData];

    imported.forEach(entry => {
      if (!existing.has(entry.id)) {
        updated.push(entry);
        existing.add(entry.id);
      }
    });

    updated.sort((a, b) =>
      String(b.timestamp).localeCompare(String(a.timestamp))
    );

    if (!writeLocalJSON(JOURNAL_KEY, updated)) return;

    journalData = updated;
    journalPage = 1;

    renderJournal();
    showToast('✓ 紀錄匯入成功');
  } catch (error) {
    alert('匯入失敗：' + error.message);
  } finally {
    input.value = '';
  }
}

/* ── 頁面切換 ── */

const PAGE_TITLES = {
  home: '今日節氣｜節氣養生',
  library: '二十四節氣知識庫｜節氣養生',
  journal: '個人養生日誌｜節氣養生',
  constitution: '中醫體質自測｜節氣養生',
  tools: '提醒工具｜節氣養生'
};

function switchPage(which, navEl, fromHistory = false) {
  document.getElementById('solar-detail').classList.remove('open');
  document.getElementById('page-library').style.display = '';

  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  document.querySelectorAll('.nav-item').forEach(nav => {
    nav.classList.remove('active');
  });

  const page = document.getElementById('page-' + which);
  if (page) page.classList.add('active');

  const nav = navEl ||
    document.querySelector(`.nav-item[data-page="${which}"]`);

  if (nav) nav.classList.add('active');

  document.title = PAGE_TITLES[which] || '節氣養生';

  if (!fromHistory && location.hash !== '#' + which) {
    history.pushState({ page: which }, '', '#' + which);
  }

  if (which === 'home') initHome();
  if (which === 'library') initLibrary();
  if (which === 'journal') renderJournal();

  if (which === 'tools') {
    if (window.initToolsCountdown) initToolsCountdown();
    if (window.initHabits) initHabits();
  }

  if (which === 'constitution') {
    if (window.initConstPage) initConstPage();
  }

  window.scrollTo(0, 0);
}

/* ── Toast ── */

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.style.transform = 'translateX(-50%) translateY(0)';

  clearTimeout(toast._timer);

  toast._timer = setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(80px)';
  }, 2800);
}

/* ── 初始化 ── */

document.addEventListener('DOMContentLoaded', () => {
  initHome();
  initLibrary();

  const hash = location.hash.slice(1);

  if (hash.startsWith('solar=')) {
    const name = decodeURIComponent(hash.slice(6));

    switchPage(
      'library',
      document.querySelector('.nav-item[data-page="library"]'),
      true
    );

    openDetail(name);
  } else if (PAGE_TITLES[hash]) {
    switchPage(
      hash,
      document.querySelector(`.nav-item[data-page="${hash}"]`),
      true
    );
  }

  setInterval(() => {
    if (document.getElementById('page-home').classList.contains('active')) {
      initHome();
    }
  }, 3600000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      if (document.getElementById('page-home').classList.contains('active')) {
        initHome();
      }
      if (document.getElementById('page-journal').classList.contains('active')) {
        renderJournal();
      }
    }
  });
});

/* ── 瀏覽器返回鍵 ── */

window.addEventListener('popstate', () => {
  const hash = location.hash.slice(1);

  const page = hash.startsWith('solar=')
    ? 'library'
    : (PAGE_TITLES[hash] ? hash : 'home');

  switchPage(
    page,
    document.querySelector(`.nav-item[data-page="${page}"]`),
    true
  );

  if (hash.startsWith('solar=')) {
    try {
      openDetail(decodeURIComponent(hash.slice(6)));
    } catch {
      // 忽略無效網址
    }
  }
});
