
function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function readLocalJSON(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
  catch { return fallback; }
}
function writeLocalJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { showToast('儲存失敗：請檢查瀏覽器儲存空間或隱私模式'); return false; }
}
function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

/* ── Service Worker 註冊 ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW 註冊失敗', err));
  });
}

/* ── 節氣日期計算（使用 SOLAR_DATES 表，跨年安全） ── */
function getSolarDatesInRange(year) {
  const table = (window.SOLAR_DATES && window.SOLAR_DATES[year]) || null;
  return window.SOLAR_TERMS.map((st, i) => {
    const [m, d] = table ? table[i] : [st.month, st.day];
    return { term: st, date: new Date(year, m - 1, d) };
  });
}

function getCurrentSolar(now) {
  now = now || new Date();
  const thisYear = getSolarDatesInRange(now.getFullYear());
  const lastYear = getSolarDatesInRange(now.getFullYear() - 1);
  const nextYear = getSolarDatesInRange(now.getFullYear() + 1);
  const all = [...lastYear, ...thisYear, ...nextYear];

  let cur = all[0], next = all[all.length - 1];
  for (let i = 0; i < all.length; i++) {
    if (all[i].date <= now) cur = all[i];
    if (all[i].date > now) { next = all[i]; break; }
  }
  return {
    term: cur.term,
    daysIn: Math.max(0, Math.floor((now - cur.date) / 86400000)),
    next: {
      term: next.term,
      daysLeft: Math.max(0, Math.ceil((next.date - now) / 86400000)),
      date: next.date
    }
  };
}

function getNextSolar(now) {
  return getCurrentSolar(now).next;
}

/* ── 主頁 ── */
function initHome() {
  const now = new Date();
  const { term, daysIn, next } = getCurrentSolar(now);

  const days = ['日','一','二','三','四','五','六'];
  document.getElementById('hero-date').textContent =
    `${now.getFullYear()}年 ${now.getMonth()+1}月${now.getDate()}日 星期${days[now.getDay()]}`;
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
      <div class="action-desc">${term.diet}</div>
      <div class="action-tip">以上食材依傳統養生建議，可依個人情況適量食用</div>
    </div>
  </div>
  <div class="action-card">
    <span class="action-icon">🌙</span>
    <div class="action-info">
      <div class="action-cat">起居建議</div>
      <div class="action-title">睡眠作息</div>
      <div class="action-desc">${term.sleep}</div>
    </div>
  </div>
  <div class="action-card">
    <span class="action-icon">🤸</span>
    <div class="action-info">
      <div class="action-cat">運動建議</div>
      <div class="action-title">適合的活動</div>
      <div class="action-desc">${term.exercise}</div>
    </div>
  </div>
  <div class="action-card">
    <span class="action-icon">⚠️</span>
    <div class="action-info">
      <div class="action-cat">注意事項</div>
      <div class="action-title">這時節要避免</div>
      <div class="action-desc">${term.avoid}</div>
    </div>
  </div>
  <div class="action-card">
    <span class="action-icon">📜</span>
    <div class="action-info">
      <div class="action-cat">內經智慧</div>
      <div class="action-title">古人說</div>
      <div class="action-desc" style="font-family:'Noto Serif TC',serif">「${term.classic}」</div>
      <div class="action-tip">${term.classicSrc}<br>（養生建議，非醫療診斷）</div>
    </div>
  </div>
  ${term.symptoms ? `
  <div class="action-card" style="border-color:var(--sand)">
    <span class="action-icon">🎯</span>
    <div class="action-info">
      <div class="action-cat">穴位小提示</div>
      <div class="action-title">這時節常見不適：${term.symptoms.map(s=>s.name).join('・')}</div>
      <div class="action-desc">點「知識庫」→「${term.name}」查看完整穴位按摩說明</div>
      <div class="action-tip">傳統養生穴位按摩，僅供參考，不構成醫療建議</div>
    </div>
  </div>` : ''}`;

  const dayIdx = Math.floor(Date.now()/86400000) % window.QUOTES.length;
  document.getElementById('daily-quote').textContent = window.QUOTES[dayIdx];
}

/* ── 知識庫 ── */
function filterLibrary() {
  const q = document.getElementById('lib-search')?.value?.trim() || '';
  let visible = 0;
  document.querySelectorAll('.solar-item').forEach(el => {
    const name = el.dataset.name || el.querySelector('.solar-item-name')?.textContent || '';
    const match = !q || name.includes(q);
    el.style.display = match ? '' : 'none';
    if (match) visible++;
  });
  let empty = document.getElementById('lib-empty');
  if (!empty) {
    empty = document.createElement('div');
    empty.id = 'lib-empty';
    empty.style.cssText = 'grid-column:1/-1;text-align:center;padding:24px;color:var(--muted);font-size:14px';
    empty.textContent = '找不到符合的節氣';
    document.getElementById('solar-list').appendChild(empty);
  }
  empty.style.display = visible ? 'none' : 'block';
}

function initLibrary() {
  const now = new Date();
  const { term: cur } = getCurrentSolar(now);
  document.querySelectorAll('.solar-item').forEach(el => {
    const name = el.dataset.name || el.querySelector('.solar-item-name')?.textContent;
    const isCurrent = name === cur.name;
    el.classList.toggle('current', isCurrent);
    const badge = el.querySelector('.solar-item-badge');
    if (isCurrent && !badge) {
      const b = document.createElement('div');
      b.className = 'solar-item-badge';
      b.textContent = '當前節氣';
      el.appendChild(b);
    } else if (!isCurrent && badge) {
      badge.remove();
    }
  });
}

function openDetail(name) {
  const st = window.SOLAR_TERMS.find(s => s.name === name);
  if (!st) return;
  document.getElementById('detail-name').textContent = st.name;
  document.title = `${st.name}｜節氣養生建議 - 節氣養生`;

  const acuHtml = st.symptoms ? `
  <div class="detail-card">
    <div class="detail-card-title">🎯 這個節氣常見不適・穴位按摩</div>
    <div class="detail-card-body" style="margin-bottom:10px">以下是${st.name}前後常見的身體狀況及傳統穴位按摩建議，僅供參考，不構成醫療建議。</div>
    <div class="acupoint-grid">
      ${st.symptoms.map(s => `
      <div class="acu-card">
        <div class="acu-header"><span class="acu-icon">${s.icon}</span><span class="acu-symptom">${s.name}</span></div>
        <div class="acu-name">穴位：${s.acupoint}</div>
        <div class="acu-location">📍 位置：${s.location}</div>
        <div class="acu-method">按摩方式：${s.method}</div>
      </div>`).join('')}
    </div>
    <div class="acu-disclaimer">⚠️ 穴位按摩為傳統養生方法，若有不適請立即停止並諮詢醫師</div>
  </div>` : '';

  const extraClassicHtml = st.classicExtra ? `
  <div class="detail-card" style="background:#F9F5EF">
    <div class="detail-card-title">📚 《傷寒論》相關記載</div>
    <div class="detail-card-body" style="font-family:'Noto Serif TC',serif;font-size:var(--fs-sm);color:var(--earth);line-height:1.9">${st.classicExtra}</div>
  </div>` : '';

  document.getElementById('detail-body').innerHTML = `
  <div class="detail-card">
    <div class="detail-card-title">🌿 節氣概覽</div>
    <div class="detail-card-body">${st.summary}<br><br>通常在 <strong>${st.month}月${st.day}日</strong> 前後，屬<strong>${{spring:'春季',summer:'夏季',autumn:'秋季',winter:'冬季'}[st.season]}</strong>節氣。</div>
  </div>
  <div class="detail-card">
    <div class="detail-card-title">🥢 飲食建議</div>
    <div class="detail-card-body">${st.diet}<br><br>以上食材為傳統養生建議，可依個人體質和喜好調整，如有特殊疾病請諮詢醫師。</div>
  </div>
  <div class="detail-card">
    <div class="detail-card-title">🌙 起居建議</div>
    <div class="detail-card-body">${st.sleep}</div>
  </div>
  <div class="detail-card">
    <div class="detail-card-title">🤸 運動建議</div>
    <div class="detail-card-body">${st.exercise}</div>
  </div>
  <div class="detail-card">
    <div class="detail-card-title">⚠️ 注意事項</div>
    <div class="detail-card-body">${st.avoid}</div>
  </div>
  ${acuHtml}
  <div class="detail-card">
    <div class="detail-card-title">📜 《黃帝內經》智慧</div>
    <div class="detail-quote">
      「${st.classic}」
      <cite>${st.classicSrc}</cite>
    </div>
  </div>
  ${extraClassicHtml}
  <div class="detail-card" style="background:#F5F5F0">
    <div class="detail-card-body" style="font-size:var(--fs-xs);color:var(--hint)">本頁內容為傳統文化養生知識，不構成醫療建議。如有健康疑慮，請諮詢醫療專業人員。</div>
  </div>`;

  document.getElementById('page-library').style.display = 'none';
  document.getElementById('solar-detail').classList.add('open');
  if (location.hash !== '#solar=' + encodeURIComponent(name)) {
    history.pushState({ solar: name }, '', '#solar=' + encodeURIComponent(name));
  }
  window.scrollTo(0, 0);
}

function closeDetail() {
  document.getElementById('solar-detail').classList.remove('open');
  document.getElementById('page-library').style.display = 'flex';
  document.title = '二十四節氣知識庫｜節氣養生';
  if (location.hash.startsWith('#solar=')) {
    history.replaceState({ page: 'library' }, '', '#library');
  }
}

/* ── 個人日誌：安全儲存版 V3.1 ── */
const JOURNAL_KEY = 'st_journal';
const JOURNAL_PAGE_SIZE = 30;
let journalPage = 1;
let journalLoadError = false;

function newJournalId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `r-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeJournalEntry(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const date = typeof raw.date === 'string' ? raw.date : '';
  const timestamp =
    typeof raw.timestamp === 'string' &&
    !Number.isNaN(Date.parse(raw.timestamp))
      ? raw.timestamp
      : '';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) && !timestamp) return null;

  const derivedDate = timestamp
    ? localDateKey(new Date(timestamp))
    : date;

  const symptoms =
    Array.isArray(raw.symptoms) &&
    raw.symptoms.every(s => typeof s === 'string')
      ? raw.symptoms.slice(0, 30).map(s => s.slice(0, 100))
      : [];

  return {
    id: raw.id == null ? newJournalId() : String(raw.id),
    date: derivedDate,
    timestamp,
    solar: typeof raw.solar === 'string' ? raw.solar.slice(0, 60) : '',
    checks: Object.fromEntries(
      ['water', 'veg', 'sleep', 'exercise'].map(k => [
        k,
        raw.checks?.[k] === true
      ])
    ),
    symptoms,
    note: typeof raw.note === 'string'
      ? raw.note.slice(0, 10000)
      : ''
  };
}

function loadJournal() {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    if (raw === null) return [];

    const data = JSON.parse(raw);

    if (!Array.isArray(data)) {
      throw new Error('現有日誌不是預期的陣列格式');
    }

    if (data.some(e => !normalizeJournalEntry(e))) {
      throw new Error('現有日誌有無法辨識的紀錄');
    }

    return data
      .map(normalizeJournalEntry)
      .sort((a, b) =>
        String(b.timestamp || b.date)
          .localeCompare(String(a.timestamp || a.date))
      );
  } catch (err) {
    console.error('日誌讀取失敗；為保護舊資料，暫停寫入', err);
    journalLoadError = true;
    return [];
  }
}

let journalData = loadJournal();

function saveJournal() {
  if (journalLoadError) {
    return alert(
      '原有日誌資料格式異常。為避免覆蓋，已停止儲存；請先備份瀏覽器資料。'
    );
  }

  const now = new Date();

  const checks = Object.fromEntries(
    ['water', 'veg', 'sleep', 'exercise'].map(k => [
      k,
      !!document.getElementById('chk-' + k)?.classList.contains('on')
    ])
  );

  const symptoms = [
    ...document.querySelectorAll('.symptom-chip.sel')
  ].map(e => e.textContent.trim());

  const noteInput = document.getElementById('journal-note');
  const note = (noteInput?.value || '').trim();

  if (!note && !symptoms.length && !Object.values(checks).some(Boolean)) {
    return showToast('請先選擇感受、習慣或填寫備註');
  }

  const entry = {
    id: newJournalId(),
    date: localDateKey(now),
    timestamp: now.toISOString(),
    solar: getCurrentSolar(now).term.name,
    checks,
    symptoms,
    note
  };

  const updated = [entry, ...journalData];

  if (!writeLocalJSON(JOURNAL_KEY, updated)) return;

  journalData = updated;
  journalPage = 1;

  if (noteInput) noteInput.value = '';

  document.querySelectorAll('.symptom-chip.sel').forEach(e => {
    e.classList.remove('sel');
  });

  renderJournal();
  showToast('✓ 已儲存此刻紀錄');
}

function journalTime(e) {
  const d = new Date(
    e.timestamp || `${e.date}T12:00:00`
  );

  if (Number.isNaN(d.getTime())) {
    return e.date || '未知日期';
  }

  return e.timestamp
    ? d.toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    : `${e.date}（舊紀錄，無時間）`;
}

function renderJournal() {
  const el = document.getElementById('journal-entries');
  const insights = document.getElementById('journal-insights');

  if (!el || !insights) return;

  const label = document.getElementById('journal-today-label');

  if (label) {
    label.textContent =
      `隨時記下此刻（${getCurrentSolar().term.name}）`;
  }

  if (journalLoadError) {
    insights.textContent =
      '⚠️ 舊日誌讀取失敗，為避免資料遺失已暫停儲存與匯入。';
    el.textContent =
      '請先保留原瀏覽器資料，不要清除網站資料。';
    return;
  }

  const now = Date.now();

  const recent = journalData.filter(e => {
    const time = Date.parse(
      e.timestamp || `${e.date}T12:00:00`
    );

    return Number.isFinite(time) &&
      time <= now &&
      now - time < 7 * 86400000;
  });

  const counts = new Map();

  recent.forEach(e => {
    e.symptoms.forEach(s => {
      counts.set(s, (counts.get(s) || 0) + 1);
    });
  });

  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  insights.textContent = recent.length
    ? `最近 7 天有 ${recent.length} 筆紀錄。${
        top.length
          ? '常見感受：' +
            top.map(([s, n]) => `${s}（${n} 次）`).join('、') +
            '。'
          : ''
      }此為紀錄統計，並非醫療診斷。`
    : '最近七天尚無紀錄，隨時可以新增一筆。';

  if (!journalData.length) {
    el.innerHTML =
      '<div style="text-align:center;padding:24px;color:var(--muted)">尚無紀錄，從此刻開始吧！</div>';
    return;
  }

  const totalPages = Math.ceil(
    journalData.length / JOURNAL_PAGE_SIZE
  );

  journalPage = Math.min(
    Math.max(journalPage, 1),
    totalPages
  );

  const pageEntries = journalData.slice(
    (journalPage - 1) * JOURNAL_PAGE_SIZE,
    journalPage * JOURNAL_PAGE_SIZE
  );

  const labels = {
    water: '喝水✓',
    veg: '蔬菜✓',
    sleep: '睡眠✓',
    exercise: '運動✓'
  };

  el.innerHTML = pageEntries.map(e => {
    const checks = Object.entries(e.checks)
      .filter(([, done]) => done)
      .map(([key]) =>
        `<span class="entry-check">${labels[key]}</span>`
      ).join('');

    return `<div class="journal-entry">
      <div class="entry-date">${escapeHTML(journalTime(e))}</div>
      <div class="entry-solar">📅 ${escapeHTML(e.solar)}</div>

      ${checks
        ? `<div class="entry-checks">${checks}</div>`
        : ''}

      ${e.symptoms.length
        ? `<div class="entry-symptoms">身體感覺：${escapeHTML(e.symptoms.join('・'))}</div>`
        : ''}

      ${e.note
        ? `<div class="entry-note">${escapeHTML(e.note)}</div>`
        : ''}

      <button
        type="button"
        class="journal-delete"
        data-journal-id="${escapeHTML(e.id)}">
        刪除這筆
      </button>
    </div>`;
  }).join('');

  el.querySelectorAll('[data-journal-id]').forEach(button => {
    button.addEventListener('click', () => {
      deleteJournal(button.dataset.journalId);
    });
  });

  if (totalPages > 1) {
    const nav = document.createElement('div');

    nav.style.cssText =
      'display:flex;align-items:center;justify-content:center;gap:12px;padding:16px';

    const prev = document.createElement('button');
    prev.textContent = '← 上一頁';
    prev.disabled = journalPage === 1;
    prev.addEventListener('click', () => {
      journalPage--;
      renderJournal();
    });

    const info = document.createElement('span');
    info.textContent = `${journalPage} / ${totalPages} 頁`;

    const next = document.createElement('button');
    next.textContent = '下一頁 →';
    next.disabled = journalPage === totalPages;
    next.addEventListener('click', () => {
      journalPage++;
      renderJournal();
    });

    nav.append(prev, info, next);
    el.appendChild(nav);
  }
}

function deleteJournal(id) {
  if (journalLoadError) return;

  if (!confirm('確定刪除這筆紀錄？此操作無法復原。')) {
    return;
  }

  const updated = journalData.filter(
    e => e.id !== String(id)
  );

  if (updated.length === journalData.length) {
    return showToast('找不到這筆紀錄');
  }

  if (!writeLocalJSON(JOURNAL_KEY, updated)) return;

  journalData = updated;
  renderJournal();
  showToast('紀錄已刪除');
}

/* ── JSON 備份 ── */
function exportJournal() {
  if (journalLoadError) {
    return alert(
      '日誌讀取異常，請勿匯出空白備份覆蓋舊備份。'
    );
  }

  const blob = new Blob([
    JSON.stringify({
      app: 'solar-terms-health',
      version: 3,
      exportedAt: new Date().toISOString(),
      entries: journalData
    }, null, 2)
  ], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download =
    `節氣自我紀錄-${localDateKey()}.json`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importJournal(input) {
  const file = input.files?.[0];
  if (!file) return;

  try {
    if (journalLoadError) {
      throw new Error(
        '原有資料讀取異常，已禁止匯入以免覆蓋'
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('備份檔超過 5 MB');
    }

    const parsed = JSON.parse(await file.text());

    if (
      !parsed ||
      !Array.isArray(parsed.entries) ||
      parsed.entries.length > 10000
    ) {
      throw new Error('備份格式錯誤或筆數過多');
    }

    if (!parsed.entries.every(e =>
      e &&
      typeof e === 'object' &&
      typeof e.date === 'string' &&
      Array.isArray(e.symptoms) &&
      e.symptoms.every(s => typeof s === 'string') &&
      typeof e.note === 'string'
    )) {
      throw new Error('備份內容有不合法的紀錄');
    }

    const incoming = parsed.entries.map(
      normalizeJournalEntry
    );

    if (incoming.some(e => !e)) {
      throw new Error('備份日期格式不正確');
    }

    if (!confirm(
      `匯入 ${incoming.length} 筆紀錄？會與現有紀錄合併，不清除舊資料。`
    )) {
      return;
    }

    const seen = new Set(
      journalData.map(e =>
        `${e.timestamp || e.date}|${e.note}|${e.symptoms.join('~')}`
      )
    );

    const ids = new Set(
      journalData.map(e => e.id)
    );

    const originalCount = journalData.length;
    const updated = [...journalData];

    incoming.forEach(e => {
      const fingerprint =
        `${e.timestamp || e.date}|${e.note}|${e.symptoms.join('~')}`;

      if (seen.has(fingerprint)) return;

      seen.add(fingerprint);

      if (ids.has(e.id)) {
        e.id = newJournalId();
      }

      ids.add(e.id);
      updated.push(e);
    });

    updated.sort((a, b) =>
      String(b.timestamp || b.date)
        .localeCompare(String(a.timestamp || a.date))
    );

    if (!writeLocalJSON(JOURNAL_KEY, updated)) return;

    journalData = updated;
    journalPage = 1;

    renderJournal();

    showToast(
      `✓ 匯入完成，新增 ${updated.length - originalCount} 筆紀錄`
    );
  } catch (err) {
    alert('匯入失敗：' + err.message);
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

  document.querySelectorAll('.page').forEach(p =>
    p.classList.remove('active')
  );

  document.querySelectorAll('.nav-item').forEach(n =>
    n.classList.remove('active')
  );

  const pageEl = document.getElementById('page-' + which);
  if (pageEl) pageEl.classList.add('active');

  if (navEl) navEl.classList.add('active');

  document.title = PAGE_TITLES[which] || '節氣養生';

  if (!fromHistory && location.hash !== '#' + which) {
    history.pushState(
      { page: which },
      '',
      '#' + which
    );
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
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;

  t.textContent = msg;
  t.style.transform =
    'translateX(-50%) translateY(0)';

  clearTimeout(t._t);

  t._t = setTimeout(() => {
    t.style.transform =
      'translateX(-50%) translateY(80px)';
  }, 2800);
}

/* ── 啟動 ── */
document.addEventListener('DOMContentLoaded', () => {
  initHome();
  initLibrary();

  const h = location.hash.replace('#', '');

  if (h.startsWith('solar=')) {
    const name = decodeURIComponent(h.slice(6));

    switchPage(
      'library',
      document.querySelector(
        '.nav-item[data-page="library"]'
      )
    );

    setTimeout(() => openDetail(name), 0);
  } else if (PAGE_TITLES[h]) {
    switchPage(
      h,
      document.querySelector(
        `.nav-item[data-page="${h}"]`
      )
    );
  }

  setInterval(() => {
    if (
      document.getElementById('page-home')
        .classList.contains('active')
    ) {
      initHome();
    }
  }, 3600000);

  document.addEventListener('visibilitychange', () => {
    if (
      !document.hidden &&
      document.getElementById('page-home')
        .classList.contains('active')
    ) {
      initHome();
    }
  });
});

/* ── 歷史返回鍵 ── */
window.addEventListener('popstate', () => {
  const hash = location.hash.slice(1);

  const page = hash.startsWith('solar=')
    ? 'library'
    : (PAGE_TITLES[hash] ? hash : 'home');

  switchPage(
    page,
    document.querySelector(
      `.nav-item[data-page="${page}"]`
    ),
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
