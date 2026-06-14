/**
 * ═══════════════════════════════════════════════════════════════
 * jobs.js — Transfer Job CRUD + Interlock Engine
 * ═══════════════════════════════════════════════════════════════
 * ครอบคลุม:
 *   - Job modal (Create Transfer Job)
 *   - submitJob() / updateJobStatus() / cancelJob()
 *   - Interlock logic: ตรวจ source / dest / route conflict
 *   - Job Board list (card + D&D reorder)
 *   - openJobModal() รองรับ pre-fill จาก FIFO list
 *
 * State:
 *   aerJobs (shared array — อ้างอิงจาก MOCK_DATA.aerJobs ใน DEMO_MODE)
 *
 * Dependencies: config.js, i18n.js, utils.js, db.js
 * ═══════════════════════════════════════════════════════════════
 */

// ── State ──────────────────────────────────────────────────────
// aerJobs เป็น reference ตรงจาก MOCK_DATA.aerJobs ใน demo
// หรือ array ที่โหลดจาก Supabase ใน production
let aerJobs = CONFIG.DEMO_MODE ? MOCK_DATA.aerJobs : [];

let _jobFilter    = 'active'; // 'active'|'inprogress'|'scheduled'|'complete'|'all'
let _jdDragId     = null;     // drag-and-drop: job id ที่กำลังลาก

// ─────────────────────────────────────────────────────────────
// INTERLOCK ENGINE
// ─────────────────────────────────────────────────────────────

/**
 * ตรวจสอบ interlock ก่อนสร้าง/เริ่ม job
 *
 * ตรวจ 3 ระดับ:
 *   1. source silo — ถังต้นทางกำลังถ่ายออกอยู่แล้ว
 *   2. dest silo   — ถังปลายทางกำลังรับเข้าอยู่แล้ว
 *   3. route       — สายพานเส้นเดียวกันกำลังใช้งานอยู่
 *
 * @param {string} from         silo code ต้นทาง
 * @param {string} to           silo code ปลายทาง
 * @param {number|null} [excludeJobId]  ไม่ตรวจ job ตัวเอง (ตอน update)
 * @returns {{ ok: boolean, conflicts: Array }}
 */
function checkInterlocks(from, to, excludeJobId = null) {
  const conflicts = [];
  // เฉพาะ job ที่กำลัง inprogress (และไม่ใช่ job ตัวเอง)
  const active = aerJobs.filter(j => j.status === 'inprogress' && j.id !== excludeJobId);

  // 1. Source conflict
  const srcConflict = active.find(j => j.from === from);
  if (srcConflict) {
    conflicts.push({
      type: 'source',
      message: `ถัง ${from} กำลังถ่ายออก (Job #${srcConflict.id})`,
    });
  }

  // 2. Destination conflict
  const dstConflict = active.find(j => j.to === to);
  if (dstConflict) {
    conflicts.push({
      type: 'dest',
      message: `ถัง ${to} กำลังรับเข้า (Job #${dstConflict.id})`,
    });
  }

  // 3. Route conflict (สายพานร่วม)
  const myRoute = getRoute(from, to);
  active.forEach(j => {
    const theirRoute = getRoute(j.from, j.to);
    myRoute.forEach(eq => {
      if (theirRoute.includes(eq)) {
        conflicts.push({
          type: 'route',
          equipment: eq,
          message: `${eq} ถูกใช้งานโดย Job #${j.id} (${j.from}→${j.to})`,
        });
      }
    });
  });

  return { ok: conflicts.length === 0, conflicts };
}

// ─────────────────────────────────────────────────────────────
// JOB MODAL
// ─────────────────────────────────────────────────────────────

/**
 * เปิด modal สร้าง job
 * @param {Object} [prefill]  { from, to, tons, grain, note }  pre-fill จาก FIFO list
 */
function openJobModal(prefill = {}) {
  const modal = document.getElementById('job-modal');
  if (!modal) return;

  // Reset fields
  _setVal('jm-from', prefill.from  || '');
  _setVal('jm-to',   prefill.to    || '');
  _setVal('jm-tons', prefill.tons  || '');
  _setVal('jm-grain',prefill.grain || 'Paddy');
  _setVal('jm-note', prefill.note  || '');
  _setVal('jm-date', isoDate());
  _setVal('jm-time', '08:00');

  // Populate silo selects
  _populateSiloSelects();

  modal.classList.add('open');

  // ถ้ามี from ให้ auto-fill grain + เช็ค interlock ทันที
  if (prefill.from) {
    onFromSiloChange();
  } else {
    _updateInterlockDisplay();
    _updateJobPreview();
  }
}

/** ปิด modal */
function closeJobModal() {
  const modal = document.getElementById('job-modal');
  if (modal) modal.classList.remove('open');
}

/** เติม option ถังใน select dropdown */
function _populateSiloSelects() {
  const inv = MOCK_DATA.siloInventory;   // แสดงเฉพาะถังที่มีสินค้า
  const allSilos = CONFIG.DEMO_MODE
    ? MOCK_DATA.silos.map(s => s.id)
    : Object.keys(CONFIG.CONV_LINE_MAP);

  ['jm-from','jm-to'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = `<option value="">— เลือกถัง —</option>`;
    allSilos.forEach(code => {
      const invE = inv.find(e => e.id === code);
      const label = invE
        ? `${code} — ${invE.grain} (${numFmt(invE.tons)} ตัน)`
        : `${code} — (ว่าง)`;
      sel.innerHTML += `<option value="${code}" ${code===cur?'selected':''}>${label}</option>`;
    });
  });
}

/**
 * เรียกเมื่อ select "ถังต้นทาง" เปลี่ยน
 * → auto-fill ประเภทสินค้า + ปริมาณ 40%
 * → อัปเดต interlock display + route preview
 */
function onFromSiloChange() {
  const from = _getVal('jm-from');
  if (from) {
    const invE = MOCK_DATA.siloInventory.find(s => s.id === from);
    if (invE) {
      _setVal('jm-grain', invE.grain);
      // แนะนำ 40% ถ้ายังไม่ได้กรอก
      if (!_getVal('jm-tons')) _setVal('jm-tons', Math.round(invE.tons * 0.4));
      // แสดงปริมาณสูงสุด
      const maxEl = document.getElementById('jm-max-tons');
      if (maxEl) maxEl.textContent = `(สูงสุด ${numFmt(invE.tons)} ตัน)`;
    }
  }
  _updateJobPreview();
  _updateInterlockDisplay();
}

/** เรียกเมื่อ select "ถังปลายทาง" เปลี่ยน */
function onToSiloChange() {
  _updateJobPreview();
  _updateInterlockDisplay();
}

/** อัปเดต route chips + preview ระยะเวลา */
function _updateJobPreview() {
  const from = _getVal('jm-from');
  const to   = _getVal('jm-to');
  const tons = parseFloat(_getVal('jm-tons')) || 0;

  const routeWrap  = document.getElementById('jm-route-wrap');
  const routeChips = document.getElementById('jm-route-chips');

  if (from && to && from !== to) {
    const route = getRoute(from, to);
    if (routeWrap) routeWrap.style.display = 'flex';
    if (routeChips) {
      routeChips.innerHTML = route.map((r, i) =>
        `<span style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:2px 10px;font-size:11px;font-weight:600">${r}</span>`
        + (i < route.length - 1 ? '<span style="color:var(--text3)">→</span>' : '')
      ).join('');
    }
    // ประมาณเวลา
    if (tons > 0) {
      const h   = jobDurH(tons);
      const hh  = Math.floor(h);
      const mm  = Math.round((h - hh) * 60);
      const durStr = hh > 0 ? `${hh} ชม. ${mm} นาที` : `${mm} นาที`;
      const prevEl = document.getElementById('jm-preview');
      if (prevEl) prevEl.textContent = `ประมาณ ${durStr} (${numFmt(tons)} ตัน @ ${CONFIG.TRANSFER_RATE_TPH} ตัน/ชม.)`;
    }
  } else {
    if (routeWrap) routeWrap.style.display = 'none';
  }
}

/** แสดง interlock status box ใน modal */
function _updateInterlockDisplay() {
  const from = _getVal('jm-from');
  const to   = _getVal('jm-to');
  const box  = document.getElementById('jm-interlock');
  if (!box) return;

  if (!from || !to || from === to) {
    box.style.display = 'none';
    return;
  }

  const { ok, conflicts } = checkInterlocks(from, to);
  box.style.display = 'block';

  if (ok) {
    box.style.borderColor = 'var(--green-border)';
    box.style.background  = 'var(--green-bg)';
    box.innerHTML = '✅ Interlock OK — เส้นทางว่าง สามารถสร้าง Job ได้';
  } else {
    box.style.borderColor = 'var(--red-border)';
    box.style.background  = '#1a0000';
    box.innerHTML = '🔒 <strong>INTERLOCK BLOCK</strong><br>' +
      conflicts.map(c => `&nbsp;• ${c.message}`).join('<br>');
  }
}

// ─────────────────────────────────────────────────────────────
// SUBMIT
// ─────────────────────────────────────────────────────────────

/** สร้าง Job จาก modal */
async function submitJob() {
  const from  = _getVal('jm-from');
  const to    = _getVal('jm-to');
  const tons  = parseFloat(_getVal('jm-tons'));
  const grain = _getVal('jm-grain');
  const date  = _getVal('jm-date');
  const time  = _getVal('jm-time');
  const note  = _getVal('jm-note');

  // Validation
  if (!from || !to) return showToast('กรุณาเลือกถังต้นทางและปลายทาง', 'error');
  if (from === to)  return showToast('ถังต้นทางและปลายทางต้องไม่เหมือนกัน', 'error');
  if (!tons || tons < CONFIG.MIN_TRANSFER_TONS)
    return showToast(`ปริมาณขั้นต่ำ ${CONFIG.MIN_TRANSFER_TONS} ตัน`, 'error');

  // Interlock check
  const { ok, conflicts } = checkInterlocks(from, to);
  if (!ok) {
    showToast('🔒 Interlock Block — แก้ไข conflict ก่อนสร้าง Job', 'error');
    return;
  }

  // สร้าง route string
  const route_lines = getRoute(from, to).join(',');

  await DB.createJob({ from, to, grain, quantity_tons: tons, route_lines, scheduled_date: date, scheduled_time: time, notes: note });

  // Sync aerJobs ใน demo mode (DB.createJob แก้ MOCK_DATA.aerJobs โดยตรง)
  if (CONFIG.DEMO_MODE) aerJobs = MOCK_DATA.aerJobs;

  showToast(`✅ สร้าง Job ${from}→${to} (${numFmt(tons)} ตัน) แล้ว`);
  closeJobModal();

  // Re-render planning board
  renderPlanner();
}

// ─────────────────────────────────────────────────────────────
// JOB STATUS UPDATE
// ─────────────────────────────────────────────────────────────

/**
 * เปลี่ยนสถานะ job
 * เช็ค interlock ก่อน start (inprogress)
 */
async function updateJobStatus(id, newStatus) {
  const job = aerJobs.find(j => j.id === id);
  if (!job) return;

  if (newStatus === 'inprogress') {
    const { ok, conflicts } = checkInterlocks(job.from, job.to, job.id);
    if (!ok) {
      alert(`🔒 INTERLOCK BLOCK\n\nไม่สามารถเริ่ม Job ได้:\n${conflicts.map(c => '• ' + c.message).join('\n')}`);
      return;
    }
    // อัปเดต PLC state (ถ้ามี)
    const route = getRoute(job.from, job.to);
    route.forEach(line => {
      if (MOCK_DATA.plcState[line]) MOCK_DATA.plcState[line].running = true;
    });
  }

  if (newStatus === 'complete') {
    // ปิด PLC lines
    const route = getRoute(job.from, job.to);
    route.forEach(line => {
      if (MOCK_DATA.plcState[line]) MOCK_DATA.plcState[line].running = false;
    });
    // อัปเดต inventory (ย้ายตัน from → to)
    const invFrom = MOCK_DATA.siloInventory.find(s => s.id === job.from);
    const invTo   = MOCK_DATA.siloInventory.find(s => s.id === job.to);
    if (invFrom) { invFrom.tons = Math.max(0, invFrom.tons - (job.tons || job.quantity_tons)); }
    if (invTo)   { invTo.tons  += (job.tons || job.quantity_tons); }
  }

  await DB.updateJob(id, { status: newStatus });
  showToast(`Job #${id}: ${_statusLabel(newStatus)}`);
  renderPlanner();
}

/** ยกเลิก job */
async function cancelJob(id) {
  if (!confirm('ยืนยันยกเลิก Job นี้?')) return;
  await DB.updateJob(id, { status: 'cancelled' });
  showToast('Job ยกเลิกแล้ว', 'warn');
  renderPlanner();
}

// ─────────────────────────────────────────────────────────────
// JOB BOARD LIST
// ─────────────────────────────────────────────────────────────

/** วาด job card list ใน Planning Board */
function renderJobBoard() {
  const el = document.getElementById('job-board-list');
  if (!el) return;
  el.innerHTML = '';

  const filtered = aerJobs.filter(j => {
    if (_jobFilter === 'active')    return j.status === 'inprogress' || j.status === 'scheduled';
    if (_jobFilter === 'all')       return true;
    return j.status === _jobFilter;
  });

  if (!filtered.length) {
    el.innerHTML = '<div style="color:var(--text3);text-align:center;padding:20px;font-size:13px">ไม่มี Job ในหมวดนี้</div>';
    return;
  }

  filtered.forEach(j => {
    const route    = getRoute(j.from, j.to);
    const routeStr = route.join(' → ');
    const durH     = jobDurH(j.tons || j.quantity_tons || 0);
    const durStr   = durH >= 1 ? `${durH.toFixed(1)} ชม.` : `${Math.round(durH*60)} นาที`;
    const canDrag  = j.status === 'scheduled';

    const card = document.createElement('div');
    card.className   = `job-card status-${j.status}`;
    card.dataset.jobid = j.id;
    card.draggable   = canDrag;
    if (canDrag) {
      card.ondragstart = e => onJobCardDragStart(e, j.id);
      card.ondragover  = e => onJobCardDragOver(e, j.id);
      card.ondrop      = e => onJobCardDrop(e, j.id);
      card.ondragend   = onJobCardDragEnd;
    }

    card.innerHTML = `
      <div class="jc-header">
        <span class="jc-route">${j.from} → ${j.to}</span>
        <span class="jc-status-badge ${j.status}">${_statusLabel(j.status)}</span>
      </div>
      <div class="jc-meta">
        <span>🌾 ${j.grain || j.grain_type || '—'}</span>
        <span>⚖️ ${numFmt(j.tons || j.quantity_tons || 0)} ตัน</span>
        <span>⏱ ${durStr}</span>
      </div>
      <div class="jc-route-line">${routeStr}</div>
      ${j.note || j.notes ? `<div class="jc-note">📝 ${j.note || j.notes}</div>` : ''}
      <div class="jc-time">🕐 ${j.date || j.scheduled_date || ''} ${j.time || j.scheduled_time || ''}</div>
      <div class="jc-actions">
        ${j.status === 'scheduled'
          ? `<button class="jc-btn start" onclick="updateJobStatus(${j.id},'inprogress')">▶ เริ่ม</button>`
          : ''}
        ${j.status === 'inprogress'
          ? `<button class="jc-btn complete" onclick="updateJobStatus(${j.id},'complete')">✅ เสร็จ</button>`
          : ''}
        ${j.status !== 'complete' && j.status !== 'cancelled'
          ? `<button class="jc-btn cancel" onclick="cancelJob(${j.id})">✕</button>`
          : ''}
      </div>
    `;
    el.appendChild(card);
  });
}

/** Filter job board */
function setJobFilter(f, btn) {
  _jobFilter = f;
  document.querySelectorAll('.jb-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderJobBoard();
}

// ─────────────────────────────────────────────────────────────
// DRAG-AND-DROP REORDER (Job Board)
// ─────────────────────────────────────────────────────────────

function onJobCardDragStart(e, jobId) {
  _jdDragId = jobId;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('jc-dragging');
}

function onJobCardDragOver(e, targetId) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  // Highlight drop target
  document.querySelectorAll('.job-card').forEach(c => c.classList.remove('jc-drop-target'));
  if (targetId !== _jdDragId) {
    const el = document.querySelector(`[data-jobid="${targetId}"]`);
    if (el) el.classList.add('jc-drop-target');
  }
}

function onJobCardDrop(e, targetId) {
  e.preventDefault();
  if (!_jdDragId || _jdDragId === targetId) return;
  const fi = aerJobs.findIndex(j => j.id === _jdDragId);
  const ti = aerJobs.findIndex(j => j.id === targetId);
  if (fi < 0 || ti < 0) return;
  const [moved] = aerJobs.splice(fi, 1);
  aerJobs.splice(ti, 0, moved);
  renderJobBoard();
  if (typeof renderGantt === 'function') renderGantt();
}

function onJobCardDragEnd() {
  _jdDragId = null;
  document.querySelectorAll('.job-card').forEach(c => {
    c.classList.remove('jc-dragging', 'jc-drop-target');
  });
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function _statusLabel(status) {
  const map = {
    scheduled:  '📅 Scheduled',
    inprogress: '⚙ In Progress',
    complete:   '✅ Complete',
    cancelled:  '✕ Cancelled',
  };
  return map[status] || status;
}

function _getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function _setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}
