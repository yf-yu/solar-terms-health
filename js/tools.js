/* ════════════════════════════════════════
   節氣養生 — 提醒工具
   倒數計時、養生計時器、習慣打勾
════════════════════════════════════════ */

/* ── 下個節氣倒數 ── */
function initToolsCountdown() {
  if (typeof getNextSolar !== 'function') return;
  const now = new Date();
  const next = getNextSolar(now);
  if (!next) return;

  document.getElementById('tools-next-name').textContent = next.term.name;
  const nextDate = next.date || new Date(now.getFullYear(), next.term.month - 1, next.term.day);
  document.getElementById('tools-next-date').textContent =
    `${nextDate.getMonth() + 1}月${nextDate.getDate()}日`;

  function tick() {
    const diff = nextDate - new Date();
    if (diff < 0) { initToolsCountdown(); return; }
    const days = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    document.getElementById('tools-countdown-num').textContent = days;
    document.getElementById('cd-h').textContent = String(h).padStart(2, '0');
    document.getElementById('cd-m').textContent = String(m).padStart(2, '0');
    document.getElementById('cd-s').textContent = String(s).padStart(2, '0');
  }
  tick();
  if (window._cdTimer) clearInterval(window._cdTimer);
  window._cdTimer = setInterval(tick, 1000);
}

/* ── 養生計時器（使用時間戳避免背景漂移） ── */
let timerInterval = null, timerEnd = 0, timerPaused = false, timerPausedLeft = 0, timerLabel = '';

function startTimer(sec, label) {
  clearInterval(timerInterval);
  timerEnd = Date.now() + sec * 1000;
  timerPaused = false;
  timerPausedLeft = 0;
  timerLabel = label;

  document.getElementById('timer-label').textContent = label;
  document.getElementById('timer-display').style.display = 'block';
  document.getElementById('timer-toggle').textContent = '⏸ 暫停';
  updateTimerDisplay(Math.ceil(sec));

  timerInterval = setInterval(() => {
    if (timerPaused) return;
    const left = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
    if (left <= 0) {
      clearInterval(timerInterval);
      document.getElementById('timer-time').textContent = '完成！';
      showToast('🎉 ' + timerLabel + ' 完成！');
      return;
    }
    updateTimerDisplay(left);
  }, 250);
}

function updateTimerDisplay(secLeft) {
  const m = Math.floor(secLeft / 60), s = secLeft % 60;
  document.getElementById('timer-time').textContent =
    String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function toggleTimer() {
  timerPaused = !timerPaused;
  if (timerPaused) {
    timerPausedLeft = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
  } else {
    timerEnd = Date.now() + timerPausedLeft * 1000;
  }
  document.getElementById('timer-toggle').textContent = timerPaused ? '▶ 繼續' : '⏸ 暫停';
}

function stopTimer() {
  clearInterval(timerInterval);
  document.getElementById('timer-display').style.display = 'none';
}

/* ── 今日習慣打勾 ── */
function initHabits() {
  if (!window.HABITS) return;
  const today = localDateKey();
  const saved = readLocalJSON('st_habits_' + today, {});
  const el = document.getElementById('habit-list');
  if (!el) return;
  el.innerHTML = window.HABITS.map(h => `
    <button type="button" class="habit-row ${saved[h.id] ? 'done' : ''}" aria-pressed="${!!saved[h.id]}"
      onclick="toggleHabit('${h.id}','${today}')">
      <span class="habit-emoji">${h.em}</span>
      <span class="habit-name">${h.name}</span>
      <span class="habit-check">${saved[h.id] ? '✅' : '⬜'}</span>
    </button>`).join('');
}

function toggleHabit(id, today) {
  const saved = readLocalJSON('st_habits_' + today, {});
  saved[id] = !saved[id];
  if (!writeLocalJSON('st_habits_' + today, saved)) return;
  initHabits();
  if (saved[id]) showToast('✓ 記錄完成！');
}
