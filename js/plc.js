/**
 * ═══════════════════════════════════════════════════════════════
 * plc.js — PLC Interlock Status Panel + E-STOP
 * ═══════════════════════════════════════════════════════════════
 * จำลองสถานะ PLC สายพาน (LINE-1 / LINE-2 / LINE-3 / MAIN)
 *
 * ใน production:
 *   - Node-RED อ่านสถานะจาก Mitsubishi PLC ผ่าน Modbus TCP
 *   - Push ขึ้น Supabase plc_status_log ทุก 5 วินาที
 *   - ฝั่ง web subscribe realtime และเรียก renderPLCStatus()
 *
 * ใน DEMO_MODE:
 *   - อ่านจาก MOCK_DATA.plcState
 *   - ปุ่ม E-STOP จำลองการหยุดฉุกเฉิน
 *
 * Dependencies: config.js, i18n.js, utils.js, db.js, jobs.js
 * ═══════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────

/**
 * วาด PLC status panel ใน planning board
 * เรียกใช้โดย renderPlanner() → renderPLCStatus()
 */
function renderPLCStatus() {
  const el = document.getElementById('plc-panel-body');
  if (!el) return;

  // อัปเดตสถานะ running จาก aerJobs
  _syncPlcFromJobs();

  const plcState = MOCK_DATA.plcState;
  const anyRunning = Object.values(plcState).some(s => s.running);
  const anyFault   = Object.values(plcState).some(s => s.fault);
  const anyEstop   = Object.values(plcState).some(s => s.estop);

  // ── Master status chip ─────────────────────────────────────
  const masterEl = document.getElementById('plc-master-status');
  if (masterEl) {
    if (anyEstop)   { masterEl.textContent = '🛑 E-STOP ACTIVE'; masterEl.style.color = 'var(--red)'; }
    else if (anyFault)   { masterEl.textContent = '⚠ FAULT';         masterEl.style.color = 'var(--yellow)'; }
    else if (anyRunning) { masterEl.textContent = '🟢 RUNNING';       masterEl.style.color = 'var(--green)'; }
    else                 { masterEl.textContent = '⚪ IDLE';           masterEl.style.color = 'var(--text3)'; }
  }

  // ── Equipment cards ────────────────────────────────────────
  el.innerHTML = `
    <div class="plc-grid">
      ${CONFIG.EQUIPMENT_LIST.map(line => _buildEquipCard(line, plcState[line])).join('')}
    </div>

    <!-- E-STOP bar -->
    <div class="estop-bar ${anyEstop ? 'estop-active' : ''}">
      <div class="estop-label">
        ${anyEstop
          ? '🛑 E-STOP ACTIVE — สายพานทั้งหมดหยุดฉุกเฉิน'
          : '🔒 EMERGENCY STOP — กดเมื่อเกิดเหตุฉุกเฉินเท่านั้น'
        }
      </div>
      <div class="estop-btns">
        <button class="estop-btn ${anyEstop ? 'reset' : 'stop'}" onclick="emergencyStopAll()">
          ${anyEstop ? '🔓 RESET' : '🛑 E-STOP ALL'}
        </button>
      </div>
    </div>

    <!-- Active jobs table -->
    <div style="margin-top:12px">
      ${_buildActiveJobsTable()}
    </div>
  `;
}

/** สร้าง equipment card */
function _buildEquipCard(line, state) {
  if (!state) return '';
  const meta      = CONFIG.EQUIPMENT_META[line] || { label: line, icon: '⚙', desc: '' };
  const isRunning = state.running;
  const isFault   = state.fault;
  const isEstop   = state.estop;

  // หา active job ของ line นี้
  const activeJob = aerJobs.find(j =>
    j.status === 'inprogress' && getRoute(j.from, j.to).includes(line)
  );

  const cardClass = isEstop
    ? 'plc-card estop'
    : isFault
      ? 'plc-card fault'
      : isRunning
        ? 'plc-card running'
        : 'plc-card idle';

  return `
    <div class="${cardClass}">
      <!-- Header -->
      <div class="plc-card-header">
        <span class="plc-line-id">${meta.icon} ${line}</span>
        <span class="plc-state-badge ${isRunning ? 'run' : 'idle'}">
          ${isEstop ? 'E-STOP' : isFault ? 'FAULT' : isRunning ? 'RUNNING' : 'IDLE'}
        </span>
      </div>

      <!-- Description -->
      <div class="plc-desc">${meta.desc}</div>

      <!-- DO Output indicators -->
      <div class="plc-io-row">
        <span class="plc-io-label">DO Output</span>
        <div class="plc-dots">
          ${[0,1,2,3].map(i =>
            `<span class="plc-dot ${isRunning && i < 2 ? 'dot-on' : ''}" title="DO${i}"></span>`
          ).join('')}
        </div>
      </div>

      <!-- Running FB indicators -->
      <div class="plc-io-row">
        <span class="plc-io-label">Running FB</span>
        <div class="plc-dots">
          ${[0,1].map(i =>
            `<span class="plc-dot ${isRunning ? 'dot-cyan' : ''}" title="FB${i}"></span>`
          ).join('')}
        </div>
      </div>

      <!-- Active job info -->
      ${activeJob ? `
        <div class="plc-job-info">
          🚛 ${activeJob.from}→${activeJob.to}
          · ${numFmt(activeJob.tons || activeJob.quantity_tons || 0)} ตัน
        </div>
      ` : ''}

      <!-- Manual control buttons -->
      <div class="plc-actions">
        ${!isRunning
          ? `<button class="plc-btn start" onclick="plcManualStart('${line}')">▶ เริ่ม</button>`
          : `<button class="plc-btn stop"  onclick="plcManualStop('${line}')">⏹ หยุด</button>`
        }
        ${!isFault
          ? `<button class="plc-btn fault-sim" onclick="plcSimFault('${line}')">⚠ Fault</button>`
          : `<button class="plc-btn reset"      onclick="plcResetFault('${line}')">Reset</button>`
        }
      </div>
    </div>
  `;
}

/** ตาราง Active Jobs */
function _buildActiveJobsTable() {
  const active = aerJobs.filter(j => j.status === 'inprogress');
  if (!active.length) return '<div style="color:var(--text3);font-size:12px">ไม่มี Job กำลังดำเนินการ</div>';

  const rows = active.map(j => {
    const route = getRoute(j.from, j.to).join(' → ');
    const durH_ = jobDurH(j.tons || j.quantity_tons || 0);
    return `
      <tr>
        <td style="font-weight:700">#${j.id}</td>
        <td>${j.from} → ${j.to}</td>
        <td>${j.grain || j.grain_type || '—'}</td>
        <td>${numFmt(j.tons || j.quantity_tons || 0)} ตัน</td>
        <td style="color:var(--text3)">${route}</td>
        <td>${j.time || j.scheduled_time || '—'}</td>
        <td>
          <button class="jc-btn complete" style="padding:2px 8px;font-size:10px" onclick="updateJobStatus(${j.id},'complete')">✅ เสร็จ</button>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <table class="plc-job-table" style="width:100%;border-collapse:collapse;font-size:11px">
      <thead>
        <tr style="color:var(--text3)">
          <th align="left">Job</th>
          <th align="left">เส้นทาง</th>
          <th align="left">สินค้า</th>
          <th align="left">ตัน</th>
          <th align="left">สายพาน</th>
          <th align="left">เวลา</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ─────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────

/** E-STOP ทุกสายพาน */
function emergencyStopAll() {
  const state = MOCK_DATA.plcState;
  const anyEstop = Object.values(state).some(s => s.estop);

  if (anyEstop) {
    // Reset
    Object.keys(state).forEach(line => {
      state[line].estop   = false;
      state[line].running = false;
    });
    showToast('🔓 RESET — สายพานพร้อมใช้งาน', 'ok');
  } else {
    // E-STOP
    if (!confirm('⚠️ กด E-STOP จะหยุดสายพานทั้งหมดทันที\nยืนยันหรือไม่?')) return;
    Object.keys(state).forEach(line => {
      state[line].estop   = true;
      state[line].running = false;
    });
    showToast('🛑 E-STOP ACTIVE — สายพานทั้งหมดหยุดแล้ว', 'error');
  }

  renderPLCStatus();
}

/** เริ่มสายพาน manual */
function plcManualStart(line) {
  if (MOCK_DATA.plcState[line]) {
    MOCK_DATA.plcState[line].running = true;
    MOCK_DATA.plcState[line].fault   = false;
    showToast(`${line}: เริ่มเดิน (Manual)`);
    renderPLCStatus();
  }
}

/** หยุดสายพาน manual */
function plcManualStop(line) {
  if (MOCK_DATA.plcState[line]) {
    MOCK_DATA.plcState[line].running = false;
    showToast(`${line}: หยุด (Manual)`, 'warn');
    renderPLCStatus();
  }
}

/** จำลอง fault */
function plcSimFault(line) {
  if (MOCK_DATA.plcState[line]) {
    MOCK_DATA.plcState[line].fault   = true;
    MOCK_DATA.plcState[line].running = false;
    showToast(`${line}: ⚠ FAULT — ตรวจสอบอุปกรณ์`, 'error');
    renderPLCStatus();
  }
}

/** Reset fault */
function plcResetFault(line) {
  if (MOCK_DATA.plcState[line]) {
    MOCK_DATA.plcState[line].fault = false;
    showToast(`${line}: Fault reset แล้ว`);
    renderPLCStatus();
  }
}

// ─────────────────────────────────────────────────────────────
// PRIVATE
// ─────────────────────────────────────────────────────────────

/**
 * Sync PLC state จาก aerJobs
 * LINE = running ถ้ามี inprogress job ผ่านสายพานนั้น
 */
function _syncPlcFromJobs() {
  const state = MOCK_DATA.plcState;
  // Reset ก่อน (ยกเว้น estop / fault)
  Object.keys(state).forEach(line => {
    if (!state[line].estop && !state[line].fault) {
      state[line].running = false;
    }
  });
  // ตั้งค่าจาก inprogress jobs
  aerJobs.filter(j => j.status === 'inprogress').forEach(j => {
    const route = getRoute(j.from, j.to);
    route.forEach(line => {
      if (state[line] && !state[line].estop) {
        state[line].running = true;
      }
    });
  });
}
