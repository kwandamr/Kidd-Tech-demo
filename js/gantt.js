/**
 * ═══════════════════════════════════════════════════════════════
 * gantt.js — Gantt Chart + Mouse-Drag Reschedule
 * ═══════════════════════════════════════════════════════════════
 * ลักษณะ:
 *   - แกน X = เวลา 06:00–22:00  (CONFIG.GANTT_START_H–END_H)
 *   - แกน Y = สายพาน LINE-1, LINE-2, LINE-3, MAIN
 *   - แต่ละ job แสดงเป็น bar สี ตาม status
 *   - ลากแถบด้วย Mouse (mousedown/mousemove/mouseup) ได้
 *   - Snap ทุก 15 นาที (CONFIG.GANTT_SNAP_MIN)
 *   - เส้นแนวตั้งสีแดง = ตอนนี้
 *   - Tooltip แสดงรายละเอียด job
 *
 * Dependencies: config.js, i18n.js, utils.js, db.js, jobs.js
 * ═══════════════════════════════════════════════════════════════
 */

// ── Constants ──────────────────────────────────────────────────
const GANTT_SH   = CONFIG.GANTT_START_H;    // ชั่วโมงเริ่ม
const GANTT_EH   = CONFIG.GANTT_END_H;      // ชั่วโมงสิ้นสุด
const GANTT_HW   = CONFIG.GANTT_HOUR_PX;    // pixel ต่อ 1 ชั่วโมง
const GANTT_SNAP = CONFIG.GANTT_SNAP_MIN;   // snap ทุก n นาที
const GANTT_ROWS = CONFIG.EQUIPMENT_LIST;   // ['LINE-1','LINE-2','LINE-3','MAIN']

// ROW_H = pixel สูงของแต่ละแถว
const GANTT_ROW_H = 52;

// สี bar ตาม status
const GANTT_COLORS = {
  inprogress: { bg: 'linear-gradient(90deg,#0284C7,#38BDF8)', border: '#0EA5E9' },
  scheduled:  { bg: 'linear-gradient(90deg,#047857,#00BFA5)', border: '#059669' },
  complete:   { bg: 'var(--bg3)', border: 'var(--border)' },
  cancelled:  { bg: 'transparent', border: 'var(--border)' },
};

// ── Drag state ─────────────────────────────────────────────────
let _gd = null;  // { jobId, barEl, startMouseX, origLeft, origH }

// ─────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────

/** วาด Gantt chart ใหม่ทั้งหมด */
function renderGantt() {
  const labelColEl = document.getElementById('gantt-label-col');
  const hdrEl      = document.getElementById('gantt-time-hdr');
  const rowsEl     = document.getElementById('gantt-rows');
  const dateLabel  = document.getElementById('gantt-date-label');
  if (!rowsEl) return;

  // อัปเดต date label
  if (dateLabel) {
    dateLabel.textContent = new Date().toLocaleDateString('th-TH', { weekday:'short', day:'numeric', month:'short' });
  }

  const totalW = (GANTT_EH - GANTT_SH) * GANTT_HW;

  // ── Time header ───────────────────────────────────────────
  if (hdrEl) {
    hdrEl.innerHTML = '<div style="width:0"></div>';  // spacer แถวแรก
    for (let h = GANTT_SH; h <= GANTT_EH; h++) {
      hdrEl.innerHTML += `<div class="gantt-hour-tick">${String(h).padStart(2,'0')}:00</div>`;
    }
  }

  // ── Row labels ────────────────────────────────────────────
  if (labelColEl) {
    labelColEl.innerHTML = '<div style="height:30px"></div>';  // spacer สำหรับ header
    GANTT_ROWS.forEach(row => {
      const meta = CONFIG.EQUIPMENT_META[row] || { icon:'⚙', label: row };
      labelColEl.innerHTML += `
        <div class="gantt-row-label" style="height:${GANTT_ROW_H}px;display:flex;align-items:center;padding-right:10px;justify-content:flex-end;font-size:11px;font-weight:600;color:var(--text2)">
          ${meta.icon} ${row}
        </div>
      `;
    });
  }

  // ── Grid rows + bars ──────────────────────────────────────
  rowsEl.innerHTML = '';

  const todayJobs = aerJobs.filter(j => {
    const d = j.date || j.scheduled_date;
    return !d || d === isoDate();   // แสดงเฉพาะวันนี้
  });

  GANTT_ROWS.forEach(row => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'gantt-row';
    rowDiv.style.cssText = `position:relative;height:${GANTT_ROW_H}px;width:${totalW}px;border-bottom:1px solid var(--border);`;

    // Grid lines ทุกชั่วโมง
    for (let h = GANTT_SH; h < GANTT_EH; h++) {
      const gridLine = document.createElement('div');
      gridLine.className = 'gantt-grid-col';
      gridLine.style.left = ((h - GANTT_SH) * GANTT_HW) + 'px';
      rowDiv.appendChild(gridLine);
    }

    // Bars สำหรับ job ในแถวนี้
    todayJobs.forEach(j => {
      const route = getRoute(j.from, j.to);
      if (!route.includes(row)) return;  // ไม่ผ่านแถวนี้

      const timeStr = j.time || j.scheduled_time || '08:00';
      const startH  = timeStrToH(timeStr);
      const durH_   = jobDurH(j.tons || j.quantity_tons || 0);
      const x       = hToX(startH);
      const w       = Math.max(32, durH_ * GANTT_HW);

      const clr = GANTT_COLORS[j.status] || GANTT_COLORS.scheduled;

      const bar = document.createElement('div');
      bar.className = 'gantt-bar';
      bar.dataset.jobid = j.id;
      bar.style.cssText = `
        left:${x}px;
        width:${w}px;
        background:${clr.bg};
        border:1px solid ${clr.border};
        ${j.status === 'complete' ? 'opacity:0.5;' : ''}
        ${j.status === 'cancelled' ? 'opacity:0.3;border-style:dashed;' : ''}
        color:${j.status === 'complete' ? 'var(--text3)' : 'white'};
      `;
      bar.textContent = `${j.from}→${j.to}`;

      // ลากได้เฉพาะ scheduled / inprogress
      if (j.status === 'scheduled') {
        bar.style.cursor = 'grab';
        bar.addEventListener('mousedown', e => _ganttDragStart(e, j.id, rowDiv));
      }

      // Tooltip
      bar.addEventListener('mouseenter', e => _showGanttTooltip(e, j));
      bar.addEventListener('mousemove',  e => _moveGanttTooltip(e));
      bar.addEventListener('mouseleave', _hideGanttTooltip);

      rowDiv.appendChild(bar);
    });

    // เส้นตอนนี้ (Now line)
    const nowH = new Date().getHours() + new Date().getMinutes() / 60;
    if (nowH >= GANTT_SH && nowH <= GANTT_EH) {
      const nowLine = document.createElement('div');
      nowLine.className = 'gantt-now-line';
      nowLine.style.left = hToX(nowH) + 'px';
      rowDiv.appendChild(nowLine);
    }

    rowsEl.appendChild(rowDiv);
  });
}

// ─────────────────────────────────────────────────────────────
// COORDINATE HELPERS
// ─────────────────────────────────────────────────────────────

/** ชั่วโมงทศนิยม → pixel X */
function hToX(h) {
  return (h - GANTT_SH) * GANTT_HW;
}

/** pixel X → ชั่วโมงทศนิยม (snap) */
function xToH(x) {
  const raw = GANTT_SH + x / GANTT_HW;
  // snap ทุก GANTT_SNAP นาที
  const snapFrac = GANTT_SNAP / 60;
  return Math.round(raw / snapFrac) * snapFrac;
}

/** clamp + snap ชั่วโมง ให้อยู่ใน range */
function snapH(h) {
  const snapFrac = GANTT_SNAP / 60;
  return Math.round(Math.max(GANTT_SH, Math.min(GANTT_EH - 0.5, h)) / snapFrac) * snapFrac;
}

// ─────────────────────────────────────────────────────────────
// MOUSE DRAG (precision drag — ไม่ใช้ HTML5 drag API)
// ─────────────────────────────────────────────────────────────

function _ganttDragStart(e, jobId, rowEl) {
  e.preventDefault();
  const bar     = e.currentTarget;
  const origLeft = parseFloat(bar.style.left) || 0;

  _gd = {
    jobId,
    barEl:      bar,
    startMouseX: e.clientX,
    origLeft,
  };
  bar.classList.add('gb-dragging');
  bar.style.cursor = 'grabbing';
  bar.style.zIndex = 20;

  document.addEventListener('mousemove', _ganttDragMove);
  document.addEventListener('mouseup',   _ganttDragEnd);
}

function _ganttDragMove(e) {
  if (!_gd) return;
  const dx      = e.clientX - _gd.startMouseX;
  const newLeft = Math.max(0, _gd.origLeft + dx);
  _gd.barEl.style.left = newLeft + 'px';

  // แสดงเวลาตาม position ปัจจุบัน
  const previewH = snapH(GANTT_SH + newLeft / GANTT_HW);
  _gd.barEl.innerHTML = hToTimeStr(previewH);
}

function _ganttDragEnd(e) {
  if (!_gd) return;

  document.removeEventListener('mousemove', _ganttDragMove);
  document.removeEventListener('mouseup',   _ganttDragEnd);

  const dx      = e.clientX - _gd.startMouseX;
  const newLeft = Math.max(0, _gd.origLeft + dx);
  const newH    = snapH(GANTT_SH + newLeft / GANTT_HW);

  // อัปเดต job time
  const job = aerJobs.find(j => j.id === _gd.jobId);
  if (job) {
    const newTime = hToTimeStr(newH);
    job.time             = newTime;
    job.scheduled_time   = newTime;
    DB.updateJob(job.id, { scheduled_time: newTime });
    showToast(`Job ${job.from}→${job.to}: ปรับเวลาเป็น ${newTime}`);
  }

  _gd.barEl.classList.remove('gb-dragging');
  _gd = null;

  renderGantt();
}

// ─────────────────────────────────────────────────────────────
// TOOLTIP
// ─────────────────────────────────────────────────────────────

function _showGanttTooltip(e, j) {
  const tt = document.getElementById('gantt-tooltip');
  if (!tt) return;
  const durH_ = jobDurH(j.tons || j.quantity_tons || 0);
  const durStr = durH_ >= 1 ? `${durH_.toFixed(1)} ชม.` : `${Math.round(durH_*60)} นาที`;
  const route  = getRoute(j.from, j.to).join(' → ');
  tt.innerHTML = `
    <div style="font-weight:700;margin-bottom:4px">${j.from} → ${j.to}</div>
    <div>🌾 ${j.grain || j.grain_type || '—'} · ${numFmt(j.tons || j.quantity_tons || 0)} ตัน</div>
    <div>🕐 ${j.time || j.scheduled_time || '—'} · ⏱ ${durStr}</div>
    <div>🔗 ${route}</div>
    <div style="color:var(--text3);margin-top:4px">${j.note || j.notes || ''}</div>
  `;
  tt.style.display = 'block';
  _moveGanttTooltip(e);
}

function _moveGanttTooltip(e) {
  const tt = document.getElementById('gantt-tooltip');
  if (!tt) return;
  tt.style.left = (e.clientX + 16) + 'px';
  tt.style.top  = (e.clientY - 20) + 'px';
}

function _hideGanttTooltip() {
  const tt = document.getElementById('gantt-tooltip');
  if (tt) tt.style.display = 'none';
}
