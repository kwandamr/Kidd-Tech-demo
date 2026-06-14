/**
 * ═══════════════════════════════════════════════════════════════
 * alertRules.js — Custom Alert Threshold Rules (Feature 3)
 * ═══════════════════════════════════════════════════════════════
 * ให้ user ตั้ง threshold เองต่างจาก CONFIG defaults
 * เก็บไว้ใน localStorage key: 'kid_d_alert_rules'
 *
 * Dependencies: config.js, utils.js (showToast)
 * ═══════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────
// DEFAULT THRESHOLDS (mirror CONFIG values)
// ─────────────────────────────────────────────────────────────

const _AR_DEFAULTS = {
  temp_warn: 30,     // °C — ตรงกับ CONFIG.TEMP_OK_MAX
  temp_crit: 33,     // °C — ตรงกับ CONFIG.TEMP_CRIT_MIN
  co2_warn:  700,    // ppm — ตรงกับ CONFIG.CO2_WARN_MAX
  co2_crit:  1000,   // ppm — ตรงกับ CONFIG.CO2_CRIT_MIN
  mois_warn: 14.0,   // %  — ตรงกับ CONFIG.MOIS_WARN_MAX
  mois_crit: 15.5,   // %  — ตรงกับ CONFIG.MOIS_CRIT_MIN
};

const _AR_STORAGE_KEY = 'kid_d_alert_rules';
const _AR_META = {
  temp_warn:  { label: 'Temp Warning',  unit: '°C',  min: 20, max: 45, step: 0.5 },
  temp_crit:  { label: 'Temp Critical', unit: '°C',  min: 20, max: 45, step: 0.5 },
  co2_warn:   { label: 'CO₂ Warning',   unit: 'ppm', min: 300, max: 2000, step: 50 },
  co2_crit:   { label: 'CO₂ Critical',  unit: 'ppm', min: 300, max: 2000, step: 50 },
  mois_warn:  { label: 'Moisture Warn', unit: '%',   min: 8, max: 20, step: 0.5 },
  mois_crit:  { label: 'Moisture Crit', unit: '%',   min: 8, max: 20, step: 0.5 },
};

// ── State ──────────────────────────────────────────────────────
let _arRules = null;  // loaded lazily on first openAlertRules()

// ─────────────────────────────────────────────────────────────
// LOAD / SAVE
// ─────────────────────────────────────────────────────────────

function _arLoad() {
  try {
    const raw = localStorage.getItem(_AR_STORAGE_KEY);
    _arRules  = raw
      ? { ..._AR_DEFAULTS, ...JSON.parse(raw) }
      : { ..._AR_DEFAULTS };
  } catch (e) {
    _arRules = { ..._AR_DEFAULTS };
  }
}

function _arSave() {
  try {
    localStorage.setItem(_AR_STORAGE_KEY, JSON.stringify(_arRules));
  } catch (e) {
    console.warn('alertRules: localStorage write failed', e);
  }
}

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────

/**
 * คืนค่า rules ปัจจุบัน — module อื่นเรียกได้ เช่น silos.js
 * @returns {object}
 */
function getAlertRules() {
  if (!_arRules) _arLoad();
  return { ..._arRules };
}

/** เปิด modal กรอก rules */
function openAlertRules() {
  if (!_arRules) _arLoad();
  const m = document.getElementById('alert-rules-modal');
  if (!m) return;

  // Fill inputs with current values
  Object.keys(_AR_DEFAULTS).forEach(k => {
    const inp = document.getElementById('ar-' + k);
    if (inp) {
      inp.value = _arRules[k];
      inp.style.borderColor = '';
    }
  });

  // Update compare column (default values)
  Object.keys(_AR_DEFAULTS).forEach(k => {
    const def = document.getElementById('ar-def-' + k);
    if (def) def.textContent = _AR_DEFAULTS[k];
  });

  m.classList.add('open');
}

/** ปิด modal */
function closeAlertRules() {
  const m = document.getElementById('alert-rules-modal');
  if (m) m.classList.remove('open');
}

/** บันทึก rules จาก inputs */
function saveAlertRules() {
  if (!_arRules) _arLoad();

  // Read + validate inputs
  const next = {};
  let hasError = false;

  Object.keys(_AR_DEFAULTS).forEach(k => {
    const inp = document.getElementById('ar-' + k);
    if (!inp) return;
    const v = parseFloat(inp.value);
    const meta = _AR_META[k];
    if (isNaN(v) || v < meta.min || v > meta.max) {
      inp.style.borderColor = '#EF4444';
      hasError = true;
    } else {
      inp.style.borderColor = '';
      next[k] = v;
    }
  });

  if (hasError) {
    showToast('กรุณากรอกค่าให้ถูกต้อง', 'warn');
    return;
  }

  // Cross-field validation
  if (next.temp_warn  >= next.temp_crit)  { _arHighlight('ar-temp_warn',  'ar-temp_crit');  return; }
  if (next.co2_warn   >= next.co2_crit)   { _arHighlight('ar-co2_warn',   'ar-co2_crit');   return; }
  if (next.mois_warn  >= next.mois_crit)  { _arHighlight('ar-mois_warn',  'ar-mois_crit');  return; }

  _arRules = next;
  _arSave();
  _arUpdateBadge();
  closeAlertRules();
  showToast('✅ บันทึก Alert Rules เรียบร้อย', 'ok');
}

function _arHighlight(idA, idB) {
  [idA, idB].forEach(id => {
    const inp = document.getElementById(id);
    if (inp) { inp.style.borderColor = '#EF4444'; }
  });
  showToast('Warning ต้องน้อยกว่า Critical', 'warn');
}

/** รีเซ็ตกลับค่า default (ไม่บันทึกจนกว่าจะกด บันทึก) */
function resetAlertRules() {
  Object.keys(_AR_DEFAULTS).forEach(k => {
    const inp = document.getElementById('ar-' + k);
    if (inp) { inp.value = _AR_DEFAULTS[k]; inp.style.borderColor = ''; }
  });
  showToast('↺ รีเซ็ตเป็นค่า default แล้ว (ยังไม่ได้บันทึก)', 'ok');
}

// ─────────────────────────────────────────────────────────────
// BADGE — แสดงจำนวน rule ที่เปลี่ยนจาก default
// ─────────────────────────────────────────────────────────────

function _arUpdateBadge() {
  if (!_arRules) _arLoad();
  const changed = Object.keys(_AR_DEFAULTS).filter(k => _arRules[k] !== _AR_DEFAULTS[k]).length;
  const badge   = document.getElementById('ar-badge');
  if (!badge) return;
  if (changed > 0) {
    badge.textContent  = changed;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  _arLoad();
  _arUpdateBadge();
});
