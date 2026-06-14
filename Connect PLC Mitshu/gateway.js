/**
 * ═══════════════════════════════════════════════════════════════
 * gateway.js — Kid-D Tech PLC Gateway
 * ═══════════════════════════════════════════════════════════════
 * อ่านค่า D register จาก GX Simulator3 (SLMP/MC Protocol)
 * แล้ว Publish ขึ้น MQTT Broker
 *
 * Register Map:
 *   D100–D119 = Temp × 10      (27.5°C → 275)
 *   D200–D219 = CO₂ ppm
 *   D300–D319 = Moisture × 10  (14.2% → 142)
 *
 * รัน: node gateway.js
 * ═══════════════════════════════════════════════════════════════
 */

const MC   = require('mcprotocol');
const mqtt = require('mqtt');

// ── Config ──────────────────────────────────────────────────
const PLC_HOST = '127.0.0.1';   // GX Simulator3 บนเครื่องเดียวกัน
const PLC_PORT = 5007;           // default SLMP port
const POLL_MS  = 3000;           // poll ทุก 3 วินาที
const PLANT_ID = 'feedmill-01';
const MQTT_URL = 'mqtt://broker.hivemq.com';

// ชื่อถัง 20 ถัง — index ตรงกับ D100–D119
const SILO_IDS = [
  'S01','S02','S03','S04','S05','S06','S07','S08','S09','S10',
  'S11','S12','R01','R02','R03','R04','R05','R06','R07','R08',
];

// สร้าง item list ครบ 60 register
const ITEMS = [
  ...Array.from({length: 20}, (_, i) => `D${100 + i}`),  // Temp
  ...Array.from({length: 20}, (_, i) => `D${200 + i}`),  // CO₂
  ...Array.from({length: 20}, (_, i) => `D${300 + i}`),  // Moisture
];

// ── MQTT Connect ─────────────────────────────────────────────
console.log('[MQTT] Connecting to', MQTT_URL);
const client = mqtt.connect(MQTT_URL, {
  clientId: `kidDtech-gateway-${Date.now()}`,
  clean: true,
});

client.on('connect', () => {
  console.log('[MQTT] Connected ✅');
  initPLC();
});

client.on('error', err => console.error('[MQTT] Error:', err.message));

// ── PLC Connect ──────────────────────────────────────────────
const conn = new MC();
conn.setTranslationCB(tag => tag);

function initPLC() {
  console.log(`[PLC]  Connecting to GX Simulator3 at ${PLC_HOST}:${PLC_PORT}...`);
  conn.initiateConnection(
    { host: PLC_HOST, port: PLC_PORT, ascii: false },
    (err) => {
      if (err) {
        console.error('[PLC]  Connect failed:', err.message);
        console.log('[PLC]  Retry in 5s...');
        setTimeout(initPLC, 5000);
        return;
      }
      console.log('[PLC]  Connected ✅');
      conn.addItems(ITEMS);
      poll();
      setInterval(poll, POLL_MS);
    }
  );
}

// ── Poll PLC ─────────────────────────────────────────────────
function poll() {
  conn.readAllItems((err, values) => {
    if (err) {
      console.error('[PLC]  Read error:', err);
      return;
    }
    publishAll(values);
  });
}

// ── Publish to MQTT ──────────────────────────────────────────
function publishAll(values) {
  const ts = Date.now();

  SILO_IDS.forEach((siloId, i) => {
    const temp     = (values[`D${100 + i}`] || 0) / 10;
    const co2      =  values[`D${200 + i}`] || 0;
    const moisture = (values[`D${300 + i}`] || 0) / 10;

    const topic   = `kidDtech/${PLANT_ID}/silo/${siloId}`;
    const payload = JSON.stringify({ siloId, temp, co2, moisture, ts });

    client.publish(topic, payload, { qos: 1, retain: true });
  });

  // Log summary
  const t0  = (values['D100'] || 0) / 10;
  const c0  =  values['D200'] || 0;
  const t2  = (values['D102'] || 0) / 10;
  const c2  =  values['D202'] || 0;
  console.log(`[${new Date().toLocaleTimeString('th-TH')}] Published 20 silos`);
  console.log(`  S01: ${t0}°C | CO₂: ${c0} ppm`);
  console.log(`  S03: ${t2}°C | CO₂: ${c2} ppm  ← alarm silo`);
}
