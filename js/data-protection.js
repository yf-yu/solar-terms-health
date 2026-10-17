
/* 節氣養生 V3.6｜本機資料備份、預覽與安全還原 */
'use strict';

(() => {
  const JOURNAL = 'st_journal';
  const CONSTITUTION = 'st_constitution';
  const MAX_BYTES = 8 * 1024 * 1024;
  const $ = id => document.getElementById(id);

  const allowedKey = key =>
    key === JOURNAL ||
    key === CONSTITUTION ||
    /^st_habits_\d{4}-\d{2}-\d{2}$/.test(key);

  let pending = null;

  function say(message) {
    const el = $('dp-status');
    if (el) el.textContent = message;
  }

  function safeRead(key) {
    const raw = localStorage.getItem(key);

    if (raw === null) {
      return { exists: false, value: null };
    }

    try {
      return {
        exists: true,
        value: JSON.parse(raw)
      };
    } catch {
      throw new Error(
        `本機資料「${key}」格式異常。請勿覆蓋，先保留原始資料。`
      );
    }
  }

  function validateJournal(value) {
    return (
      Array.isArray(value) &&
      value.length <= 50000 &&
      value.every(e =>
        e &&
        typeof e === 'object' &&
        !Array.isArray(e) &&
        (
          typeof e.date === 'string' ||
          typeof e.timestamp === 'string'
        ) &&
        (
          e.id === undefined ||
          ['string', 'number'].includes(typeof e.id)
        ) &&
        (
          e.note === undefined ||
          typeof e.note === 'string'
        ) &&
        (
          e.symptoms === undefined ||
          (
            Array.isArray(e.symptoms) &&
            e.symptoms.every(s => typeof s === 'string')
          )
        )
      )
    );
  }

  function validateValue(key, value) {
    if (key === JOURNAL) {
      return validateJournal(value);
    }

    if (key === CONSTITUTION) {
      return (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        typeof value.main === 'string'
      );
    }

    return (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.values(value).every(
        v => typeof v === 'boolean'
      )
    );
  }

  function collect() {
    const records = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (!allowedKey(key)) continue;

      const item = safeRead(key);

      if (!validateValue(key, item.value)) {
        throw new Error(
          `「${key}」資料格式不符合備份要求，已停止匯出。`
        );
      }

      records[key] = item.value;
    }

    return records;
  }

  function downloadJSON(obj, name) {
    const blob = new Blob(
      [JSON.stringify(obj, null, 2)],
      { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = name;

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function backup() {
    try {
      const records = collect();

      if (!Object.keys(records).length) {
        say('目前沒有找到可備份的日誌、習慣或體質問卷資料。');
        return;
      }

      const stamp = new Date().toLocaleDateString('sv-SE');

      downloadJSON(
        {
          app: 'solar-terms-health',
          format: 1,
          exportedAt: new Date().toISOString(),
          records
        },
        `節氣養生-個人備份-${stamp}.json`
      );

      say(
        '備份檔案已開始下載。請確認檔案存在，並妥善保存。'
      );
    } catch (err) {
      say('備份未完成：' + err.message);
    }
  }

  function entryIdentity(e) {
    if (e.id != null) {
      return `id:${String(e.id)}`;
    }

    return (
      `legacy:${String(e.timestamp || e.date)}` +
      `|${String(e.note || '')}` +
      `|${JSON.stringify(e.symptoms || [])}`
    );
  }

  function mergeJournal(existing, incoming) {
    const result = existing.slice();
    const seen = new Set(existing.map(entryIdentity));
    let added = 0;

    for (const entry of incoming) {
      const identity = entryIdentity(entry);

      if (!seen.has(identity)) {
        result.push(entry);
        seen.add(identity);
        added++;
      }
    }

    result.sort((a, b) =>
      String(b.timestamp || b.date)
        .localeCompare(String(a.timestamp || a.date))
    );

    return {
      value: result,
      added
    };
  }

  function parseBackup(obj) {
    if (
      !obj ||
      obj.app !== 'solar-terms-health' ||
      obj.format !== 1 ||
      !obj.records ||
      typeof obj.records !== 'object' ||
      Array.isArray(obj.records)
    ) {
      throw new Error(
        '這不是 V3.6 可辨識的完整備份檔。' +
        '舊版只有日誌的備份，請使用原本的日誌匯入功能。'
      );
    }

    const keys = Object.keys(obj.records);

    if (
      !keys.length ||
      keys.length > 20000 ||
      keys.some(k => !allowedKey(k))
    ) {
      throw new Error(
        '備份檔包含不支援的資料項目。'
      );
    }

    for (const key of keys) {
      if (!validateValue(key, obj.records[key])) {
        throw new Error(
          `備份內的「${key}」格式異常。`
        );
      }
    }

    return obj.records;
  }

  function buildPlan(records) {
    const plan = {};

    let journalAdded = 0;
    let habitsAdded = 0;
    let habitsSkipped = 0;
    let constitutionAction = '未包含';

    for (const [key, incoming] of Object.entries(records)) {
      const current = safeRead(key);

      if (
        current.exists &&
        !validateValue(key, current.value)
      ) {
        throw new Error(
          `目前裝置的「${key}」資料異常，` +
          '為避免覆蓋已停止還原。'
        );
      }

      if (key === JOURNAL) {
        const merged = mergeJournal(
          current.exists ? current.value : [],
          incoming
        );

        plan[key] = merged.value;
        journalAdded = merged.added;

      } else if (key === CONSTITUTION) {
        if (!current.exists) {
          plan[key] = incoming;
          constitutionAction = '將新增';
        } else {
          constitutionAction = '保留本機現有結果';
        }

      } else if (!current.exists) {
        plan[key] = incoming;
        habitsAdded++;

      } else {
        habitsSkipped++;
      }
    }

    return {
      plan,
      journalAdded,
      habitsAdded,
      habitsSkipped,
      constitutionAction
    };
  }

  async function selectFile(file) {
    pending = null;
    $('dp-confirm').disabled = true;

    if (!file) return;

    try {
      if (file.size > MAX_BYTES) {
        throw new Error(
          '備份超過 8 MB，請先確認檔案是否正確。'
        );
      }

      const records = parseBackup(
        JSON.parse(await file.text())
      );

      const summary = buildPlan(records);

      pending = records;

      say(
        `預覽完成：將新增 ${summary.journalAdded} 筆日誌、` +
        `${summary.habitsAdded} 天習慣；` +
        `${summary.habitsSkipped} 天既有習慣將保留。` +
        `體質問卷：${summary.constitutionAction}。` +
        '確認後才會寫入。'
      );

      $('dp-confirm').disabled = false;

    } catch (err) {
      say('無法讀取備份：' + err.message);
    }
  }

  function restore() {
    if (!pending) return;

    try {
      if (
        typeof journalLoadError !== 'undefined' &&
        journalLoadError
      ) {
        throw new Error(
          '目前日誌讀取異常，已停止還原以保護資料。'
        );
      }

      // 確認匯入前重新讀取，避免預覽期間新增資料。
      const {
        plan,
        journalAdded,
        habitsAdded
      } = buildPlan(pending);

      const keys = Object.keys(plan);

      if (!keys.length) {
        say('沒有需要新增的資料。');
        return;
      }

      const confirmed = confirm(
        `即將匯入 ${journalAdded} 筆新日誌、` +
        `${habitsAdded} 天習慣等資料。\n` +
        '既有日誌會保留，已有日期的習慣不覆蓋。\n' +
        '確定繼續嗎？'
      );

      if (!confirmed) return;

      // 記錄原始資料，寫入失敗時嘗試回復。
      const originals = new Map(
        keys.map(key => [
          key,
          localStorage.getItem(key)
        ])
      );

      try {
        for (const key of keys) {
          localStorage.setItem(
            key,
            JSON.stringify(plan[key])
          );
        }
      } catch {
        for (const [key, raw] of originals) {
          try {
            if (raw === null) {
              localStorage.removeItem(key);
            } else {
              localStorage.setItem(key, raw);
            }
          } catch {
            // 瀏覽器儲存空間異常時，
            // 無法保證所有回復操作成功。
          }
        }

        throw new Error(
          '寫入失敗，已嘗試回復原資料。' +
          '請先檢查儲存空間。'
        );
      }

      pending = null;
      $('dp-confirm').disabled = true;

      say(
        '還原完成。請重新整理頁面，' +
        '讓日誌與習慣重新讀取資料。'
      );

      $('dp-reload').hidden = false;

    } catch (err) {
      say('還原未完成：' + err.message);
    }
  }

  function init() {
    if ($('dp-panel')) return;

    const panel = document.createElement('section');
    panel.id = 'dp-panel';

    panel.innerHTML = `
      <h3>🔐 個人資料備份與還原</h3>

      <p>
        日誌、體質問卷及每日習慣儲存在這個瀏覽器中。
        換裝置、清除網站資料或使用無痕模式，
        都可能使紀錄無法保留。
      </p>

      <button type="button" id="dp-export">
        下載完整 JSON 備份
      </button>

      <label for="dp-file">
        選擇先前下載的備份檔
        （先預覽，不會立即覆蓋）
      </label>

      <input
        type="file"
        id="dp-file"
        accept=".json,application/json">

      <button
        type="button"
        id="dp-confirm"
        disabled>
        確認匯入備份
      </button>

      <button
        type="button"
        id="dp-reload"
        hidden>
        重新整理以顯示資料
      </button>

      <p
        id="dp-status"
        role="status"
        aria-live="polite">
        尚未選擇備份檔。
      </p>

      <details>
        <summary>隱私與使用提醒</summary>

        <p>
          資料預設只存於目前瀏覽器。
          備份由你手動下載，網站不會自動上傳；
          但備份 JSON 未加密，
          請勿公開分享或放在公共電腦。
        </p>

        <p>
          瀏覽器可能因清除資料、裝置故障或儲存限制
          而遺失紀錄。
          建議定期備份並確認檔案能被讀取。
        </p>

        <p>
          體質傾向問卷僅供自我觀察，
          不是醫療診斷。
          網站不取代專業醫療建議。
        </p>
      </details>
    `;

    const style = document.createElement('style');

    style.textContent = `
      #dp-panel {
        margin: 18px 0;
        padding: 16px;
        border: 1px solid #cbdccb;
        border-radius: 14px;
        background: #f7faf5;
        color: #304938;
        line-height: 1.7;
      }

      #dp-panel h3 {
        margin: 0 0 8px;
        font-size: 18px;
      }

      #dp-panel p {
        margin: 8px 0;
      }

      #dp-panel button,
      #dp-panel input[type=file] {
        display: block;
        max-width: 100%;
        margin: 10px 0;
        padding: 10px;
        border: 1px solid #88a48c;
        border-radius: 9px;
        font: inherit;
      }

      #dp-panel button {
        background: #426a4d;
        color: white;
        cursor: pointer;
      }

      #dp-panel button:disabled {
        opacity: .45;
        cursor: not-allowed;
      }

      #dp-panel label {
        display: block;
        margin-top: 12px;
        font-weight: 600;
      }

      #dp-status {
        overflow-wrap: anywhere;
        font-size: 13px;
      }
    `;

    document.head.appendChild(style);

    const target =
      $('page-journal') ||
      document.querySelector('main') ||
      document.body;

    target.appendChild(panel);

    $('dp-export').addEventListener('click', backup);

    $('dp-file').addEventListener('change', e =>
      selectFile(e.target.files[0])
    );

    $('dp-confirm').addEventListener('click', restore);

    $('dp-reload').addEventListener(
      'click',
      () => location.reload()
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
