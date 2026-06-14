/**
 * ═══════════════════════════════════════════════════════════════
 * data.js — Mock / Seed Data (DEMO_MODE = true)
 * ═══════════════════════════════════════════════════════════════
 * ข้อมูลจำลองสำหรับ demo ทั้งหมด
 * เมื่อ CONFIG.DEMO_MODE = false ไฟล์นี้จะถูกข้ามทั้งหมด
 * (Supabase จะส่งข้อมูลจริงแทน)
 *
 * Dependencies: config.js (โหลดก่อนไฟล์นี้)
 * ═══════════════════════════════════════════════════════════════
 */

const MOCK_DATA = (() => {

  // ── Silos (S01-S12 ถังยาว | R01-R08 ถังกลม) ──────────────────
  // alarmSilos = อุณหภูมิวิกฤต, warnSilos = อุณหภูมิเตือน
  const _alarmSilos = ['S03', 'R04'];
  const _warnSilos  = ['S07', 'S09', 'S11', 'R02', 'R06', 'R07'];

  function _buildSilo(code, type, zone, line, cap, cables, spc) {
    const isAlarm = _alarmSilos.includes(code);
    const isWarn  = _warnSilos.includes(code);
    const status  = isAlarm ? 'red' : isWarn ? 'yellow' : 'green';
    const temp    = isAlarm
      ? +(35 + Math.random() * 3).toFixed(1)
      : isWarn
        ? +(29 + Math.random() * 4).toFixed(1)
        : +(22 + Math.random() * 6).toFixed(1);
    const co2Base = isAlarm ? 1800 : isWarn ? 700 : 250;
    const co2     = Math.round(co2Base + Math.random() * 300);
    const moist   = isAlarm
      ? +(14 + Math.random() * 2).toFixed(1)
      : isWarn
        ? +(12.5 + Math.random() * 1.5).toFixed(1)
        : +(11 + Math.random() * 1.5).toFixed(1);
    const fillPct = +(40 + Math.random() * 55).toFixed(1);
    const fanOn   = status === 'red' || (status === 'yellow' && Math.random() > 0.5);
    return {
      id: code,
      code,
      silo_type: type,   // 'long' | 'round'
      zone,              // 'A' | 'B' | 'C' | 'D'
      conv_line: line,   // 'LINE-1' | 'LINE-2' | 'LINE-3'
      capacity_tons: cap,
      num_cables: cables,
      sensors_per_cable: spc,
      // runtime state
      status,
      temp,
      fanOn,
      co2,
      moisture: moist,
      fillPct,
    };
  }

  const silos = [
    _buildSilo('S01','long','A','LINE-1',500,2,8),
    _buildSilo('S02','long','A','LINE-1',500,2,8),
    _buildSilo('S03','long','A','LINE-1',500,2,8),
    _buildSilo('S04','long','A','LINE-1',500,2,8),
    _buildSilo('S05','long','A','LINE-1',500,2,8),
    _buildSilo('S06','long','A','LINE-1',500,2,8),
    _buildSilo('S07','long','B','LINE-2',500,2,8),
    _buildSilo('S08','long','B','LINE-2',500,2,8),
    _buildSilo('S09','long','B','LINE-2',500,2,8),
    _buildSilo('S10','long','B','LINE-2',500,2,8),
    _buildSilo('S11','long','B','LINE-2',500,2,8),
    _buildSilo('S12','long','B','LINE-2',500,2,8),
    _buildSilo('R01','round','C','LINE-3',200,1,6),
    _buildSilo('R02','round','C','LINE-3',200,1,6),
    _buildSilo('R03','round','C','LINE-3',200,1,6),
    _buildSilo('R04','round','C','LINE-3',200,1,6),
    _buildSilo('R05','round','D','LINE-3',200,1,6),
    _buildSilo('R06','round','D','LINE-3',200,1,6),
    _buildSilo('R07','round','D','LINE-3',200,1,6),
    _buildSilo('R08','round','D','LINE-3',200,1,6),
  ];

  // ── Grain Inventory (สินค้าในถัง) ─────────────────────────────
  // S06, R04 = ถังว่าง (ไม่มี inventory)
  const siloInventory = [
    { id:'S01', grain:'Paddy',   tons:390, fillPct:78, daysIn:45, supplier:'สมใจ จำกัด' },
    { id:'S02', grain:'Corn',    tons:275, fillPct:55, daysIn:18, supplier:'สมใจ จำกัด' },
    { id:'S03', grain:'Corn',    tons:460, fillPct:92, daysIn:12, supplier:'เจริญ อะกรี' },
    { id:'S04', grain:'Paddy',   tons:75,  fillPct:15, daysIn:60, supplier:'สมใจ จำกัด' },
    { id:'S05', grain:'Paddy',   tons:440, fillPct:88, daysIn:22, supplier:'ไทยเกษตร' },
    // S06 = empty
    { id:'S07', grain:'Corn',    tons:335, fillPct:67, daysIn:9,  supplier:'เจริญ อะกรี' },
    { id:'S08', grain:'Sorghum', tons:220, fillPct:44, daysIn:31, supplier:'ไทยเกษตร' },
    { id:'S09', grain:'Paddy',   tons:355, fillPct:71, daysIn:33, supplier:'สมใจ จำกัด' },
    { id:'S10', grain:'Corn',    tons:150, fillPct:30, daysIn:5,  supplier:'เจริญ อะกรี' },
    { id:'S11', grain:'Wheat',   tons:425, fillPct:85, daysIn:14, supplier:'ไทยเกษตร' },
    { id:'S12', grain:'Millet',  tons:290, fillPct:58, daysIn:27, supplier:'สมใจ จำกัด' },
    { id:'R01', grain:'Corn',    tons:124, fillPct:62, daysIn:7,  supplier:'เจริญ อะกรี' },
    { id:'R02', grain:'Paddy',   tons:190, fillPct:95, daysIn:3,  supplier:'ไทยเกษตร' },
    { id:'R03', grain:'Corn',    tons:96,  fillPct:48, daysIn:21, supplier:'สมใจ จำกัด' },
    // R04 = empty
    { id:'R05', grain:'Millet',  tons:154, fillPct:77, daysIn:16, supplier:'ไทยเกษตร' },
    { id:'R06', grain:'Paddy',   tons:66,  fillPct:33, daysIn:38, supplier:'สมใจ จำกัด' },
    { id:'R07', grain:'Paddy',   tons:178, fillPct:89, daysIn:11, supplier:'เจริญ อะกรี' },
    { id:'R08', grain:'Sorghum', tons:110, fillPct:55, daysIn:25, supplier:'ไทยเกษตร' },
  ];

  // ── Fumigation Status ──────────────────────────────────────────
  // days = วันนับตั้งแต่อบยาครั้งล่าสุด | fuming = กำลังอบอยู่
  const fumData = [
    // ถังยาว
    { id:'S01', days:52, fuming:false, lastDate:'25/03/2569', chem:'Phosphine' },  // overdue
    { id:'S02', days:20, fuming:false, lastDate:'26/04/2569', chem:'Phosphine' },
    { id:'S03', days:38, fuming:false, lastDate:'08/04/2569', chem:'Phosphine' },  // due soon
    { id:'S04', days:10, fuming:false, lastDate:'06/05/2569', chem:'Methyl Bromide' },
    { id:'S05', days:44, fuming:false, lastDate:'02/04/2569', chem:'Phosphine' },  // due soon
    { id:'S06', days:0,  fuming:false, lastDate:'—',          chem:'—' },          // empty
    { id:'S07', days:2,  fuming:true,  lastDate:'14/05/2569', chem:'Phosphine' },  // active
    { id:'S08', days:33, fuming:false, lastDate:'13/04/2569', chem:'Phosphine' },  // due soon
    { id:'S09', days:7,  fuming:false, lastDate:'09/05/2569', chem:'Phosphine' },
    { id:'S10', days:28, fuming:false, lastDate:'18/04/2569', chem:'Methyl Bromide' },
    { id:'S11', days:15, fuming:false, lastDate:'01/05/2569', chem:'Phosphine' },
    { id:'S12', days:48, fuming:false, lastDate:'28/03/2569', chem:'Phosphine' },  // overdue
    // ถังกลม
    { id:'R01', days:12, fuming:false, lastDate:'04/05/2569', chem:'Phosphine' },
    { id:'R02', days:3,  fuming:false, lastDate:'13/05/2569', chem:'Phosphine' },
    { id:'R03', days:26, fuming:false, lastDate:'20/04/2569', chem:'Phosphine' },
    { id:'R04', days:0,  fuming:false, lastDate:'—',          chem:'—' },          // empty
    { id:'R05', days:36, fuming:false, lastDate:'10/04/2569', chem:'Methyl Bromide' },
    { id:'R06', days:50, fuming:false, lastDate:'26/03/2569', chem:'Phosphine' },  // overdue
    { id:'R07', days:18, fuming:false, lastDate:'28/04/2569', chem:'Phosphine' },
    { id:'R08', days:30, fuming:false, lastDate:'16/04/2569', chem:'Phosphine' },
  ];

  // ── Fumigation log (timeline) ─────────────────────────────────
  const fumLog = [
    { date:'14/05/2569 08:12', silo:'S07', action:'start', chem:'Phosphine', staff:'วิชัย ศ.' },
    { date:'26/03/2569 07:30', silo:'R06', action:'complete', chem:'Phosphine', staff:'สมศักดิ์ ว.' },
    { date:'25/03/2569 07:00', silo:'S01', action:'complete', chem:'Phosphine', staff:'วิชัย ศ.' },
    { date:'10/03/2569 08:00', silo:'S12', action:'complete', chem:'Phosphine', staff:'สมศักดิ์ ว.' },
  ];

  // ── Transfer Jobs ─────────────────────────────────────────────
  let _jobIdCounter = 100;

  const _today = new Date().toISOString().slice(0,10);

  const aerJobs = [
    {
      id: _jobIdCounter++,
      from:'S01', to:'S06',
      grain:'Paddy', tons:200, route_lines:'LINE-1',
      date: _today, time:'08:00',
      status:'inprogress',
      note:'Aeration overdue 12 วัน',
      created: _today,
    },
    {
      id: _jobIdCounter++,
      from:'R02', to:'R04',
      grain:'Paddy', tons:100, route_lines:'LINE-3',
      date: _today, time:'10:30',
      status:'scheduled',
      note:'R02 aeration overdue 14 วัน',
      created: _today,
    },
    {
      id: _jobIdCounter++,
      from:'S12', to:'S06',
      grain:'Millet', tons:150, route_lines:'LINE-1',
      date: _today, time:'13:00',
      status:'scheduled',
      note:'FIFO — Millet 48 วัน',
      created: _today,
    },
  ];

  // ── Latest Sensor Readings (ใช้ view v_silo_latest_reading) ───
  const latestReadings = silos.map(s => ({
    silo_id:   s.id,
    avg_temp:  s.temp,
    max_temp:  +(s.temp + Math.random() * 2).toFixed(1),
    co2_ppm:   s.co2,
    moisture:  s.moisture,
    reading_at: new Date().toISOString(),
  }));

  // ── Active Alarms ─────────────────────────────────────────────
  const alarms = [
    { id:1, silo_id:'S03', type:'temp_critical', message:'อุณหภูมิเกิน 35°C — เปิดพัดลมอัตโนมัติ', triggered_at: new Date(Date.now()-1800000).toISOString(), acknowledged_at: null, is_active: true },
    { id:2, silo_id:'R04', type:'temp_critical', message:'อุณหภูมิเกิน 35°C — แจ้งเตือน LINE Notify', triggered_at: new Date(Date.now()-3600000).toISOString(), acknowledged_at: null, is_active: true },
    { id:3, silo_id:'S01', type:'fum_overdue',   message:'เกินกำหนดอบยา 52 วัน', triggered_at: new Date(Date.now()-86400000).toISOString(), acknowledged_at: null, is_active: true },
  ];

  // ── Energy Meters ─────────────────────────────────────────────
  const energyMeters = [
    { id:'MTR-01', zone:'A', name:'Zone A — S01-S06', kwhToday: 82.4, kwhMonth: 2140, activeFans: 3 },
    { id:'MTR-02', zone:'B', name:'Zone B — S07-S12', kwhToday: 91.8, kwhMonth: 2390, activeFans: 4 },
    { id:'MTR-03', zone:'C', name:'Zone C — R01-R04', kwhToday: 38.2, kwhMonth:  990, activeFans: 2 },
    { id:'MTR-04', zone:'D', name:'Zone D — R05-R08', kwhToday: 25.6, kwhMonth:  670, activeFans: 2 },
  ];

  // ── PLC Equipment State ───────────────────────────────────────
  // ใช้โดย plc.js เพื่อแสดงสถานะ DO / DI
  const plcState = {
    'LINE-1': { running: false, fault: false, estop: false },
    'LINE-2': { running: false, fault: false, estop: false },
    'LINE-3': { running: false, fault: false, estop: false },
    'MAIN':   { running: false, fault: false, estop: false },
  };

  // ─────────────────────────────────────────────────────────────
  // Public
  // ─────────────────────────────────────────────────────────────
  return {
    silos,
    siloInventory,
    fumData,
    fumLog,
    aerJobs,
    latestReadings,
    alarms,
    energyMeters,
    plcState,
    // counter เพิ่มตาม job ใหม่
    get _jobIdCounter() { return _jobIdCounter; },
    set _jobIdCounter(v) { _jobIdCounter = v; },
  };

})();
