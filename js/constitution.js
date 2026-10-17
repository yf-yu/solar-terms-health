/* ════════════════════════════════════════
   節氣養生 — 體質自測
   依據王琦《中醫體質學》（2009）
════════════════════════════════════════ */

const OPTS = ['從不', '很少', '有時', '經常', '總是'];
let constAnswers = {};

function initConstPage() {
  const saved = loadConstResult();
  const savedDiv = document.getElementById('const-saved-result');
  const savedText = document.getElementById('const-saved-text');
  if (saved && savedDiv && savedText) {
    const con = window.CONSTITUTIONS[saved.main];
    savedDiv.style.display = 'block';
    savedText.textContent = (con ? con.name : saved.main) + '（' + saved.date + '）';
  }
}

function loadAndShowConst() {
  const saved = loadConstResult();
  if (!saved) return;
  document.getElementById('const-intro').style.display = 'none';
  constAnswers = {};
  showConstResult(saved.main, saved.secondary || []);
}

function startConst() {
  document.getElementById('const-intro').style.display = 'none';
  document.getElementById('const-result').style.display = 'none';
  const qa = document.getElementById('const-questions');
  qa.style.display = 'block';
  qa.innerHTML = window.CONST_QS.map((q, i) => `
    <div class="const-q-card" id="cq-${q.id}">
      <div class="const-q-progress">第 ${i + 1} 題 / 共 ${window.CONST_QS.length} 題</div>
      <div class="const-q-text">${q.q}</div>
      <div class="const-q-options">
        ${OPTS.map((opt, j) => `
          <button class="const-opt" onclick="answerConst(${q.id},${j},this)">${opt}</button>
        `).join('')}
      </div>
    </div>`).join('') +
    `<div id="const-submit-wrap" style="display:none;padding-bottom:20px">
      <button class="const-submit-btn" onclick="calcConst()">查看我的體質結果 →</button>
    </div>`;
}

function answerConst(qid, score, btn) {
  const card = document.getElementById('cq-' + qid);
  card.querySelectorAll('.const-opt').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  constAnswers[qid] = score;

  if (Object.keys(constAnswers).length === window.CONST_QS.length) {
    const wrap = document.getElementById('const-submit-wrap');
    wrap.style.display = 'block';
    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function calcConst() {
  const scores = {};
  Object.keys(window.CONSTITUTIONS).forEach(k => { scores[k] = 0; });

  window.CONST_QS.forEach(q => {
    const ans = constAnswers[q.id] || 0;
    Object.entries(q.scores).forEach(([type, weight]) => {
      if (!scores[type]) scores[type] = 0;
      scores[type] += ans * weight;
    });
  });

  // 平和體質：若其他體質分數越高，平和分數越低
  const nonPhMax = Math.max(...Object.entries(scores).filter(([k]) => k !== 'ph').map(([,v]) => v));
  scores['ph'] = Math.max(0, 20 - Math.round(nonPhMax / 4));

  const sorted = Object.entries(scores)
    .filter(([k]) => k !== 'ph' || scores['ph'] > 12)
    .sort((a, b) => b[1] - a[1]);

  const main = sorted[0] || ['ph', scores['ph']];
  const secondary = sorted.slice(1, 3).filter(([,v]) => v > main[1] * 0.5);

  showConstResult(main[0], secondary.map(([k]) => k));
}

function showConstResult(mainKey, secondaryKeys) {
  document.getElementById('const-questions').style.display = 'none';
  const main = window.CONSTITUTIONS[mainKey] || window.CONSTITUTIONS['ph'];
  const res = document.getElementById('const-result');
  res.style.display = 'block';

  const secondaryHTML = secondaryKeys.map(k => {
    const c = window.CONSTITUTIONS[k];
    if (!c) return '';
    return `
    <div class="const-secondary" style="background:${c.bg};border-color:${c.color}33">
      <div class="const-secondary-title" style="color:${c.color}">${c.icon} 兼夾：${c.name}</div>
      <div class="const-secondary-desc">${c.desc}</div>
    </div>`;
  }).join('');

  res.innerHTML = `
  <div class="const-result-hero" style="background:${main.bg};border-color:${main.color}55">
    <div class="const-result-label" style="color:${main.color}">你的主要體質</div>
    <div class="const-result-icon">${main.icon}</div>
    <div class="const-result-name" style="color:${main.color}">${main.name}</div>
    <div class="const-result-desc">${main.desc}</div>
  </div>
  ${secondaryHTML ? `<div style="margin-bottom:14px">${secondaryHTML}</div>` : ''}
  <div class="const-card">
    <div class="const-card-head" style="background:${main.color}">主要特徵</div>
    <div class="const-card-body">
      ${main.traits.map(t => `
        <div class="const-trait-row">
          <span class="const-trait-mark" style="color:${main.color}">▸</span>${t}
        </div>`).join('')}
    </div>
  </div>
  <div class="const-card">
    <div class="const-card-head" style="background:var(--forest)">節氣養生建議</div>
    <div class="const-card-body">${main.solar_advice}</div>
  </div>
  <div class="const-card">
    <div class="const-card-head" style="background:#5D6D7E">飲食建議</div>
    <div class="const-card-body">${main.diet}</div>
  </div>
  <div class="const-card">
    <div class="const-card-head" style="background:#C0392B">需要避免</div>
    <div class="const-card-body">${main.avoid}</div>
  </div>
  <div class="const-classic">${main.classic}</div>
  <div class="const-disclaimer">
    ⚠️ 本測試結果為中醫養生參考，不構成醫療診斷。若有健康問題，請諮詢合格中醫師。<br>
    依據：王琦《中醫體質學》（北京中醫藥大學，2009）
  </div>
  <button class="const-reset-btn" onclick="resetConst()">↩ 重新測試</button>`;

  saveConstResult(mainKey, secondaryKeys);
  res.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function saveConstResult(mainKey, secondaryKeys) {
  const result = {
    date: new Date().toLocaleDateString('zh-TW'),
    main: mainKey,
    secondary: secondaryKeys,
    timestamp: Date.now()
  };
  localStorage.setItem('st_constitution', JSON.stringify(result));
}

function loadConstResult() {
  try {
    const saved = localStorage.getItem('st_constitution');
    return saved ? JSON.parse(saved) : null;
  } catch (e) { return null; }
}

function resetConst() {
  constAnswers = {};
  document.getElementById('const-questions').style.display = 'none';
  document.getElementById('const-result').style.display = 'none';
  document.getElementById('const-intro').style.display = 'block';
  document.getElementById('const-quiz-area').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
