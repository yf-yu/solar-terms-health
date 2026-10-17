
/* 節氣養生 V3.5.1｜日誌、補填、習慣同步、健康資訊安全
   必須在 app.js、journal-ux.js、tools.js、constitution.js 之後載入。
*/
'use strict';

(() => {
  const HABITS = {
    water: 'h-water',
    veg: 'h-veg',
    sleep: 'h-sleep',
    exercise: 'h-ex'
  };

  const KEYS = Object.keys(HABITS);
  const $ = id => document.getElementById(id);

  const dateKey = d =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const read = key => {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      return null;
    }
  };

  const notify = msg =>
    typeof showToast === 'function'
      ? showToast(msg)
      : alert(msg);

  function put(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      alert('儲存失敗，請保留目前內容並檢查瀏覽器儲存空間。');
      return false;
    }
  }

  function refresh() {
    if (typeof renderJournal === 'function') {
      renderJournal();
    }
  }

  function addEntry(entry) {
    if (
      typeof journalLoadError !== 'undefined' &&
      journalLoadError
    ) {
      alert('舊日誌讀取異常，已停止新增，避免覆蓋資料。');
      return false;
    }

    if (
      typeof journalData === 'undefined' ||
      !Array.isArray(journalData)
    ) {
      return false;
    }

    const updated = [entry, ...journalData].sort((a, b) =>
      String(b.timestamp || b.date)
        .localeCompare(String(a.timestamp || a.date))
    );

    if (!put('st_journal', updated)) return false;

    journalData = updated;

    if (typeof journalPage !== 'undefined') {
      journalPage = 1;
    }

    refresh();
    return true;
  }

  function checksFromForm() {
    return Object.fromEntries(
      KEYS.map(key => [
        key,
        !!$('chk-' + key)?.classList.contains('on')
      ])
    );
  }

  function clearForm() {
    if ($('journal-note')) {
      $('journal-note').value = '';
    }

    document.querySelectorAll('.symptom-chip.sel')
      .forEach(el => el.classList.remove('sel'));
  }

  function getSolarName(date) {
    try {
      return getCurrentSolar(date).term.name;
    } catch {
      return '';
    }
  }

  function formatLocalDateTime(date) {
    return `${dateKey(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  /* ============================================
     一、補填以前的日誌
     ============================================ */

  function initBackfill() {
    const note = $('journal-note');

    if (!note || $('v35-backfill')) return;

    const box = document.createElement('section');

    box.id = 'v35-backfill';
    box.className = 'v35-box';

    box.innerHTML = `
      <label for="v35-datetime">
        <strong>🗓️ 補填以前的紀錄</strong>
      </label>

      <p class="v35-help">
        先在上方勾選當時的狀態、感受或填寫備註，
        再選擇發生時間。
        補填不會修改今天的習慣狀態。
      </p>

      <input
        id="v35-datetime"
        type="datetime-local"
        min="2000-01-01T00:00"
        aria-label="補填的日期與時間">

      <button id="v35-save-backfill" type="button">
        儲存補填紀錄
      </button>
    `;

    note.parentElement.appendChild(box);

    const field = $('v35-datetime');

    field.max = formatLocalDateTime(new Date());
    field.value = formatLocalDateTime(new Date());

    $('v35-save-backfill').addEventListener('click', () => {
      const value = field.value;

      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
        return alert('請選擇補填日期與時間。');
      }

      const when = new Date(value);

      if (
        !Number.isFinite(when.getTime()) ||
        formatLocalDateTime(when) !== value ||
        when > new Date() ||
        when.getFullYear() < 2000
      ) {
        return alert('請輸入有效、且不晚於現在的日期與時間。');
      }

      const checks = checksFromForm();

      const symptoms = [
        ...document.querySelectorAll('.symptom-chip.sel')
      ].map(el => el.textContent.trim());

      const noteText = (note.value || '').trim();

      if (
        !noteText &&
        !symptoms.length &&
        !Object.values(checks).some(Boolean)
      ) {
        return notify('請先填寫備註、感受或勾選習慣。');
      }

      const entry = {
        id: typeof newJournalId === 'function'
          ? newJournalId()
          : `backfill-${Date.now()}`,
        date: dateKey(when),
        timestamp: when.toISOString(),
        solar: getSolarName(when),
        checks,
        symptoms,
        note: `【補填紀錄】${noteText ? '\n' + noteText : ''}`
      };

      if (addEntry(entry)) {
        clearForm();
        notify('✓ 補填紀錄已儲存');
      }
    });
  }

  /* ============================================
     二、日誌與提醒工具的習慣同步
     ============================================ */

  function habitKey() {
    return 'st_habits_' + dateKey(new Date());
  }

  function syncJournalChecks() {
    const saved = read(habitKey()) || {};

    KEYS.forEach(key => {
      const el = $('chk-' + key);
      if (!el) return;

      const done = saved[HABITS[key]] === true;

      el.classList.toggle('on', done);
      el.setAttribute('aria-pressed', String(done));
    });
  }

  function onJournalCheck(event) {
    const btn = event.target.closest('.check-toggle');

    if (
      !btn ||
      !KEYS.some(key => 'chk-' + key === btn.id)
    ) {
      return;
    }

    // 等 index.html 原有的 onclick 切換完成。
    queueMicrotask(() => {
      const key = btn.id.slice(4);
      const saved = read(habitKey()) || {};

      saved[HABITS[key]] = btn.classList.contains('on');

      if (!put(habitKey(), saved)) {
        syncJournalChecks();
      }

      if (
        typeof initHabits === 'function' &&
        $('habit-list')
      ) {
        initHabits();
      }
    });
  }

  if (typeof toggleHabit === 'function') {
    const originalToggleHabit = toggleHabit;

    toggleHabit = function(id, day) {
      originalToggleHabit(id, day);

      if (day === dateKey(new Date())) {
        syncJournalChecks();
      }
    };
  }

  if (typeof switchPage === 'function') {
    const originalSwitchPage = switchPage;

    switchPage = function(...args) {
      const result = originalSwitchPage.apply(this, args);
      syncJournalChecks();
      return result;
    };
  }

  window.addEventListener('storage', event => {
    if (event.key === habitKey()) {
      syncJournalChecks();

      if (
        typeof initHabits === 'function' &&
        $('habit-list')
      ) {
        initHabits();
      }
    }

    if (event.key === 'st_journal') {
      notify(
        '另一分頁更新了日誌，請重新整理後再繼續記錄。'
      );
    }
  });

  /* ============================================
     三、體質問卷結果同步到個人日誌
     ============================================ */

  function constitutionEntry(result) {
    const main = window.CONSTITUTIONS?.[result.main];

    if (!main) return null;

    const when = Number.isFinite(result.timestamp)
      ? new Date(result.timestamp)
      : new Date();

    if (!Number.isFinite(when.getTime())) {
      return null;
    }

    const others = (result.secondary || [])
      .map(key => window.CONSTITUTIONS?.[key]?.name)
      .filter(Boolean);

    const note =
      `【體質傾向問卷（非診斷）】\n` +
      `主要傾向：${main.name}` +
      (others.length
        ? '\n其他傾向：' + others.join('、')
        : '') +
      '\n這是自我觀察問卷結果，並非醫療診斷。';

    return {
      id: `constitution-${result.timestamp || dateKey(when)}-${result.main}`,
      date: dateKey(when),
      timestamp: when.toISOString(),
      solar: getSolarName(when),
      checks: {
        water: false,
        veg: false,
        sleep: false,
        exercise: false
      },
      symptoms: [],
      note
    };
  }

  function addConstitutionToJournal(result) {
    const entry = constitutionEntry(result);

    if (!entry) return false;

    if (journalData.some(old => old.id === entry.id)) {
      return true;
    }

    return addEntry(entry);
  }

  function importLastConstitution() {
    const saved = read('st_constitution');

    if (!saved) {
      return alert('尚未找到已儲存的體質問卷結果。');
    }

    if (!confirm(
      '要將最近一次體質傾向問卷結果加入日誌嗎？'
    )) {
      return;
    }

    if (addConstitutionToJournal(saved)) {
      notify('✓ 已將問卷結果加入日誌');
    }
  }

  /* ============================================
     四、問卷後：生活建議與手動加入日誌
     ============================================ */

  if (typeof showConstResult === 'function') {
    const originalShowResult = showConstResult;

    showConstResult = function(
      mainKey,
      secondaryKeys,
      shouldSave = true
    ) {
      const result = originalShowResult.apply(this, arguments);
      const host = $('const-result');

      if (
        !host ||
        !window.CONSTITUTIONS?.[mainKey]
      ) {
        return result;
      }

      const stored = read('st_constitution');

      const matched =
        stored &&
        stored.main === mainKey &&
        JSON.stringify(stored.secondary || []) ===
          JSON.stringify(secondaryKeys || []);

      const current = {
        main: mainKey,
        secondary: Array.isArray(secondaryKeys)
          ? [...secondaryKeys]
          : [],
        timestamp:
          matched && Number.isFinite(stored.timestamp)
            ? stored.timestamp
            : Date.now()
      };

      const entry = constitutionEntry(current);

      const panel = document.createElement('section');
      panel.className = 'v35-box';

      const heading = document.createElement('strong');
      heading.textContent = '🌱 接下來可以怎麼做？';

      const tips = document.createElement('ul');

      [
        '接下來 7 天，每天記錄睡眠、精神或身體感受。',
        '在提醒工具記錄習慣，再回到日誌觀察變化。',
        '如果不適持續或加重，請尋求合格醫療人員協助。'
      ].forEach(t => {
        const li = document.createElement('li');
        li.textContent = t;
        tips.appendChild(li);
      });

      const question = document.createElement('p');
      question.textContent = '📖 想保留這次問卷結果嗎？';

      const description = document.createElement('p');
      description.className = 'v35-help';
      description.textContent =
        '由你主動決定是否加入個人日誌。' +
        '問卷並非醫療診斷。';

      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = '＋ 加入我的養生日誌';

      if (
        entry &&
        journalData.some(e => e.id === entry.id)
      ) {
        button.textContent = '✓ 已存在於日誌';
        button.disabled = true;
      }

      button.addEventListener('click', () => {
        if (!entry) {
          return alert('問卷結果無法加入日誌。');
        }

        if (journalData.some(e => e.id === entry.id)) {
          button.textContent = '✓ 已存在於日誌';
          button.disabled = true;
        } else if (addEntry(entry)) {
          button.textContent = '✓ 已加入我的養生日誌';
          button.disabled = true;
          notify('✓ 已加入日誌');
        }
      });

      panel.append(
        heading,
        tips,
        question,
        description,
        button
      );

      host.appendChild(panel);

      return result;
    };
  }

  /* ============================================
     五、全站健康資訊安全提醒
     ============================================ */

  function initSafety() {
    if ($('v35-safety')) return;

    const box = document.createElement('aside');

    box.id = 'v35-safety';
    box.className = 'v35-box';
    box.setAttribute('role', 'note');

    box.innerHTML = `
      <strong>健康資訊使用提醒</strong>

      <p>
        本站提供節氣文化、生活習慣紀錄及
        非診斷性體質傾向問卷，並非醫療機構；
        內容不能替代診斷、治療或個別醫囑。
      </p>

      <p>
        請勿因本站建議延後就醫或自行停藥。
        若有胸痛、呼吸困難、突然單側無力、
        意識改變等急症，請立即尋求緊急醫療協助
        （臺灣可撥 119）。
      </p>

      <p>
        穴位、飲食與傳統文獻相關內容
        不代表已證實的治療效果；
        孕期、慢性病、服藥中或其他特殊情況，
        請先詢問合格醫療專業人員。
      </p>
    `;

    const main =
      document.querySelector('main') ||
      $('page-home') ||
      document.body;

    main.insertBefore(box, main.firstChild);
  }

  /* ============================================
     六、介面樣式
     ============================================ */

  function initStyle() {
    if ($('v35-style')) return;

    const style = document.createElement('style');

    style.id = 'v35-style';

    style.textContent = `
      .v35-box {
        background: #f7f9f5;
        border: 1px solid #d9e5d8;
        border-radius: 12px;
        padding: 14px;
        margin: 14px 0;
        color: #354d3d;
        line-height: 1.8;
        font-size: 14px;
      }

      .v35-box p {
        margin: 6px 0;
      }

      .v35-box ul {
        padding-left: 22px;
      }

      .v35-help {
        font-size: 12px;
        color: #617267;
      }

      .v35-box input[type=datetime-local] {
        display: block;
        width: 100%;
        max-width: 350px;
        box-sizing: border-box;
        padding: 10px;
        margin: 10px 0;
        border: 1px solid #aebdae;
        border-radius: 8px;
        font: inherit;
      }

      .v35-box button {
        padding: 10px 13px;
        border: 1px solid #75967e;
        background: white;
        color: #345940;
        border-radius: 9px;
        font: inherit;
        cursor: pointer;
      }

      .v35-box button:focus-visible,
      .v35-box input:focus-visible {
        outline: 2px solid #426a4d;
        outline-offset: 2px;
      }
    `;

    document.head.appendChild(style);
  }

  /* ============================================
     七、啟動
     ============================================ */

  function init() {
    initStyle();
    initBackfill();
    initSafety();
    syncJournalChecks();

    document.addEventListener(
      'click',
      onJournalCheck
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      init
    );
  } else {
    init();
  }
})();
