/**
 * ═══════════════════════════════════════════════════════════════
 * analytics.js — Historical Analytics Dashboard (Power BI Style)
 * ═══════════════════════════════════════════════════════════════
 * ครอบคลุม:
 *   - Date range selector (7 / 30 / 90 วัน)
 *   - Silo chips selector (toggle สูงสุด 8 ถัง)
 *   - KPI Summary row (4 cards)
 *   - Temperature History chart (multi-silo lines)
 *   - Risk Score History chart (area per silo)
 *   - Energy Daily chart (stacked bar by zone)
 *   - Silo Ranking table (worst → best risk)
 *   - Event Timeline log
 *
 * Dependencies: config.js, data.js, db.js, reports.js (_zCols)
 * ═══════════════════════════════════════════════════════════════
 */

// ── State ─────────────────────────────────────────────────────────
let _anDateFrom    = null;   // Date object — start of range
let _anDateTo      = null;   // Date object — end of range (inclusive)
let _anSilos       = [];     // selected silo IDs
let _anSilosAll    = [];     // all silo objects (cached)
let _anInited      = false;  // first-time init flag
let _anChartTemp   = null;
let _anChartRisk   = null;
let _anChartEnergy = null;

/** Returns number of days in current range (min 1) */
function _anGetDays() {
  if (!_anDateFrom || !_anDateTo) return 30;
  const ms = _anDateTo - _anDateFrom;
  return Math.max(1, Math.round(ms / 86400000));
}

/** ISO date string "YYYY-MM-DD" for an offset from today */
function _anISOOffset(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/** Sync the two <input type="date"> values to current state */
function _anSyncDateInputs() {
  const f = document.getElementById('an-date-from');
  const t = document.getElementById('an-date-to');
  if (f && _anDateFrom) f.value = _anDateFrom.toISOString().slice(0, 10);
  if (t && _anDateTo)   t.value = _anDateTo.toISOString().slice(0, 10);
}

// Colour palette for silo lines (cycles up to 10)
const _AN_COLORS = [
  '#00BFA5', '#38BDF8', '#F59E0B', '#EF4444', '#A78BFA',
  '#FB923C', '#34D399', '#F472B6', '#60A5FA', '#FBBF24',
];

// Zone colours (fallback if _zCols not yet defined)
function _anZCol(zone) {
  const map = { A: '#38BDF8', B: '#10B981', C: '#F59E0B', D: '#00BFA5' };
  return (typeof _zCols !== 'undefined' ? _zCols : map)[zone] || '#00BFA5';
}

// ── DATA GENERATORS ───────────────────────────────────────────────

/** Seeded LCG RNG — [value 0-1, next_seed] */
function _anRng(seed) {
  const next = (seed * 9301 + 49297) % 233280;
  return [next / 233280, next];
}

/**
 * Generate N-day daily data for one silo
 * Returns [{date, avg_temp, max_temp, min_temp, risk, co2, moisture}]
 */
function _genDailyData(siloId, days) {
  let seed = (siloId || 'S01').split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 7;
  const pts = [];
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    let r;
    [r, seed] = _anRng(seed); const base     = 26 + r * 10;
    [r, seed] = _anRng(seed); const spread   = 1.0 + r * 2.2;
    [r, seed] = _anRng(seed); const co2      = 360 + r * 220;
    [r, seed] = _anRng(seed); const moisture = 10.5 + r * 3.5;

    // slight upward trend for high-risk silos
    const trendBump = (siloId === 'S01' || siloId === 'R01') ? (days - i) * 0.015 : 0;
    const avg = +(base + trendBump).toFixed(1);

    const d = new Date(now);
    d.setDate(d.getDate() - i);

    pts.push({
      date:     d.toISOString().slice(0, 10),
      avg_temp: avg,
      max_temp: +(avg + spread).toFixed(1),
      min_temp: +(avg - spread * 0.55).toFixed(1),
      co2:      +co2.toFixed(0),
      moisture: +moisture.toFixed(1),
      risk:     _calcAnRisk(avg, co2, moisture),
    });
  }
  return pts;
}

function _calcAnRisk(temp, co2, moisture) {
  let r = 0;
  if (temp >= 35)     r += 2.0; else if (temp >= 30) r += 1.3; else if (temp >= 28) r += 0.5;
  if (co2  >= 500)    r += 2.0; else if (co2  >= 400) r += 1.2; else if (co2  >= 380) r += 0.4;
  if (moisture >= 15) r += 2.0; else if (moisture >= 13) r += 1.0; else if (moisture >= 12) r += 0.3;
  return Math.min(6, Math.round(r * 10) / 10);
}

function _genEnergyHistory(days) {
  const zones  = ['A', 'B', 'C', 'D'];
  const basekW = { A: 180, B: 152, C: 88, D: 112 };
  const result = {};
  zones.forEach(z => { result[z] = []; });
  let seed = 54321;
  const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr   = d.toISOString().slice(0, 10);
    const isWeekend = [0, 6].includes(d.getDay());
    zones.forEach(z => {
      const v = basekW[z] * (isWeekend ? 0.55 : 1.0) * (0.82 + rng() * 0.36);
      result[z].push({ date: dateStr, kwh: +v.toFixed(1) });
    });
  }
  return result;
}

function _genEventLog(silos, days) {
  const events = [];
  const now    = Date.now();
  const types  = [
    { type: 'alarm',      icon: '🔴', label: 'Temp Alert' },
    { type: 'alarm',      icon: '🟡', label: 'CO₂ Warning' },
    { type: 'alarm',      icon: '🟠', label: 'Moisture Alert' },
    { type: 'fumigation', icon: '🧪', label: 'Fumigation Start' },
    { type: 'fumigation', icon: '✅', label: 'Fumigation Complete' },
    { type: 'job',        icon: '🚛', label: 'Transfer Job' },
    { type: 'fan',        icon: '💨', label: 'Fan Auto-On' },
    { type: 'fan',        icon: '⏹',  label: 'Fan Auto-Off' },
  ];
  let seed = 99887;
  const rng   = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const count = Math.min(60, Math.max(20, days * 2));

  for (let i = 0; i < count; i++) {
    const ts   = new Date(now - rng() * days * 86400000);
    const silo = silos[Math.floor(rng() * silos.length)];
    const ev   = types[Math.floor(rng() * types.length)];
    events.push({ ts, silo: silo?.id || 'S01', ...ev });
  }
  return events.sort((a, b) => b.ts - a.ts);
}

// ── MAIN RENDER ───────────────────────────────────────────────────

async function renderAnalytics() {
  const silos = await DB.getSilos();
  _anSilosAll = silos;

  if (!_anInited) {
    _anSilos  = ['S01', 'S07', 'R01', 'R05']; // one per zone
    // Default range: last 30 days
    _anDateTo   = new Date(); _anDateTo.setHours(23,59,59,0);
    _anDateFrom = new Date(); _anDateFrom.setDate(_anDateFrom.getDate() - 30); _anDateFrom.setHours(0,0,0,0);
    _anInited   = true;
  }

  const days = _anGetDays();
  _anSyncDateInputs();
  _renderAnFilter(silos);
  _renderAnKPI(silos, days);
  _renderAnTempChart(days);
  _renderAnRiskChart(days);
  _renderAnEnergyChart(days);
  _renderAnRanking(silos, days);
  _renderAnEventLog(silos, days);
}

// ── FILTER BAR ────────────────────────────────────────────────────

function _renderAnFilter(silos) {
  const wrap = document.getElementById('an-silo-chips');
  if (!wrap) return;

  wrap.innerHTML = silos.map(s => {
    const sel = _anSilos.includes(s.id);
    const col = _anZCol(s.zone);
    return `<button class="an-chip${sel ? ' active' : ''}"
      style="--chip-col:${col}"
      onclick="_anToggleSilo('${s.id}',this)">${s.id}</button>`;
  }).join('');

  // Highlight quick-range button if days matches exactly
  const days = _anGetDays();
  document.querySelectorAll('.an-range-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.r) === days);
  });
}

/** Quick shortcut buttons: 7 / 30 / 90 days */
function _anSetRange(days) {
  _anDateTo   = new Date(); _anDateTo.setHours(23,59,59,0);
  _anDateFrom = new Date(); _anDateFrom.setDate(_anDateFrom.getDate() - days); _anDateFrom.setHours(0,0,0,0);
  renderAnalytics();
}

/** Called when either date input changes */
function _anDateChange() {
  const fEl = document.getElementById('an-date-from');
  const tEl = document.getElementById('an-date-to');
  if (!fEl || !tEl || !fEl.value || !tEl.value) return;

  const from = new Date(fEl.value + 'T00:00:00');
  const to   = new Date(tEl.value + 'T23:59:59');
  if (from > to) { showToast('⚠ วันเริ่มต้นต้องมาก่อนวันสิ้นสุด'); return; }
  if (_anGetDaysFromRange(from, to) > 365) { showToast('⚠ เลือกได้สูงสุด 365 วัน'); return; }

  _anDateFrom = from;
  _anDateTo   = to;

  // clear quick-button highlight (custom range → none matches)
  document.querySelectorAll('.an-range-btn').forEach(b => b.classList.remove('active'));
  const days = _anGetDays();
  document.querySelectorAll('.an-range-btn').forEach(b => {
    if (parseInt(b.dataset.r) === days) b.classList.add('active');
  });

  const d = _anGetDays();
  _renderAnKPI(_anSilosAll, d);
  _renderAnTempChart(d);
  _renderAnRiskChart(d);
  _renderAnEnergyChart(d);
  _renderAnRanking(_anSilosAll, d);
  _renderAnEventLog(_anSilosAll, d);
}

function _anGetDaysFromRange(from, to) {
  return Math.max(1, Math.round((to - from) / 86400000));
}

function _anToggleSilo(id, btn) {
  const idx = _anSilos.indexOf(id);
  if (idx >= 0) {
    if (_anSilos.length <= 1) return; // ต้องมีอย่างน้อย 1
    _anSilos.splice(idx, 1);
    btn.classList.remove('active');
  } else {
    if (_anSilos.length >= 8) { showToast('⚠ เลือกได้สูงสุด 8 ถัง'); return; }
    _anSilos.push(id);
    btn.classList.add('active');
  }
  const days = _anGetDays();
  _renderAnTempChart(days);
  _renderAnRiskChart(days);
}

function _anSelectAll() {
  _anSilos = _anSilosAll.slice(0, 8).map(s => s.id);
  renderAnalytics();
}

function _anClearAll() {
  _anSilos = [_anSilos[0] || 'S01'];
  renderAnalytics();
}

// ── KPI SUMMARY ───────────────────────────────────────────────────

function _renderAnKPI(silos, days) {
  const el = document.getElementById('an-kpi-row');
  if (!el) return;

  const readings = silos.map(s => _genDailyData(s.id, days).at(-1));
  const avgTemp  = (readings.reduce((a, r) => a + r.avg_temp, 0) / readings.length).toFixed(1);
  const maxRisk  = Math.max(...readings.map(r => r.risk));

  const energy   = _genEnergyHistory(days);
  const totalKwh = Object.values(energy)
    .reduce((a, arr) => a + arr.reduce((s, p) => s + p.kwh, 0), 0);
  const cost = Math.round(totalKwh * 3.2);

  const evCount  = Math.min(99, Math.round(days * 1.8));
  const riskCol  = maxRisk >= 4.5 ? '#EF4444' : maxRisk >= 3 ? '#F59E0B' : maxRisk >= 1.5 ? '#F97316' : '#10B981';
  const tempCol  = avgTemp >= 32 ? '#EF4444' : avgTemp >= 29 ? '#F59E0B' : '#00BFA5';

  const cards = [
    {
      icon: '🌡', label: 'อุณหภูมิเฉลี่ย',
      value: `${avgTemp}°C`, color: tempCol,
      sub: `${silos.length} ถัง · ${days} วันล่าสุด`,
    },
    {
      icon: '🎯', label: 'Risk Score สูงสุด',
      value: `${maxRisk} / 6`, color: riskCol,
      sub: _anRiskLabel(maxRisk),
    },
    {
      icon: '⚡', label: `พลังงานรวม ${days} วัน`,
      value: `${Math.round(totalKwh).toLocaleString()} kWh`, color: '#F59E0B',
      sub: `≈ ฿${cost.toLocaleString()}`,
    },
    {
      icon: '📋', label: 'Events ใน Period',
      value: `${evCount}`, color: 'var(--text)',
      sub: 'alarms · jobs · fumigation',
    },
  ];

  el.innerHTML = cards.map(c => `
    <div class="an-kpi-card">
      <div class="an-kpi-top">
        <span class="an-kpi-icon">${c.icon}</span>
        <div class="an-kpi-val" style="color:${c.color}">${c.value}</div>
      </div>
      <div class="an-kpi-lbl">${c.label}</div>
      <div class="an-kpi-sub">${c.sub}</div>
    </div>
  `).join('');
}

function _anRiskLabel(r) {
  if (r >= 5.5) return '🔴 INFESTATION';
  if (r >= 4.5) return '🔴 CRITICAL';
  if (r >= 3.0) return '🟠 WARNING';
  if (r >= 1.5) return '🟡 CAUTION';
  if (r >= 0.5) return '🟢 MONITOR';
  return '🟢 SAFE';
}

// ── TEMP HISTORY CHART ────────────────────────────────────────────

function _renderAnTempChart(days) {
  const ctx = document.getElementById('an-temp-chart');
  if (!ctx) return;
  if (_anChartTemp) { _anChartTemp.destroy(); _anChartTemp = null; }

  const labels = []; const datasets = []; let labelsSet = false;

  _anSilos.forEach((sid, i) => {
    const data = _genDailyData(sid, days);
    if (!labelsSet) {
      data.forEach(p => labels.push(p.date.slice(5).replace('-', '/')));
      labelsSet = true;
    }
    const col = _AN_COLORS[i % _AN_COLORS.length];
    datasets.push({
      label: sid,
      data: data.map(p => p.avg_temp),
      borderColor: col,
      backgroundColor: col + '14',
      borderWidth: 2,
      pointRadius: days > 45 ? 0 : 2,
      pointHoverRadius: 4,
      tension: 0.35,
      fill: false,
    });
  });

  _anChartTemp = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: _anOpts({
      y: {
        min: 22, max: 42,
        ticks: { color: '#3A5C73', callback: v => v + '°C', font: { size: 10 } },
        grid: { color: 'rgba(0,191,165,.07)' },
      },
    }),
  });
}

// ── RISK HISTORY CHART ────────────────────────────────────────────

function _renderAnRiskChart(days) {
  const ctx = document.getElementById('an-risk-chart');
  if (!ctx) return;
  if (_anChartRisk) { _anChartRisk.destroy(); _anChartRisk = null; }

  const labels = []; const datasets = []; let labelsSet = false;

  _anSilos.forEach((sid, i) => {
    const data = _genDailyData(sid, days);
    if (!labelsSet) {
      data.forEach(p => labels.push(p.date.slice(5).replace('-', '/')));
      labelsSet = true;
    }
    const col = _AN_COLORS[i % _AN_COLORS.length];
    datasets.push({
      label: sid,
      data: data.map(p => p.risk),
      borderColor: col,
      backgroundColor: col + '18',
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.4,
      fill: true,
    });
  });

  _anChartRisk = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: _anOpts(
      {
        y: {
          min: 0, max: 6,
          ticks: {
            color: '#3A5C73', stepSize: 1, font: { size: 10 },
            callback: v => (['0','','WARN','','CRIT','',''][v] ?? v),
          },
          grid: { color: 'rgba(0,191,165,.07)' },
        },
      },
      {
        label: c => ` ${c.dataset.label}: ${c.parsed.y} · ${_anRiskLabel(c.parsed.y).split(' ')[1]}`,
      }
    ),
  });
}

// ── ENERGY CHART ──────────────────────────────────────────────────

function _renderAnEnergyChart(days) {
  const ctx = document.getElementById('an-energy-chart');
  if (!ctx) return;
  if (_anChartEnergy) { _anChartEnergy.destroy(); _anChartEnergy = null; }

  const energy   = _genEnergyHistory(days);
  const zones    = ['A', 'B', 'C', 'D'];
  const labels   = energy['A'].map(p => p.date.slice(5).replace('-', '/'));
  const datasets = zones.map(z => ({
    label: `Zone ${z}`,
    data: energy[z].map(p => p.kwh),
    backgroundColor: _anZCol(z) + 'CC',
    borderColor: _anZCol(z),
    borderWidth: 0,
    stack: 'energy',
  }));

  _anChartEnergy = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#6E8FA8', boxWidth: 10, font: { size: 11 } } },
        tooltip: {
          backgroundColor: '#0A1E30', titleColor: '#C8DDE8', bodyColor: '#6E8FA8',
          borderColor: 'rgba(0,191,165,.3)', borderWidth: 1,
          callbacks: {
            footer: items => `Total: ${items.reduce((a, i) => a + i.parsed.y, 0).toFixed(0)} kWh`,
          },
        },
      },
      scales: {
        x: { stacked: true, ticks: { color: '#3A5C73', maxTicksLimit: 15, font: { size: 10 } }, grid: { color: 'rgba(0,191,165,.05)' } },
        y: { stacked: true, ticks: { color: '#3A5C73', callback: v => v + ' kWh', font: { size: 10 } }, grid: { color: 'rgba(0,191,165,.07)' } },
      },
    },
  });
}

// ── SILO RANKING ─────────────────────────────────────────────────

function _renderAnRanking(silos, days) {
  const el = document.getElementById('an-ranking');
  if (!el) return;

  const ranked = silos.map(s => {
    const data    = _genDailyData(s.id, days);
    const last    = data.at(-1);
    const avgRisk = +(data.reduce((a, p) => a + p.risk, 0) / data.length).toFixed(1);
    const maxTemp = +Math.max(...data.map(p => p.max_temp)).toFixed(1);
    return { id: s.id, zone: s.zone, grain: s.grain || 'Paddy', lastRisk: last.risk, avgRisk, maxTemp };
  }).sort((a, b) => b.lastRisk - a.lastRisk || b.avgRisk - a.avgRisk);

  el.innerHTML = `
    <div class="an-rank-hdr">
      <span></span>
      <span>ถัง</span>
      <span>Zone</span>
      <span>สินค้า</span>
      <span>Risk ล่าสุด</span>
      <span>MaxTemp</span>
    </div>` +
    ranked.map((r, i) => {
      const rc    = r.lastRisk >= 4.5 ? '#EF4444' : r.lastRisk >= 3 ? '#F59E0B' : r.lastRisk >= 1.5 ? '#F97316' : '#10B981';
      const tc    = r.maxTemp >= 32 ? '#EF4444' : r.maxTemp >= 29 ? '#F59E0B' : 'var(--text2)';
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
      const cond  = _anRiskLabel(r.lastRisk).replace(/[🔴🟠🟡🟢] /, '');
      return `<div class="an-rank-row" onclick="showDetail('${r.id}')">
        <span class="an-rank-medal">${medal}</span>
        <span class="an-rank-silo" style="color:${_anZCol(r.zone)}">${r.id}</span>
        <span class="an-rank-zone">Zone ${r.zone}</span>
        <span class="an-rank-grain">${r.grain}</span>
        <div class="an-rank-risk-cell">
          <div class="an-rank-bar-bg">
            <div class="an-rank-bar" style="width:${(r.lastRisk / 6 * 100).toFixed(0)}%;background:${rc}"></div>
          </div>
          <span style="color:${rc};font-size:11px;font-weight:700;white-space:nowrap">${r.lastRisk} · ${cond}</span>
        </div>
        <span class="an-rank-temp" style="color:${tc}">${r.maxTemp}°C</span>
      </div>`;
    }).join('');
}

// ── EVENT LOG ────────────────────────────────────────────────────

function _renderAnEventLog(silos, days) {
  const el = document.getElementById('an-event-log');
  if (!el) return;
  const sZone = {};
  silos.forEach(s => { sZone[s.id] = s.zone; });

  el.innerHTML = '';
  _genEventLog(silos, days).slice(0, 50).forEach(ev => {
    const dtStr   = ev.ts.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })
                  + ' · ' + ev.ts.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const typeCol = ev.type === 'alarm' ? '#EF4444'
                  : ev.type === 'fumigation' ? '#F59E0B'
                  : ev.type === 'fan' ? '#38BDF8'
                  : 'var(--teal)';
    el.innerHTML += `<div class="an-ev-row">
      <span class="an-ev-icon">${ev.icon}</span>
      <span class="an-ev-time">${dtStr}</span>
      <span class="an-ev-silo" style="color:${_anZCol(sZone[ev.silo])}">${ev.silo}</span>
      <span class="an-ev-label" style="color:${typeCol}">${ev.label}</span>
    </div>`;
  });
}

// ── SHARED CHART OPTIONS ──────────────────────────────────────────

function _anOpts(yScale = {}, tooltipCallbacks = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: '#6E8FA8', boxWidth: 10, font: { size: 11 } } },
      tooltip: {
        backgroundColor: '#0A1E30', titleColor: '#C8DDE8', bodyColor: '#6E8FA8',
        borderColor: 'rgba(0,191,165,.3)', borderWidth: 1,
        callbacks: tooltipCallbacks,
      },
    },
    scales: {
      x: { ticks: { color: '#3A5C73', maxTicksLimit: 12, font: { size: 10 } }, grid: { color: 'rgba(0,191,165,.05)' } },
      y: yScale,
    },
  };
}
