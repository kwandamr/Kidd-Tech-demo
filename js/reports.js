/**
 * ═══════════════════════════════════════════════════════════════
 * reports.js — Reports & Energy Page
 * ═══════════════════════════════════════════════════════════════
 * ครอบคลุม:
 *   - Hero KPI strip (kWh วันนี้ / เดือน / ค่าไฟ / พัดลม / อุณหภูมิ)
 *   - Zone Meter Cards (4 การ์ด MTR-01…04 พร้อม progress bar)
 *   - Energy bar chart (Chart.js — แยก dataset ตาม Zone)
 *   - Fan Map แบบจัดกลุ่มตาม Zone + temperature bar
 *   - Alarm Log timeline
 *   - Zone filter + Daily/Monthly/Yearly toggle
 *
 * Dependencies: config.js, i18n.js, utils.js, db.js
 * ═══════════════════════════════════════════════════════════════
 */

// ── State ──────────────────────────────────────────────────────
let _reportZone   = 'all';   // 'all'|'A'|'B'|'C'|'D'
let _periodMode   = 'day';   // 'day'|'month'|'year'
let _energyChart  = null;    // Chart.js instance

// Zone colour palette
const _zCols = { A:'#38BDF8', B:'#10B981', C:'#F59E0B', D:'#00BFA5' };
const _zDesc = {
  A: 'ถังยาว S01–S06',
  B: 'ถังยาว S07–S12',
  C: 'ถังกลม R01–R04',
  D: 'ถังกลม R05–R08',
};

// ─────────────────────────────────────────────────────────────
// MAIN RENDER
// ─────────────────────────────────────────────────────────────

async function renderReport() {
  const meters = CONFIG.DEMO_MODE ? MOCK_DATA.energyMeters : await _fetchMeters();
  const alarms = await DB.getActiveAlarms();
  const silos  = await DB.getSilos();

  const filteredSilos  = _reportZone === 'all' ? silos  : silos.filter(s => s.zone === _reportZone);
  const zoneMtrs       = _reportZone === 'all' ? meters : meters.filter(m => m.zone === _reportZone);

  _renderReportHero(zoneMtrs, filteredSilos);
  _renderZoneCards(zoneMtrs);
  _renderEnergyChart(zoneMtrs);
  _renderFanMap(zoneMtrs, silos);
  _renderAlarmLog(alarms);
}

/** Zone selector */
function selectZone(zone, btn) {
  _reportZone = zone;
  document.querySelectorAll('.zone-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderReport();
}

/** Period mode toggle (Daily / Monthly / Yearly) */
function setPeriodMode(mode) {
  _periodMode = mode;
  ['day','month','year'].forEach(m => {
    const btn = document.getElementById('btn-' + m);
    if (btn) btn.classList.toggle('active', m === mode);
  });
  renderReport();
}

// ─────────────────────────────────────────────────────────────
// HERO KPI STRIP
// ─────────────────────────────────────────────────────────────

function _renderReportHero(meters, silos) {
  const heroEl = document.getElementById('rpt-hero');
  if (!heroEl) return;

  const kwhToday  = meters.reduce((a,m) => a + m.kwhToday, 0);
  const kwhMonth  = meters.reduce((a,m) => a + m.kwhMonth, 0);
  const kwhYear   = Math.round(kwhMonth * 12);
  const costToday = Math.round(kwhToday * 4.2);
  const costMonth = Math.round(kwhMonth * 4.2);
  const fansOn    = meters.reduce((a,m) => a + m.activeFans, 0);
  const totalFans = silos.length;
  const avgTemp   = silos.length
    ? +(silos.reduce((a,s) => a + s.temp, 0) / silos.length).toFixed(1) : 0;

  // trend: today vs. กรอบ 30-day daily avg
  const dailyAvg  = +(kwhMonth / 30).toFixed(1);
  const trendPct  = dailyAvg > 0 ? Math.round((kwhToday - dailyAvg) / dailyAvg * 100) : 0;
  const trendUp   = trendPct > 0;
  const trendCol  = trendUp ? 'var(--red)' : 'var(--green)';
  const trendTxt  = trendUp ? `↑ ${trendPct}% vs avg` : `↓ ${Math.abs(trendPct)}% vs avg`;

  const tempStatus = avgTemp >= 32 ? '⚠ วิกฤต' : avgTemp >= 29 ? '↑ สูง' : '✓ ปกติ';
  const tempCol    = avgTemp >= 32 ? 'var(--red)' : avgTemp >= 29 ? 'var(--yellow)' : 'var(--green)';
  const fanRatio   = totalFans > 0 ? Math.round(fansOn / totalFans * 100) : 0;

  heroEl.innerHTML = `
    <div class="rpt-kpi-card">
      <div class="rpt-kpi-label">⚡ ใช้ไฟวันนี้</div>
      <div class="rpt-kpi-val" style="color:#22d3ee">${numFmt(kwhToday,1)}<small> kWh</small></div>
      <div class="rpt-kpi-sub" style="color:${trendCol}">${trendTxt}</div>
      <div class="rpt-kpi-sub2">avg/day ${numFmt(dailyAvg,1)} kWh</div>
    </div>
    <div class="rpt-kpi-card">
      <div class="rpt-kpi-label">📅 เดือนนี้</div>
      <div class="rpt-kpi-val" style="color:#22d3ee">${numFmt(kwhMonth,0)}<small> kWh</small></div>
      <div class="rpt-kpi-sub">ปีนี้ ~${numFmt(kwhYear,0)} kWh</div>
    </div>
    <div class="rpt-kpi-card">
      <div class="rpt-kpi-label">💰 ค่าไฟวันนี้</div>
      <div class="rpt-kpi-val" style="color:#f59e0b">฿${numFmt(costToday,0)}</div>
      <div class="rpt-kpi-sub">เดือนนี้ ~฿${numFmt(costMonth,0)}</div>
    </div>
    <div class="rpt-kpi-card">
      <div class="rpt-kpi-label">🌀 พัดลมทำงาน</div>
      <div class="rpt-kpi-val" style="color:#38bdf8">${fansOn}<small> / ${totalFans}</small></div>
      <div class="rpt-kpi-sub">${fanRatio}% ของถังทั้งหมด</div>
    </div>
    <div class="rpt-kpi-card">
      <div class="rpt-kpi-label">🌡 อุณหภูมิเฉลี่ย</div>
      <div class="rpt-kpi-val" style="color:${tempCol}">${avgTemp}<small> °C</small></div>
      <div class="rpt-kpi-sub" style="color:${tempCol}">${tempStatus}</div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// ZONE METER CARDS
// ─────────────────────────────────────────────────────────────

function _renderZoneCards(meters) {
  const el = document.getElementById('rpt-zone-cards');
  if (!el) return;

  if (!meters.length) { el.innerHTML = ''; return; }

  el.innerHTML = `<div class="zone-meter-cards">${meters.map(m => {
    const col      = _zCols[m.zone] || '#00BFA5';
    const dailyAvg = m.kwhMonth / 30;
    const pct      = dailyAvg > 0 ? Math.min(110, Math.round(m.kwhToday / dailyAvg * 100)) : 0;
    const barCol   = pct > 100 ? '#EF4444' : pct > 85 ? '#F59E0B' : '#00BFA5';
    const costDay  = Math.round(m.kwhToday * 4.2);

    return `
      <div class="zone-meter-card" style="border-top:3px solid ${col}">
        <div class="zmc-top">
          <span class="zmc-name" style="color:${col}">${m.id}</span>
          <span class="zmc-zone" style="background:${col}18;color:${col}">Zone ${m.zone}</span>
        </div>
        <div class="zmc-desc">${_zDesc[m.zone] || ''}</div>
        <div class="zmc-val">${m.kwhToday.toFixed(1)}<small> kWh</small></div>
        <div class="zmc-unit">วันนี้</div>
        <div class="zmc-bar-row">
          <div class="zmc-bar-bg" title="${pct}% ของค่าเฉลี่ย/วัน">
            <div class="zmc-bar" style="width:${Math.min(100,pct)}%;background:${barCol}"></div>
          </div>
          <span class="zmc-pct" style="color:${barCol}">${pct}%</span>
        </div>
        <div class="zmc-foot">
          <div class="zmc-foot-row">
            <span class="zmc-fl">📅 เดือนนี้</span>
            <span class="zmc-fv" style="color:#22d3ee">${numFmt(m.kwhMonth,0)} kWh</span>
          </div>
          <div class="zmc-foot-row">
            <span class="zmc-fl">💰 ค่าไฟวันนี้</span>
            <span class="zmc-fv" style="color:#f59e0b">฿${numFmt(costDay,0)}</span>
          </div>
          <div class="zmc-foot-row">
            <span class="zmc-fl">🌀 พัดลม</span>
            <span class="zmc-fv" style="color:#38bdf8">${m.activeFans} ตัว</span>
          </div>
        </div>
      </div>
    `;
  }).join('')}</div>`;
}

// ─────────────────────────────────────────────────────────────
// ENERGY CHART — Multi-zone stacked bars
// ─────────────────────────────────────────────────────────────

function _renderEnergyChart(meters) {
  const ctx = document.getElementById('energy-chart');
  if (!ctx) return;
  if (_energyChart) { _energyChart.destroy(); _energyChart = null; }

  let labels, datasets;

  if (_periodMode === 'day') {
    labels = Array.from({length:24}, (_,i) => String(i).padStart(2,'0') + ':00');
    datasets = meters.map(m => {
      const col  = _zCols[m.zone] || '#00BFA5';
      const base = m.kwhToday / 24;
      return {
        label: `Zone ${m.zone} (${m.id})`,
        data: labels.map(() => +(base * (0.65 + Math.random() * 0.7)).toFixed(1)),
        backgroundColor: col + '50',
        borderColor: col,
        borderWidth: 1.5,
        borderRadius: 3,
      };
    });
  } else if (_periodMode === 'month') {
    const days = new Date().getDate();
    labels = Array.from({length: days}, (_,i) => String(i+1));
    datasets = meters.map(m => {
      const col  = _zCols[m.zone] || '#00BFA5';
      const base = m.kwhMonth / 30;
      return {
        label: `Zone ${m.zone} (${m.id})`,
        data: labels.map(() => +(base * (0.65 + Math.random() * 0.7)).toFixed(0)),
        backgroundColor: col + '50',
        borderColor: col,
        borderWidth: 1.5,
        borderRadius: 3,
      };
    });
  } else {
    labels = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    datasets = meters.map(m => {
      const col  = _zCols[m.zone] || '#00BFA5';
      const base = m.kwhMonth;
      return {
        label: `Zone ${m.zone} (${m.id})`,
        data: labels.map(() => +(base * (0.75 + Math.random() * 0.5)).toFixed(0)),
        backgroundColor: col + '50',
        borderColor: col,
        borderWidth: 1.5,
        borderRadius: 3,
      };
    });
  }

  _energyChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#6B9AB5', boxWidth: 10, padding: 14, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: c => ` ${c.dataset.label}: ${c.formattedValue} kWh`,
            footer: items => {
              const total = items.reduce((a,i) => a + (Number(i.raw)||0), 0);
              return `รวม: ${total.toFixed(1)} kWh`;
            },
          },
          footerColor: '#22d3ee',
        },
      },
      scales: {
        x: {
          ticks: { color: '#3A5C73', maxTicksLimit: 12, font: { size: 10 } },
          grid: { display: false },
        },
        y: {
          ticks: { color: '#3A5C73', font: { size: 10 } },
          grid: { color: 'rgba(0,191,165,.06)' },
          title: { display: true, text: 'kWh', color: '#3A5C73', font: { size: 11 } },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────
// FAN MAP — Zone-grouped with temp bar + fan pill
// ─────────────────────────────────────────────────────────────

function _renderFanMap(meters, silos) {
  const el = document.getElementById('fan-map-table');
  if (!el) return;

  const zones = _reportZone === 'all' ? ['A','B','C','D'] : [_reportZone];
  let html = '';

  for (const zone of zones) {
    const mtr       = meters.find(m => m.zone === zone);
    const zoneSilos = silos.filter(s => s.zone === zone);
    if (!zoneSilos.length) continue;

    const col      = _zCols[zone] || '#00BFA5';
    const redCnt   = zoneSilos.filter(s => s.status === 'red').length;
    const yelCnt   = zoneSilos.filter(s => s.status === 'yellow').length;
    const fansOn   = zoneSilos.filter(s => s.fanOn).length;

    html += `
      <div class="fm-zone-hdr" style="border-left-color:${col}">
        <span class="fm-zone-lbl" style="color:${col}">Zone ${zone}</span>
        <span class="fm-mtr-info">
          ${mtr ? `${mtr.id} &nbsp;·&nbsp; ${mtr.kwhToday.toFixed(1)} kWh &nbsp;·&nbsp; 🌀 ${mtr.activeFans} fans` : ''}
        </span>
        <span class="fm-zone-badges">
          ${redCnt ? `<span class="fm-badge red">⚠ ${redCnt} วิกฤต</span>` : ''}
          ${yelCnt ? `<span class="fm-badge yellow">⬆ ${yelCnt} เตือน</span>` : ''}
          <span class="fm-badge blue">🌀 ${fansOn}/${zoneSilos.length}</span>
        </span>
      </div>
      <div class="fm-silo-rows">
        ${zoneSilos.map(s => {
          const tc  = typeof _tempCol === 'function' ? _tempCol(s.temp) : tempColor(s.temp);
          const pct = Math.min(100, Math.round(Math.max(0, s.temp - 20) / 18 * 100));
          const pill = s.fanOn
            ? `<span class="fan-pill on">🌀 ON</span>`
            : `<span class="fan-pill off">— OFF</span>`;
          const statusDot = s.status === 'red'    ? `<span class="sl-dot-sb red"></span>`
                          : s.status === 'yellow' ? `<span class="sl-dot-sb yellow"></span>`
                          :                         `<span class="sl-dot-sb green"></span>`;
          return `
            <div class="fm-silo-row ${s.status}">
              ${statusDot}
              <span class="fm-sid">${s.id}</span>
              <span class="fm-temp" style="color:${tc}">${s.temp}°C</span>
              <div class="fm-tbar-bg">
                <div class="fm-tbar" style="width:${pct}%;background:${tc}"></div>
              </div>
              ${pill}
              <span class="fm-sensors">${s.num_cables}C × ${s.sensors_per_cable}pt</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  el.innerHTML = html || `<div style="color:var(--text3);padding:16px;text-align:center">ไม่พบข้อมูล Zone ที่เลือก</div>`;
}

// ─────────────────────────────────────────────────────────────
// ALARM LOG
// ─────────────────────────────────────────────────────────────

function _renderAlarmLog(alarms) {
  const logEl = document.getElementById('alarm-log');
  if (!logEl) return;

  if (!alarms.length) {
    logEl.innerHTML = `<div class="alarm-ok">✅ ไม่มี Alarm ที่ยังเปิดอยู่</div>`;
    return;
  }

  logEl.innerHTML = alarms.map(a => {
    const isAck   = !!a.acknowledged_at;
    const isCrit  = a.type === 'temp_critical';
    const dotCol  = isAck ? 'var(--text3)' : isCrit ? 'var(--red)' : 'var(--yellow)';
    const icon    = isCrit ? '🔴' : a.type === 'fum_overdue' ? '🧪' : '⚠';
    const timeStr = new Date(a.triggered_at).toLocaleString('th-TH', {
      hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit',
    });
    return `
      <div class="alarm-row ${isAck ? 'alarm-acked' : ''}">
        <span class="alarm-icon">${icon}</span>
        <div class="alarm-body">
          <div class="alarm-msg">${a.silo_id} — ${a.message}</div>
          <div class="alarm-time">${timeStr}${isAck ? ' · ✓ รับทราบแล้ว' : ''}</div>
        </div>
        ${!isAck
          ? `<button class="fc-btn alarm-ack-btn" onclick="ackAlarm(${a.id})">รับทราบ</button>`
          : ''
        }
      </div>
    `;
  }).join('');
}

/** Acknowledge alarm */
async function ackAlarm(alarmId) {
  await DB.acknowledgeAlarm(alarmId);
  showToast('✅ รับทราบ Alarm แล้ว');
  renderReport();
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

async function _fetchMeters() {
  return MOCK_DATA.energyMeters;
}

function exportReport() {
  showToast(T('r.exporting'), 'warn');
}
