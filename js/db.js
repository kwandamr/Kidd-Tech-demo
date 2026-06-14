/**
 * ═══════════════════════════════════════════════════════════════
 * db.js — Data Access Layer (Mock ↔ Supabase)
 * ═══════════════════════════════════════════════════════════════
 * Abstraction layer: โค้ดอื่นๆ เรียกผ่านไฟล์นี้เสมอ
 * ไม่ว่าจะเป็น demo mode หรือ production mode
 * interface เหมือนกันทุกอย่าง
 *
 * วิธีใช้งาน:
 *   const silos = await DB.getSilos();
 *   const jobs  = await DB.getJobs({ status: 'scheduled' });
 *   await DB.updateJob(jobId, { status: 'inprogress' });
 *
 * Dependencies: config.js, data.js (mock data)
 * ═══════════════════════════════════════════════════════════════
 */

const DB = (() => {

  // ── Supabase client (โหลดเมื่อ DEMO_MODE = false) ──────────
  let _supabase = null;

  function _initSupabase() {
    if (_supabase) return _supabase;
    if (typeof supabase !== 'undefined') {
      _supabase = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    }
    return _supabase;
  }

  // ─────────────────────────────────────────────────────────────
  // SILOS
  // ─────────────────────────────────────────────────────────────

  /** ดึงถังทั้งหมดพร้อม inventory ล่าสุด */
  async function getSilos(filters = {}) {
    if (CONFIG.DEMO_MODE) {
      return MOCK_DATA.silos.filter(s =>
        (!filters.zone || s.zone === filters.zone)
      );
    }
    const sb = _initSupabase();
    let q = sb.from('silos').select(`
      *,
      grain_inventory(*),
      v_silo_latest_reading(*)
    `);
    if (filters.zone) q = q.eq('zone', filters.zone);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  /** อัปเดต inventory ของถัง (หลังจาก job complete) */
  async function updateInventory(siloId, changes) {
    if (CONFIG.DEMO_MODE) {
      const inv = MOCK_DATA.siloInventory.find(s => s.id === siloId);
      if (inv) Object.assign(inv, changes);
      return inv;
    }
    const sb = _initSupabase();
    const { data, error } = await sb
      .from('grain_inventory')
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq('silo_id', siloId)
      .select();
    if (error) throw error;
    return data[0];
  }

  // ─────────────────────────────────────────────────────────────
  // SENSOR READINGS
  // ─────────────────────────────────────────────────────────────

  /** ดึงค่าเซ็นเซอร์ล่าสุดของถังทั้งหมด (ใช้ view) */
  async function getLatestReadings() {
    if (CONFIG.DEMO_MODE) return MOCK_DATA.latestReadings;
    const sb = _initSupabase();
    const { data, error } = await sb.from('v_silo_latest_reading').select('*');
    if (error) throw error;
    return data;
  }

  /** ดึงประวัติอุณหภูมิถังเดียว (สำหรับ trend chart) */
  async function getSiloReadingHistory(siloId, hours = 24) {
    if (CONFIG.DEMO_MODE) {
      // สร้าง mock trend data
      return _generateMockTrend(siloId, hours);
    }
    const since = new Date(Date.now() - hours * 3600000).toISOString();
    const sb = _initSupabase();
    const { data, error } = await sb
      .from('sensor_readings')
      .select('reading_at, cable_no, sensor_no, temp_celsius, co2_ppm, moisture_pct')
      .eq('silo_id', siloId)
      .gte('reading_at', since)
      .order('reading_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  // ─────────────────────────────────────────────────────────────
  // TRANSFER JOBS
  // ─────────────────────────────────────────────────────────────

  /** ดึง jobs ทั้งหมด หรือกรองตาม status */
  async function getJobs(filters = {}) {
    if (CONFIG.DEMO_MODE) {
      let jobs = [...MOCK_DATA.aerJobs];
      if (filters.status) jobs = jobs.filter(j => j.status === filters.status);
      if (filters.date)   jobs = jobs.filter(j => j.date === filters.date);
      return jobs;
    }
    const sb = _initSupabase();
    let q = sb.from('transfer_jobs').select(`
      *,
      from_silo:silos!from_silo_id(code, zone, conv_line),
      to_silo:silos!to_silo_id(code, zone, conv_line)
    `).order('scheduled_date').order('scheduled_time').order('priority');
    if (filters.status) q = q.eq('status', filters.status);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  /** สร้าง job ใหม่ */
  async function createJob(jobData) {
    if (CONFIG.DEMO_MODE) {
      const newJob = {
        id: MOCK_DATA._jobIdCounter++,
        ...jobData,
        status: 'scheduled',
        created: new Date().toLocaleDateString('th-TH'),
      };
      MOCK_DATA.aerJobs.unshift(newJob);
      return newJob;
    }
    const sb = _initSupabase();
    const { data, error } = await sb
      .from('transfer_jobs')
      .insert(jobData)
      .select();
    if (error) throw error;
    return data[0];
  }

  /** อัปเดตสถานะ/ข้อมูล job */
  async function updateJob(jobId, changes) {
    if (CONFIG.DEMO_MODE) {
      const job = MOCK_DATA.aerJobs.find(j => j.id === jobId);
      if (job) Object.assign(job, changes);
      return job;
    }
    const sb = _initSupabase();
    const { data, error } = await sb
      .from('transfer_jobs')
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq('id', jobId)
      .select();
    if (error) throw error;
    return data[0];
  }

  // ─────────────────────────────────────────────────────────────
  // FUMIGATION
  // ─────────────────────────────────────────────────────────────

  /** ดึงสถานะ fumigation ทุกถัง */
  async function getFumigationStatus() {
    if (CONFIG.DEMO_MODE) return MOCK_DATA.fumData;
    const sb = _initSupabase();
    const { data, error } = await sb
      .from('v_silo_fumigation_status')
      .select('*');
    if (error) throw error;
    return data;
  }

  /** บันทึก fumigation (start หรือ complete) */
  async function logFumigation(siloId, action, extra = {}) {
    if (CONFIG.DEMO_MODE) {
      const s = MOCK_DATA.fumData.find(f => f.id === siloId);
      if (!s) return null;
      if (action === 'start') {
        s.fuming = true;
      } else {
        s.fuming = false;
        s.days = 0;
        s.lastDate = new Date().toLocaleDateString('th-TH');
      }
      return s;
    }
    const sb = _initSupabase();
    if (action === 'start') {
      const { data, error } = await sb.from('fumigation_records').insert({
        silo_id: siloId,
        status: 'active',
        started_at: new Date().toISOString(),
        ...extra,
      }).select();
      if (error) throw error;
      return data[0];
    } else {
      // complete: อัปเดต record ล่าสุด
      const { data, error } = await sb
        .from('fumigation_records')
        .update({ status: 'complete', completed_at: new Date().toISOString() })
        .eq('silo_id', siloId)
        .eq('status', 'active')
        .select();
      if (error) throw error;
      return data[0];
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ALARMS
  // ─────────────────────────────────────────────────────────────

  /** ดึง alarm ที่ยังเปิดอยู่ */
  async function getActiveAlarms() {
    if (CONFIG.DEMO_MODE) return MOCK_DATA.alarms;
    const sb = _initSupabase();
    const { data, error } = await sb
      .from('alarms')
      .select('*, silos(code)')
      .eq('is_active', true)
      .order('triggered_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data;
  }

  /** Acknowledge alarm */
  async function acknowledgeAlarm(alarmId) {
    if (CONFIG.DEMO_MODE) {
      const a = MOCK_DATA.alarms.find(x => x.id === alarmId);
      if (a) a.acknowledged_at = new Date().toISOString();
      return a;
    }
    const sb = _initSupabase();
    const { data, error } = await sb
      .from('alarms')
      .update({ acknowledged_at: new Date().toISOString() })
      .eq('id', alarmId)
      .select();
    if (error) throw error;
    return data[0];
  }

  // ─────────────────────────────────────────────────────────────
  // REALTIME SUBSCRIPTIONS (Production only)
  // ─────────────────────────────────────────────────────────────

  /**
   * Subscribe ค่าเซ็นเซอร์ real-time
   * callback(payload) จะถูกเรียกทุกครั้งที่มีข้อมูลใหม่
   */
  function subscribeToSensors(callback) {
    if (CONFIG.DEMO_MODE) {
      // ใน demo mode: จำลองด้วย setInterval
      return setInterval(() => {
        callback({ type: 'INSERT', new: _generateMockReading() });
      }, CONFIG.SENSOR_INTERVAL_SEC * 1000);
    }
    const sb = _initSupabase();
    return sb
      .channel('sensor-readings')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sensor_readings' }, callback)
      .subscribe();
  }

  /** Subscribe job status changes */
  function subscribeToJobs(callback) {
    if (CONFIG.DEMO_MODE) return null; // ไม่ต้อง subscribe ใน demo
    const sb = _initSupabase();
    return sb
      .channel('transfer-jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transfer_jobs' }, callback)
      .subscribe();
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────

  function _generateMockTrend(siloId, hours) {
    const points = [];
    const now = Date.now();
    // seed from siloId → consistent per silo
    let seed = (siloId || 'S01').split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 7;
    const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = hours; i >= 0; i -= 1) {
      const base = 26 + rng() * 9;
      points.push({
        reading_at: new Date(now - i * 3600000).toISOString(),
        avg_temp:  +(base).toFixed(1),
        max_temp:  +(base + 1.0 + rng() * 1.8).toFixed(1),
        min_temp:  +(base - 0.8 - rng() * 1.5).toFixed(1),
      });
    }
    return points;
  }

  function _generateMockReading() {
    return {
      silo_id: 'S01',
      temp_celsius: (28 + Math.random() * 10).toFixed(1),
      reading_at: new Date().toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────
  return {
    // Silos
    getSilos, updateInventory,
    // Sensors
    getLatestReadings, getSiloReadingHistory,
    // Jobs
    getJobs, createJob, updateJob,
    // Fumigation
    getFumigationStatus, logFumigation,
    // Alarms
    getActiveAlarms, acknowledgeAlarm,
    // Realtime
    subscribeToSensors, subscribeToJobs,
  };

})();
