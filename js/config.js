/**
 * ═══════════════════════════════════════════════════════════════
 * config.js — Kid-D Tech Global Configuration
 * ═══════════════════════════════════════════════════════════════
 * ไฟล์นี้เก็บค่า constant และ threshold ทั้งหมดของระบบ
 * แก้ไขที่นี่จุดเดียว มีผลทั่วทั้งแอป
 *
 * Dependencies: ไม่มี (โหลดก่อนไฟล์อื่นทุกไฟล์)
 * ═══════════════════════════════════════════════════════════════
 */

const CONFIG = {

  // ── App Info ───────────────────────────────────────────────
  APP_NAME:    'Kid-D Tech',
  VERSION:     '1.0.0',
  DEFAULT_LANG: 'th',            // 'th' | 'en'

  // ── Supabase Connection ────────────────────────────────────
  // TODO: แทนที่ด้วยค่าจริงจาก Supabase Dashboard > Settings > API
  SUPABASE_URL: 'https://YOUR-PROJECT-ID.supabase.co',
  SUPABASE_KEY: 'YOUR-ANON-PUBLIC-KEY',

  // เมื่อ DEMO_MODE = true ระบบใช้ mock data แทน Supabase
  // เปลี่ยนเป็น false เมื่อ connect กับ database จริง
  DEMO_MODE: true,

  // ── Temperature Thresholds (°C) ────────────────────────────
  TEMP_OK_MAX:    28,   // ต่ำกว่านี้ = ปกติ (สีเขียว)
  TEMP_WARN_MAX:  34,   // 28-34 = เตือน (สีเหลือง)
  TEMP_CRIT_MIN:  35,   // 35+ = วิกฤต (สีแดง) → fan auto-on

  // ── CO₂ Thresholds (ppm) — Phase 2 ────────────────────────
  CO2_OK_MAX:     400,  // ปกติ
  CO2_WARN_MAX:   600,  // เตือน
  CO2_CRIT_MIN:   800,  // วิกฤต — เสี่ยงแมลง/เชื้อรา

  // ── Moisture Thresholds (%) — Phase 2 ─────────────────────
  MOIS_OK_MAX:    13,   // ปกติ
  MOIS_WARN_MAX:  15,   // เตือน
  MOIS_CRIT_MIN:  16,   // วิกฤต — เสี่ยงเชื้อรา

  // ── Fumigation Schedule ────────────────────────────────────
  FUM_OVERDUE_DAYS: 45, // วัน → ค้างอบยา (สีแดง)
  FUM_SOON_DAYS:    35, // วัน → ใกล้กำหนด (สีส้ม)

  // ── Silo Fill Level ────────────────────────────────────────
  FILL_FULL_PCT: 85,    // % → เกือบเต็ม (สีแดง)
  FILL_MID_PCT:  60,    // % → ปานกลาง (สีเหลือง)
  // ต่ำกว่า FILL_MID_PCT → ปกติ (สีเขียว)

  // ── Transfer / Conveyor ────────────────────────────────────
  TRANSFER_RATE_TPH: 100,    // ตัน/ชั่วโมง (อัตราสายพาน default)
  MIN_TRANSFER_TONS: 10,     // ตันขั้นต่ำต่อ job

  // ── Gantt Chart ────────────────────────────────────────────
  GANTT_START_H:  6,    // ชั่วโมงเริ่มต้นที่แสดง (06:00)
  GANTT_END_H:    22,   // ชั่วโมงสิ้นสุดที่แสดง (22:00)
  GANTT_HOUR_PX:  80,   // pixel ต่อ 1 ชั่วโมง
  GANTT_SNAP_MIN: 15,   // snap ทุก 15 นาทีเมื่อลาก

  // ── Conveyor Line Map ──────────────────────────────────────
  // กำหนดว่าถังไหนอยู่ใน LINE ไหน (ใช้คำนวณ route + interlock)
  CONV_LINE_MAP: {
    // ถังยาว แถว A (Bucket Elevator + Belt)
    'S01': 'LINE-1', 'S02': 'LINE-1', 'S03': 'LINE-1',
    'S04': 'LINE-1', 'S05': 'LINE-1', 'S06': 'LINE-1',
    // ถังยาว แถว B
    'S07': 'LINE-2', 'S08': 'LINE-2', 'S09': 'LINE-2',
    'S10': 'LINE-2', 'S11': 'LINE-2', 'S12': 'LINE-2',
    // ถังกลม (Drag Chain)
    'R01': 'LINE-3', 'R02': 'LINE-3', 'R03': 'LINE-3', 'R04': 'LINE-3',
    'R05': 'LINE-3', 'R06': 'LINE-3', 'R07': 'LINE-3', 'R08': 'LINE-3',
  },

  // ── Equipment Metadata (แสดงใน PLC Panel + Tooltip) ───────
  EQUIPMENT_META: {
    'LINE-1': { label: 'LINE-1  (S01–S06)', icon: '⚙', desc: 'Bucket Elevator + Belt — ถังยาว แถว A' },
    'LINE-2': { label: 'LINE-2  (S07–S12)', icon: '⚙', desc: 'Bucket Elevator + Belt — ถังยาว แถว B' },
    'LINE-3': { label: 'LINE-3  (R01–R08)', icon: '⚙', desc: 'Drag Chain — ถังกลม'                   },
    'MAIN':   { label: 'MAIN CONV',         icon: '🔗', desc: 'สายพานหลัก — Cross-line transfer'      },
  },

  // LINE ทั้งหมดที่แสดงใน PLC Panel
  EQUIPMENT_LIST: ['LINE-1', 'LINE-2', 'LINE-3', 'MAIN'],

  // ── Sensor Read Interval ───────────────────────────────────
  // ในระบบ production: Node-RED อ่านจาก PLC ทุก X วินาที
  SENSOR_INTERVAL_SEC:  60,   // อ่านทุก 60 วินาที
  DASHBOARD_REFRESH_MS: 30000, // refresh dashboard ทุก 30 วินาที

  // ── Admin PIN ──────────────────────────────────────────────
  // PIN 4 หลัก ใช้ล็อกการแก้ไข parameter ทุก อย่าง
  // เปลี่ยนก่อน deploy — ห้ามใช้ 1234 ใน production
  ADMIN_PIN: '1234',
};

// Freeze เพื่อป้องกันการแก้ไขโดยไม่ตั้งใจ
Object.freeze(CONFIG);
