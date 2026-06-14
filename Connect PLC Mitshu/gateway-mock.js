/**
 * ═══════════════════════════════════════════════════════════════
 * gateway-mock.js — Kid-D Tech PLC Gateway (Mock Mode)
 * ═══════════════════════════════════════════════════════════════
 * จำลองค่า sensor จาก PLC แล้ว Publish ขึ้น MQTT
 * ใช้ทดสอบ pipeline โดยไม่ต้องมี PLC จริง
 *
 * พอมี FX5U จริง → เปลี่ยนไปใช้ gateway.js แทน
 * รัน: node gateway-mock.js
 * ═══════════════════════════════════════════════════════════════
 */

const mqtt = require('mqtt');

// ── Config ──────────────────────────────────────────────────
const POLL_MS  = 3000;
const PLANT_ID = 'feedmill-01';
const MQTT_URL = 'mqtt://broker.hivemq.com';

// ชื่อถัง 20 ถัง
const SILO_IDS = [
  'S01','S02','S03','S04','S05','S06','S07','S08','S09','S10',
  'S11','S12','R01','R02','R03','R04','R05','R06','R07','R08',
];

// ── ค่าเริ่มต้นของแต่ละถัง (เหมือนที่เขียนใน ST program) ──
const BASE = [
  { temp: 27.5, co2: 420,  moisture: 14.2, fan: 1 },  // S01
  { temp: 29.0, co2: 380,  moisture: 13.8, fan: 0 },  // S02
  { temp: 34.0, co2: 1650, moisture: 15.8, fan: 1 },  // S03 ← alarm
  { temp: 26.5, co2: 410,  moisture: 13.5, fan: 0 },  // S04
  { temp: 27.2, co2: 395,  moisture: 14.0, fan: 1 },  // S05
  { temp: 28.1, co2: 430,  moisture: 14.5, fan: 0 },  // S06
  { temp: 26.8, co2: 405,  moisture: 13.7, fan: 1 },  // S07
  { temp: 29.5, co2: 460,  moisture: 15.2, fan: 1 },  // S08
  { temp: 27.8, co2: 415,  moisture: 14.3, fan: 0 },  // S09
  { temp: 26.3, co2: 390,  moisture: 13.6, fan: 0 },  // S10
  { temp: 28.5, co2: 445,  moisture: 14.7, fan: 1 },  // S11
  { temp: 27.1, co2: 400,  moisture: 13.9, fan: 0 },  // S12
  { temp: 28.8, co2: 425,  moisture: 14.6, fan: 1 },  // R01
  { temp: 26.7, co2: 385,  moisture: 13.4, fan: 0 },  // R02
  { temp: 29.3, co2: 455,  moisture: 15.1, fan: 1 },  // R03
  { temp: 27.0, co2: 398,  moisture: 14.1, fan: 0 },  // R04
  { temp: 27.6, co2: 408,  moisture: 14.4, fan: 1 },  // R05
  { temp: 28.4, co2: 435,  moisture: 14.8, fan: 0 },  // R06
  { temp: 26.9, co2: 392,  moisture: 13.5, fan: 1 },  // R07
  { temp: 28.2, co2: 440,  moisture: 14.9, fan: 0 },  // R08
];

// ── จำลองค่าขยับเล็กน้อยทุก poll (เหมือน sensor จริง) ──
function jitter(val, pct = 0.02) {
  const delta = val * pct * (Math.random() * 2 - 1);
  return Math.round((val + delta) * 10) / 10;
}

// ── MQTT Connect ─────────────────────────────────────────────
console.log('[MOCK]  Mode: จำลอง PLC (ไม่ต้องมี GX Simulator3)');
console.log('[MQTT]  Connecting to', MQTT_URL);

const client = mqtt.connect(MQTT_URL, {
  clientId: `kidDtech-mock-${Date.now()}`,
  clean: true,
});

client.on('connect', () => {
  console.log('[MQTT]  Connected ✅');
  console.log('[MOCK]  เริ่มส่งค่าทุก', POLL_MS / 1000, 'วินาที...\n');
  poll();
  setInterval(poll, POLL_MS);
});

client.on('error', err => console.error('[MQTT]  Error:', err.message));

// ── Poll & Publish ───────────────────────────────────────────
function poll() {
  const ts = Date.now();

  SILO_IDS.forEach((siloId, i) => {
    const base = BASE[i];
    const temp     = jitter(base.temp);
    const co2      = Math.round(jitter(base.co2, 0.05));
    const moisture = jitter(base.moisture);
    const fan      = base.fan;
    const fault    = 0;  // mock = ไม่มี fault

    const topic   = `kidDtech/${PLANT_ID}/silo/${siloId}`;
    const payload = JSON.stringify({ siloId, temp, co2, moisture, fan, fault, ts });

    client.publish(topic, payload, { qos: 1, retain: true });
  });

  // Log summary
  const s01 = BASE[0], s03 = BASE[2];
  console.log(`[${new Date().toLocaleTimeString('th-TH')}] Published 20 silos`);
  console.log(`  S01: ${jitter(s01.temp)}°C | CO₂: ${Math.round(jitter(s01.co2, 0.05))} ppm`);
  console.log(`  S03: ${jitter(s03.temp)}°C | CO₂: ${Math.round(jitter(s03.co2, 0.05))} ppm  ← alarm silo`);
}
