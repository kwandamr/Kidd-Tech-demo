/**
 * ═══════════════════════════════════════════════════════════════
 * utils.js — Shared Utility Functions
 * ═══════════════════════════════════════════════════════════════
 * Helper ส่วนกลางที่ทุก module เรียกใช้
 * ไม่มี side-effect ต่อ DOM (ยกเว้น showToast / updateClock)
 *
 * Dependencies: config.js, i18n.js
 * ═══════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────
// COLOUR / CLASS HELPERS — ตัดสินสีตาม threshold ใน CONFIG
// ─────────────────────────────────────────────────────────────

/**
 * สีตัวเลข fill % — ใช้ neutral เพราะสีถังแสดง temp อยู่แล้ว
 * @param {number} pct  0-100 (parameter ยังรับไว้เพื่อ backward compat)
 * @returns {string}    CSS var string
 */
function fillColor(pct) {
  return 'var(--text2)';
}

/**
 * CSS class สำหรับ status ถัง (green/yellow/red)
 * @param {number} temp  อุณหภูมิ °C
 * @returns {'green'|'yellow'|'red'}
 */
function tempStatus(temp) {
  if (temp >= CONFIG.TEMP_CRIT_MIN)  return 'red';
  if (temp >= CONFIG.TEMP_OK_MAX)    return 'yellow';
  return 'green';
}

/**
 * CSS class สำหรับ badge CO₂
 * @param {number} ppm
 * @returns {string}
 */
function co2Class(ppm) {
  if (ppm > 1500) return 'm-co2-alert';
  if (ppm > CONFIG.CO2_CRIT_MIN) return 'm-co2-warn';
  return 'm-co2-ok';
}

/**
 * Label ย่อสำหรับแสดงใน silo card
 * @param {number} ppm
 * @returns {string}
 */
function co2Label(ppm) {
  if (ppm > 1500) return 'CO₂⚠';
  if (ppm > CONFIG.CO2_WARN_MAX) return 'CO₂' + ppm;
  return 'CO₂' + ppm;
}

/**
 * CSS class สำหรับ moisture badge
 * @param {number} m  % moisture
 * @returns {string}
 */
function moistClass(m) {
  return m > CONFIG.MOIS_OK_MAX ? 'mois-warn' : 'mois-ok';
}

/**
 * สีข้อความอุณหภูมิ (CSS variable)
 * @param {number} temp
 * @returns {string}
 */
function tempColor(temp) {
  if (temp >= CONFIG.TEMP_CRIT_MIN) return 'var(--red)';
  if (temp >= CONFIG.TEMP_OK_MAX)   return 'var(--yellow)';
  return 'var(--green)';
}

/**
 * สีข้อความ fumigation ตามจำนวนวัน
 * @param {number} days     วันนับตั้งแต่อบยาครั้งล่าสุด
 * @param {boolean} fuming  กำลังอบอยู่
 * @returns {string}
 */
function fumColor(days, fuming) {
  if (fuming) return 'var(--orange)';
  if (days >= CONFIG.FUM_OVERDUE_DAYS) return 'var(--red)';
  if (days >= CONFIG.FUM_SOON_DAYS)    return 'var(--yellow)';
  return 'var(--green)';
}

/**
 * ป้ายกำกับสถานะ fumigation
 * @param {number} days
 * @param {boolean} fuming
 * @returns {string}
 */
function fumStatusLabel(days, fuming) {
  if (fuming) return T('fum.active');
  if (days >= CONFIG.FUM_OVERDUE_DAYS) return T('fum.overdue') + ` (${days} ${T('fum.days')})`;
  if (days >= CONFIG.FUM_SOON_DAYS)    return T('fum.soon') + ` (${days} ${T('fum.days')})`;
  return T('fum.ok') + ` (${days} ${T('fum.days')})`;
}

// ─────────────────────────────────────────────────────────────
// NUMBER / DATE FORMATTING
// ─────────────────────────────────────────────────────────────

/**
 * จัดรูปแบบตัวเลขให้มี comma คั่น
 * @param {number} n
 * @param {number} [decimals=0]
 * @returns {string}
 */
function numFmt(n, decimals = 0) {
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * แปลง Date object → string "DD/MM/YYYY HH:MM"
 * @param {Date|string} d
 * @param {'th'|'en'} [locale]
 * @returns {string}
 */
function formatDatetime(d, locale) {
  const dt = (d instanceof Date) ? d : new Date(d);
  const loc = locale || currentLang || 'th';
  return dt.toLocaleString(loc === 'th' ? 'th-TH' : 'en-GB', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

/**
 * แปลง Date → "DD/MM/YYYY" เท่านั้น
 * @param {Date|string} d
 * @returns {string}
 */
function formatDate(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  return dt.toLocaleDateString('th-TH');
}

/**
 * YYYY-MM-DD string (ISO) สำหรับ input[type=date]
 * @param {Date} [d]
 * @returns {string}
 */
function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/**
 * แปลงชั่วโมงทศนิยม → "HH:MM"
 * @param {number} h   เช่น 8.25 → "08:15"
 * @returns {string}
 */
function hToTimeStr(h) {
  const hh = Math.floor(h);
  const mm  = Math.round((h - hh) * 60);
  return String(hh).padStart(2, '0') + ':' + String(mm < 60 ? mm : 0).padStart(2, '0');
}

/**
 * แปลง "HH:MM" → ชั่วโมงทศนิยม
 * @param {string} t   เช่น "08:15" → 8.25
 * @returns {number}
 */
function timeStrToH(t) {
  const [hh, mm] = t.split(':').map(Number);
  return hh + mm / 60;
}

// ─────────────────────────────────────────────────────────────
// TOAST NOTIFICATION
// ─────────────────────────────────────────────────────────────

let _toastTimer = null;

/**
 * แสดง toast ด้านล่างขวา 2.5 วินาที
 * @param {string} msg
 * @param {'ok'|'warn'|'error'} [type='ok']
 */
function showToast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  // สีตาม type
  t.style.borderColor = type === 'error' ? 'var(--red-border)' : type === 'warn' ? 'var(--yellow-border)' : 'var(--green-border)';
  t.style.color       = type === 'error' ? 'var(--red)' : type === 'warn' ? 'var(--yellow)' : 'var(--green)';
  t.classList.add('show');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ─────────────────────────────────────────────────────────────
// CLOCK
// ─────────────────────────────────────────────────────────────

/**
 * อัปเดต #clock element ด้วยเวลาปัจจุบัน
 */
function updateClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleTimeString('th-TH');
}

// ─────────────────────────────────────────────────────────────
// PAGE ROUTING HELPER
// ─────────────────────────────────────────────────────────────

let _activePage = 'dashboard';

/**
 * สลับหน้า (ซ่อน/แสดง .page element)
 * @param {string} pageId   ชื่อหน้า เช่น 'dashboard' | 'fan' | 'fumigation'
 * @param {HTMLElement} [btn]  ปุ่ม nav ที่คลิก (เพื่อเพิ่ม .active)
 */
function showPage(pageId, btn) {
  // ซ่อนทุกหน้า
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // แสดงหน้าที่เลือก
  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');
  // อัปเดต active nav button
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _activePage = pageId;
  // เรียก render ของหน้านั้น
  renderCurrentPage(pageId);
}

/**
 * Re-render หน้าปัจจุบัน (ใช้หลัง setLang)
 * @param {string} [pageId]
 */
function renderCurrentPage(pageId) {
  const page = pageId || _activePage;
  switch (page) {
    case 'dashboard':  if (typeof renderSilos === 'function') renderSilos(); break;
    case 'fan':        if (typeof renderFans === 'function') renderFans(); break;
    case 'quality':    if (typeof renderQuality === 'function') renderQuality(); break;
    case 'report':     if (typeof renderReport === 'function') renderReport(); break;
    case 'fumigation': if (typeof renderFumigation === 'function') renderFumigation(); break;
    case 'planner':    if (typeof renderPlanner === 'function') renderPlanner(); break;
    case 'predict':    if (typeof PREDICT !== 'undefined') PREDICT.renderPredictPage(); break;
    case 'analytics':  if (typeof renderAnalytics === 'function') renderAnalytics(); break;
  }
}

// ─────────────────────────────────────────────────────────────
// DOM HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * สร้าง HTML element แบบง่าย
 * @param {string} tag
 * @param {string} [cls]
 * @param {string} [html]
 * @returns {HTMLElement}
 */
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

/**
 * เพิ่ม event listener แบบ shorthand
 * @param {string} id
 * @param {string} event
 * @param {Function} fn
 */
function on(id, event, fn) {
  const e = document.getElementById(id);
  if (e) e.addEventListener(event, fn);
}

// ─────────────────────────────────────────────────────────────
// CONVEYOR / ROUTE HELPERS (ใช้ร่วมกับ jobs.js และ plc.js)
// ─────────────────────────────────────────────────────────────

/**
 * หา LINE ที่ถังอยู่
 * @param {string} siloCode  เช่น 'S01' | 'R03'
 * @returns {string}         เช่น 'LINE-1'
 */
function getLine(siloCode) {
  return CONFIG.CONV_LINE_MAP[siloCode] || null;
}

/**
 * คำนวณเส้นทางสายพานระหว่างสองถัง
 * - ถ้าอยู่ LINE เดียวกัน → [LINE-x]
 * - ถ้าต่าง LINE → [LINE-from, MAIN, LINE-to]
 * @param {string} from  silo code
 * @param {string} to    silo code
 * @returns {string[]}   เช่น ['LINE-1'] หรือ ['LINE-1','MAIN','LINE-2']
 */
function getRoute(from, to) {
  const lf = getLine(from);
  const lt = getLine(to);
  if (!lf || !lt) return [];
  return lf === lt ? [lf] : [lf, 'MAIN', lt];
}

/**
 * คำนวณระยะเวลา job จากปริมาณตัน (ชั่วโมง)
 * @param {number} tons
 * @returns {number}
 */
function jobDurH(tons) {
  return Math.max(0.5, tons / CONFIG.TRANSFER_RATE_TPH);
}
