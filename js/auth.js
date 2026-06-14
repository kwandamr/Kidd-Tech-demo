/**
 * ═══════════════════════════════════════════════════════════════
 * auth.js — Admin PIN Gate
 * ═══════════════════════════════════════════════════════════════
 * กั้นการแก้ไข parameter (Bin Info, Alert Rules, ฯลฯ) ด้วย PIN
 * PIN กำหนดใน CONFIG.ADMIN_PIN
 * Session เก็บใน sessionStorage → ปิด tab = ต้องใส่ PIN ใหม่
 *
 * วิธีใช้:
 *   AUTH.requireAdmin(() => doSomethingProtected());
 *
 * Dependencies: config.js, utils.js (showToast)
 * ═══════════════════════════════════════════════════════════════
 */

const AUTH = (() => {

  const _SESSION_KEY = 'kid_d_admin_ok';

  // ─────────────────────────────────────────────────────────────
  // STATE HELPERS
  // ─────────────────────────────────────────────────────────────

  function isUnlocked() {
    return sessionStorage.getItem(_SESSION_KEY) === '1';
  }

  function _unlock() {
    sessionStorage.setItem(_SESSION_KEY, '1');
    _updateNavBtn();
  }

  function lock() {
    sessionStorage.removeItem(_SESSION_KEY);
    _updateNavBtn();
    showToast('🔒 ออกจากโหมด Admin แล้ว', 'ok');
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC GATE
  // ─────────────────────────────────────────────────────────────

  /**
   * requireAdmin(callback)
   * ถ้า session ยัง active → callback() ทันที
   * ถ้าไม่ → เปิด PIN modal → ถูกแล้วค่อย callback()
   */
  function requireAdmin(callback) {
    if (isUnlocked()) {
      callback();
      return;
    }
    _showPinModal(callback);
  }

  // ─────────────────────────────────────────────────────────────
  // PIN MODAL
  // ─────────────────────────────────────────────────────────────

  let _pendingCb = null;

  function _showPinModal(callback) {
    _pendingCb = callback;
    const modal = document.getElementById('pin-modal');
    const inp   = document.getElementById('pin-inp');
    const err   = document.getElementById('pin-err');
    if (!modal) return;
    if (inp) { inp.value = ''; inp.style.borderColor = ''; }
    if (err) err.textContent = '';
    modal.classList.add('open');
    // dots reset
    _updateDots('');
    setTimeout(() => inp?.focus(), 80);
  }

  function _hidePinModal() {
    const modal = document.getElementById('pin-modal');
    if (modal) modal.classList.remove('open');
    _pendingCb = null;
  }

  /** เรียกจากปุ่ม numpad หรือ keyboard */
  function pinKey(val) {
    const inp = document.getElementById('pin-inp');
    if (!inp) return;
    if (inp.value.length >= 4) return;
    inp.value += val;
    _updateDots(inp.value);
    if (inp.value.length === 4) {
      // auto-confirm หลังใส่ครบ 4 หลัก
      setTimeout(confirmPin, 120);
    }
  }

  function pinBackspace() {
    const inp = document.getElementById('pin-inp');
    if (!inp) return;
    inp.value = inp.value.slice(0, -1);
    _updateDots(inp.value);
  }

  function _updateDots(val) {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((d, i) => {
      d.classList.toggle('filled', i < val.length);
    });
  }

  function confirmPin() {
    const inp = document.getElementById('pin-inp');
    const err = document.getElementById('pin-err');
    const pin = inp?.value || '';

    if (pin === String(CONFIG.ADMIN_PIN)) {
      _unlock();
      _hidePinModal();
      showToast('🔓 Admin mode เปิดแล้ว', 'ok');
      if (_pendingCb) { _pendingCb(); _pendingCb = null; }
    } else {
      // shake + reset
      const dotsWrap = document.getElementById('pin-dots');
      if (dotsWrap) {
        dotsWrap.classList.add('pin-shake');
        setTimeout(() => dotsWrap.classList.remove('pin-shake'), 380);
      }
      if (inp) { inp.value = ''; inp.style.borderColor = '#EF4444'; }
      _updateDots('');
      if (err) err.textContent = 'PIN ไม่ถูกต้อง ลองใหม่';
      setTimeout(() => { if (err) err.textContent = ''; if (inp) inp.style.borderColor = ''; }, 1800);
    }
  }

  function cancelPin() {
    _hidePinModal();
  }

  // ─────────────────────────────────────────────────────────────
  // NAV BUTTON
  // ─────────────────────────────────────────────────────────────

  function _updateNavBtn() {
    const btn = document.getElementById('auth-lock-btn');
    if (!btn) return;
    if (isUnlocked()) {
      btn.innerHTML = '🔓 <span style="font-size:9px">Admin</span>';
      btn.title     = 'คลิกเพื่อล็อก Admin mode';
      btn.style.borderColor = 'rgba(0,191,165,.45)';
      btn.style.color       = 'var(--teal)';
    } else {
      btn.innerHTML = '🔒';
      btn.title     = 'Admin login';
      btn.style.borderColor = '';
      btn.style.color       = '';
    }
  }

  function toggleLock() {
    if (isUnlocked()) lock();
    else requireAdmin(() => {});   // เปิด PIN modal แล้วไม่ทำอะไรหลังผ่าน (แค่ unlock)
  }

  // ─────────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────────

  window.addEventListener('DOMContentLoaded', () => {
    _updateNavBtn();

    // Keyboard support: ตัวเลข + Backspace + Enter + Esc
    const inp = document.getElementById('pin-inp');
    if (inp) {
      inp.addEventListener('keydown', e => {
        e.preventDefault();   // ป้องกัน focus leak
        if (e.key >= '0' && e.key <= '9') pinKey(e.key);
        else if (e.key === 'Backspace')   pinBackspace();
        else if (e.key === 'Enter')        confirmPin();
        else if (e.key === 'Escape')       cancelPin();
      });
    }

    // Click outside to cancel
    const modal = document.getElementById('pin-modal');
    if (modal) {
      modal.addEventListener('click', e => {
        if (e.target === modal) cancelPin();
      });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // EXPORTS
  // ─────────────────────────────────────────────────────────────

  return { requireAdmin, isUnlocked, lock, toggleLock, confirmPin, cancelPin, pinKey, pinBackspace };

})();
