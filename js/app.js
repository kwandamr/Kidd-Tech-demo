/**
 * ═══════════════════════════════════════════════════════════════
 * app.js — Main Application Entry Point
 * ═══════════════════════════════════════════════════════════════
 * โหลดหลังสุด — รวม init ทั้งหมด:
 *   1. applyI18n()          — อัปเดต UI ตามภาษา
 *   2. renderSilos()        — dashboard silo grid
 *   3. renderFans()         — fan control page (lazy)
 *   4. renderQuality()      — grain quality page (lazy)
 *   5. renderReport()       — reports page (lazy)
 *   6. renderFumigation()   — fumigation page (lazy)
 *   7. renderPlanner()      — planning board (lazy)
 *   8. setInterval clock    — อัปเดต clock ทุก 1 วินาที
 *   9. DB.subscribeToSensors — realtime sensor polling
 *  10. setInterval dashboard — refresh ทุก DASHBOARD_REFRESH_MS
 *
 * Dependencies: ทุกไฟล์โหลดก่อนหน้า
 * ═══════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────

(async function init() {

  // ── 1. ภาษา ──────────────────────────────────────────────
  applyI18n();

  // ── 2. Dashboard (หน้าแรก) ───────────────────────────────
  await renderSilos();

  // ── 3. Clock (nav + statusbar) ───────────────────────────
  function _updateAllClocks() {
    updateClock();  // nav clock (#clock)
    const sbClock = document.getElementById('sb-clock');
    if (sbClock) sbClock.textContent = new Date().toLocaleTimeString('th-TH');
  }
  _updateAllClocks();
  setInterval(_updateAllClocks, 1000);

  // ── 4. Realtime sensor subscription ──────────────────────
  // Demo mode → จำลอง polling ทุก SENSOR_INTERVAL_SEC
  // Production → Supabase realtime
  const _sensorSub = DB.subscribeToSensors(payload => {
    // อัปเดต silo ใน cache เมื่อมีค่าใหม่
    if (payload?.new?.silo_id) {
      const cached = _silosCache.find(s => s.id === payload.new.silo_id);
      if (cached) {
        cached.temp = parseFloat(payload.new.temp_celsius) || cached.temp;
      }
    }
  });

  // ── 5. Auto-refresh dashboard ─────────────────────────────
  setInterval(() => {
    if (_activePage === 'dashboard') renderSilos();
  }, CONFIG.DASHBOARD_REFRESH_MS);

  // ── 6. Lazy init หน้าอื่น ─────────────────────────────────
  // รอให้ page แสดงก่อนค่อย render (เพื่อไม่ block first paint)
  setTimeout(async () => {
    await renderFumigation();
    await renderReport();
  }, 500);

})();

// ─────────────────────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────
// D → Dashboard, F → Fan, Q → Quality, R → Report, P → Planner
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const map = {
    'd': ['dashboard', 'nb-dashboard'],
    'f': ['fan',        'nb-fan'],
    'q': ['quality',    'nb-quality'],
    'r': ['report',     'nb-report'],
    'u': ['fumigation', 'nb-fumigation'],
    'p': ['planner',    'nb-planner'],
  };
  const entry = map[e.key.toLowerCase()];
  if (entry) {
    const btn = document.getElementById(entry[1]);
    showPage(entry[0], btn);
  }
});

// ─────────────────────────────────────────────────────────────
// WINDOW RESIZE → re-render Gantt
// ─────────────────────────────────────────────────────────────
let _resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    if (_activePage === 'dashboard' && typeof _syncDashboardTop === 'function') _syncDashboardTop();
  }, 200);
});

// ─────────────────────────────────────────────────────────────
// DEMO MODE BANNER
// ─────────────────────────────────────────────────────────────
if (CONFIG.DEMO_MODE) {
  const banner = document.getElementById('demo-banner');
  if (banner) banner.style.display = 'block';
}
