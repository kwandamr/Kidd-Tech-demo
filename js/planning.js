/**
 * ═══════════════════════════════════════════════════════════════
 * planning.js — Planning Board Orchestration
 * ═══════════════════════════════════════════════════════════════
 * ครอบคลุม:
 *   - หน้า Planning Board (#page-planner) — render ทั้งหน้า
 *   - Stats strip (in-progress / scheduled / done / total)
 *   - FIFO / LIFO list — เรียงถังตามวันที่รับเข้า
 *   - AI Recommendations — คำแนะนำอัตโนมัติ
 *
 * Dependencies: config.js, i18n.js, utils.js, jobs.js, gantt.js, db.js
 * ═══════════════════════════════════════════════════════════════
 */

// ── State ──────────────────────────────────────────────────────
let _planMode = 'fifo';   // 'fifo' | 'lifo'

// ─────────────────────────────────────────────────────────────
// MAIN RENDER
// ─────────────────────────────────────────────────────────────

/** วาดหน้า Planning Board ทั้งหมด */
async function renderPlanner() {
  _renderPlanStats();
  renderGantt();
  renderJobBoard();
  _renderFifoList();
  _renderRecommendations();
  if (typeof renderPLCStatus === 'function') renderPLCStatus();
}

// ─────────────────────────────────────────────────────────────
// STATS STRIP
// ─────────────────────────────────────────────────────────────

function _renderPlanStats() {
  const inprog = aerJobs.filter(j => j.status === 'inprogress').length;
  const sched  = aerJobs.filter(j => j.status === 'scheduled').length;
  const done   = aerJobs.filter(j => j.status === 'complete').length;
  const total  = aerJobs.length;

  _setText('ps-inprog', inprog);
  _setText('ps-sched',  sched);
  _setText('ps-done',   done);
  _setText('ps-total',  total);
}

// ─────────────────────────────────────────────────────────────
// FIFO / LIFO LIST
// ─────────────────────────────────────────────────────────────

/** สลับ mode FIFO / LIFO */
function setPlanMode(mode, btn) {
  _planMode = mode;
  document.querySelectorAll('[id^="pm-"]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _renderFifoList();
}

/** วาด FIFO/LIFO list */
function _renderFifoList() {
  const listEl = document.getElementById('fifo-list');
  if (!listEl) return;

  const inv = MOCK_DATA.siloInventory;
  // กรองเฉพาะถังที่มีสินค้า
  let sorted = inv.filter(s => s.grain && s.tons > 0);
  // เรียงตาม daysIn
  sorted = _planMode === 'fifo'
    ? sorted.sort((a, b) => b.daysIn - a.daysIn)   // เก่าออกก่อน
    : sorted.sort((a, b) => a.daysIn - b.daysIn);   // ใหม่ออกก่อน

  listEl.innerHTML = '';

  sorted.forEach((s, rank) => {
    const urgency = s.daysIn >= 60 ? 'red' : s.daysIn >= 40 ? 'yellow' : 'green';
    const urgencyColor = urgency === 'red' ? 'var(--red)' : urgency === 'yellow' ? 'var(--yellow)' : 'var(--green)';

    const row = document.createElement('div');
    row.className = 'fifo-row';
    row.innerHTML = `
      <span class="fifo-rank">${rank + 1}.</span>
      <span class="fifo-id" style="color:${urgencyColor}">${s.id}</span>
      <span class="fifo-grain">${s.grain}</span>
      <span class="fifo-days" style="color:${urgencyColor}">${s.daysIn} วัน</span>
      <span class="fifo-tons" style="color:var(--text2)">${numFmt(s.tons)} ตัน</span>
      <button class="fifo-job-btn" onclick="
        event.stopPropagation();
        openJobModal({
          from:'${s.id}',
          tons:${Math.round(s.tons * 0.4) || 50},
          grain:'${s.grain}',
          note:'${_planMode.toUpperCase()} — ${s.grain} ${s.daysIn} วัน'
        })
      ">+ Job</button>
    `;
    listEl.appendChild(row);
  });
}

// ─────────────────────────────────────────────────────────────
// AI RECOMMENDATIONS
// ─────────────────────────────────────────────────────────────

/** สร้างคำแนะนำอัตโนมัติจากข้อมูล */
function _renderRecommendations() {
  const el = document.getElementById('plan-recs');
  if (!el) return;

  const recs = [];
  const silos = MOCK_DATA.silos;
  const inv   = MOCK_DATA.siloInventory;
  const fum   = MOCK_DATA.fumData;
  const today = aerJobs.filter(j => j.status !== 'cancelled' && j.status !== 'complete');

  // ── ถังอุณหภูมิสูง ────────────────────────────────────────
  silos.forEach(s => {
    if (s.temp >= CONFIG.TEMP_CRIT_MIN) {
      const invE = inv.find(i => i.id === s.id);
      if (invE && invE.tons > 0) {
        const alreadyScheduled = today.find(j => j.from === s.id);
        recs.push({
          priority: 1,
          icon: '🌡',
          color: 'var(--red)',
          title: `ถัง ${s.id} — อุณหภูมิ ${s.temp}°C (วิกฤต)`,
          body:  `${invE.grain} ${numFmt(invE.tons)} ตัน — ${alreadyScheduled ? 'มี Job อยู่แล้ว ✓' : 'แนะนำให้ถ่ายวนทันที'}`,
          action: !alreadyScheduled ? { label: '+ สร้าง Job', from: s.id, tons: Math.round(invE.tons * 0.4), grain: invE.grain, note: `อุณหภูมิสูง ${s.temp}°C — ถ่ายวนด่วน` } : null,
        });
      }
    }
  });

  // ── ถังที่ต้องอบยา ─────────────────────────────────────────
  fum.forEach(f => {
    if (!f.fuming && f.days >= CONFIG.FUM_OVERDUE_DAYS) {
      recs.push({
        priority: 2,
        icon: '🧪',
        color: 'var(--orange)',
        title: `ถัง ${f.id} — อบยาเกินกำหนด ${f.days} วัน`,
        body:  'ควรย้ายสินค้าออกก่อนอบยา หรือดำเนินการอบยาทันที',
        action: null,
      });
    }
  });

  // ── ถังเกือบเต็ม ──────────────────────────────────────────
  inv.forEach(s => {
    if (s.fillPct >= CONFIG.FILL_FULL_PCT) {
      recs.push({
        priority: 3,
        icon: '📦',
        color: 'var(--yellow)',
        title: `ถัง ${s.id} — ความจุ ${s.fillPct}% (เกือบเต็ม)`,
        body:  `${s.grain} ${numFmt(s.tons)} ตัน — หาถังปลายทางเตรียมรับ`,
        action: null,
      });
    }
  });

  // ── FIFO เก่ามาก (> 50 วัน) ──────────────────────────────
  inv.forEach(s => {
    if (s.daysIn > 50) {
      recs.push({
        priority: 4,
        icon: '⏰',
        color: 'var(--yellow)',
        title: `ถัง ${s.id} — รับเข้า ${s.daysIn} วัน (FIFO)`,
        body:  `${s.grain} ควรนำออกตาม FIFO ก่อนคุณภาพลดลง`,
        action: { label: '+ สร้าง Job', from: s.id, tons: Math.round(s.tons * 0.4), grain: s.grain, note: `FIFO ${s.daysIn} วัน` },
      });
    }
  });

  if (!recs.length) {
    el.innerHTML = '<div style="color:var(--green);font-size:13px">✅ ทุกถังปกติ ไม่มีคำแนะนำพิเศษ</div>';
    return;
  }

  // เรียง priority
  recs.sort((a, b) => a.priority - b.priority);

  el.innerHTML = recs.slice(0, 6).map(r => `
    <div class="rec-card" style="border-left:3px solid ${r.color}">
      <div class="rec-title">${r.icon} ${r.title}</div>
      <div class="rec-body">${r.body}</div>
      ${r.action
        ? `<button class="rec-btn" onclick="openJobModal({from:'${r.action.from}',tons:${r.action.tons},grain:'${r.action.grain}',note:'${r.action.note}'})">
             ${r.action.label}
           </button>`
        : ''}
    </div>
  `).join('');
}

// ─────────────────────────────────────────────────────────────
// TOGGLE PLC PANEL
// ─────────────────────────────────────────────────────────────

function togglePLCPanel() {
  const body = document.getElementById('plc-panel-body');
  if (!body) return;
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? 'block' : 'none';
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function _setText(id, val) {
  const e = document.getElementById(id);
  if (e) e.textContent = val;
}
