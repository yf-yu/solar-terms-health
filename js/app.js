/* ════════════════════════════════════════
   節氣養生 — 核心邏輯
   節氣計算、主頁、知識庫、日誌、導覽
════════════════════════════════════════ */

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
    <div class="acu-disclaimer">⚠️ 穴位按摩為傳統養生方法，若有不適請停止並諮詢醫師</div>
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
  history.pushState({ solar: name }, '', '#solar=' + encodeURIComponent(name));
  window.scrollTo(0, 0);
}

function closeDetail() {
  document.getElementById('solar-detail').classList.remove('open');
  document.getElementById('page-library').style.display = 'flex';
  document.title = '二十四節氣知識庫｜節氣養生';
  if (location.hash.startsWith('#solar=')) {
    history.pushState({ page: 'library' }, '', '#library');
  }
}

/* ── 個人日誌 ── */
let journalData = JSON.parse(localStorage.getItem('st_journal') || '[]');

function saveJournal() {
  const now = new Date();
  const { term } = getCurrentSolar(now);
  const checks = {
    water: document.getElementById('chk-water').classList.contains('on'),
    veg:   document.getElementById('chk-veg').classList.contains('on'),
    sleep: document.getElementById('chk-sleep').classList.contains('on'),
    exercise: document.getElementById('chk-exercise').classList.contains('on'),
  };
  const symptoms = [...document.querySelectorAll('.symptom-chip.sel')].map(c => c.textContent.trim());
  const note = document.getElementById('journal-note').value.trim();

  const entry = {
    id: Date.now(),
    date: now.toLocaleDateString('zh-TW'),
    solar: term.name,
    checks, symptoms, note,
  };

  // 同日去重：同一天只保留一筆（更新）
  const today = now.toLocaleDateString('zh-TW');
  const idx = journalData.findIndex(e => e.date === today);
  if (idx >= 0) journalData[idx] = entry;
  else journalData.unshift(entry);

  if (journalData.length > 100) journalData = journalData.slice(0, 100);
  localStorage.setItem('st_journal', JSON.stringify(journalData));

  ['chk-water','chk-veg','chk-sleep','chk-exercise'].forEach(id =>
    document.getElementById(id).classList.remove('on'));
  document.querySelectorAll('.symptom-chip').forEach(c => c.classList.remove('sel'));
  document.getElementById('journal-note').value = '';

  renderJournal();
  showToast('✓ 今日記錄已儲存');
}

function renderJournal() {
  const el = document.getElementById('journal-entries');
  const { term } = getCurrentSolar(new Date());
  document.getElementById('journal-today-label').textContent = `今日（${term.name}）自我觀察`;

  if (!journalData.length) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:var(--fs-sm)">還沒有任何記錄<br>從上方開始記錄今天吧！</div>';
    return;
  }

  const checkLabels = { water:'喝水✓', veg:'蔬菜✓', sleep:'睡眠✓', exercise:'運動✓' };
  el.innerHTML = journalData.slice(0, 20).map(e => {
    const doneCks = Object.entries(e.checks)
      .filter(([,v]) => v)
      .map(([k]) => `<span class="entry-check">${checkLabels[k]}</span>`).join('');
    return `
    <div class="journal-entry">
      <div class="entry-date">${e.date}</div>
      <div class="entry-solar">📅 ${e.solar}</div>
      ${doneCks ? `<div class="entry-checks">${doneCks}</div>` : ''}
      ${e.symptoms.length ? `<div class="entry-symptoms">身體感覺：${e.symptoms.join('・')}</div>` : ''}
      ${e.note ? `<div class="entry-note">${e.note}</div>` : ''}
    </div>`;
  }).join('');
}

/* ── 頁面切換 ── */
const PAGE_TITLES = {
  home: '今日節氣｜節氣養生',
  library: '二十四節氣知識庫｜節氣養生',
  journal: '個人養生日誌｜節氣養生',
  constitution: '中醫體質自測｜節氣養生',
  tools: '提醒工具｜節氣養生'
};

function switchPage(which, navEl) {
  document.getElementById('solar-detail').classList.remove('open');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-' + which);
  if (pageEl) pageEl.classList.add('active');
  if (navEl) navEl.classList.add('active');
  document.title = PAGE_TITLES[which] || '節氣養生';
  history.replaceState({ page: which }, '', '#' + which);

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
window.addEventListener('popstate', (e) => {
  if (e.state?.solar) openDetail(e.state.solar);
  else if (e.state?.page) switchPage(e.state.page, document.querySelector(`.nav-item[data-page="${e.state.page}"]`));
  else closeDetail();
});
