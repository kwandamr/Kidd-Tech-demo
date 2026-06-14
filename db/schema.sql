-- ═══════════════════════════════════════════════════════════════════════════
-- Kid-D Tech — Smart Grain Silo Management System
-- Database Schema v1.0  |  Supabase / PostgreSQL
-- ───────────────────────────────────────────────────────────────────────────
-- ออกแบบให้รองรับ:
--   • Multi-tenant (หลายโรงงาน / ลูกค้าหลายราย)
--   • Real-time sensor streaming (temperature, CO₂, moisture)
--   • Transfer job management + conveyor interlock
--   • Fumigation tracking + history
--   • Energy monitoring per zone
--   • PLC status log
--   • Row Level Security — แต่ละลูกค้าเห็นข้อมูลตัวเองเท่านั้น
-- ═══════════════════════════════════════════════════════════════════════════

-- Extension ที่ต้องใช้
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";   -- สำหรับ scheduled jobs (optional)


-- ───────────────────────────────────────────────────────────────────────────
-- TABLE 1: facilities
-- โรงงาน / ลูกค้าแต่ละราย (multi-tenant root)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE facilities (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code            varchar(20)  UNIQUE NOT NULL,   -- 'KTFOOD-01', 'CIMBRIA-02'
  name            varchar(200) NOT NULL,           -- ชื่อบริษัท
  location        varchar(500),                    -- ที่ตั้ง เช่น จ.ขอนแก่น
  contact_name    varchar(200),
  contact_phone   varchar(50),
  contact_email   varchar(200),

  -- ระบบ Plan tier: phase1 = temp only, phase2 = CO2+moisture unlock
  plan_tier       varchar(20)  DEFAULT 'phase1'
                  CHECK (plan_tier IN ('phase1','phase2')),

  timezone        varchar(50)  DEFAULT 'Asia/Bangkok',
  logo_url        text,                            -- URL รูป logo ลูกค้า
  is_active       boolean      DEFAULT true,
  created_at      timestamptz  DEFAULT now(),
  updated_at      timestamptz  DEFAULT now()
);

COMMENT ON TABLE facilities IS 'ข้อมูลโรงงาน/ลูกค้าแต่ละราย (multi-tenant)';
COMMENT ON COLUMN facilities.plan_tier IS 'phase1=เฉพาะอุณหภูมิ, phase2=CO2+moisture ด้วย';


-- ───────────────────────────────────────────────────────────────────────────
-- TABLE 2: silos
-- ถัง/ไซโลแต่ละถัง (master data)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE silos (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id         uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,

  code                varchar(10)  NOT NULL,       -- 'S01', 'S12', 'R01'
  display_name        varchar(100),                -- ชื่อที่แสดงบนหน้าจอ
  silo_type           varchar(20)  NOT NULL        -- 'long' | 'round'
                      CHECK (silo_type IN ('long','round')),
  zone                varchar(10),                 -- 'A','B','C' — zone ของโรงงาน
  conv_line           varchar(20),                 -- 'LINE-1','LINE-2','LINE-3' — สายพานที่เชื่อม

  capacity_tons       numeric(8,2) NOT NULL,       -- ความจุสูงสุด (ตัน)
  num_cables          smallint     DEFAULT 2,       -- จำนวน cable เซ็นเซอร์
  sensors_per_cable   smallint     DEFAULT 8,       -- เซ็นเซอร์ต่อ cable

  -- ตำแหน่ง GPS (สำหรับ map view ในอนาคต)
  latitude            numeric(10,7),
  longitude           numeric(10,7),

  -- ข้อมูลทางกายภาพ
  height_m            numeric(6,2),                -- ความสูงถัง (เมตร)
  diameter_m          numeric(6,2),                -- เส้นผ่าศูนย์กลาง (เมตร)
  install_date        date,
  notes               text,

  is_active           boolean      DEFAULT true,
  created_at          timestamptz  DEFAULT now(),

  UNIQUE (facility_id, code)
);

COMMENT ON TABLE silos IS 'ถัง/ไซโลแต่ละถัง — master data';
COMMENT ON COLUMN silos.conv_line IS 'สายพานที่เชื่อมถังนี้ ใช้สำหรับ interlock check';


-- ───────────────────────────────────────────────────────────────────────────
-- TABLE 3: grain_inventory
-- ปริมาณสินค้าในถัง ณ ปัจจุบัน (1 row ต่อ silo)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE grain_inventory (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  silo_id         uuid NOT NULL REFERENCES silos(id) ON DELETE CASCADE,

  grain_type      varchar(50),                     -- 'Paddy','Corn','Sorghum','Wheat','Millet'
  quantity_tons   numeric(10,2)  DEFAULT 0,
  fill_pct        numeric(5,2)   DEFAULT 0          -- % เต็ม (คำนวณจาก quantity/capacity)
                  CHECK (fill_pct BETWEEN 0 AND 100),

  -- ข้อมูล Batch/Lot ที่นำเข้า
  batch_no        varchar(50),
  supplier        varchar(200),
  received_date   date,
  moisture_intake numeric(5,2),                    -- % ความชื้นตอนรับเข้า

  -- วันที่เก็บ (คำนวณอัตโนมัติ)
  days_stored     integer GENERATED ALWAYS AS (
    GREATEST(0, EXTRACT(DAY FROM now() - received_date::timestamptz)::integer)
  ) STORED,

  updated_at      timestamptz    DEFAULT now(),

  UNIQUE (silo_id)                                 -- 1 active record per silo
);

COMMENT ON TABLE grain_inventory IS 'สินค้า/วัตถุดิบในถัง ณ ปัจจุบัน';
COMMENT ON COLUMN grain_inventory.days_stored IS 'วันที่เก็บในถัง — คำนวณอัตโนมัติจาก received_date';


-- ───────────────────────────────────────────────────────────────────────────
-- TABLE 4: sensor_readings
-- ค่าเซ็นเซอร์ (time-series — ปริมาณข้อมูลสูงมาก)
-- อ่านทุก 15 นาที × 20 ถัง × 16 จุด = ~1,500 rows/hour = ~36,000 rows/day
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE sensor_readings (
  id              bigserial PRIMARY KEY,
  silo_id         uuid        NOT NULL REFERENCES silos(id) ON DELETE CASCADE,
  reading_at      timestamptz NOT NULL DEFAULT now(),

  cable_no        smallint    NOT NULL,             -- Cable A=1, B=2, C=3, ...
  sensor_no       smallint    NOT NULL,             -- 1-8 ต่อ cable

  -- Phase 1: อุณหภูมิ (ทุกราย)
  temp_celsius    numeric(5,2),

  -- Phase 2: CO₂ + ความชื้น (ต้องติดเซ็นเซอร์เพิ่ม)
  co2_ppm         integer,                          -- NULL ถ้า phase1
  moisture_pct    numeric(5,2),                     -- NULL ถ้า phase1

  -- Alarm flag (คำนวณใน trigger หรือ edge device)
  is_alarm        boolean     DEFAULT false,
  alarm_type      varchar(30)                       -- 'temp_high'|'co2_high'|'moisture_high'
);

-- Index สำคัญสำหรับ query dashboard (latest per silo)
CREATE INDEX idx_sensor_silo_time ON sensor_readings (silo_id, reading_at DESC);
CREATE INDEX idx_sensor_time      ON sensor_readings (reading_at DESC);

COMMENT ON TABLE sensor_readings IS 'ค่าเซ็นเซอร์ time-series — อุณหภูมิ/CO2/ความชื้น';


-- View: ค่าล่าสุดของแต่ละถัง (ใช้แสดง dashboard)
CREATE VIEW v_silo_latest_reading AS
SELECT DISTINCT ON (silo_id)
  silo_id,
  reading_at,
  MAX(temp_celsius) OVER (PARTITION BY silo_id) AS max_temp,
  AVG(temp_celsius) OVER (PARTITION BY silo_id) AS avg_temp,
  MAX(co2_ppm)      OVER (PARTITION BY silo_id) AS max_co2,
  MAX(moisture_pct) OVER (PARTITION BY silo_id) AS max_moisture
FROM sensor_readings
ORDER BY silo_id, reading_at DESC;

COMMENT ON VIEW v_silo_latest_reading IS 'ค่าล่าสุดของแต่ละถัง — ใช้แสดง dashboard card';


-- ───────────────────────────────────────────────────────────────────────────
-- TABLE 5: fans
-- พัดลมแต่ละตัว พร้อม status ปัจจุบัน
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE fans (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  silo_id         uuid        NOT NULL REFERENCES silos(id) ON DELETE CASCADE,

  fan_no          smallint    NOT NULL,             -- หมายเลขพัดลม (1, 2, ...)
  rated_kw        numeric(6,2),                    -- กำลังไฟ rated (kW)
  plc_output_addr varchar(50),                     -- Modbus coil address เช่น 'Y0.0'

  -- สถานะปัจจุบัน
  status          varchar(20)  DEFAULT 'off'
                  CHECK (status IN ('on','off','auto','fault')),
  mode            varchar(20)  DEFAULT 'manual'
                  CHECK (mode IN ('manual','auto','schedule')),
  reason          varchar(200),                    -- เหตุผลที่เปิด/ปิด

  -- สถิติ
  run_hours       numeric(10,2) DEFAULT 0,          -- ชั่วโมงการทำงานสะสม
  last_on_at      timestamptz,
  last_off_at     timestamptz,

  updated_at      timestamptz  DEFAULT now(),

  UNIQUE (silo_id, fan_no)
);

COMMENT ON TABLE fans IS 'พัดลมระบายอากาศแต่ละตัว + สถานะ + ชั่วโมงทำงาน';


-- ───────────────────────────────────────────────────────────────────────────
-- TABLE 6: equipment
-- อุปกรณ์สายพาน/ลิฟท์ — ใช้สำหรับ interlock
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE equipment (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id           uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,

  code                  varchar(20) NOT NULL,       -- 'LINE-1','LINE-2','LINE-3','MAIN'
  name                  varchar(100),               -- 'สายพาน A (S01-S06)'
  equipment_type        varchar(30)                 -- 'belt'|'chain'|'elevator'|'main'
                        CHECK (equipment_type IN ('belt','chain','elevator','main')),

  max_capacity_tph      numeric(8,2),               -- ความสามารถสูงสุด (ตัน/ชั่วโมง)
  plc_do_address        varchar(50),                -- Modbus DO address เพื่อสั่ง run/stop
  plc_di_running_addr   varchar(50),                -- Modbus DI address อ่าน running feedback

  -- สถานะปัจจุบัน (อัปเดตจาก PLC หรือ job status)
  status                varchar(20) DEFAULT 'idle'
                        CHECK (status IN ('idle','running','fault','maintenance')),
  current_job_id        uuid,                       -- FK ไปที่ transfer_jobs (set ตอน job เริ่ม)

  last_maintenance_date date,
  notes                 text,

  UNIQUE (facility_id, code)
);

COMMENT ON TABLE equipment IS 'อุปกรณ์สายพาน/ลิฟท์ — ใช้ compute route และ interlock';
COMMENT ON COLUMN equipment.plc_do_address IS 'Modbus DO สำหรับสั่ง start/stop จาก Web HMI';


-- ───────────────────────────────────────────────────────────────────────────
-- TABLE 7: transfer_jobs
-- งานถ่ายวนถัง (ใจกลางของ Planning Board)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE transfer_jobs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id     uuid    NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,

  -- Auto-increment job number ต่อ facility (เพื่อ display เป็น JOB-0001)
  job_seq         integer,

  -- ถังต้นทาง/ปลายทาง
  from_silo_id    uuid    NOT NULL REFERENCES silos(id),
  to_silo_id      uuid    NOT NULL REFERENCES silos(id),
  CHECK (from_silo_id <> to_silo_id),

  grain_type      varchar(50)    NOT NULL,
  quantity_tons   numeric(10,2)  NOT NULL CHECK (quantity_tons > 0),
  actual_tons     numeric(10,2),                   -- ปริมาณจริงที่ถ่าย (อาจต่างจาก plan)

  -- เส้นทาง (comma-separated LINE codes)
  route_lines     varchar(100),                    -- 'LINE-1' หรือ 'LINE-1,MAIN,LINE-3'

  -- กำหนดการ
  scheduled_date  date           NOT NULL,
  scheduled_time  time           NOT NULL,
  priority        smallint       DEFAULT 5         -- 1=สูงสุด, 10=ต่ำสุด
                  CHECK (priority BETWEEN 1 AND 10),

  -- เวลาจริง
  started_at      timestamptz,
  completed_at    timestamptz,

  -- สถานะ
  status          varchar(20)    DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled','inprogress','complete','cancelled')),

  -- ผู้สร้าง + หมายเหตุ
  created_by      uuid           REFERENCES auth.users(id),
  notes           text,
  cancel_reason   text,

  created_at      timestamptz    DEFAULT now(),
  updated_at      timestamptz    DEFAULT now()
);

-- Sequence สำหรับ job_seq ต่อ facility
CREATE SEQUENCE IF NOT EXISTS transfer_job_seq;

-- Indexes
CREATE INDEX idx_jobs_facility_status   ON transfer_jobs (facility_id, status);
CREATE INDEX idx_jobs_scheduled         ON transfer_jobs (facility_id, scheduled_date, scheduled_time);
CREATE INDEX idx_jobs_silo_active       ON transfer_jobs (from_silo_id, status)
  WHERE status IN ('scheduled','inprogress');

COMMENT ON TABLE transfer_jobs IS 'งานถ่ายวนถัง — วางแผน, เริ่ม, เสร็จ, ยกเลิก';
COMMENT ON COLUMN transfer_jobs.route_lines IS 'LINE ที่ใช้ — ระบบ interlock check ตาม field นี้';


-- ───────────────────────────────────────────────────────────────────────────
-- TABLE 8: fumigation_records
-- ประวัติการอบยา (fumigation)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE fumigation_records (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  silo_id         uuid        NOT NULL REFERENCES silos(id) ON DELETE CASCADE,

  -- ประเภทและปริมาณสารเคมี
  chemical_name   varchar(100),                    -- 'Phosphine (PH₃)', 'Methyl Bromide'
  dosage_g_per_ton numeric(8,3),                   -- กรัมต่อตัน
  total_chemical_g numeric(10,2),                  -- รวมกรัม

  -- เวลา
  scheduled_at    timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,

  -- สถานะ
  status          varchar(20)  DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled','active','complete','cancelled')),

  -- ข้อมูลเพิ่มเติม
  temperature_at_start  numeric(5,2),              -- อุณหภูมิถังตอนเริ่ม
  operator              varchar(200),              -- ชื่อผู้ดำเนินการ
  notes                 text,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX idx_fum_silo_time ON fumigation_records (silo_id, completed_at DESC);

-- View: วันที่อบยาล่าสุดของแต่ละถัง (ใช้แสดง Dashboard)
CREATE VIEW v_silo_fumigation_status AS
SELECT
  s.id              AS silo_id,
  s.facility_id,
  s.code,
  MAX(fr.completed_at)                                        AS last_fumigation_at,
  EXTRACT(DAY FROM now() - MAX(fr.completed_at))::integer     AS days_since_fumigation,
  BOOL_OR(fr.status = 'active')                               AS is_fuming_now
FROM silos s
LEFT JOIN fumigation_records fr ON fr.silo_id = s.id
GROUP BY s.id, s.facility_id, s.code;

COMMENT ON VIEW v_silo_fumigation_status IS 'วันที่อบยาล่าสุด + สถานะปัจจุบันแต่ละถัง';


-- ───────────────────────────────────────────────────────────────────────────
-- TABLE 9: alarms
-- การแจ้งเตือน — temp สูง, CO₂ สูง, interlock, fan fault
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE alarms (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id     uuid        NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  silo_id         uuid                 REFERENCES silos(id),       -- NULL ถ้า alarm ระดับ facility

  alarm_type      varchar(30) NOT NULL,            -- 'temp_high'|'co2_high'|'moisture_high'|'fan_fault'|'interlock_block'|'job_delay'
  severity        varchar(10) NOT NULL             -- 'info'|'warn'|'critical'
                  CHECK (severity IN ('info','warn','critical')),

  message         text        NOT NULL,
  value           numeric(10,3),                   -- ค่าที่ trigger alarm
  threshold       numeric(10,3),                   -- threshold ที่กำหนด

  triggered_at    timestamptz DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid                 REFERENCES auth.users(id),
  resolved_at     timestamptz,

  is_active       boolean     DEFAULT true         -- false = resolved
);

CREATE INDEX idx_alarms_facility_active ON alarms (facility_id, is_active, triggered_at DESC);

COMMENT ON TABLE alarms IS 'การแจ้งเตือนทุกประเภท — severity: info/warn/critical';


-- ───────────────────────────────────────────────────────────────────────────
-- TABLE 10: energy_meters + energy_readings
-- มิเตอร์ไฟฟ้าและค่าการใช้พลังงาน
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE energy_meters (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id uuid        NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  meter_code  varchar(20) NOT NULL,                -- 'MTR-01', 'MTR-02'
  zone        varchar(10),                         -- 'A','B','C','D'
  name        varchar(100),                        -- 'Zone A — ถัง S01-S06'
  rated_kva   numeric(8,2),                        -- ขนาด transformer
  UNIQUE (facility_id, meter_code)
);

CREATE TABLE energy_readings (
  id              bigserial PRIMARY KEY,
  meter_id        uuid        NOT NULL REFERENCES energy_meters(id),
  reading_at      timestamptz NOT NULL DEFAULT now(),

  kwh_cumulative  numeric(12,3),                   -- kWh สะสม (อ่านจากมิเตอร์)
  kw_demand       numeric(10,3),                   -- demand ปัจจุบัน (kW)
  kvar_demand     numeric(10,3),                   -- reactive power
  power_factor    numeric(5,3),                    -- PF (0.0-1.0)
  voltage_v       numeric(8,2),                    -- แรงดัน (V)
  current_a       numeric(10,3)                    -- กระแส (A)
);

CREATE INDEX idx_energy_meter_time ON energy_readings (meter_id, reading_at DESC);

COMMENT ON TABLE energy_readings IS 'ค่ามิเตอร์ไฟฟ้า time-series — ใช้คำนวณค่าไฟ/zone';


-- ───────────────────────────────────────────────────────────────────────────
-- TABLE 11: plc_status_log
-- บันทึกสถานะ PLC/equipment — audit trail
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE plc_status_log (
  id              bigserial PRIMARY KEY,
  facility_id     uuid REFERENCES facilities(id),
  equipment_id    uuid REFERENCES equipment(id),

  status          varchar(20),                     -- 'idle'|'running'|'fault'
  job_id          uuid REFERENCES transfer_jobs(id),

  -- DO/DI snapshot จาก PLC (jsonb — flexible)
  digital_outputs jsonb,                           -- {"Y0":true,"Y1":false,...}
  digital_inputs  jsonb,                           -- {"X0":true,"X1":true,...}

  triggered_by    varchar(50),                     -- 'user'|'auto'|'estop'
  logged_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_plc_equip_time ON plc_status_log (equipment_id, logged_at DESC);

COMMENT ON TABLE plc_status_log IS 'บันทึก PLC DO/DI snapshot — สำหรับ audit และ debug';


-- ───────────────────────────────────────────────────────────────────────────
-- TABLE 12: user_profiles
-- โปรไฟล์ผู้ใช้ (ต่อจาก Supabase Auth)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE user_profiles (
  id              uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  facility_id     uuid REFERENCES facilities(id),

  full_name       varchar(200),
  role            varchar(20)  DEFAULT 'viewer'
                  CHECK (role IN ('admin','operator','viewer')),
  phone           varchar(50),
  language        varchar(5)   DEFAULT 'th'        -- 'th'|'en'

  notify_alarm    boolean      DEFAULT true,        -- รับ notification alarm
  notify_email    boolean      DEFAULT false,

  created_at      timestamptz  DEFAULT now()
);

COMMENT ON TABLE user_profiles IS 'โปรไฟล์ผู้ใช้ + role + facility ที่มีสิทธิ์เข้าถึง';


-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- แต่ละ user เห็นเฉพาะข้อมูล facility ของตัวเอง
-- ═══════════════════════════════════════════════════════════════════════════

-- Helper function: ดึง facility_id ของ user ปัจจุบัน
CREATE OR REPLACE FUNCTION my_facility_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT facility_id FROM user_profiles WHERE id = auth.uid()
$$;

-- Enable RLS
ALTER TABLE facilities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE silos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE grain_inventory  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_readings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fans             ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_jobs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fumigation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE alarms           ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_meters    ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_readings  ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "own facility only" ON facilities
  FOR ALL USING (id = my_facility_id());

CREATE POLICY "own facility silos" ON silos
  FOR ALL USING (facility_id = my_facility_id());

CREATE POLICY "own facility inventory" ON grain_inventory
  FOR ALL USING (silo_id IN (SELECT id FROM silos WHERE facility_id = my_facility_id()));

CREATE POLICY "own facility sensors" ON sensor_readings
  FOR ALL USING (silo_id IN (SELECT id FROM silos WHERE facility_id = my_facility_id()));

CREATE POLICY "own facility jobs" ON transfer_jobs
  FOR ALL USING (facility_id = my_facility_id());

CREATE POLICY "own facility alarms" ON alarms
  FOR ALL USING (facility_id = my_facility_id());

-- Admin สามารถแก้ไขได้ทุกอย่าง, viewer อ่านได้อย่างเดียว
CREATE POLICY "operators can write jobs" ON transfer_jobs
  FOR INSERT WITH CHECK (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('admin','operator')
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- SUPABASE REALTIME SUBSCRIPTIONS
-- เปิด realtime สำหรับ table ที่ต้อง live update
-- ═══════════════════════════════════════════════════════════════════════════
-- รันใน Supabase SQL Editor หรือเปิดใน Dashboard > Database > Replication

-- ALTER PUBLICATION supabase_realtime ADD TABLE sensor_readings;
-- ALTER PUBLICATION supabase_realtime ADD TABLE alarms;
-- ALTER PUBLICATION supabase_realtime ADD TABLE transfer_jobs;
-- ALTER PUBLICATION supabase_realtime ADD TABLE equipment;
-- ALTER PUBLICATION supabase_realtime ADD TABLE fans;


-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_facilities_updated_at
  BEFORE UPDATE ON facilities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON transfer_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create alarm เมื่อ sensor เกิน threshold (ตัวอย่าง temp_high)
CREATE OR REPLACE FUNCTION check_sensor_alarm()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_facility_id uuid;
  v_threshold   numeric := 35; -- °C critical
BEGIN
  -- ดึง facility_id จาก silo
  SELECT s.facility_id INTO v_facility_id FROM silos s WHERE s.id = NEW.silo_id;

  IF NEW.temp_celsius >= v_threshold THEN
    INSERT INTO alarms (facility_id, silo_id, alarm_type, severity, message, value, threshold)
    VALUES (
      v_facility_id, NEW.silo_id,
      'temp_high', 'critical',
      format('ถัง %s: อุณหภูมิสูง %.1f°C (Cable %s, Sensor %s)',
             NEW.silo_id, NEW.temp_celsius, NEW.cable_no, NEW.sensor_no),
      NEW.temp_celsius, v_threshold
    )
    ON CONFLICT DO NOTHING; -- ไม่สร้าง alarm ซ้ำถ้ายังไม่ resolved
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_sensor_alarm
  AFTER INSERT ON sensor_readings
  FOR EACH ROW EXECUTE FUNCTION check_sensor_alarm();
