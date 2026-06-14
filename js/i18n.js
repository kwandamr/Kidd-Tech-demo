/**
 * ═══════════════════════════════════════════════════════════════
 * i18n.js — Internationalisation (EN / TH)
 * ═══════════════════════════════════════════════════════════════
 * วิธีใช้งาน:
 *   T('nav.dashboard')          → 'แดชบอร์ด'  (ภาษาปัจจุบัน)
 *   setLang('en')               → เปลี่ยนภาษา + re-render
 *   applyI18n()                 → อัปเดต DOM ทุก [data-i18n] element
 *
 * เพิ่ม key ใหม่: ใส่ทั้ง en: { } และ th: { } เสมอ
 * Dependencies: ไม่มี (โหลดก่อนทุกไฟล์)
 * ═══════════════════════════════════════════════════════════════
 */

// ── Translation Map ────────────────────────────────────────────
const I18N = {
  en: {
    // Navigation
    'nav.dashboard':  '🏠 Dashboard',
    'nav.fan':        '💨 Fan Control',
    'nav.quality':    '🌿 Grain Quality',
    'nav.report':     '📊 Reports & Energy',
    'nav.fumigation': '🧪 Fumigation',
    'nav.planner':    '📋 Planning Board',
    'nav.company':    'Kid-D Tech | Silo Management',

    // Dashboard summary cards
    'dash.normalLabel': 'Normal (Green)',
    'dash.warnLabel':   'Warning (Yellow)',
    'dash.critLabel':   'Critical (Red)',
    'dash.co2Label':    'CO₂ Alert / Critical',
    'dash.bins':        'bins',
    'dash.actRequired': 'bins — Action Required!',
    'dash.co2risk':     'bins — Insect/Mold Risk',
    'dash.overview':    'All Silos Overview',
    'dash.all':         'All',
    'dash.alert':       '🔴 Alert',
    'dash.watch':       '🟡 Watch',
    'dash.ok':          '🟢 Normal',

    // Silo detail page
    'det.back':       '← Back to Dashboard',
    'det.matrixTitle':'🌡 All Sensors — Matrix View',
    'det.trendTitle': '📈 24h Trend — Temperature & CO₂',
    'det.infoTitle':  'ℹ️ Bin Info & Inventory',
    'det.avgTemp':    'Avg Temp',
    'det.co2ppm':     'CO₂ (ppm)',
    'det.moisture':   'Grain Moisture',
    'det.co2high':    '⚠ Very High — Urgent!',
    'det.co2rise':    '⚠ Rising',
    'det.co2ok':      'Normal',
    'det.moistHigh':  '⚠ Over Limit — Mold Risk',
    'det.moistOk':    'Safe (< 13.5%)',
    'det.fillLevel':  'Fill Level',
    'det.cable':      'Cables',
    'det.maxTemp':    'Max Temp',
    'det.fanStatus':  'Fan Status',
    'det.fanOn':      '💨 ON (EMC Auto)',
    'det.fanOff':     '— OFF',
    'det.grainType':  'Grain Type',

    // Fan Control page
    'fan.fansOn':       'Fans Running',
    'fan.fansOff':      'Fans Off',
    'fan.units':        'units (Auto mode)',
    'fan.units2':       'units',
    'fan.totalPower':   'Total Power',
    'fan.current':      'now',
    'fan.autoAll':      'All bins auto-controlled',
    'fan.controlTitle': 'Fan Control per Bin',
    'fan.openAt':       'Open at (°C)',
    'fan.closeAt':      'Close at (°C)',
    'fan.on':           'ON',
    'fan.off':          'OFF',
    'fan.open':         'Open',
    'fan.close':        'Closed',
    'fan.reasonHigh':   '🔴 EMC: Temp+CO₂ Critical',
    'fan.reasonGood':   '✅ EMC: Conditions Favorable',
    'fan.reasonHumid':  '💧 EMC: Outside humid — NOT opening',
    'fan.reasonIdle':   '💤 EMC: Temperature Normal',

    // Grain Quality page
    'q.co2crit':     'CO₂ Critical (> 1500 ppm)',
    'q.co2warn':     'CO₂ Warning (800–1500 ppm)',
    'q.moistWarn':   'Moisture Exceeded (> 13.5%)',
    'q.totalGrain':  'Total Grain in Storage',
    'q.bins':        'bins — Insect/Mold Risk',
    'q.binsWarn':    'bins — Monitor closely',
    'q.binsM':       'bins — Aflatoxin Risk',
    'q.tonnes':      'tonnes | Avg fill',
    'q.tempCrit':    '🌡 Temp Critical Bins',
    'q.tempWarn':    '⚠️ Temp Warning Bins',
    'q.tempCritSub': 'bins — Action Required!',
    'q.tempWarnSub': 'bins — Monitor closely',
    'q.sensorLocked':'Sensor Not Installed',
    'q.co2Locked':   'CO₂ monitoring locked',
    'q.moistLocked': 'Moisture monitoring locked',
    'q.phase1Title': 'Phase 1 — Temperature Monitoring',
    'q.phase1Active':'✅ Active Now',
    'q.phase2Title': 'Phase 2 — CO₂ & Moisture Sensors',
    'q.phase2Lock':  '🔒 Upgrade Available',
    'q.phase1Feats': ['✅ 24/7 multi-point temperature','✅ Cable sensor matrix (8 pts/cable)','✅ EMC fan auto-control','✅ Alarm & LINE notification'],
    'q.phase2Feats': ['🔒 CO₂ concentration (ppm)','🔒 Grain moisture content (%)','🔒 Insect & mold risk scoring','🔒 Aflatoxin risk monitoring'],
    'q.upgradeCta':  '📞 Contact us to upgrade',
    'q.upgradeTitle':'Sensor Upgrade Required',
    'q.upgradeSub':  'Add CO₂ and moisture sensors to unlock this view. Contact our team for pricing and installation details.',
    'q.weather':     '🌤 Outdoor Conditions & EMC Aeration Control',
    'q.updated':     'Updated: just now',
    'q.outdoorTemp': '🌡 Outdoor Temp',
    'q.outside':     'Outside plant',
    'q.humidity':    '💧 Relative Humidity',
    'q.rhOut':       'RH Outdoor',
    'q.emcTarget':   '⚖️ EMC Target',
    'q.fansOk':      '✅ Fans Allowed',
    'q.fansOkVal':   '11 Bins',
    'q.emcBenefit':  'EMC Beneficial',
    'q.emcExplain':  '💡 <strong style="color:#22d3ee">EMC Logic:</strong> Fans will ONLY activate when outdoor humidity is low enough to actually draw moisture OUT of the grain — not just based on temperature alone. This saves energy and prevents grain from re-absorbing moisture back from humid air.',
    'q.grainStatus': '🌾 Grain Quality Status — All Bins',
    'q.filterCo2':   '🟠 CO₂ Alert',
    'q.filterMois':  '💧 High Moisture',
    'q.temp':        'Temp',
    'q.fill':        'Fill',

    // Reports & Energy page
    'r.allPlant':    '🏭 Entire Plant',
    'r.daily':       'Daily',
    'r.monthly':     'Monthly',
    'r.yearly':      'Yearly',
    'r.fanMapTitle': '🗺 Fan Mapping — Meter → Silo → Fan Status',
    'r.alarmLog':    '📋 Alarm Log',
    'r.export':      '📥 Export PDF',
    'r.exporting':   'Exporting PDF...',
    'r.energyToday': 'Energy Today',
    'r.energyMonth': 'Energy This Month',
    'r.energyYear':  'Energy This Year',
    'r.estCost':     'Estimated Cost',
    'r.activeFans':  'Active Fans',
    'r.avgTemp':     'Avg Temp',
    'r.allMeters':   '🔌 All Meters',
    'r.meterInfo':   '🔌 Meter Info',
    'r.today':       'Today kWh',
    'r.fansActive':  'Active Fans',
    'r.binCount':    'Bin Count',
    'r.tableCol':    ['Bin','Meter','Temp','Status','Fan','Sensors'],
    'r.statusCrit':  'Critical',
    'r.statusWarn':  'Warning',
    'r.statusOk':    'Normal',
    'r.zoneName':    { all:'Entire Plant', A:'Zone A — North', B:'Zone B — East', C:'Zone C — South', D:'Zone D — West' },

    // Shared
    'grainTypes':    ['Paddy Rice','Milled Rice','Corn','Wheat','Millet','Sorghum'],
    'status.ok':     'Normal',
    'status.warn':   '⚠ Watch',
    'status.crit':   '🚨 Critical',
    'silo.fanOn':    '💨 ON',
    'silo.fanOff':   '— OFF',
    'alarm.fanAuto': '▶ Fan auto-opened',
    'alarm.lineAlert':'▶ LINE Notify sent',
    'alarm.watching':'▶ Monitoring',
    'alarm.fanClose':'▶ Fan auto-closed',
    'alarm.pdfGen':  '▶ Daily report generated',

    // Fumigation page
    'fum.title':        '🧪 Fumigation Status — All Silos',
    'fum.overdue':      '🔴 Overdue',
    'fum.soon':         '🟡 Due Soon',
    'fum.ok':           '🟢 OK',
    'fum.active':       '🟠 Active',
    'fum.startBtn':     '▶ Start Fumigation',
    'fum.completeBtn':  '✅ Mark Complete',
    'fum.lastDate':     'Last fumigated:',
    'fum.days':         'days ago',
    'fum.kpiOverdue':   'Overdue (> 45 days)',
    'fum.kpiSoon':      'Due Soon (35–44 days)',
    'fum.kpiActive':    'Currently Fumigating',
    'fum.kpiOk':        'OK (< 35 days)',
    'fum.logTitle':     '📋 Fumigation Log — History',

    // Planning Board
    'plan.title':       '📋 Planning Board',
    'plan.sub':         'Manage transfer jobs · FIFO/LIFO · Silo scheduling',
    'plan.newJob':      '➕ New Transfer Job',
    'plan.inprog':      '⚙ In Progress',
    'plan.sched':       '📅 Scheduled',
    'plan.done':        '✅ Done Today',
    'plan.all':         '📋 Total Jobs',
    'plan.ganttTitle':  '📊 Gantt Schedule — Today',
    'plan.fifoTitle':   '📦 FIFO / LIFO — Withdrawal Order',
    'plan.recsTitle':   '💡 AI Recommendations',
    'plan.jobBoard':    '🚛 Job Board — Transfer Jobs',
    'plan.plcTitle':    '🖥 PLC Interlock Status — Real-time Equipment',
    'plan.exportPlan':  '📥 Export Plan',
  },

  th: {
    // Navigation
    'nav.dashboard':  '🏠 แดชบอร์ด',
    'nav.fan':        '💨 ควบคุมพัดลม',
    'nav.quality':    '🌿 คุณภาพเมล็ดพืช',
    'nav.report':     '📊 รายงาน & Energy',
    'nav.fumigation': '🧪 การอบยา',
    'nav.planner':    '📋 Planning Board',
    'nav.company':    'Kid-D Tech | จัดการไซโล',

    // Dashboard summary cards
    'dash.normalLabel': 'ปกติ (เขียว)',
    'dash.warnLabel':   'เตือน (เหลือง)',
    'dash.critLabel':   'วิกฤต (แดง)',
    'dash.co2Label':    'CO₂ เตือน / วิกฤต',
    'dash.bins':        'ถัง',
    'dash.actRequired': 'ถัง — ต้องดำเนินการ!',
    'dash.co2risk':     'ถัง — เสี่ยงแมลง/เชื้อรา',
    'dash.overview':    'ภาพรวมถังไซโลทั้งหมด',
    'dash.all':         'ทั้งหมด',
    'dash.alert':       '🔴 แจ้งเตือน',
    'dash.watch':       '🟡 เฝ้าระวัง',
    'dash.ok':          '🟢 ปกติ',

    // Silo detail page
    'det.back':       '← กลับ Dashboard',
    'det.matrixTitle':'🌡 อุณหภูมิทุก Sensor (Matrix View)',
    'det.trendTitle': '📈 Trend 24 ชั่วโมง — อุณหภูมิ & CO₂',
    'det.infoTitle':  'ℹ️ ข้อมูลถัง & Inventory',
    'det.avgTemp':    'อุณหภูมิเฉลี่ย',
    'det.co2ppm':     'CO₂ (ppm)',
    'det.moisture':   'ความชื้นเมล็ดพืช',
    'det.co2high':    '⚠ สูงมาก — ตรวจสอบด่วน',
    'det.co2rise':    '⚠ เพิ่มขึ้น',
    'det.co2ok':      'ปกติ',
    'det.moistHigh':  '⚠ ชื้นเกิน — เสี่ยงเชื้อรา',
    'det.moistOk':    'เหมาะสม (< 13.5%)',
    'det.fillLevel':  'ระดับความเต็ม (Fill Level)',
    'det.cable':      'Cable',
    'det.maxTemp':    'อุณหภูมิสูงสุด',
    'det.fanStatus':  'สถานะพัดลม',
    'det.fanOn':      '💨 เปิด (EMC Auto)',
    'det.fanOff':     '— ปิด',
    'det.grainType':  'ชนิดเมล็ดพืช',

    // Fan Control page
    'fan.fansOn':       'พัดลมเปิด',
    'fan.fansOff':      'พัดลมปิด',
    'fan.units':        'ตัว (Auto mode)',
    'fan.units2':       'ตัว',
    'fan.totalPower':   'กำลังไฟทั้งหมด',
    'fan.current':      'ขณะนี้',
    'fan.autoAll':      'ทุกถังควบคุมอัตโนมัติ',
    'fan.controlTitle': 'ควบคุมพัดลมแต่ละถัง',
    'fan.openAt':       'เปิดที่ (°C)',
    'fan.closeAt':      'ปิดที่ (°C)',
    'fan.on':           'ON',
    'fan.off':          'OFF',
    'fan.open':         'เปิด',
    'fan.close':        'ปิด',
    'fan.reasonHigh':   '🔴 EMC: Temp+CO₂ สูงมาก',
    'fan.reasonGood':   '✅ EMC: อากาศเหมาะ ดูดชื้นได้',
    'fan.reasonHumid':  '💧 EMC: ชื้นนอก > ชื้นใน ไม่เปิด',
    'fan.reasonIdle':   '💤 EMC: อุณหภูมิปกติ',

    // Grain Quality page
    'q.co2crit':     'CO₂ วิกฤต (> 1500 ppm)',
    'q.co2warn':     'CO₂ เตือน (800–1500 ppm)',
    'q.moistWarn':   'ความชื้นเกินเกณฑ์ (> 13.5%)',
    'q.totalGrain':  'ปริมาณเมล็ดพืชรวม',
    'q.bins':        'ถัง — เสี่ยงแมลง/เชื้อรา',
    'q.binsWarn':    'ถัง — เฝ้าระวัง',
    'q.binsM':       'ถัง — เสี่ยง Aflatoxin',
    'q.tonnes':      'ตัน | เฉลี่ยเต็ม',
    'q.tempCrit':    '🌡 ถังอุณหภูมิวิกฤต',
    'q.tempWarn':    '⚠️ ถังอุณหภูมิเตือน',
    'q.tempCritSub': 'ถัง — ต้องดำเนินการ!',
    'q.tempWarnSub': 'ถัง — ต้องเฝ้าระวัง',
    'q.sensorLocked':'ยังไม่ได้ติด Sensor',
    'q.co2Locked':   'CO₂ ล็อกอยู่',
    'q.moistLocked': 'ความชื้นล็อกอยู่',
    'q.phase1Title': 'Phase 1 — ตรวจสอบอุณหภูมิ',
    'q.phase1Active':'✅ ใช้งานได้แล้ว',
    'q.phase2Title': 'Phase 2 — CO₂ & Moisture Sensors',
    'q.phase2Lock':  '🔒 อัปเกรดได้',
    'q.phase1Feats': ['✅ ตรวจอุณหภูมิ 24/7 หลายจุด','✅ Cable sensor matrix (8 จุด/cable)','✅ ควบคุมพัดลม EMC อัตโนมัติ','✅ แจ้งเตือน Alarm & LINE Notify'],
    'q.phase2Feats': ['🔒 วัดความเข้มข้น CO₂ (ppm)','🔒 วัดความชื้นเมล็ดพืช (%)','🔒 ประเมินความเสี่ยงแมลง/เชื้อรา','🔒 ติดตาม Aflatoxin'],
    'q.upgradeCta':  '📞 สอบถามการอัปเกรด',
    'q.upgradeTitle':'ต้องการ Sensor เพิ่มเติม',
    'q.upgradeSub':  'ติด CO₂ และ Moisture sensor เพื่อเปิดใช้งานส่วนนี้ ติดต่อทีมงานเพื่อดูราคาและรายละเอียดการติดตั้ง',
    'q.weather':     '🌤 สภาพอากาศภายนอก & EMC Aeration Control',
    'q.updated':     'อัปเดต: เมื่อสักครู่',
    'q.outdoorTemp': '🌡 อุณหภูมิอากาศ',
    'q.outside':     'ภายนอกโรงงาน',
    'q.humidity':    '💧 ความชื้นสัมพัทธ์',
    'q.rhOut':       'RH ภายนอก',
    'q.emcTarget':   '⚖️ EMC เป้าหมาย',
    'q.fansOk':      '✅ เปิดพัดลมได้',
    'q.fansOkVal':   '11 ถัง',
    'q.emcBenefit':  'EMC เป็นผลดี',
    'q.emcExplain':  '💡 <strong style="color:#22d3ee">EMC Logic:</strong> พัดลมจะเปิดก็ต่อเมื่อ ความชื้นอากาศภายนอกต่ำพอที่จะดูดซับความชื้นออกจากเมล็ดพืชได้จริง — ไม่ใช่แค่เปิดตามอุณหภูมิ ซึ่งช่วยประหยัดพลังงานและป้องกันไม่ให้เมล็ดพืชดูดซับความชื้นกลับเข้าไป',
    'q.grainStatus': '🌾 สถานะคุณภาพเมล็ดพืชทุกถัง',
    'q.filterCo2':   '🟠 CO₂ เตือน',
    'q.filterMois':  '💧 ความชื้นสูง',
    'q.temp':        'อุณหภูมิ',
    'q.fill':        'เต็ม',

    // Reports & Energy page
    'r.allPlant':    '🏭 ทั้งโรงงาน',
    'r.daily':       'รายวัน',
    'r.monthly':     'รายเดือน',
    'r.yearly':      'รายปี',
    'r.fanMapTitle': '🗺 Fan Mapping — Meter → Silo → สถานะพัดลม',
    'r.alarmLog':    '📋 Alarm Log',
    'r.export':      '📥 Export PDF',
    'r.exporting':   'กำลัง Export PDF...',
    'r.energyToday': 'การใช้ไฟฟ้าวันนี้',
    'r.energyMonth': 'ไฟฟ้าเดือนนี้',
    'r.energyYear':  'ไฟฟ้าปีนี้',
    'r.estCost':     'ค่าไฟโดยประมาณ',
    'r.activeFans':  'พัดลมทำงานอยู่',
    'r.avgTemp':     'อุณหภูมิเฉลี่ย',
    'r.allMeters':   '🔌 มิเตอร์ทั้งหมด',
    'r.meterInfo':   '🔌 ข้อมูลมิเตอร์',
    'r.today':       'kWh วันนี้',
    'r.fansActive':  'พัดลมทำงาน',
    'r.binCount':    'จำนวนถัง',
    'r.tableCol':    ['ถัง','มิเตอร์','อุณหภูมิ','สถานะ','พัดลม','Sensor'],
    'r.statusCrit':  'วิกฤต',
    'r.statusWarn':  'เฝ้าระวัง',
    'r.statusOk':    'ปกติ',
    'r.zoneName':    { all:'ทั้งโรงงาน', A:'Zone A — เหนือ', B:'Zone B — ตะวันออก', C:'Zone C — ใต้', D:'Zone D — ตะวันตก' },

    // Shared
    'grainTypes':    ['ข้าวเปลือก','ข้าวสาร','ข้าวโพด','ข้าวสาลี','ลูกเดือย','ข้าวฟ่าง'],
    'status.ok':     'ปกติ',
    'status.warn':   '⚠ เฝ้าระวัง',
    'status.crit':   '🚨 วิกฤต',
    'silo.fanOn':    '💨 พัดลมเปิด',
    'silo.fanOff':   '— พัดลมปิด',
    'alarm.fanAuto': '▶ พัดลมเปิดอัตโนมัติ',
    'alarm.lineAlert':'▶ แจ้งเตือน LINE',
    'alarm.watching':'▶ เฝ้าระวัง',
    'alarm.fanClose':'▶ พัดลมปิดอัตโนมัติ',
    'alarm.pdfGen':  '▶ สร้างรายงานประจำวัน',

    // Fumigation page
    'fum.title':        '🧪 สถานะการอบยา — ทุกถัง',
    'fum.overdue':      '🔴 เกินกำหนด',
    'fum.soon':         '🟡 ใกล้ถึงกำหนด',
    'fum.ok':           '🟢 ปกติ',
    'fum.active':       '🟠 กำลังอบอยู่',
    'fum.startBtn':     '▶ เริ่มอบยา',
    'fum.completeBtn':  '✅ เสร็จสิ้น',
    'fum.lastDate':     'อบยาครั้งล่าสุด:',
    'fum.days':         'วันที่แล้ว',
    'fum.kpiOverdue':   'เกินกำหนด (> 45 วัน)',
    'fum.kpiSoon':      'ใกล้กำหนด (35–44 วัน)',
    'fum.kpiActive':    'กำลังอบอยู่',
    'fum.kpiOk':        'ปกติ (< 35 วัน)',
    'fum.logTitle':     '📋 ประวัติการอบยา',

    // Planning Board
    'plan.title':       '📋 Planning Board',
    'plan.sub':         'จัดการงานถ่ายวนถัง · FIFO/LIFO · วางแผนการใช้ถัง',
    'plan.newJob':      '➕ สร้าง Job ถ่ายวนถัง',
    'plan.inprog':      '⚙ กำลังดำเนินการ',
    'plan.sched':       '📅 รอดำเนินการ',
    'plan.done':        '✅ เสร็จสิ้นวันนี้',
    'plan.all':         '📋 Job ทั้งหมด',
    'plan.ganttTitle':  '📊 Gantt Schedule — ตารางงานวันนี้',
    'plan.fifoTitle':   '📦 FIFO / LIFO — ลำดับการนำออก',
    'plan.recsTitle':   '💡 AI Recommendations — คำแนะนำ',
    'plan.jobBoard':    '🚛 Job Board — ถ่ายวนถัง',
    'plan.plcTitle':    '🖥 PLC Interlock Status — สถานะอุปกรณ์ Real-time',
    'plan.exportPlan':  '📥 Export Plan',
  },
};

// ─────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────
let currentLang = CONFIG.DEFAULT_LANG || 'th';

// ─────────────────────────────────────────────────────────────
// T() — translate key to current language
// ─────────────────────────────────────────────────────────────
/**
 * ดึง string แปลตาม key
 * @param {string} key  — e.g. 'nav.dashboard'
 * @returns {string}
 */
function T(key) {
  const map = I18N[currentLang];
  return (map && map[key] !== undefined) ? map[key] : key;
}

// ─────────────────────────────────────────────────────────────
// applyI18n() — อัปเดต DOM ทุก element ที่มี data-i18n attribute
// ─────────────────────────────────────────────────────────────
function applyI18n() {
  // อัปเดตข้อความใน element
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = I18N[currentLang]?.[key];
    if (val !== undefined && typeof val === 'string') {
      el.innerHTML = val;
    }
  });

  // อัปเดตปุ่ม EN / TH
  const btnEn = document.getElementById('lang-en');
  const btnTh = document.getElementById('lang-th');
  if (btnEn) {
    btnEn.style.background = currentLang === 'en' ? 'var(--accent)' : 'var(--bg3)';
    btnEn.style.color      = currentLang === 'en' ? 'white' : 'var(--text2)';
  }
  if (btnTh) {
    btnTh.style.background = currentLang === 'th' ? 'var(--accent)' : 'var(--bg3)';
    btnTh.style.color      = currentLang === 'th' ? 'white' : 'var(--text2)';
  }

  // อัปเดต <html lang="…">
  document.documentElement.lang = currentLang;
}

// ─────────────────────────────────────────────────────────────
// setLang() — เปลี่ยนภาษา แล้ว re-render ทุกส่วน
// ─────────────────────────────────────────────────────────────
/**
 * @param {'en'|'th'} lang
 */
function setLang(lang) {
  if (!I18N[lang]) return;
  currentLang = lang;
  applyI18n();
  // แจ้ง module อื่นให้ re-render (ถ้ามี)
  if (typeof renderCurrentPage === 'function') renderCurrentPage();
}
