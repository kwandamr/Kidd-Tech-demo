/**
 * ═══════════════════════════════════════════════════════════════
 * predict.js — Predictive Intelligence Engine
 * ═══════════════════════════════════════════════════════════════
 * 5 โมเดลเชิงคาดการณ์:
 *   1. CO₂ Deterioration Forecast
 *   2. Hot Spot Detection
 *   3. Aflatoxin Risk Score
 *   4. EMC Aeration Window
 *   5. Remaining Safe Storage Days (combined)
 *
 * Dependencies: config.js, data.js (MOCK_DATA)
 * ═══════════════════════════════════════════════════════════════
 */

const PREDICT = (() => {

  // ── External Weather (mock — production: ดึงจาก Weather API) ──
  // ฤดูร้อน/ฝนในไทย: ร้อนชื้น
  const EXT_TEMP_DAY  = 33;   // °C กลางวัน
  const EXT_RH_DAY    = 78;   // % ความชื้นสัมพัทธ์กลางวัน
  const EXT_TEMP_NIGHT = 26;  // °C กลางคืน
  const EXT_RH_NIGHT  = 65;   // % ความชื้นสัมพัทธ์กลางคืน

  // CO₂ thresholds
  const CO2_AMBIENT   = 420;  // ppm — baseline อากาศปกติ
  const CO2_WARN      = 600;  // ppm — เริ่มเฝ้าระวัง
  const CO2_CRIT      = 1000; // ppm — วิกฤต เสี่ยงเชื้อรา

  // ─────────────────────────────────────────────────────────────
  // MODEL 1: CO₂ Deterioration Forecast
  // ─────────────────────────────────────────────────────────────
  /**
   * สร้าง CO₂ trend ย้อนหลัง 14 วัน (simulation)
   * production: query จาก DB ตาราง sensor_readings
   */
  function _buildCO2Trend(silo) {
    const current = silo.co2;
    let slope;
    if (silo.status === 'red')    slope = 80 + Math.random() * 25;
    else if (silo.status === 'yellow') slope = 18 + Math.random() * 12;
    else                          slope = 2  + Math.random() * 5;

    // seed random ด้วย silo id ให้ค่าคงที่ต่อ session
    const seed = silo.id.charCodeAt(0) + (silo.id.charCodeAt(1) || 0);
    const noise = d => ((seed * (d + 7)) % 31 - 15) * 0.4;

    return Array.from({ length: 15 }, (_, i) => {
      const day = i - 14;
      const ppm = Math.max(CO2_AMBIENT, current + slope * day + noise(i));
      return { day, ppm: Math.round(ppm) };
    });
  }

  function computeCO2Forecast(silo) {
    const trend   = _buildCO2Trend(silo);
    const current = silo.co2;

    // คำนวณ slope จาก linear regression อย่างง่าย (3 จุดล่าสุด)
    const last3  = trend.slice(-4);
    const slope  = +((last3[3].ppm - last3[0].ppm) / 3).toFixed(1);

    let daysToWarn = null, daysToCrit = null;
    if (slope > 0) {
      daysToWarn = current < CO2_WARN
        ? Math.ceil((CO2_WARN - current) / slope)
        : 0;
      daysToCrit = current < CO2_CRIT
        ? Math.ceil((CO2_CRIT - current) / slope)
        : 0;
    } else {
      daysToWarn = current < CO2_WARN ? 99 : 0;
      daysToCrit = current < CO2_CRIT ? 99 : 0;
    }

    // forecast อีก 7 วัน
    const forecast = Array.from({ length: 7 }, (_, i) => ({
      day: i + 1,
      ppm: Math.round(Math.max(CO2_AMBIENT, current + slope * (i + 1))),
    }));

    const level = current >= CO2_CRIT ? 'critical'
      : current >= CO2_WARN            ? 'warning'
      : 'ok';

    return { current, slope, daysToWarn, daysToCrit, trend, forecast, level };
  }

  // ─────────────────────────────────────────────────────────────
  // MODEL 2: Hot Spot Detection
  // ─────────────────────────────────────────────────────────────
  /**
   * จำลอง multi-point sensor readings (production: ดึงจาก PLC Analog Input)
   * ถ้า ΔT (max - avg) > 2.5°C = มี hot spot
   */
  function computeHotSpot(silo) {
    const base = silo.temp;
    const spread = silo.status === 'red' ? 5.5
      : silo.status === 'yellow'         ? 2.5
      : 1.0;

    // seed ด้วย silo id เพื่อให้ค่าคงที่
    const seed = silo.id.charCodeAt(0) * 17 + (silo.id.charCodeAt(1) || 1) * 3;
    const total = silo.num_cables * silo.sensors_per_cable;
    const points = Array.from({ length: total }, (_, i) => {
      const r = ((seed * (i + 1) * 7919) % 1000) / 1000; // pseudo-random 0-1
      return +(base + (r - 0.35) * spread).toFixed(1);
    });

    const maxTemp = Math.max(...points);
    const minTemp = Math.min(...points);
    const avgTemp = +(points.reduce((a, b) => a + b, 0) / points.length).toFixed(1);
    const delta   = +(maxTemp - avgTemp).toFixed(1);

    const risk = delta > 4.0 ? 'high' : delta > 2.5 ? 'medium' : 'low';
    const detected = delta > 2.5;

    return { maxTemp, minTemp, avgTemp, delta, points, detected, risk };
  }

  // ─────────────────────────────────────────────────────────────
  // MODEL 3: Aflatoxin Risk Score
  // ─────────────────────────────────────────────────────────────
  /**
   * Score 0–100 จาก 3 ตัวแปรหลัก
   * production: temperature จาก sensor, moisture จาก moisture meter, daysIn จาก DB
   */
  function computeAflatoxinScore(silo, invEntry) {
    const daysIn  = invEntry ? (invEntry.daysIn || 0) : 0;
    const temp    = silo.temp;
    const moisture = silo.moisture;

    // Temperature component (max 40 pts)
    let tempScore = 0;
    if (temp >= 35)      tempScore = 40;
    else if (temp >= 28) tempScore = Math.round(40 * (temp - 28) / 7);

    // Moisture component (max 35 pts) — ความชื้นเมล็ด proxy สำหรับ RH ในไซโล
    let moistScore = 0;
    if (moisture >= 16)      moistScore = 35;
    else if (moisture >= 13) moistScore = Math.round(35 * (moisture - 13) / 3);

    // Storage duration component (max 25 pts)
    let daysScore = 0;
    if (daysIn >= 45)      daysScore = 25;
    else if (daysIn >= 30) daysScore = Math.round(25 * (daysIn - 30) / 15);

    const score = Math.min(100, tempScore + moistScore + daysScore);

    let level, color, label;
    if (score >= 80)      { level = 'danger'; color = '#B71C1C'; label = 'อันตราย!'; }
    else if (score >= 60) { level = 'high';   color = '#E65100'; label = 'เสี่ยงสูง'; }
    else if (score >= 30) { level = 'medium'; color = '#F57F17'; label = 'เฝ้าระวัง'; }
    else                  { level = 'low';    color = '#2E7D32'; label = 'ปลอดภัย'; }

    return {
      score,
      level,
      color,
      label,
      breakdown: { temp: tempScore, moisture: moistScore, days: daysScore },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // MODEL 4: EMC Aeration Window
  // ─────────────────────────────────────────────────────────────
  /**
   * Henderson Equation (Modified) สำหรับข้าวโพด:
   *   MC = ( -ln(1-RH) / (K1 * (T + K2)) )^(1/K3)
   *   K1=9.3e-5, K2=49.81, K3=1.865  [temp in °C, MC in %wb]
   *
   * production: extTemp/extRH จาก Weather Sensor หน้าไซโล
   */
  function _henderson(tempC, rhFraction) {
    const K1 = 9.3e-5, K2 = 49.81, K3 = 1.865;
    const rh = Math.min(0.999, rhFraction);
    const emc = Math.pow((-Math.log(1 - rh)) / (K1 * (tempC + K2)), 1 / K3);
    return +emc.toFixed(2);
  }

  function computeEMC(silo) {
    const grainMC   = silo.moisture;
    const emcDay    = _henderson(EXT_TEMP_DAY,   EXT_RH_DAY   / 100);
    const emcNight  = _henderson(EXT_TEMP_NIGHT, EXT_RH_NIGHT / 100);

    const canAerateDay   = emcDay   < grainMC;
    const canAerateNight = emcNight < grainMC;

    let recommendation, bestWindow;
    if (canAerateDay && canAerateNight) {
      recommendation = 'เปิดพัดลมได้ตลอดวัน';
      bestWindow = '00:00–24:00';
    } else if (!canAerateDay && canAerateNight) {
      recommendation = 'เปิดพัดลมได้เฉพาะช่วงกลางคืน';
      bestWindow = '22:00–06:00';
    } else if (canAerateDay && !canAerateNight) {
      recommendation = 'เปิดพัดลมได้ช่วงกลางวัน';
      bestWindow = '08:00–18:00';
    } else {
      recommendation = 'ยังไม่ควรระบาย — EMC ภายนอกสูงกว่าความชื้นเมล็ด';
      bestWindow = null;
    }

    return {
      grainMC,
      emcDay,
      emcNight,
      extTempDay:  EXT_TEMP_DAY,
      extRHDay:    EXT_RH_DAY,
      extTempNight: EXT_TEMP_NIGHT,
      extRHNight:  EXT_RH_NIGHT,
      canAerateDay,
      canAerateNight,
      recommendation,
      bestWindow,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // MODEL 5: Remaining Safe Storage Days (combined)
  // ─────────────────────────────────────────────────────────────
  function computeRemainingSafeDays(silo, invEntry) {
    const co2F = computeCO2Forecast(silo);
    const afl  = computeAflatoxinScore(silo, invEntry);
    const hs   = computeHotSpot(silo);

    // Base: เวลาถึง CO₂ critical
    let days;
    if (co2F.daysToCrit === 0)          days = 2;           // เกิน threshold แล้ว
    else if (co2F.daysToCrit !== null)  days = co2F.daysToCrit;
    else                                days = 35;

    // Adjust ลงตาม Aflatoxin Risk
    if      (afl.score >= 80) days = Math.min(days, 3);
    else if (afl.score >= 60) days = Math.min(days, 10);
    else if (afl.score >= 40) days = Math.min(days, 20);

    // Adjust ลงถ้ามี hot spot รุนแรง
    if (hs.detected && hs.risk === 'high') days = Math.min(days, 7);

    days = Math.max(1, days);

    let label, color, urgency;
    if (days <= 3)       { label = 'เร่งด่วน!';  color = '#B71C1C'; urgency = 4; }
    else if (days <= 7)  { label = 'เสี่ยงสูง';  color = '#E65100'; urgency = 3; }
    else if (days <= 15) { label = 'เฝ้าระวัง';  color = '#F57F17'; urgency = 2; }
    else                 { label = 'ปลอดภัย';    color = '#2E7D32'; urgency = 1; }

    return { days, label, color, urgency };
  }

  // ─────────────────────────────────────────────────────────────
  // Compute all models for one silo
  // ─────────────────────────────────────────────────────────────
  function computeAll(silo, invEntry) {
    return {
      co2:      computeCO2Forecast(silo),
      aflat:    computeAflatoxinScore(silo, invEntry),
      hotSpot:  computeHotSpot(silo),
      emc:      computeEMC(silo),
      safeDays: computeRemainingSafeDays(silo, invEntry),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: Predictive Intelligence Page
  // ─────────────────────────────────────────────────────────────
  async function renderPredictPage() {
    const silos = await DB.getSilos();
    const invMap = {};
    const invList = CONFIG.DEMO_MODE
      ? MOCK_DATA.siloInventory
      : (await DB.getSilos()).map(r => r.grain_inventory?.[0] || {});
    invList.forEach(i => { invMap[i.id] = i; });

    // Compute all predictions
    const rows = silos
      .filter(s => invMap[s.id])   // เฉพาะถังที่มีสินค้า
      .map(s => ({
        silo: s,
        inv:  invMap[s.id],
        pred: computeAll(s, invMap[s.id]),
      }))
      .sort((a, b) => b.pred.safeDays.urgency - a.pred.safeDays.urgency
        || a.pred.safeDays.days - b.pred.safeDays.days);

    // ── Summary KPI ──────────────────────────────────────────
    const urgent  = rows.filter(r => r.pred.safeDays.urgency >= 4).length;
    const high    = rows.filter(r => r.pred.safeDays.urgency === 3).length;
    const watch   = rows.filter(r => r.pred.safeDays.urgency === 2).length;
    const safe    = rows.filter(r => r.pred.safeDays.urgency === 1).length;

    const kpiEl = document.getElementById('predict-kpi');
    if (kpiEl) {
      kpiEl.innerHTML = `
        <div class="predict-kpi-card urgent"  onclick="filterPredictTable('urgent')">
          <div class="pkpi-num">${urgent}</div>
          <div class="pkpi-label">เร่งด่วน (≤3 วัน)</div>
        </div>
        <div class="predict-kpi-card high"    onclick="filterPredictTable('high')">
          <div class="pkpi-num">${high}</div>
          <div class="pkpi-label">เสี่ยงสูง (4–7 วัน)</div>
        </div>
        <div class="predict-kpi-card watch"   onclick="filterPredictTable('watch')">
          <div class="pkpi-num">${watch}</div>
          <div class="pkpi-label">เฝ้าระวัง (8–15 วัน)</div>
        </div>
        <div class="predict-kpi-card safe"    onclick="filterPredictTable('safe')">
          <div class="pkpi-num">${safe}</div>
          <div class="pkpi-label">ปลอดภัย (>15 วัน)</div>
        </div>
      `;
    }

    // External weather strip
    const wEl = document.getElementById('predict-weather');
    if (wEl) {
      wEl.innerHTML = `
        <span>🌤 สภาพอากาศวันนี้ (Sensor ภายนอก):</span>
        <span>กลางวัน ${EXT_TEMP_DAY}°C · ${EXT_RH_DAY}% RH
          → EMC ≈ ${_henderson(EXT_TEMP_DAY, EXT_RH_DAY/100).toFixed(1)}%</span>
        <span style="color:var(--text2)">|</span>
        <span>กลางคืน ${EXT_TEMP_NIGHT}°C · ${EXT_RH_NIGHT}% RH
          → EMC ≈ ${_henderson(EXT_TEMP_NIGHT, EXT_RH_NIGHT/100).toFixed(1)}%</span>
      `;
    }

    // ── Main Table ───────────────────────────────────────────
    const tbody = document.getElementById('predict-tbody');
    if (!tbody) return;

    tbody.innerHTML = rows.map(({ silo: s, inv, pred }) => {
      const sd  = pred.safeDays;
      const co2 = pred.co2;
      const afl = pred.aflat;
      const hs  = pred.hotSpot;
      const emc = pred.emc;

      const co2TrendArrow = co2.slope > 15 ? '↑↑' : co2.slope > 5 ? '↑' : co2.slope > 0 ? '→' : '↓';
      const co2TrendColor = co2.slope > 15 ? '#B71C1C' : co2.slope > 5 ? '#E65100' : '#2E7D32';

      const hsIcon = hs.detected
        ? `<span style="color:${hs.risk==='high'?'#B71C1C':'#F57F17'}">⚠ ΔT ${hs.delta}°C</span>`
        : `<span style="color:#2E7D32">✓ ปกติ</span>`;

      const emcIcon = emc.canAerateNight
        ? `<span style="color:#2E7D32">✓ เปิดได้กลางคืน</span>`
        : `<span style="color:#F57F17">— รอช่วงอากาศแห้ง</span>`;

      const action = sd.urgency >= 4
        ? `<button class="predict-action-btn urgent" onclick="showDetail('${s.id}')">🚨 ดำเนินการด่วน</button>`
        : sd.urgency === 3
        ? `<button class="predict-action-btn high"   onclick="showDetail('${s.id}')">⚠ ตรวจสอบ</button>`
        : `<button class="predict-action-btn safe"   onclick="showDetail('${s.id}')">👁 ดูรายละเอียด</button>`;

      return `
        <tr class="predict-row urgency-${sd.urgency}">
          <td><strong>${s.id}</strong></td>
          <td>${inv.grain}<br><small style="color:var(--text2)">${inv.daysIn} วัน</small></td>
          <td>
            <div class="safe-days-badge" style="background:${sd.color}">
              ${sd.days}<small>วัน</small>
            </div>
            <div class="safe-days-label" style="color:${sd.color}">${sd.label}</div>
          </td>
          <td>
            <span style="color:${co2TrendColor};font-weight:700">${co2.current} ppm ${co2TrendArrow}</span><br>
            <small style="color:var(--text2)">
              ${co2.daysToWarn === 0
                ? '<span style="color:#B71C1C">เกิน threshold แล้ว</span>'
                : co2.daysToWarn > 30 ? 'ยังปลอดภัย'
                : `ถึง 600 ppm ใน ~${co2.daysToWarn} วัน`}
            </small>
          </td>
          <td>
            <div class="afl-score-bar">
              <div class="afl-bar-fill" style="width:${afl.score}%;background:${afl.color}"></div>
            </div>
            <small style="color:${afl.color};font-weight:600">${afl.score} — ${afl.label}</small>
          </td>
          <td>${hsIcon}</td>
          <td><small>${emcIcon}</small></td>
          <td>${action}</td>
        </tr>
      `;
    }).join('');

    _window._predictRows = rows;
  }

  // filter table by urgency (ถ้า user กดที่ KPI card)
  let _window = typeof window !== 'undefined' ? window : {};
  function filterPredictTable(type) {
    const rows = document.querySelectorAll('#predict-tbody .predict-row');
    rows.forEach(r => {
      const urgency = parseInt(r.className.match(/urgency-(\d)/)?.[1] || '0');
      let show = true;
      if (type === 'urgent') show = urgency >= 4;
      else if (type === 'high')   show = urgency === 3;
      else if (type === 'watch')  show = urgency === 2;
      else if (type === 'safe')   show = urgency === 1;
      r.style.display = show ? '' : 'none';
    });
    // highlight active KPI card
    document.querySelectorAll('.predict-kpi-card').forEach(c => c.classList.remove('active'));
    const map = { urgent:0, high:1, watch:2, safe:3 };
    const cards = document.querySelectorAll('.predict-kpi-card');
    if (cards[map[type]]) cards[map[type]].classList.add('active');
  }

  // ─────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────
  return {
    computeCO2Forecast,
    computeHotSpot,
    computeAflatoxinScore,
    computeEMC,
    computeRemainingSafeDays,
    computeAll,
    renderPredictPage,
    filterPredictTable,
  };

})();
