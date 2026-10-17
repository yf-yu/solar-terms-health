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

/* ── 節氣日期計算（精確，使用 SOLAR_DATES 表，跨年安全） ── */
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

  // 每日一句
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
    // 動態加 badge（若原本沒有）
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
  if (location.hash !== '#solar=' + encodeURIComponent(name)) history.pushState({ solar: name }, '', '#solar=' + encodeURIComponent(name));
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

/* ── 個人日誌 ── */

/* ── 個人日誌 ── */
let journalData = readLocalJSON('st_journal', []);
if (!Array.isArray(journalData)) journalData = [];

function saveJournal() {
  const now = new Date();
  const { term } = getCurrentSolar(now);

  const checks = {
    water: document.getElementById('chk-water').classList.contains('on'),
    veg: document.getElementById('chk-veg').classList.contains('on'),
    sleep: document.getElementById('chk-sleep').classList.contains('on'),
    exercise: document.getElementById('chk-exercise').classList.contains('on'),
  };

  const symptoms = [
    ...document.querySelectorAll('.symptom-chip.sel')
  ].map(c => c.textContent.trim());

  const note = document.getElementById('journal-note').value.trim();

  const entry = {
    id: Date.now(),
    date: localDateKey(now),
    timestamp: now.toISOString(),
    solar: term.name,
    checks,
    symptoms,
    note,
  };

  // 每次新增獨立紀錄，不覆蓋當天舊資料
  const updated = [entry, ...journalData];

  if (!writeLocalJSON('st_journal', updated)) return;

  journalData = updated;

  document.getElementById('journal-note').value = '';
  document.querySelectorAll('.symptom-chip.sel')
    .forEach(c => c.classList.remove('sel'));

  renderJournal();
  showToast('✓ 已新增一筆時間紀錄');
}

function journalTime(e) {
  const d = e.timestamp
    ? new Date(e.timestamp)
    : new Date(e.date + 'T12:00:00');

  return Number.isNaN(d.getTime())
    ? (e.date || '未知日期')
    : d.toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
}

function renderJournal() {
  const el = document.getElementById('journal-entries');
  const { term } = getCurrentSolar(new Date());

  document.getElementById('journal-today-label').textContent =
    `隨時記下此刻（${term.name}）`;

  const insights = document.getElementById('journal-insights');

  if (!journalData.length) {
    insights.textContent =
      '記下幾次不同時段的感受後，這裡會幫你整理常見狀態。';

    el.innerHTML =
      '<div style="text-align:center;padding:24px;color:var(--muted)">還沒有任何紀錄，從此刻開始吧！</div>';
    return;
  }

  const recent = journalData.filter(e =>
    e.timestamp &&
    Date.now() - new Date(e.timestamp).getTime() <= 7 * 86400000
  );

  const counts = {};

  recent.forEach(e =>
    (e.symptoms || []).forEach(x => {
      counts[x] = (counts[x] || 0) + 1;
    })
  );

  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  insights.textContent = recent.length
    ? `最近 7 天記錄 ${recent.length} 次。${
        top.length
          ? '常出現的感受：' +
            top.map(([x, n]) => `${x}（${n} 次）`).join('、') + '。'
          : '可以多記錄感受，慢慢觀察變化。'
      }這只是紀錄統計，不代表醫療診斷。`
    : '近期尚無紀錄，今天可以從一次簡短觀察開始。';

  const checkLabels = {
    water: '喝水✓',
    veg: '蔬菜✓',
    sleep: '睡眠✓',
    exercise: '運動✓'
  };

  el.innerHTML = journalData.slice(0, 100).map(e => {
    const doneCks = Object.entries(e.checks || {})
      .filter(([, v]) => v)
      .map(([k]) =>
        `<span class="entry-check">${escapeHTML(checkLabels[k] || k)}</span>`
      ).join('');

    return `<div class="journal-entry">
      <div class="entry-date">${escapeHTML(journalTime(e))}</div>
      <div class="entry-solar">📅 ${escapeHTML(e.solar || '')}</div>

      ${doneCks
        ? `<div class="entry-checks">${doneCks}</div>`
        : ''}

      ${(e.symptoms || []).length
        ? `<div class="entry-symptoms">身體感覺：${escapeHTML(e.symptoms.join('・'))}</div>`
        : ''}

      ${e.note
        ? `<div class="entry-note">${escapeHTML(e.note)}</div>`
        : ''}

      <button
        type="button"
        class="journal-delete"
        onclick="deleteJournal(${Number(e.id) || 0})"
        aria-label="刪除此筆紀錄">
        刪除這筆
      </button>
    </div>`;
  }).join('');
}

function deleteJournal(id) {
  if (!confirm('確定刪除這筆紀錄？此操作無法復原。')) return;

  const updated = journalData.filter(e => e.id !== id);

  if (writeLocalJSON('st_journal', updated)) {
    journalData = updated;
    renderJournal();
    showToast('紀錄已刪除');
  }
}

function exportJournal() {
  const blob = new Blob([
    JSON.stringify({
      version: 2,
      exportedAt: new Date().toISOString(),
      entries: journalData
    }, null, 2)
  ], { type: 'application/json' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = `節氣自我紀錄-${localDateKey(new Date())}.json`;
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importJournal(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  try {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('檔案過大');
    }

    const data = JSON.parse(await file.text());

    if (
      !Array.isArray(data.entries) ||
      !data.entries.every(e =>
        e &&
        typeof e.date === 'string' &&
        Array.isArray(e.symptoms) &&
        typeof e.note === 'string'
      )
    ) {
      throw new Error('檔案格式不符');
    }

    if (!confirm(`匯入 ${data.entries.length} 筆紀錄？將與現有紀錄合併。`)) {
      return;
    }

    const existing = new Set(
      journalData.map(e => `${e.timestamp || e.date}|${e.note}`)
    );

    const updated = [...journalData];

    data.entries.forEach(e => {
      const key = `${e.timestamp || e.date}|${e.note}`;

      if (!existing.has(key)) {
        updated.push(e);
        existing.add(key);
      }
    });

    updated.sort((a, b) =>
      String(b.timestamp || b.date)
        .localeCompare(String(a.timestamp || a.date))
    );

    if (writeLocalJSON('st_journal', updated)) {
      journalData = updated;
      renderJournal();
      showToast('✓ 匯入完成');
    }
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
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-' + which);
  if (pageEl) pageEl.classList.add('active');
  if (navEl) navEl.classList.add('active');
  document.title = PAGE_TITLES[which] || '節氣養生';
  if (!fromHistory && location.hash !== '#' + which) history.pushState({ page: which }, '', '#' + which);

  if (which === 'home') initHome();
  if (which === 'library') initLibrary();
  if (which === 'journal') renderJournal();
  if (which === 'tools') { if (window.initToolsCountdown) initToolsCountdown(); if (window.initHabits) initHabits(); }
  if (which === 'constitution') { if (window.initConstPage) initConstPage(); }
  window.scrollTo(0, 0);
}

/* ── Toast ── */
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(t._t);
  t._t = setTimeout(() => t.style.transform = 'translateX(-50%) translateY(80px)', 2800);
}

/* ── 啟動 ── */
document.addEventListener('DOMContentLoaded', () => {
  initHome();
  initLibrary();

  // 依 URL hash 決定初始頁
  const h = location.hash.replace('#', '');
  if (h.startsWith('solar=')) {
    const name = decodeURIComponent(h.slice(6));
    switchPage('library', document.querySelector('.nav-item[data-page="library"]'));
    setTimeout(() => openDetail(name), 0);
  } else if (PAGE_TITLES[h]) {
    switchPage(h, document.querySelector(`.nav-item[data-page="${h}"]`));
  }

  // 每小時重算一次主頁（跨節氣時更新）
  setInterval(() => {
    if (document.getElementById('page-home').classList.contains('active')) initHome();
  }, 3600000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && document.getElementById('page-home').classList.contains('active')) initHome();
  });
});

/* ── 歷史返回鍵 ── */
window.addEventListener('popstate', () => {
  const hash = location.hash.slice(1);
  const page = hash.startsWith('solar=') ? 'library' : (PAGE_TITLES[hash] ? hash : 'home');
  switchPage(page, document.querySelector(`.nav-item[data-page="${page}"]`), true);
  if (hash.startsWith('solar=')) {
    try { openDetail(decodeURIComponent(hash.slice(6))); } catch { /* 無效網址 */ }
  }
});
