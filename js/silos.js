/**
 * ═══════════════════════════════════════════════════════════════
 * silos.js — Dashboard, Silo Grid, Fan Control, Grain Quality
 * ═══════════════════════════════════════════════════════════════
 * ครอบคลุมหน้า:
 *   - Dashboard   (#page-dashboard)  — silo card grid + summary KPI
 *   - Silo Detail (#page-detail)     — sensor matrix, trend chart, info
 *   - Fan Control (#page-fan)        — fan toggle per silo
 *   - Grain Quality (#page-quality)  — quality cards, EMC panel, phase banner
 *
 * Dependencies: config.js, i18n.js, utils.js, db.js
 * ═══════════════════════════════════════════════════════════════
 */

// ── State ──────────────────────────────────────────────────────
let _siloFilter    = 'all';   // 'all'|'red'|'yellow'|'green'
let _qualityFilter = 'all';   // 'all'|'co2'|'mois'
let _silosCache    = [];      // คัดลอกมาจาก DB.getSilos()
let _selectedSiloId = null;   // silo ที่เลือกใน detail panel

// Chart.js instance สำหรับ trend chart ใน detail page
let _trendChart = null;
// Chart.js instance สำหรับ trend chart ใน right detail panel
let _detChart = null;

// ─────────────────────────────────────────────────────────────
// SILO SVG — 3D Cylinder with Temperature Zones
// ─────────────────────────────────────────────────────────────

/**
 * Temperature → hex colour (precision industrial scale)
 * <26°C = cool blue  |  <28°C = teal  |  <30°C = amber
 * <32°C = orange     |  32°C+ = red critical
 */
function _tempCol(t) {
  if (t < 26) return '#0EA5E9';
  if (t < 28) return '#00BFA5';
  if (t < 30) return '#F59E0B';
  if (t < 32) return '#FB923C';
  return '#EF4444';
}

/**
 * siloSVG(s, fillPct)
 * สร้าง SVG ถัง 3D พร้อม 3 zone อุณหภูมิ + grain fill indicator
 * @param {object} s        — silo object (ใช้ s.id, s.temp, s.status)
 * @param {number} fillPct  — 0–100 % เต็มข้าว
 */
function siloSVG(s, fillPct) {
  // sanitise ID สำหรับ SVG clipPath id
  const uid = (s.id || 'S00').replace(/[^a-z0-9]/gi, '');

  // ── geometry ──────────────────────────────────────────────
  const cx = 35, rx = 27, ry = 7;         // cylinder centre-x, x-radius, ellipse y-radius
  const bY = 25, bH = 74, bBot = bY + bH; // body top-Y, height, bottom-Y
  const zH = Math.round(bH / 3);          // zone height

  // zone Y positions (top zone at bY, bot zone lowest)
  const z3Y = bY;              // top zone   — hottest (heat rises)
  const z2Y = bY + zH;         // mid zone
  const z1Y = bY + zH * 2;     // bot zone   — coolest

  // mid-Y for sensor dots
  const z3mid = z3Y + Math.round(zH / 2);
  const z2mid = z2Y + Math.round(zH / 2);
  const z1mid = z1Y + Math.round(zH / 2);

  // ── temperature zones (simulated from single avg temp) ────
  const t  = s.temp || 28;
  const c3 = _tempCol(t + 0.35);   // top zone slightly hotter
  const c2 = _tempCol(t);
  const c1 = _tempCol(t - 0.4);    // bot zone slightly cooler

  // ── status border & glow ──────────────────────────────────
  const isRed    = s.status === 'red';
  const isYellow = s.status === 'yellow';
  const bc = isRed ? '#EF4444' : isYellow ? '#F59E0B' : '#00BFA5';
  const bo = (isRed || isYellow) ? 0.9 : 0.28;  // border opacity

  // ── grain fill (empty-space overlay above grain level) ────
  const fp       = Math.max(0, Math.min(100, fillPct || 0));
  const emptyH   = Math.round(bH * (1 - fp / 100));
  const emptyRect = fp < 99
    ? `<rect x="${cx - rx}" y="${bY}" width="${rx * 2}" height="${emptyH}" fill="#030C17" opacity=".60" clip-path="url(#cl${uid})"/>`
    : '';

  // ── critical alert ring ───────────────────────────────────
  const alertRing = isRed
    ? `<rect x="${cx - rx - 2}" y="${bY - 2}" width="${rx * 2 + 4}" height="${bH + 4}" fill="none" stroke="#EF4444" stroke-width="2" rx="1" opacity=".45"/>`
    : '';

  return `<svg viewBox="0 0 70 112" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="cl${uid}">
        <rect x="${cx - rx}" y="${bY}" width="${rx * 2}" height="${bH}"/>
      </clipPath>
      <linearGradient id="sh${uid}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stop-color="#000" stop-opacity=".32"/>
        <stop offset="26%"  stop-color="#fff" stop-opacity=".07"/>
        <stop offset="74%"  stop-color="#fff" stop-opacity=".00"/>
        <stop offset="100%" stop-color="#000" stop-opacity=".24"/>
      </linearGradient>
    </defs>

    <!-- Conical roof -->
    <polygon points="${cx},3 ${cx - rx + 6},${bY} ${cx + rx - 6},${bY}"
      fill="#071525" stroke="${bc}" stroke-width="1.1" stroke-opacity=".55"/>
    <line x1="${cx - rx}" y1="${bY}" x2="${cx + rx}" y2="${bY}"
      stroke="${bc}" stroke-width=".8" stroke-opacity=".25"/>

    <!-- 3 temperature zones (bot → top) -->
    <rect x="${cx - rx}" y="${z1Y}" width="${rx * 2}" height="${zH}"     fill="${c1}" opacity=".78" clip-path="url(#cl${uid})"/>
    <rect x="${cx - rx}" y="${z2Y}" width="${rx * 2}" height="${zH}"     fill="${c2}" opacity=".72" clip-path="url(#cl${uid})"/>
    <rect x="${cx - rx}" y="${z3Y}" width="${rx * 2}" height="${zH + 2}" fill="${c3}" opacity=".66" clip-path="url(#cl${uid})"/>

    <!-- Grain fill empty-space overlay -->
    ${emptyRect}

    <!-- Zone divider lines -->
    <line x1="${cx - rx}" y1="${z2Y}" x2="${cx + rx}" y2="${z2Y}"
      stroke="#000" stroke-opacity=".32" stroke-width=".7"/>
    <line x1="${cx - rx}" y1="${z1Y}" x2="${cx + rx}" y2="${z1Y}"
      stroke="#000" stroke-opacity=".32" stroke-width=".7"/>

    <!-- 3D side shading -->
    <rect x="${cx - rx}" y="${bY}" width="${rx * 2}" height="${bH}"
      fill="url(#sh${uid})" clip-path="url(#cl${uid})"/>

    <!-- Cylinder wall border -->
    <rect x="${cx - rx}" y="${bY}" width="${rx * 2}" height="${bH}"
      fill="none" stroke="${bc}" stroke-width="1.3" stroke-opacity="${bo * .7 + .18}" rx=".5"/>

    <!-- Top ellipse cap -->
    <ellipse cx="${cx}" cy="${bY}" rx="${rx}" ry="${ry}"
      fill="#0A1E30" stroke="${bc}" stroke-width="1" stroke-opacity="${bo * .55 + .18}"/>

    <!-- Bottom ellipse cap -->
    <ellipse cx="${cx}" cy="${bBot}" rx="${rx}" ry="${ry}"
      fill="${c1}" fill-opacity=".45" stroke="${bc}" stroke-width="1" stroke-opacity="${bo * .55 + .18}"/>

    <!-- Sensor dots (right-side indicators) -->
    <circle cx="${cx + rx - 5}" cy="${z3mid}" r="2.5" fill="${c3}" stroke="#fff" stroke-width=".6" opacity=".88"/>
    <circle cx="${cx + rx - 5}" cy="${z2mid}" r="2.5" fill="${c2}" stroke="#fff" stroke-width=".6" opacity=".88"/>
    <circle cx="${cx + rx - 5}" cy="${z1mid}" r="2.5" fill="${c1}" stroke="#fff" stroke-width=".6" opacity=".88"/>

    <!-- Critical alert ring -->
    ${alertRing}
  </svg>`;
}

// ─────────────────────────────────────────────────────────────
// 3D TEMPERATURE PROFILE (Detail Page)
// ─────────────────────────────────────────────────────────────

/**
 * _buildSilo3DProfile(s, fillPct)
 * สร้าง SVG แสดงภาพตัด 3D ของถัง พร้อม sensor cables ครบทุกเส้น
 * มี heat-map gradient, grain fill overlay, animated hot sensors
 */
function _buildSilo3DProfile(s, fillPct) {
  const nCab  = s.num_cables || 4;
  const nSen  = s.sensors_per_cable || 6;
  const baseT = s.temp || 28;
  const fp    = Math.max(0, Math.min(100, fillPct || 0));

  // ── Reproducible RNG from silo ID (same seed = same temps each open) ──
  let seed = (s.id || 'S00').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

  // ── SVG viewport ──────────────────────────────────────────
  const W = 500, H = 538;
  const cx = W / 2;

  // ── Cylinder geometry ─────────────────────────────────────
  const rx = 175, ry = 36;
  const bY = 72, bH = 386, bBot = bY + bH;

  // ── Cable x positions (evenly spread) ─────────────────────
  const xPad = rx * 0.20;
  const cabXs = nCab <= 1 ? [cx]
    : Array.from({length: nCab}, (_, i) =>
        cx - rx + xPad + i * (rx * 2 - xPad * 2) / (nCab - 1));

  // ── Sensor y positions (evenly through body) ──────────────
  const yPad = 26;
  const senYs = nSen <= 1 ? [bY + bH / 2]
    : Array.from({length: nSen}, (_, i) =>
        bY + yPad + i * (bH - yPad * 2) / (nSen - 1));

  // ── Generate sensor temperatures ──────────────────────────
  const cabOffsets = Array.from({length: nCab}, () => (rng() - 0.5) * 2.2);
  const grid = Array.from({length: nCab}, (_, c) =>
    Array.from({length: nSen}, (_, p) => {
      const rise = (1 - p / Math.max(nSen - 1, 1)) * 3.2;   // heat rises to top
      return +(baseT + rise + cabOffsets[c] + (rng() - 0.5) * 0.65).toFixed(1);
    })
  );

  const allT  = grid.flat();
  const tMin  = Math.min(...allT);
  const tMax  = Math.max(...allT);
  const uid   = (s.id || 'X').replace(/[^a-z0-9]/gi, '');
  const isRed = s.status === 'red';
  const isYel = s.status === 'yellow';
  const bc    = isRed ? '#EF4444' : isYel ? '#F59E0B' : '#00BFA5';

  // ── Grain fill overlay position ───────────────────────────
  const grainTop = bY + Math.round(bH * (1 - fp / 100));

  // ── Label density ─────────────────────────────────────────
  const showLabel = nCab <= 6;
  const fs = nCab > 5 ? 8 : 9;

  // ── Animation durations (varied per cable) ─────────────────
  const DURS = ['1.3s','1.7s','2.1s','2.5s','1.9s','1.5s'];

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
  style="width:100%;height:100%;display:block;max-height:490px">
<defs>
  <clipPath id="cp${uid}"><rect x="${cx-rx}" y="${bY}" width="${rx*2}" height="${bH}"/></clipPath>
  <linearGradient id="hg${uid}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="${_tempCol(tMax)}" stop-opacity=".32"/>
    <stop offset="50%"  stop-color="${_tempCol(baseT)}" stop-opacity=".13"/>
    <stop offset="100%" stop-color="${_tempCol(tMin)}"  stop-opacity=".05"/>
  </linearGradient>
  <linearGradient id="ws${uid}" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%"   stop-color="#000" stop-opacity=".52"/>
    <stop offset="16%"  stop-color="#fff" stop-opacity=".07"/>
    <stop offset="84%"  stop-color="#fff" stop-opacity=".03"/>
    <stop offset="100%" stop-color="#000" stop-opacity=".48"/>
  </linearGradient>
  <linearGradient id="sc${uid}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#EF4444"/>
    <stop offset="28%"  stop-color="#FB923C"/>
    <stop offset="55%"  stop-color="#F59E0B"/>
    <stop offset="78%"  stop-color="#00BFA5"/>
    <stop offset="100%" stop-color="#0EA5E9"/>
  </linearGradient>
  <filter id="gf${uid}" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur stdDeviation="4.5" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  ${isRed ? `<filter id="rf${uid}" x="-8%" y="-4%" width="116%" height="108%">
    <feGaussianBlur stdDeviation="7" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>` : ''}
</defs>

<!-- ── Conical roof ────────────────────────────────────── -->
<polygon points="${cx},12 ${cx-rx+20},${bY} ${cx+rx-20},${bY}"
  fill="#060F1E" stroke="${bc}" stroke-width="1.5" stroke-opacity=".58"/>
<ellipse cx="${cx}" cy="${bY}" rx="${rx-19}" ry="${ry*.52}"
  fill="#0C2033" stroke="${bc}" stroke-width=".9" stroke-opacity=".28"/>

<!-- ── Body background ────────────────────────────────── -->
<rect x="${cx-rx}" y="${bY}" width="${rx*2}" height="${bH}" fill="#020B16" rx="1"/>

<!-- ── Interior heat gradient ───────────────────────── -->
<rect x="${cx-rx}" y="${bY}" width="${rx*2}" height="${bH}"
  fill="url(#hg${uid})" clip-path="url(#cp${uid})"/>

<!-- ── Grain fill overlay ──────────────────────────── -->
${fp > 3 ? `
<rect x="${cx-rx+2}" y="${grainTop}" width="${rx*2-4}" height="${bBot-grainTop}"
  fill="rgba(245,158,11,.08)" clip-path="url(#cp${uid})"/>
<line x1="${cx-rx+2}" y1="${grainTop}" x2="${cx+rx-2}" y2="${grainTop}"
  stroke="rgba(245,158,11,.40)" stroke-width="1.3" stroke-dasharray="7,5"/>
<text x="${cx+rx-8}" y="${grainTop-7}" text-anchor="end" font-size="9"
  font-family="'Courier New',monospace" fill="rgba(245,158,11,.65)">${fp}% เต็ม</text>` : ''}

<!-- ── Horizontal depth guides ─────────────────────── -->
${Array.from({length: 4}, (_, i) => {
  const y = bY + (i + 1) * bH / 5;
  return `<line x1="${cx-rx+5}" y1="${y}" x2="${cx+rx-5}" y2="${y}"
  stroke="rgba(0,191,165,.04)" stroke-width="1" stroke-dasharray="6,9"/>`;
}).join('\n')}

<!-- ── Sensor cables ──────────────────────────────── -->
${cabXs.map((x, c) => `
<line x1="${x}" y1="${bY+10}" x2="${x}" y2="${bBot-10}"
  stroke="rgba(180,210,240,.14)" stroke-width="1.6" stroke-dasharray="3,8"/>
<circle cx="${x}" cy="${bY+10}" r="3.2" fill="rgba(0,191,165,.30)"
  stroke="rgba(0,191,165,.65)" stroke-width=".9"/>
<text x="${x}" y="${bY-13}" text-anchor="middle" font-size="10.5"
  font-family="'Courier New',monospace" fill="rgba(0,191,165,.72)"
  letter-spacing="1">C${c+1}</text>`).join('')}

<!-- ── Sensor nodes (heat-mapped, animated if hot) ── -->
${cabXs.map((x, c) => senYs.map((y, p) => {
  const t   = grid[c][p];
  const col = _tempCol(t);
  const hot  = t >= CONFIG.TEMP_OK_MAX;
  const crit = t >= CONFIG.TEMP_CRIT_MIN;
  const r    = crit ? 7.5 : hot ? 6.2 : 5.0;
  const dur  = DURS[c % DURS.length];
  return `
${hot ? `<circle cx="${x}" cy="${y}" r="${r+6}" fill="${col}" opacity=".16"
  filter="url(#gf${uid})">
  ${crit ? `<animate attributeName="r" values="${r+5};${r+9};${r+5}" dur="${dur}" repeatCount="indefinite"/>
  <animate attributeName="opacity" values=".16;.30;.16" dur="${dur}" repeatCount="indefinite"/>` : ''}
</circle>` : ''}
<circle cx="${x}" cy="${y}" r="${r}" fill="${col}"
  stroke="rgba(255,255,255,${crit?'.75':hot?'.50':'.28'})"
  stroke-width="${crit?1.6:hot?1.1:.7}"
  opacity="${crit?1:hot?.93:.82}">
  ${crit ? `<animate attributeName="r" values="${r};${r+1.8};${r}" dur="${dur}" repeatCount="indefinite"/>` : ''}
  <title>C${c+1}S${p+1}: ${t}°C${crit?' ⚠ CRITICAL':hot?' ⬆ HOT':''}</title>
</circle>
${showLabel ? `<text x="${x+r+4}" y="${y+3.5}" font-size="${fs}"
  font-family="'Courier New',monospace" fill="${col}" opacity=".92">${t}</text>` : ''}`;
}).join('')).join('')}

<!-- ── 3D wall shading overlay ────────────────────── -->
<rect x="${cx-rx}" y="${bY}" width="${rx*2}" height="${bH}"
  fill="url(#ws${uid})" clip-path="url(#cp${uid})" pointer-events="none"/>

<!-- ── Wall border ────────────────────────────────── -->
<rect x="${cx-rx}" y="${bY}" width="${rx*2}" height="${bH}"
  fill="none" stroke="${bc}" stroke-width="1.9"
  stroke-opacity="${isRed||isYel?.88:.30}" rx="1"
  ${isRed ? `filter="url(#rf${uid})"` : ''}>
  ${isRed ? `<animate attributeName="stroke-opacity" values=".88;.45;.88" dur=".9s" repeatCount="indefinite"/>` : ''}
</rect>

<!-- ── Top ellipse cap ────────────────────────────── -->
<ellipse cx="${cx}" cy="${bY}" rx="${rx}" ry="${ry}"
  fill="#0A1E2E" stroke="${bc}" stroke-width="1.4" stroke-opacity=".54"/>
<path d="M ${cx-rx*.65} ${bY-ry*.28} A ${rx*.65} ${ry*.28} 0 0 1 ${cx+rx*.65} ${bY-ry*.28}"
  fill="none" stroke="rgba(255,255,255,.07)" stroke-width="2.5"/>

<!-- ── Bottom ellipse ─────────────────────────────── -->
<ellipse cx="${cx}" cy="${bBot}" rx="${rx}" ry="${ry}"
  fill="${_tempCol(tMin)}" fill-opacity=".16"
  stroke="${bc}" stroke-width="1" stroke-opacity=".28"/>

<!-- ── Temperature scale bar (right) ──────────────── -->
<rect x="${cx+rx+22}" y="${bY+bH*.23}" width="11" height="${bH*.54}"
  rx="4" fill="url(#sc${uid})" opacity=".72"/>
<text x="${cx+rx+27}" y="${bY+bH*.23-9}" text-anchor="middle" font-size="8.5"
  font-family="'Courier New',monospace" fill="${_tempCol(tMax)}">${tMax.toFixed(1)}°</text>
<text x="${cx+rx+27}" y="${bY+bH*.77+17}" text-anchor="middle" font-size="8.5"
  font-family="'Courier New',monospace" fill="${_tempCol(tMin)}">${tMin.toFixed(1)}°</text>
<line x1="${cx+rx+18}" y1="${bY+bH*.5}" x2="${cx+rx+22}" y2="${bY+bH*.5}"
  stroke="rgba(200,220,240,.28)" stroke-width="1"/>
<text x="${cx+rx+27}" y="${bY+bH*.5+4}" text-anchor="middle" font-size="7.5"
  font-family="'Courier New',monospace" fill="rgba(200,220,240,.38)">${((tMin+tMax)/2).toFixed(1)}°</text>

<!-- ── Depth labels (left) ────────────────────────── -->
${senYs.map((y, p) => {
  const pct   = Math.round(p / Math.max(nSen - 1, 1) * 100);
  const lbl   = p === 0 ? 'TOP' : p === nSen - 1 ? 'BOT' : `${pct}%`;
  const lcol  = p === 0 || p === nSen - 1 ? 'rgba(0,191,165,.5)' : 'rgba(110,143,168,.38)';
  return `<text x="${cx-rx-9}" y="${y+3.5}" text-anchor="end" font-size="8"
  font-family="'Courier New',monospace" fill="${lcol}">${lbl}</text>
<line x1="${cx-rx-5}" y1="${y}" x2="${cx-rx+1}" y2="${y}"
  stroke="rgba(110,143,168,.18)" stroke-width=".7"/>`;
}).join('\n')}

<!-- ── Status bar ─────────────────────────────────── -->
<rect x="0" y="${H-30}" width="${W}" height="30" fill="rgba(2,8,20,.92)"/>
<circle cx="18" cy="${H-15}" r="5.5" fill="${bc}" opacity="${isRed||isYel?.95:.55}">
  ${isRed ? `<animate attributeName="opacity" values=".95;.38;.95" dur=".85s" repeatCount="indefinite"/>` : ''}
</circle>
<text x="32" y="${H-11}" font-size="10.5" font-family="'Courier New',monospace"
  fill="${bc}" font-weight="700" letter-spacing=".5">${s.id}</text>
<text x="${W/2}" y="${H-11}" text-anchor="middle" font-size="10"
  font-family="'Courier New',monospace" fill="rgba(200,221,240,.52)">
  ${nCab}&thinsp;cables &times; ${nSen}&thinsp;sensors = ${nCab*nSen}&thinsp;pts
</text>
<text x="${W-12}" y="${H-11}" text-anchor="end" font-size="10"
  font-family="'Courier New',monospace" fill="${_tempCol(baseT)}">${baseT}°C avg</text>
</svg>`;
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD — Silo Grid
// ─────────────────────────────────────────────────────────────

/** โหลดข้อมูลถัง → อัปเดต summary KPI → วาด grid */
async function renderSilos(filter) {
  if (filter !== undefined) _siloFilter = filter;

  // โหลดจาก DB (demo หรือ Supabase)
  const silos = await DB.getSilos();
  _silosCache = silos;

  // ── Inventory + Fumigation maps ───────────────────────────
  const inv = await _getInventoryMap();
  const fum = await _getFumMap();

  const red    = silos.filter(s => s.status === 'red').length;
  const yellow = silos.filter(s => s.status === 'yellow').length;
  const green  = silos.filter(s => s.status === 'green').length;
  const alerts = red + yellow;
  const avgTemp = silos.length
    ? +(silos.reduce((a, s) => a + s.temp, 0) / silos.length).toFixed(1)
    : 0;
  const avgCo2 = silos.length
    ? Math.round(silos.reduce((a, s) => a + s.co2, 0) / silos.length)
    : 0;

  // ── Sidebar status counts ─────────────────────────────────
  _setText('cnt-green',  green);
  _setText('cnt-yellow', yellow);
  _setText('cnt-red',    red);

  // ── KPI strip (new IDs) ───────────────────────────────────
  _setText('kpi-normal',   `${green}/${silos.length}`);
  _setText('kpi-alerts',   alerts);
  _setText('kpi-avg-temp', `${avgTemp}°C`);
  _setText('cnt-co2',      avgCo2);

  // ── Statusbar ─────────────────────────────────────────────
  const totalSensors = silos.reduce((a, s) => a + (s.num_cables * s.sensors_per_cable), 0);
  _setText('sb-sensor-count', `${totalSensors} sensors`);
  _setText('sb-alerts',  `${alerts} alert${alerts !== 1 ? 's' : ''}`);
  const alertDot = document.getElementById('sb-alert-dot');
  if (alertDot) alertDot.style.display = alerts > 0 ? 'inline-block' : 'none';

  // ── Fumigation overdue strip ───────────────────────────────
  const overdues = Object.values(fum).filter(f => !f.fuming && f.days >= CONFIG.FUM_OVERDUE_DAYS);
  _renderFumStrip(overdues);

  // ── Sidebar silo list ─────────────────────────────────────
  _renderSidebarList(silos, inv);

  // ── Silo Grid ──────────────────────────────────────────────
  const grid = document.getElementById('silo-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const filtered = _siloFilter === 'all'
    ? silos
    : silos.filter(s => s.status === _siloFilter);

  filtered.forEach(s => {
    const invEntry = inv[s.id] || {};
    const fumEntry = fum[s.id] || {};
    const fumOverdue = !fumEntry.fuming && (fumEntry.days || 0) >= CONFIG.FUM_OVERDUE_DAYS;
    const fuming     = fumEntry.fuming;

    // Safe Days badge (Predictive Intelligence)
    const sd = (typeof PREDICT !== 'undefined' && invEntry.grain)
      ? PREDICT.computeRemainingSafeDays(s, invEntry)
      : null;

    const card = document.createElement('div');
    card.className = `silo-card ${s.status}${_selectedSiloId === s.id ? ' db-selected' : ''}`;
    card.onclick   = () => showDetail(s.id);    // navigate to full detail (old behaviour)
    card.onmouseenter = () => selectSilo(s.id); // preview in right panel on hover

    card.innerHTML = `
      ${fumOverdue ? '<div class="badge-alarm"></div>' : ''}
      ${fuming     ? '<div class="badge-fum" title="กำลังอบยา">🧪</div>' : ''}
      <div class="silo-id">${s.id}</div>
      ${siloSVG(s, invEntry.fillPct || 0)}
      <div class="silo-temp" style="color:${tempColor(s.temp)}">${s.temp}°C</div>
      <div class="silo-badges">
        <span class="${co2Class(s.co2)}">${co2Label(s.co2)}</span>
        <span class="${moistClass(s.moisture)}">${s.moisture}%</span>
      </div>
      ${sd ? `<div class="safe-days-badge" style="background:${sd.color}" title="${sd.label}">${sd.days}<small>d</small></div>` : ''}
      <div class="silo-fan">${s.fanOn ? T('silo.fanOn') : T('silo.fanOff')}</div>
      ${invEntry.grain ? `<div class="silo-grain">${invEntry.grain}</div>` : ''}
    `;
    grid.appendChild(card);
  });

  // ── Auto-select first silo if none selected ───────────────
  if (!_selectedSiloId && silos.length) {
    selectSilo(silos[0].id);
  }

  // ── Weather + Fan Decision strip ─────────────────────────────
  _renderWeatherCard();

  // ── Sync dashboard top to actual nav bottom (handles demo banner) ──
  _syncDashboardTop();
}

/** filter ปุ่ม All / Alert / Watch / Normal */
function filterSilos(f, btn) {
  _siloFilter = f;
  document.querySelectorAll('#page-dashboard .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderSilos();
}

// ─────────────────────────────────────────────────────────────
// SILO DETAIL
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// RISK FACTOR — Assessment Engine (เหนือกว่า iGRAIN smiley)
// ─────────────────────────────────────────────────────────────

/**
 * _calcRiskFactor(temp, co2, moisture)
 * คำนวณ Risk Factor 0–6 จากค่า sensor ทั้ง 3 ตัว
 * อ้างอิงมาตรฐาน iGRAIN + HACCP grain storage
 */
function _calcRiskFactor(temp, co2, moisture) {
  let risk = 0;
  // Temperature component (0–2)
  if      (temp >= CONFIG.TEMP_CRIT_MIN)  risk += 2.0;
  else if (temp >= CONFIG.TEMP_WARN_MAX)  risk += 1.3;
  else if (temp >= CONFIG.TEMP_OK_MAX)    risk += 0.5;
  // CO₂ component (0–2)
  if      (co2 >= CONFIG.CO2_CRIT_MIN)   risk += 2.0;
  else if (co2 >= CONFIG.CO2_WARN_MAX)   risk += 1.2;
  else if (co2 >= CONFIG.CO2_OK_MAX)     risk += 0.4;
  // Moisture component (0–2)
  if      (moisture >= CONFIG.MOIS_CRIT_MIN)  risk += 2.0;
  else if (moisture >= CONFIG.MOIS_WARN_MAX)  risk += 1.0;
  else if (moisture >= CONFIG.MOIS_OK_MAX)    risk += 0.3;
  return Math.min(6, Math.round(risk * 10) / 10);
}

/**
 * _calcSafeStorageDays(temp, moisture)
 * ประเมิน Safe Storage Time (วัน) จากอุณหภูมิ + ความชื้น
 */
function _calcSafeStorageDays(temp, moisture) {
  const tFactor = Math.max(0, (38 - temp) / 13);   // 25°C=1.0, 38°C=0
  const mFactor = Math.max(0, (16 - moisture) / 5); // 11%=1.0, 16%=0
  return Math.min(365, Math.max(0, Math.round(tFactor * mFactor * 200)));
}

/** Condition label จาก Risk Score */
function _riskCondLabel(risk) {
  if (risk >= 5.5) return 'INFESTATION';
  if (risk >= 4.5) return 'CRITICAL';
  if (risk >= 3.0) return 'WARNING';
  if (risk >= 1.5) return 'CAUTION';
  if (risk >= 0.5) return 'MONITOR';
  return 'SAFE';
}

/**
 * _buildRiskGaugeSVG(score)
 * สร้าง SVG gauge 6-segment 0–6 พร้อม needle — เหนือกว่า smiley ของ iGRAIN
 */
function _buildRiskGaugeSVG(score) {
  const s   = Math.max(0, Math.min(6, score));
  const W   = 220, H = 128;
  const cx  = W / 2, cy = 108;
  const Ro  = 82, Ri = 52;
  const DEG = Math.PI / 180;

  const px = (a, r) => +(cx + r * Math.cos(a * DEG)).toFixed(1);
  const py = (a, r) => +(cy - r * Math.sin(a * DEG)).toFixed(1);

  // Segment arc: a1°→a2° counterclockwise on screen (sweep=0 in SVG with y-flipped coords)
  const arcSeg = (a1, a2) => {
    const [ox1,oy1] = [px(a1,Ro), py(a1,Ro)];
    const [ox2,oy2] = [px(a2,Ro), py(a2,Ro)];
    const [ix2,iy2] = [px(a2,Ri), py(a2,Ri)];
    const [ix1,iy1] = [px(a1,Ri), py(a1,Ri)];
    return `M${ox1},${oy1} A${Ro},${Ro},0,0,0,${ox2},${oy2} L${ix2},${iy2} A${Ri},${Ri},0,0,1,${ix1},${iy1}Z`;
  };

  const segCols = ['#10B981','#84CC16','#EAB308','#F97316','#EF4444','#B91C1C'];
  const segs = segCols.map((c, i) => {
    // i=0 → angles 150°–180° (LEFT, safe)   i=5 → 0°–30° (RIGHT, danger)
    const a1 = 180 - (i + 1) * 30;
    const a2 = 180 - i * 30;
    return `<path d="${arcSeg(a1,a2)}" fill="${c}" opacity="${s > i ? .90 : .12}"/>`;
  }).join('');

  // Needle: score 0 → 180°, score 6 → 0°
  const needleDeg = 180 - (s / 6) * 180;
  const nx = px(needleDeg, Ro - 12), ny = py(needleDeg, Ro - 12);

  const col = s>=5 ? '#B91C1C' : s>=4 ? '#EF4444' : s>=3 ? '#F97316' : s>=2 ? '#EAB308' : s>=1 ? '#84CC16' : '#10B981';
  const cond = _riskCondLabel(s);

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
  style="width:100%;max-width:${W}px;display:block;margin:0 auto">
  ${segs}
  <circle cx="${cx}" cy="${cy}" r="${Ri-4}" fill="var(--bg2)"/>
  <!-- needle shadow -->
  <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}"
    stroke="rgba(0,0,0,.5)" stroke-width="4" stroke-linecap="round"/>
  <!-- needle -->
  <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}"
    stroke="${col}" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="${cx}" cy="${cy}" r="5.8" fill="${col}"/>
  <!-- score -->
  <text x="${cx}" y="${cy-14}" text-anchor="middle"
    font-size="26" font-weight="700" font-family="'Courier New',monospace" fill="${col}">${s.toFixed(1)}</text>
  <text x="${cx}" y="${cy+5}" text-anchor="middle" font-size="9"
    fill="rgba(110,143,168,.55)">/ 6.0  Risk Scale</text>
  <!-- condition label -->
  <text x="${cx}" y="${H-4}" text-anchor="middle"
    font-size="11" font-weight="700" letter-spacing="1" fill="${col}">${cond}</text>
  <!-- scale ends -->
  <text x="${px(180,Ro+10)}" y="${py(180,Ro+10)+4}" text-anchor="end"
    font-size="8" fill="rgba(16,185,129,.7)">SAFE</text>
  <text x="${px(0,Ro+10)}" y="${py(0,Ro+10)+4}" text-anchor="start"
    font-size="8" fill="rgba(185,28,28,.75)">DANGER</text>
  <text x="${px(90,Ro+10)}" y="${py(90,Ro+10)}" text-anchor="middle"
    font-size="8" fill="rgba(110,143,168,.35)">3</text>
</svg>`;
}

/** วาด Risk Card ทั้งหมดใน #detail-risk */
function _renderDetailRisk(s) {
  const el = document.getElementById('detail-risk');
  if (!el) return;

  const risk  = _calcRiskFactor(s.temp, s.co2, s.moisture);
  const days  = _calcSafeStorageDays(s.temp, s.moisture);
  const cond  = _riskCondLabel(risk);

  const col   = risk>=5 ? '#B91C1C' : risk>=4 ? '#EF4444' : risk>=3 ? '#F97316' : risk>=2 ? '#EAB308' : risk>=1 ? '#84CC16' : '#10B981';
  const dCol  = days<=30 ? '#EF4444' : days<=60 ? '#F59E0B' : '#00BFA5';
  const dNote = days<=30 ? '⚠ เร่งด่วน' : days<=60 ? '📋 วางแผน' : '✓ ปลอดภัย';

  const tempC  = _tempCol(s.temp);
  const co2C   = s.co2>=CONFIG.CO2_CRIT_MIN ? 'var(--red)' : s.co2>=CONFIG.CO2_WARN_MAX ? 'var(--yellow)' : 'var(--green)';
  const moistC = s.moisture>=CONFIG.MOIS_CRIT_MIN ? 'var(--red)' : s.moisture>=CONFIG.MOIS_WARN_MAX ? 'var(--yellow)' : 'var(--green)';

  const tempPct  = Math.min(100, Math.round(Math.max(0, s.temp - 20) / 20 * 100));
  const co2Pct   = Math.min(100, Math.round(s.co2 / 1200 * 100));
  const moistPct = Math.min(100, Math.round(Math.max(0, s.moisture - 10) / 8 * 100));

  const tempNote  = s.temp>=CONFIG.TEMP_CRIT_MIN ? '⚠ วิกฤต' : s.temp>=CONFIG.TEMP_OK_MAX ? '↑ สูง' : '✓ ปกติ';
  const co2Note   = s.co2>=CONFIG.CO2_CRIT_MIN   ? '⚠ วิกฤต' : s.co2>=CONFIG.CO2_WARN_MAX  ? '↑ เตือน' : '✓ ปกติ';
  const moistNote = s.moisture>=CONFIG.MOIS_CRIT_MIN ? '⚠ วิกฤต' : s.moisture>=CONFIG.MOIS_WARN_MAX ? '↑ เตือน' : '✓ ปกติ';

  el.innerHTML = `
    <div class="risk-top">
      <div class="risk-gauge-box">${_buildRiskGaugeSVG(risk)}</div>
      <div class="risk-storage">
        <div class="risk-st-days" style="color:${dCol}">${days}</div>
        <div class="risk-st-unit">วัน</div>
        <div class="risk-st-lbl">Safe Storage Time</div>
        <div class="risk-st-note" style="color:${dCol}">${dNote}</div>
      </div>
      <div class="risk-cond-box">
        <div class="risk-cond-icon">${risk>=4?'🔴':risk>=2?'🟡':'🟢'}</div>
        <div class="risk-cond-lbl" style="color:${col}">${cond}</div>
        <div class="risk-cond-sub">Overall Condition</div>
        <div class="risk-score-chips">
          <span class="risk-chip" style="border-color:${col};color:${col}">${risk.toFixed(1)} / 6.0</span>
        </div>
      </div>
    </div>
    <div class="risk-metrics">
      <div class="risk-metric">
        <div class="rm-hdr">
          <span class="rm-icon">🌡</span>
          <span class="rm-lbl">Temperature</span>
          <span class="rm-val" style="color:${tempC}">${s.temp}°C</span>
          <span class="rm-note" style="color:${tempC}">${tempNote}</span>
        </div>
        <div class="rm-bar-bg"><div class="rm-bar" style="width:${tempPct}%;background:${tempC}"></div></div>
      </div>
      <div class="risk-metric">
        <div class="rm-hdr">
          <span class="rm-icon">💨</span>
          <span class="rm-lbl">CO₂</span>
          <span class="rm-val" style="color:${co2C}">${s.co2} ppm</span>
          <span class="rm-note" style="color:${co2C}">${co2Note}</span>
        </div>
        <div class="rm-bar-bg"><div class="rm-bar" style="width:${co2Pct}%;background:${co2C}"></div></div>
      </div>
      <div class="risk-metric">
        <div class="rm-hdr">
          <span class="rm-icon">💧</span>
          <span class="rm-lbl">Moisture</span>
          <span class="rm-val" style="color:${moistC}">${s.moisture}%</span>
          <span class="rm-note" style="color:${moistC}">${moistNote}</span>
        </div>
        <div class="rm-bar-bg"><div class="rm-bar" style="width:${moistPct}%;background:${moistC}"></div></div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// MOISTURE GRADIENT — per-layer depth (Feature 1)
// เหนือกว่า AGI BinManager: แสดง gradient ตามชั้นความลึก + per-cable
// ─────────────────────────────────────────────────────────────

/**
 * _renderMoistureGradient(s)
 * วาด Moisture ตาม 4 ชั้นความลึก (Top → Bottom) + per-cable reading
 * ใช้ seeded RNG เดียวกับที่ใช้ทั่วระบบ เพื่อให้ค่าสม่ำเสมอ
 */
function _renderMoistureGradient(s) {
  const el = document.getElementById('detail-moisture-gradient');
  if (!el) return;

  // Seeded RNG ตาม siloId
  let seed = 0;
  for (let i = 0; i < s.id.length; i++) seed = (seed * 31 + s.id.charCodeAt(i)) % 1e9;
  const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

  const base = s.moisture;

  // 4 ชั้น จากบนลงล่าง — ชั้นล่างมักชื้นกว่า (bias +0.1)
  const layerDefs = [
    { name: 'Top',    icon: '⬆', depth: '0–25%' },
    { name: 'Upper',  icon: '↑',  depth: '25–50%' },
    { name: 'Lower',  icon: '↓',  depth: '50–75%' },
    { name: 'Bottom', icon: '⬇', depth: '75–100%' },
  ];
  const layers = layerDefs.map((l, i) => {
    const bias  = i * 0.15;                           // ชั้นล่างมีแนวโน้มชื้นกว่า
    const delta = (rng() - 0.46) * 2.6 + bias;
    const m     = Math.max(8.0, Math.min(18.0, +(base + delta).toFixed(1)));
    const col   = m >= CONFIG.MOIS_CRIT_MIN ? '#EF4444'
                : m >= CONFIG.MOIS_WARN_MAX ? '#F59E0B'
                : '#00BFA5';
    const pct   = Math.min(100, Math.round((m - 8) / 10 * 100));
    return { ...l, m, col, pct };
  });

  // Per-cable readings
  const ncables = Math.min(s.num_cables || 4, 4);
  const cableData = Array.from({ length: ncables }, (_, ci) => {
    const lbl  = String.fromCharCode(65 + ci);
    let cs = (seed + ci * 1973) % 233280;
    const crng = () => { cs = (cs * 9301 + 49297) % 233280; return cs / 233280; };
    const cm   = Math.max(8.0, Math.min(18.0, +(base + (crng() - 0.5) * 1.8).toFixed(1)));
    const cCol = cm >= CONFIG.MOIS_CRIT_MIN ? '#EF4444'
               : cm >= CONFIG.MOIS_WARN_MAX ? '#F59E0B'
               : '#00BFA5';
    const zCol = (typeof _zCols !== 'undefined' ? _zCols : {})[lbl] || '#00BFA5';
    return { lbl, cm, cCol, zCol };
  });

  const maxLayer = layers.reduce((a, b) => a.m > b.m ? a : b);
  const minLayer = layers.reduce((a, b) => a.m < b.m ? a : b);
  const gradient = (maxLayer.m - minLayer.m).toFixed(1);
  const baseCol  = base >= CONFIG.MOIS_CRIT_MIN ? '#EF4444'
                 : base >= CONFIG.MOIS_WARN_MAX  ? '#F59E0B'
                 : '#00BFA5';

  const layerRows = layers.map(l => `
    <div class="mg-row">
      <div class="mg-lname"><span class="mg-licon">${l.icon}</span>${l.name}<span class="mg-depth">${l.depth}</span></div>
      <div class="mg-bar-bg"><div class="mg-bar" style="width:${l.pct}%;background:${l.col}"></div></div>
      <div class="mg-val" style="color:${l.col}">${l.m}%</div>
    </div>`).join('');

  const cableChips = cableData.map(c => `
    <div class="mg-cable">
      <span class="mg-cable-dot" style="background:${c.zCol}"></span>
      <span class="mg-cable-lbl" style="color:${c.zCol}">Zone ${c.lbl}</span>
      <span class="mg-cable-val" style="color:${c.cCol}">${c.cm}%</span>
    </div>`).join('');

  el.innerHTML = `
    <div class="mg-layers">${layerRows}</div>
    ${ncables > 1 ? `<div class="mg-cable-row">${cableChips}</div>` : ''}
    <div class="mg-footer">
      <span>📏 เฉลี่ย: <strong style="color:${baseCol}">${base}%</strong></span>
      <span class="mg-sep">·</span>
      <span>Gradient: <strong style="color:${+gradient > 1.5 ? '#F59E0B' : 'var(--text2)'}">${gradient}%</strong></span>
      <span class="mg-sep">·</span>
      <span style="color:var(--text3)">EMC target 12–13%</span>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// BIN INFO — INLINE EDIT (user config, localStorage)
// ─────────────────────────────────────────────────────────────

const _SI_KEY = 'kid_d_silo_inv';   // localStorage namespace

/** โหลด user overrides สำหรับถัง 1 ใบ */
function _siLoadUserInv(siloId) {
  try {
    const all = JSON.parse(localStorage.getItem(_SI_KEY) || '{}');
    return all[siloId] || {};
  } catch (e) { return {}; }
}

/** บันทึก user overrides */
function _siSaveUserInv(siloId, data) {
  try {
    const all = JSON.parse(localStorage.getItem(_SI_KEY) || '{}');
    all[siloId] = { ...(all[siloId] || {}), ...data };
    localStorage.setItem(_SI_KEY, JSON.stringify(all));
  } catch (e) {}
}

const _GRAIN_OPTS = ['Paddy','Corn','Sorghum','Wheat','Barley','(ว่าง)'];

/** View mode — แสดงข้อมูล */
function _renderBinInfoView(s, inv) {
  const el = document.getElementById('detail-info');
  if (!el) return;
  const fillPct = inv.fillPct || 0;
  const tons    = inv.tons    || Math.round((fillPct / 100) * s.capacity_tons);
  const cap     = s.capacity_tons;

  el.innerHTML = `
    <div class="info-row"><span class="info-label">${T('det.grainType')}</span>
      <span>${inv.grain || '(ว่าง)'}</span></div>
    <div class="info-row"><span class="info-label">${T('det.fillLevel')}</span>
      <span style="color:${fillColor(fillPct)}">${fillPct}% &nbsp;(${numFmt(tons)} / ${numFmt(cap)} ตัน)</span></div>
    <div class="info-row"><span class="info-label">${T('det.avgTemp')}</span>
      <span style="color:${tempColor(s.temp)}">${s.temp}°C</span></div>
    <div class="info-row"><span class="info-label">${T('det.co2ppm')}</span>
      <span class="${co2Class(s.co2)}">${s.co2} ppm</span></div>
    <div class="info-row"><span class="info-label">${T('det.moisture')}</span>
      <span class="${moistClass(s.moisture)}">${s.moisture}%</span></div>
    <div class="info-row"><span class="info-label">${T('det.cable')}</span>
      <span>${s.num_cables} × ${s.sensors_per_cable} pt</span></div>
    <div class="info-row"><span class="info-label">${T('det.fanStatus')}</span>
      <span>${s.fanOn ? T('det.fanOn') : T('det.fanOff')}</span></div>
    ${inv.supplier ? `<div class="info-row"><span class="info-label">Supplier</span><span>${inv.supplier}</span></div>` : ''}
    ${inv.daysIn   ? `<div class="info-row"><span class="info-label">รับเข้า</span><span>${inv.daysIn} วันที่แล้ว</span></div>` : ''}
  `;
}

// state สำหรับ popup
let _bemSiloId = null;
let _bemCap    = 0;

/** เปิด popup แก้ไขถัง */
function _renderBinInfoEdit(s, inv) {
  _bemSiloId = s.id;
  _bemCap    = s.capacity_tons;

  // ใส่ค่าเข้า modal
  const idEl = document.getElementById('bem-silo-id');
  if (idEl) idEl.textContent = s.id;

  const grainEl = document.getElementById('bem-grain');
  if (grainEl) grainEl.value = inv.grain || '(ว่าง)';

  const fillEl = document.getElementById('bem-fill');
  if (fillEl) fillEl.value = inv.fillPct || 0;

  const supEl = document.getElementById('bem-supplier');
  if (supEl) supEl.value = inv.supplier || '';

  const intakeEl = document.getElementById('bem-intake');
  if (intakeEl) intakeEl.value = inv.intakeDate || '';

  _bemUpdateTons();

  document.getElementById('bin-edit-modal')?.classList.add('open');
}

/** อัปเดต preview ตัน real-time */
function _bemUpdateTons() {
  const fill = parseFloat(document.getElementById('bem-fill')?.value) || 0;
  const hint = document.getElementById('bem-tons-hint');
  if (hint) hint.textContent = Math.round(fill / 100 * _bemCap) + ' ตัน';
}

/** ล้างข้อมูลกลับ default */
function _bemReset() {
  const grainEl = document.getElementById('bem-grain');
  if (grainEl) grainEl.value = '(ว่าง)';
  const fillEl = document.getElementById('bem-fill');
  if (fillEl) fillEl.value = 0;
  const supEl = document.getElementById('bem-supplier');
  if (supEl) supEl.value = '';
  const intakeEl = document.getElementById('bem-intake');
  if (intakeEl) intakeEl.value = '';
  _bemUpdateTons();
}

/** บันทึกจาก popup */
function _bemSave() {
  if (!_bemSiloId) return;
  const grain   = document.getElementById('bem-grain')?.value    || '';
  const fillPct = Math.min(100, Math.max(0, parseInt(document.getElementById('bem-fill')?.value) || 0));
  const supplier= document.getElementById('bem-supplier')?.value.trim() || '';
  const intake  = document.getElementById('bem-intake')?.value   || '';

  const tons   = Math.round(fillPct / 100 * _bemCap);
  const daysIn = intake
    ? Math.max(0, Math.round((Date.now() - new Date(intake).getTime()) / 86400000))
    : undefined;

  const data = { grain, fillPct, tons, supplier,
    ...(intake ? { intakeDate: intake, daysIn } : {}) };

  _siSaveUserInv(_bemSiloId, data);

  // อัปเดต 3D profile (fillPct)
  const cached = _silosCache.find(s => s.id === _bemSiloId);
  if (cached) {
    const matEl = document.getElementById('detail-sensors');
    if (matEl) matEl.innerHTML = _buildSilo3DProfile(cached, fillPct);
  }

  // อัปเดต Bin Info view
  _renderBinInfoView(
    cached || { id: _bemSiloId, capacity_tons: _bemCap },
    data
  );

  closeBinEditModal();
  showToast(`✅ บันทึกข้อมูลถัง ${_bemSiloId} แล้ว`, 'ok');
}

/** ปิด popup */
function closeBinEditModal() {
  document.getElementById('bin-edit-modal')?.classList.remove('open');
}

/** เปิดหน้ารายละเอียดถัง */
async function showDetail(siloId) {
  _selectedSiloId = siloId;   // จำไว้ — เมื่อ back กลับมา dashboard จะ highlight ถังนี้
  showPage('detail', null);
  const silos = _silosCache.length ? _silosCache : await DB.getSilos();
  const s     = silos.find(x => x.id === siloId);
  if (!s) return;

  const inv = await _getInventoryMap();
  const inv_ = inv[siloId] || {};

  // ── 3D Temperature Profile ───────────────────────────────────
  const matrixEl = document.getElementById('detail-sensors');
  if (matrixEl) {
    matrixEl.style.cssText = 'width:100%;min-height:430px';
    matrixEl.innerHTML = _buildSilo3DProfile(s, inv_.fillPct || 0);
    const h3El = matrixEl.closest('.detail-card')?.querySelector('h3');
    if (h3El) {
      h3El.style.cssText = 'display:flex;align-items:center;justify-content:space-between';
      h3El.innerHTML = `
        <span>🌡 3D Temperature Profile &mdash; ${s.id}</span>
        <button class="bi-edit-btn" onclick="AUTH.requireAdmin(()=>_renderBinInfoEdit(_silosCache.find(x=>x.id==='${s.id}')||{id:'${s.id}',capacity_tons:${s.capacity_tons}},_siLoadUserInv('${s.id}')))">✏️ แก้ไขถัง</button>
      `;
    }
  }

  // ── Bin Info (ผสาน user overrides จาก localStorage) ──────────
  const userInv = _siLoadUserInv(siloId);
  const merged  = { ...inv_, ...userInv };          // user ชนะ mock
  _renderBinInfoView(s, merged);
  // อัปเดต 3D profile ด้วย fillPct ใหม่ถ้า user เปลี่ยน
  if (matrixEl && userInv.fillPct !== undefined) {
    matrixEl.innerHTML = _buildSilo3DProfile(s, merged.fillPct || 0);
  }

  // ── Risk Factor & Condition ──────────────────────────────────
  _renderDetailRisk(s);

  // ── Moisture Gradient (per-layer depth) ───────────────────────
  _renderMoistureGradient(s);

  // ── Trend Chart ──────────────────────────────────────────────
  await _renderTrendChart(siloId);
}

/** วาด trend chart 24h — 3 เส้น Max / Avg / Min พร้อม fill band */
async function _renderTrendChart(siloId) {
  const ctx = document.getElementById('trend-chart');
  if (!ctx) return;

  const history = await DB.getSiloReadingHistory(siloId, 24);
  const labels  = history.map(p =>
    new Date(p.reading_at).toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' })
  );
  const avgT = history.map(p => +p.avg_temp.toFixed(1));
  const maxT = history.map(p => +p.max_temp.toFixed(1));
  const minT = history.map(p => +(p.min_temp ?? p.avg_temp - 1.2).toFixed(1));

  if (_trendChart) { _trendChart.destroy(); _trendChart = null; }

  _trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Max °C',
          data: maxT,
          borderColor: '#EF4444',
          backgroundColor: 'rgba(239,68,68,.0)',
          fill: false,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 1.5,
          borderDash: [5, 3],
        },
        {
          label: 'Avg °C',
          data: avgT,
          borderColor: '#00BFA5',
          backgroundColor: 'rgba(0,191,165,.10)',
          fill: '+1',          // fill down to Min line
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2.2,
        },
        {
          label: 'Min °C',
          data: minT,
          borderColor: '#38BDF8',
          backgroundColor: 'rgba(56,189,248,.0)',
          fill: false,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 1.5,
          borderDash: [5, 3],
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#6E8FA8', font: { size: 11 }, boxWidth: 12, padding: 12 },
        },
        tooltip: {
          backgroundColor: '#0A1E30',
          borderColor: 'rgba(0,191,165,.25)',
          borderWidth: 1,
          titleColor: '#C8DDE8',
          bodyColor:  '#6E8FA8',
          callbacks: {
            label: c => ` ${c.dataset.label}: ${c.formattedValue}°C`,
            footer: items => {
              const spread = (items[0].raw - items[2]?.raw).toFixed(1);
              return `Spread: ±${spread}°C`;
            },
          },
          footerColor: 'rgba(110,143,168,.55)',
        },
      },
      scales: {
        x: {
          ticks: { color: '#3A5C73', maxTicksLimit: 8, font: { size: 10 } },
          grid:  { color: 'rgba(0,191,165,.06)' },
        },
        y: {
          ticks: { color: '#3A5C73', font: { size: 10 } },
          grid:  { color: 'rgba(0,191,165,.06)' },
          min: 20, suggestedMax: 42,
          title: { display: true, text: '°C', color: '#3A5C73', font: { size: 11 } },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────
// WEATHER + FAN DECISION CARD (Feature 2)
// EMC-based advisory: เหนือกว่า AGI ที่แสดงแค่สถานะพัดลม
// ─────────────────────────────────────────────────────────────

/**
 * _renderWeatherCard()
 * แสดงอากาศภายนอก + คำนวณ EMC (Henderson-Thompson) + แนะนำการใช้พัดลม
 * เรียกหลัง renderSilos() ทุกครั้ง เพราะต้องใช้ค่าจาก _silosCache
 */
function _renderWeatherCard() {
  const el = document.getElementById('weather-fan-card');
  if (!el) return;

  // Outdoor weather: seed by date for day-consistent values
  const d = new Date();
  let seed = d.getDate() * 137 + (d.getMonth() + 1) * 31 + (d.getFullYear() % 100) * 7;
  const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

  const outdoorTemp = +(24 + rng() * 14).toFixed(1);       // 24–38°C
  const outdoorRH   = Math.round(48 + rng() * 38);         // 48–86%
  const windKmh     = Math.round(rng() * 20 + 2);          // 2–22 km/h
  const condList    = ['☀ Clear','⛅ Partly Cloudy','🌤 Mostly Clear','🌥 Cloudy','🌦 Showers'];
  const cond        = condList[Math.floor(rng() * condList.length)];

  // Average in-bin values from live cache
  const silos = _silosCache.filter(s => s.temp && s.moisture);
  const avgInTemp  = silos.length ? +(silos.reduce((a, s) => a + s.temp,     0) / silos.length).toFixed(1) : 29.5;
  const avgInMois  = silos.length ? +(silos.reduce((a, s) => a + s.moisture, 0) / silos.length).toFixed(1) : 13.2;
  const fansOn     = silos.filter(s => s.fanOn).length;

  // EMC — Henderson-Thompson (wheat/rice: K₁=0.0448, K₂=2.217)
  const ERH = Math.min(0.997, outdoorRH / 100);
  const emc = +Math.pow((-Math.log(1 - ERH)) / 0.0448, 1 / 2.217).toFixed(1);

  // Fan decision logic
  const tempCooler = outdoorTemp < avgInTemp - 1.0;
  const emcDrying  = emc < avgInMois - 0.5;
  const shouldRun  = tempCooler && emcDrying;

  const fanCol    = shouldRun ? '#10B981' : '#EF4444';
  const fanIcon   = shouldRun ? '✅' : '⛔';
  const fanLabel  = shouldRun ? 'เปิดพัดลม' : 'หยุดพัดลม';
  const fanReason = shouldRun
    ? `เย็นกว่า ${(avgInTemp - outdoorTemp).toFixed(1)}°C · EMC ${emc}% ช่วยลดความชื้น`
    : !tempCooler
      ? `อากาศร้อนกว่าถัง +${(outdoorTemp - avgInTemp).toFixed(1)}°C`
      : `EMC สูง (${emc}%) จะเพิ่มความชื้นข้าว`;

  const emcCol = emc > avgInMois ? '#EF4444' : '#00BFA5';

  el.innerHTML = `
    <div class="wf-hd">
      <span class="wf-title">🌤 Weather &amp; Fan Advisor</span>
      <span class="wf-fans" style="color:${fansOn > 0 ? '#00BFA5' : 'var(--text3)'}">
        ${fansOn} fan${fansOn !== 1 ? 's' : ''} running
      </span>
    </div>
    <div class="wf-body">
      <div class="wf-col">
        <div class="wf-col-lbl">🌍 Outdoor</div>
        <div class="wf-stats">
          <div class="wf-s"><span class="wf-sv">${outdoorTemp}°C</span><span class="wf-sl">Temp</span></div>
          <div class="wf-s"><span class="wf-sv">${outdoorRH}%</span><span class="wf-sl">RH</span></div>
          <div class="wf-s"><span class="wf-sv">${windKmh}</span><span class="wf-sl">km/h</span></div>
        </div>
        <div class="wf-cond">${cond}</div>
      </div>
      <div class="wf-vs">vs</div>
      <div class="wf-col">
        <div class="wf-col-lbl">🌾 In-Bin Avg</div>
        <div class="wf-stats">
          <div class="wf-s"><span class="wf-sv">${avgInTemp}°C</span><span class="wf-sl">Temp</span></div>
          <div class="wf-s"><span class="wf-sv">${avgInMois}%</span><span class="wf-sl">Moisture</span></div>
          <div class="wf-s"><span class="wf-sv" style="color:${emcCol}">${emc}%</span><span class="wf-sl">Out EMC</span></div>
        </div>
      </div>
      <div class="wf-decision" style="border-color:${fanCol}30;background:${fanCol}0d">
        <span class="wf-dec-icon">${fanIcon}</span>
        <span class="wf-dec-label" style="color:${fanCol}">${fanLabel}</span>
        <span class="wf-dec-reason">${fanReason}</span>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// FAN CONTROL PAGE
// ─────────────────────────────────────────────────────────────

/** วาด fan card ทุกถัง */
async function renderFans() {
  const silos = _silosCache.length ? _silosCache : await DB.getSilos();
  const grid  = document.getElementById('fan-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // ── Summary KPI ────────────────────────────────────────────
  const fansOn  = silos.filter(s => s.fanOn).length;
  const fansOff = silos.length - fansOn;
  const power   = +(fansOn * 2.2).toFixed(1);
  _setText('fan-cnt-on',    fansOn);
  _setText('fan-cnt-off',   fansOff);
  _setText('fan-total-kw',  power + ' kW');

  // ── Fan Cards ─────────────────────────────────────────────
  silos.forEach(s => {
    const card = document.createElement('div');
    card.className = 'fan-card';
    const isOn   = s.fanOn;
    const reason = _emcReason(s);
    card.innerHTML = `
      <div class="fan-header">
        <span class="fan-silo-id">${s.id}</span>
        <span class="fan-temp" style="color:${tempColor(s.temp)}">${s.temp}°C</span>
        <span class="fan-status ${isOn ? 'fan-on' : 'fan-off'}">${isOn ? T('fan.on') : T('fan.off')}</span>
      </div>
      <div class="fan-visual">
        <svg class="fan-svg ${isOn ? 'spinning' : ''}" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="28" fill="none" stroke="#1e3a5f" stroke-width="2"/>
          <path d="M30 30 Q40 15 30 5 Q20 15 30 30" fill="${isOn ? '#22d3ee' : '#374151'}" opacity="0.9"/>
          <path d="M30 30 Q45 35 50 25 Q40 40 30 30" fill="${isOn ? '#22d3ee' : '#374151'}" opacity="0.9" transform="rotate(120 30 30)"/>
          <path d="M30 30 Q45 35 50 25 Q40 40 30 30" fill="${isOn ? '#22d3ee' : '#374151'}" opacity="0.9" transform="rotate(240 30 30)"/>
          <circle cx="30" cy="30" r="5" fill="#111827" stroke="#374151" stroke-width="2"/>
        </svg>
        <div class="fan-hub"></div>
      </div>
      <div class="fan-reason">${reason}</div>
      <div class="fan-controls">
        <div class="fan-threshold-row">
          <span class="threshold-label">${T('fan.openAt')}</span>
          <input class="threshold-input" type="number" value="${CONFIG.TEMP_OK_MAX}" min="20" max="40" onchange="updateFanThreshold('${s.id}','open',this.value)">
        </div>
        <div class="fan-threshold-row">
          <span class="threshold-label">${T('fan.closeAt')}</span>
          <input class="threshold-input" type="number" value="${CONFIG.TEMP_OK_MAX - 2}" min="18" max="38" onchange="updateFanThreshold('${s.id}','close',this.value)">
        </div>
        <div class="toggle-row" style="margin-top:8px;">
          <span style="font-size:12px;color:var(--text2)">Manual Override</span>
          <div class="toggle ${isOn ? 'on' : ''}" onclick="toggleFan('${s.id}',this)" title="Override auto mode"></div>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

/** EMC อธิบายเหตุผลที่พัดลมเปิด/ปิด */
function _emcReason(s) {
  if (s.temp >= CONFIG.TEMP_CRIT_MIN) return T('fan.reasonHigh');
  if (s.fanOn) return T('fan.reasonGood');
  if (Math.random() > 0.6) return T('fan.reasonHumid');
  return T('fan.reasonIdle');
}

/** Toggle พัดลม manual */
async function toggleFan(siloId, toggleEl) {
  const s = _silosCache.find(x => x.id === siloId);
  if (!s) return;
  s.fanOn = !s.fanOn;
  toggleEl.classList.toggle('on', s.fanOn);
  showToast(`${siloId}: ${s.fanOn ? T('fan.open') : T('fan.close')}`, s.fanOn ? 'ok' : 'warn');
}

/** อัปเดต threshold (demo: แค่แสดง toast) */
function updateFanThreshold(siloId, type, val) {
  showToast(`${siloId} ${type === 'open' ? T('fan.openAt') : T('fan.closeAt')} → ${val}°C`);
}

// ─────────────────────────────────────────────────────────────
// GRAIN QUALITY PAGE
// ─────────────────────────────────────────────────────────────

/** วาดหน้า Grain Quality */
async function renderQuality(filter) {
  if (filter !== undefined) _qualityFilter = filter;
  const silos = _silosCache.length ? _silosCache : await DB.getSilos();

  // ── Phase Banner ──────────────────────────────────────────
  const bannerEl = document.getElementById('quality-phase-banner');
  if (bannerEl) bannerEl.innerHTML = _buildPhaseBanner();

  // ── KPI ───────────────────────────────────────────────────
  const kpiEl = document.getElementById('quality-kpi');
  if (kpiEl) {
    const totalTons  = MOCK_DATA.siloInventory.reduce((a, v) => a + v.tons, 0);
    const avgFill    = Math.round(MOCK_DATA.siloInventory.reduce((a, v) => a + v.fillPct, 0) / MOCK_DATA.siloInventory.length);
    const critCount  = silos.filter(s => s.temp >= CONFIG.TEMP_CRIT_MIN).length;
    const warnCount  = silos.filter(s => s.temp >= CONFIG.TEMP_OK_MAX && s.temp < CONFIG.TEMP_CRIT_MIN).length;
    const co2critC   = silos.filter(s => s.co2 > 1500).length;
    const moistWarnC = silos.filter(s => s.moisture > CONFIG.MOIS_WARN_MAX).length;
    kpiEl.innerHTML = `
      <div class="summary-card c-red">
        <div class="label">${T('q.tempCrit')}</div>
        <div class="value" style="color:var(--red)">${critCount}</div>
        <div class="sub">${T('q.tempCritSub')}</div>
      </div>
      <div class="summary-card c-yellow">
        <div class="label">${T('q.tempWarn')}</div>
        <div class="value" style="color:var(--yellow)">${warnCount}</div>
        <div class="sub">${T('q.tempWarnSub')}</div>
      </div>
      <div class="summary-card" style="border-left:3px solid var(--teal)">
        <div class="label">${T('q.co2crit')}</div>
        <div class="value" style="color:var(--teal)">${co2critC}</div>
        <div class="sub">${T('q.bins')}</div>
      </div>
      <div class="summary-card c-green">
        <div class="label">${T('q.totalGrain')}</div>
        <div class="value" style="color:var(--green)">${numFmt(totalTons)}</div>
        <div class="sub">${T('q.tonnes')} ${avgFill}%</div>
      </div>
    `;
  }

  // ── Quality Cards ─────────────────────────────────────────
  const gridEl = document.getElementById('quality-grid');
  if (!gridEl) return;
  gridEl.innerHTML = '';

  let filtered = silos;
  if (_qualityFilter === 'co2')  filtered = silos.filter(s => s.co2  > CONFIG.CO2_WARN_MAX);
  if (_qualityFilter === 'mois') filtered = silos.filter(s => s.moisture > CONFIG.MOIS_OK_MAX);

  const inv = await _getInventoryMap();

  filtered.forEach(s => {
    const inv_ = inv[s.id] || {};
    const card = document.createElement('div');
    card.className = 'quality-card';
    card.innerHTML = `
      <div class="qc-header">
        <span class="qc-id">${s.id}</span>
        <span class="qc-grain">${inv_.grain || '—'}</span>
        <span class="qc-status ${s.status}">${T('status.' + (s.status === 'red' ? 'crit' : s.status === 'yellow' ? 'warn' : 'ok'))}</span>
      </div>
      <div class="qc-row">
        <span class="qc-label">${T('q.temp')}</span>
        <span style="color:${tempColor(s.temp)};font-weight:700">${s.temp}°C</span>
      </div>
      <div class="qc-row">
        <span class="qc-label">CO₂</span>
        <span class="${co2Class(s.co2)}">${s.co2} ppm</span>
      </div>
      <div class="qc-row">
        <span class="qc-label">${T('det.moisture')}</span>
        <span class="${moistClass(s.moisture)}">${s.moisture}%</span>
      </div>
      <div class="qc-row">
        <span class="qc-label">${T('q.fill')}</span>
        <span style="color:${fillColor(inv_.fillPct||0)}">${inv_.fillPct||0}%</span>
      </div>
    `;
    gridEl.appendChild(card);
  });
}

/** filter quality cards */
function filterQuality(f, btn) {
  _qualityFilter = f;
  document.querySelectorAll('#page-quality .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderQuality();
}

/** Phase 1 / Phase 2 banner */
function _buildPhaseBanner() {
  const p1f = (T('q.phase1Feats') || []).map(f => `<li>${f}</li>`).join('');
  const p2f = (T('q.phase2Feats') || []).map(f => `<li>${f}</li>`).join('');
  return `
    <div class="phase-card phase-active">
      <div class="phase-title">${T('q.phase1Title')} <span class="phase-badge active">${T('q.phase1Active')}</span></div>
      <ul class="phase-feats">${p1f}</ul>
    </div>
    <div class="phase-card phase-locked">
      <div class="phase-title">${T('q.phase2Title')} <span class="phase-badge locked">${T('q.phase2Lock')}</span></div>
      <ul class="phase-feats">${p2f}</ul>
      <button class="upgrade-cta" onclick="showToast('${T('q.upgradeCta')}')">${T('q.upgradeCta')}</button>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────

/** แสดง fumigation overdue strip ใน dashboard */
function _renderFumStrip(overdues) {
  const strip = document.getElementById('fum-dash-strip');
  const chips = document.getElementById('fum-dash-chips');
  if (!strip || !chips) return;
  const cntEl = document.getElementById('cnt-fum-overdue');
  const subEl = document.getElementById('cnt-fum-sub');
  if (cntEl) cntEl.textContent = overdues.length;
  if (subEl) subEl.textContent = overdues.length ? 'เกินกำหนด — ดำเนินการด่วน!' : 'ทุกถังปกติ';

  if (!overdues.length) { strip.style.display = 'none'; return; }
  strip.style.display = 'flex';
  chips.innerHTML = overdues.map(f =>
    `<span style="background:#7c2d12;border-radius:6px;padding:2px 10px;font-size:11px;font-weight:700;color:#fcd34d">${f.id} <span style="font-weight:400">${f.days}d</span></span>`
  ).join('');
}

/** ดึง inventory map { siloId → entry } */
async function _getInventoryMap() {
  if (CONFIG.DEMO_MODE) {
    return Object.fromEntries(MOCK_DATA.siloInventory.map(e => [e.id, e]));
  }
  const rows = await DB.getSilos();  // inventory embedded in silo response
  return Object.fromEntries(rows.map(r => [r.id, r.grain_inventory?.[0] || {}]));
}

/** ดึง fumigation map { siloId → entry } */
async function _getFumMap() {
  const fum = await DB.getFumigationStatus();
  return Object.fromEntries(fum.map(f => [f.id, f]));
}

/** setText helper */
function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─────────────────────────────────────────────────────────────
// NAV OFFSET SYNC
// ─────────────────────────────────────────────────────────────

/**
 * ตั้ง top ของ #page-dashboard ให้ตรงกับ bottom ของ nav จริง ๆ
 * รองรับกรณีที่มี demo-banner อยู่เหนือ nav
 */
function _syncDashboardTop() {
  const nav = document.querySelector('nav');
  const pg  = document.getElementById('page-dashboard');
  if (!nav || !pg) return;
  const bottom = Math.round(nav.getBoundingClientRect().bottom);
  if (bottom > 0) pg.style.top = bottom + 'px';
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR SILO LIST
// ─────────────────────────────────────────────────────────────

/** วาด sidebar list ด้านซ้าย */
function _renderSidebarList(silos, inv) {
  const listEl = document.getElementById('silo-sidebar-list');
  if (!listEl) return;

  // ลำดับ: red ก่อน → yellow → green
  const sorted = [...silos].sort((a, b) => {
    const pri = { red: 0, yellow: 1, green: 2 };
    return (pri[a.status] ?? 3) - (pri[b.status] ?? 3);
  });

  listEl.innerHTML = sorted.map(s => {
    const inv_ = inv ? (inv[s.id] || {}) : {};
    const isSelected = _selectedSiloId === s.id;
    return `
      <div class="sl-row${isSelected ? ' on' : ''}" onclick="selectSilo('${s.id}')">
        <span class="sl-dot-sb ${s.status}"></span>
        <span class="sl-id">${s.id}</span>
        <span class="sl-temp" style="color:${_tempCol(s.temp)}">${s.temp}°C</span>
      </div>
    `;
  }).join('');
}

// ─────────────────────────────────────────────────────────────
// SELECT SILO (detail panel)
// ─────────────────────────────────────────────────────────────

/** เลือกถัง → อัปเดต detail panel + sidebar highlight + card highlight */
async function selectSilo(siloId) {
  _selectedSiloId = siloId;

  // อัปเดต selected class บน silo cards
  document.querySelectorAll('.silo-card').forEach(c => {
    const id = c.querySelector('.silo-id')?.textContent;
    c.classList.toggle('db-selected', id === siloId);
  });

  // อัปเดต selected class บน sidebar rows
  document.querySelectorAll('.sl-row').forEach(r => {
    const id = r.querySelector('.sl-id')?.textContent;
    r.classList.toggle('on', id === siloId);
  });

  const silos = _silosCache.length ? _silosCache : await DB.getSilos();
  const s     = silos.find(x => x.id === siloId);
  if (!s) return;

  const inv  = await _getInventoryMap();
  const inv_ = inv[siloId] || {};

  _renderDetailPanel(s, inv_);
}

// ─────────────────────────────────────────────────────────────
// DETAIL PANEL (right)
// ─────────────────────────────────────────────────────────────

/** วาด right detail panel */
async function _renderDetailPanel(s, inv_) {
  // ── Header ────────────────────────────────────────────────
  _setText('det-sid', s.id);
  _setText('det-desc', inv_.grain ? `${inv_.grain} · ${inv_.fillPct || 0}%` : 'ว่าง');
  const fullBtn = document.getElementById('det-full-btn');
  if (fullBtn) fullBtn.style.display = 'inline-flex';

  // ── Sensor chips ─────────────────────────────────────────
  const chipsEl = document.getElementById('det-chips');
  if (chipsEl) {
    const zones = [
      { lbl: 'Top',  t: s.temp + 0.35 },
      { lbl: 'Mid',  t: s.temp },
      { lbl: 'Bot',  t: s.temp - 0.4  },
    ];
    chipsEl.innerHTML = zones.map(z => `
      <div class="s-chip-db">
        <span class="s-pip-db" style="background:${_tempCol(z.t)}"></span>
        ${z.lbl}: <span style="color:${_tempCol(z.t)};font-weight:700">${z.t.toFixed(1)}°C</span>
      </div>
    `).join('');
  }

  // ── Trend chart ───────────────────────────────────────────
  const ctx = document.getElementById('det-trend-chart');
  if (ctx) {
    const history = await DB.getSiloReadingHistory(s.id, 24);
    const labels  = history.map(p =>
      new Date(p.reading_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    );
    const avgTemp = history.map(p => p.avg_temp);
    const maxTemp = history.map(p => p.max_temp);

    if (_detChart) _detChart.destroy();
    _detChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Avg °C',
            data: avgTemp,
            borderColor: '#00BFA5',
            backgroundColor: ctx => {
              const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 110);
              g.addColorStop(0, 'rgba(0,191,165,.22)');
              g.addColorStop(1, 'rgba(0,191,165,.00)');
              return g;
            },
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 1.8,
          },
          {
            label: 'Max °C',
            data: maxTemp,
            borderColor: '#EF4444',
            fill: false,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 1.2,
            borderDash: [3, 3],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0A1E30',
            borderColor: 'rgba(0,191,165,.25)',
            borderWidth: 1,
            titleColor: '#C8DDE8',
            bodyColor: '#6E8FA8',
            callbacks: { label: c => `${c.dataset.label}: ${c.formattedValue}°C` },
          },
        },
        scales: {
          x: {
            ticks: { color: '#3A5C73', maxTicksLimit: 6, font: { size: 9 } },
            grid:  { color: 'rgba(0,191,165,.05)' },
          },
          y: {
            ticks: { color: '#3A5C73', font: { size: 9 } },
            grid:  { color: 'rgba(0,191,165,.05)' },
            min: 22, suggestedMax: 38,
          },
        },
      },
    });
  }

  // ── DM row (avg temp, CO2, moisture) ──────────────────────
  _setText('det-dm-t', `${s.temp}°C`);
  _setText('det-dm-c', `${s.co2} ppm`);
  _setText('det-dm-m', `${s.moisture}%`);

  // ── Sensor Zones ─────────────────────────────────────────
  const sensorEl = document.getElementById('det-sensor-info');
  if (sensorEl) {
    const zones = [
      { lbl: 'Top Zone',    t: s.temp + 0.35 },
      { lbl: 'Middle Zone', t: s.temp        },
      { lbl: 'Bottom Zone', t: s.temp - 0.4  },
    ];
    sensorEl.innerHTML = zones.map(z => `
      <div class="zone-row">
        <span class="zone-dot" style="background:${_tempCol(z.t)}"></span>
        <span class="zone-lbl">${z.lbl}</span>
        <span class="zone-val" style="color:${_tempCol(z.t)}">${z.t.toFixed(1)}°C</span>
      </div>
    `).join('') + `
      <div class="zone-row" style="border-bottom:none">
        <span class="zone-dot" style="background:var(--teal)"></span>
        <span class="zone-lbl">CO₂</span>
        <span class="zone-val" style="color:var(--teal)">${s.co2} ppm</span>
      </div>
    `;
  }

  // ── Bin Info ─────────────────────────────────────────────
  const binEl = document.getElementById('det-bin-info');
  if (binEl) {
    const fillPct = inv_.fillPct || 0;
    const tons    = inv_.tons    || 0;
    const cap     = s.capacity_tons || 0;
    const rows = [
      ['ประเภทข้าว',  inv_.grain || '(ว่าง)'],
      ['ปริมาณ',      `${numFmt(tons)}/${numFmt(cap)} ตัน (${fillPct}%)`],
      ['Fan',         s.fanOn ? '🟢 เปิด' : '⚫ ปิด'],
      ['Sensors',     `${s.num_cables}C × ${s.sensors_per_cable}pt`],
      inv_.supplier ? ['Supplier', inv_.supplier] : null,
      inv_.daysIn   ? ['รับเข้า',   `${inv_.daysIn} วันที่แล้ว`] : null,
    ].filter(Boolean);

    binEl.innerHTML = rows.map(([lbl, val]) => `
      <div class="det-info-row">
        <span class="det-info-lbl">${lbl}</span>
        <span style="font-family:monospace;font-size:11px">${val}</span>
      </div>
    `).join('');
  }
}
