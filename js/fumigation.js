/**
 * ═══════════════════════════════════════════════════════════════
 * fumigation.js — Fumigation Planner & Dashboard Strip
 * ═══════════════════════════════════════════════════════════════
 * ครอบคลุม:
 *   - หน้า Fumigation (#page-fumigation)
 *   - KPI cards (overdue / soon / active / ok)
 *   - Silo fumigation grid พร้อมปุ่ม Start / Complete
 *   - Fumigation log timeline
 *
 * Dependencies: config.js, i18n.js, utils.js, db.js
 * ═══════════════════════════════════════════════════════════════
 */

// ── State ──────────────────────────────────────────────────────
let _fumFilter = 'all';  // 'all'|'due'|'soon'|'ok'|'active'

// ─────────────────────────────────────────────────────────────
// MAIN RENDER
// ─────────────────────────────────────────────────────────────

/** วาดหน้า Fumigation ทั้งหมด */
async function renderFumigation(filter) {
  if (filter !== undefined) _fumFilter = filter;

  const data = await DB.getFumigationStatus();

  _renderFumKPI(data);
  _renderFumGrid(data);
  _renderFumLog();
}

/** filter ปุ่ม All / Overdue / Soon / OK */
function filterFum(f, btn) {
  _fumFilter = f;
  document.querySelectorAll('#page-fumigation .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderFumigation();
}

// ─────────────────────────────────────────────────────────────
// KPI CARDS
// ─────────────────────────────────────────────────────────────

function _renderFumKPI(data) {
  const el = document.getElementById('fum-kpi-grid');
  if (!el) return;

  const overdue = data.filter(f => !f.fuming && f.days >= CONFIG.FUM_OVERDUE_DAYS).length;
  const soon    = data.filter(f => !f.fuming && f.days >= CONFIG.FUM_SOON_DAYS && f.days < CONFIG.FUM_OVERDUE_DAYS).length;
  const active  = data.filter(f => f.fuming).length;
  const ok      = data.filter(f => !f.fuming && f.days < CONFIG.FUM_SOON_DAYS).length;

  el.innerHTML = `
    <div class="summary-card c-red" style="cursor:pointer" onclick="filterFum('due',document.getElementById('ff-due'))">
      <div class="label">${T('fum.kpiOverdue')}</div>
      <div class="value" style="color:var(--red)">${overdue}</div>
      <div class="sub">ถัง — ดำเนินการด่วน!</div>
    </div>
    <div class="summary-card c-yellow" style="cursor:pointer" onclick="filterFum('soon',document.getElementById('ff-soon'))">
      <div class="label">${T('fum.kpiSoon')}</div>
      <div class="value" style="color:var(--yellow)">${soon}</div>
      <div class="sub">ถัง — วางแผนล่วงหน้า</div>
    </div>
    <div class="summary-card" style="border-left:3px solid var(--orange);cursor:pointer" onclick="filterFum('active',document.getElementById('ff-active'))">
      <div class="label">${T('fum.kpiActive')}</div>
      <div class="value" style="color:var(--orange)">${active}</div>
      <div class="sub">ถัง</div>
    </div>
    <div class="summary-card c-green" style="cursor:pointer" onclick="filterFum('ok',document.getElementById('ff-ok'))">
      <div class="label">${T('fum.kpiOk')}</div>
      <div class="value" style="color:var(--green)">${ok}</div>
      <div class="sub">ถัง</div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// SILO GRID
// ─────────────────────────────────────────────────────────────

function _renderFumGrid(data) {
  const gridEl = document.getElementById('fum-silo-grid');
  if (!gridEl) return;
  gridEl.innerHTML = '';

  // กรองตาม filter
  let filtered = data;
  if (_fumFilter === 'due')    filtered = data.filter(f => !f.fuming && f.days >= CONFIG.FUM_OVERDUE_DAYS);
  if (_fumFilter === 'soon')   filtered = data.filter(f => !f.fuming && f.days >= CONFIG.FUM_SOON_DAYS && f.days < CONFIG.FUM_OVERDUE_DAYS);
  if (_fumFilter === 'ok')     filtered = data.filter(f => !f.fuming && f.days < CONFIG.FUM_SOON_DAYS);
  if (_fumFilter === 'active') filtered = data.filter(f => f.fuming);

  if (!filtered.length) {
    gridEl.innerHTML = '<div style="color:var(--text3);padding:20px;text-align:center">ไม่มีถังในหมวดนี้</div>';
    return;
  }

  filtered.forEach(f => {
    const color  = fumColor(f.days, f.fuming);
    const label  = fumStatusLabel(f.days, f.fuming);
    const isOverdue = !f.fuming && f.days >= CONFIG.FUM_OVERDUE_DAYS;
    const isSoon    = !f.fuming && f.days >= CONFIG.FUM_SOON_DAYS;
    const isEmpty   = f.days === 0 && !f.fuming && f.chem === '—';

    const card = document.createElement('div');
    card.className = `fum-card ${isOverdue ? 'fum-overdue' : isSoon ? 'fum-soon' : f.fuming ? 'fum-active' : ''}`;

    card.innerHTML = `
      <div class="fc-header">
        <span class="fc-id">${f.id}</span>
        <span class="fc-status" style="color:${color};font-size:11px;font-weight:600">${label}</span>
      </div>
      <div class="fc-detail">
        <div class="fc-row"><span>สารเคมี</span><span>${f.chem}</span></div>
        <div class="fc-row"><span>${T('fum.lastDate')}</span><span>${f.lastDate}</span></div>
        ${f.fuming
          ? `<div class="fc-progress"><div class="fc-prog-bar" style="width:40%"></div></div>`
          : ''
        }
      </div>
      ${!isEmpty ? `
      <div class="fc-actions">
        ${f.fuming
          ? `<button class="fc-btn fc-complete" onclick="fumComplete('${f.id}')">${T('fum.completeBtn')}</button>`
          : `<button class="fc-btn fc-start" onclick="fumStart('${f.id}')">${T('fum.startBtn')}</button>`
        }
      </div>
      ` : '<div style="font-size:11px;color:var(--text3);text-align:center;padding:4px 0">ถังว่าง</div>'}
    `;
    gridEl.appendChild(card);
  });
}

// ─────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────

/** เริ่มอบยาถัง */
async function fumStart(siloId) {
  if (!confirm(`เริ่มอบยาถัง ${siloId} ใช่หรือไม่?`)) return;
  await DB.logFumigation(siloId, 'start', { chemical_name: 'Phosphine (PH₃)', dosage_g_per_ton: 3.0 });
  showToast(`🧪 ถัง ${siloId}: เริ่มอบยาแล้ว`, 'warn');
  renderFumigation();
}

/** ปิดอบยาถัง */
async function fumComplete(siloId) {
  if (!confirm(`ยืนยันอบยาถัง ${siloId} เสร็จสิ้น?`)) return;
  await DB.logFumigation(siloId, 'complete');
  showToast(`✅ ถัง ${siloId}: อบยาเสร็จสิ้น`, 'ok');
  renderFumigation();
}

// ─────────────────────────────────────────────────────────────
// FUMIGATION LOG TIMELINE
// ─────────────────────────────────────────────────────────────

function _renderFumLog() {
  const logEl = document.getElementById('fum-log');
  if (!logEl) return;

  const logs = CONFIG.DEMO_MODE ? MOCK_DATA.fumLog : [];
  if (!logs.length) {
    logEl.innerHTML = '<div style="color:var(--text3);font-size:13px">ยังไม่มีประวัติ</div>';
    return;
  }

  logEl.innerHTML = logs.map((entry, i) => {
    const isStart    = entry.action === 'start';
    const dotColor   = isStart ? 'var(--orange)' : 'var(--green)';
    const actionText = isStart ? '▶ เริ่มอบยา' : '✅ เสร็จสิ้น';
    return `
      <div class="tl-item" style="${i < logs.length - 1 ? '' : ''}">
        <div class="tl-dot-wrap">
          <div class="tl-dot" style="border-color:${dotColor};background:${dotColor}22"></div>
          ${i < logs.length - 1 ? '<div class="tl-line"></div>' : ''}
        </div>
        <div class="tl-body">
          <div class="tl-date">${entry.date}</div>
          <div class="tl-title">${actionText} — ถัง <strong>${entry.silo}</strong></div>
          <div class="tl-sub">สารเคมี: ${entry.chem} · ผู้ดำเนินการ: ${entry.staff}</div>
        </div>
      </div>
    `;
  }).join('');
}
