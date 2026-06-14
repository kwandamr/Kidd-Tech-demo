-- ═══════════════════════════════════════════════════════════════════════════
-- Kid-D Tech — Seed Data (Demo / Development)
-- ใช้สำหรับ: ทดสอบระบบ, Demo ให้ลูกค้า
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Demo Facility ───────────────────────────────────────────────────────
INSERT INTO facilities (code, name, location, contact_name, contact_phone, plan_tier)
VALUES ('DEMO-01', 'KT Food — โรงงานขอนแก่น', 'ต.โนนท่อน อ.เมือง จ.ขอนแก่น', 'คุณวิชัย ศรีสมบูรณ์', '0812345678', 'phase1')
RETURNING id; -- copy ค่า id นี้ไปใส่ด้านล่าง

-- ─── ใส่ facility_id จากบรรทัดบน ──────────────────────────────────────────
DO $$
DECLARE
  fid uuid := (SELECT id FROM facilities WHERE code = 'DEMO-01');
BEGIN

-- ─── 2. ถังยาว S01-S12 ────────────────────────────────────────────────────
INSERT INTO silos (facility_id, code, silo_type, zone, conv_line, capacity_tons, num_cables, sensors_per_cable) VALUES
  (fid, 'S01', 'long', 'A', 'LINE-1', 500, 2, 8),
  (fid, 'S02', 'long', 'A', 'LINE-1', 500, 2, 8),
  (fid, 'S03', 'long', 'A', 'LINE-1', 500, 2, 8),
  (fid, 'S04', 'long', 'A', 'LINE-1', 500, 2, 8),
  (fid, 'S05', 'long', 'A', 'LINE-1', 500, 2, 8),
  (fid, 'S06', 'long', 'A', 'LINE-1', 500, 2, 8),
  (fid, 'S07', 'long', 'B', 'LINE-2', 500, 2, 8),
  (fid, 'S08', 'long', 'B', 'LINE-2', 500, 2, 8),
  (fid, 'S09', 'long', 'B', 'LINE-2', 500, 2, 8),
  (fid, 'S10', 'long', 'B', 'LINE-2', 500, 2, 8),
  (fid, 'S11', 'long', 'B', 'LINE-2', 500, 2, 8),
  (fid, 'S12', 'long', 'B', 'LINE-2', 500, 2, 8);

-- ─── 3. ถังกลม R01-R08 ────────────────────────────────────────────────────
INSERT INTO silos (facility_id, code, silo_type, zone, conv_line, capacity_tons, num_cables, sensors_per_cable) VALUES
  (fid, 'R01', 'round', 'C', 'LINE-3', 200, 1, 6),
  (fid, 'R02', 'round', 'C', 'LINE-3', 200, 1, 6),
  (fid, 'R03', 'round', 'C', 'LINE-3', 200, 1, 6),
  (fid, 'R04', 'round', 'C', 'LINE-3', 200, 1, 6),
  (fid, 'R05', 'round', 'D', 'LINE-3', 200, 1, 6),
  (fid, 'R06', 'round', 'D', 'LINE-3', 200, 1, 6),
  (fid, 'R07', 'round', 'D', 'LINE-3', 200, 1, 6),
  (fid, 'R08', 'round', 'D', 'LINE-3', 200, 1, 6);

-- ─── 4. Grain Inventory (ปริมาณสินค้าตัวอย่าง) ───────────────────────────
INSERT INTO grain_inventory (silo_id, grain_type, quantity_tons, fill_pct, received_date, moisture_intake, supplier)
SELECT s.id,
  CASE s.code
    WHEN 'S01' THEN 'Paddy'   WHEN 'S02' THEN 'Corn'    WHEN 'S03' THEN 'Corn'
    WHEN 'S04' THEN 'Paddy'   WHEN 'S05' THEN 'Paddy'   WHEN 'S07' THEN 'Corn'
    WHEN 'S08' THEN 'Sorghum' WHEN 'S09' THEN 'Paddy'   WHEN 'S10' THEN 'Corn'
    WHEN 'S11' THEN 'Wheat'   WHEN 'S12' THEN 'Millet'
    WHEN 'R01' THEN 'Corn'    WHEN 'R02' THEN 'Paddy'   WHEN 'R03' THEN 'Corn'
    WHEN 'R05' THEN 'Millet'  WHEN 'R06' THEN 'Paddy'   WHEN 'R07' THEN 'Paddy'
    WHEN 'R08' THEN 'Sorghum' ELSE NULL
  END,
  CASE s.code
    WHEN 'S01' THEN 390  WHEN 'S02' THEN 275  WHEN 'S03' THEN 460
    WHEN 'S04' THEN 75   WHEN 'S05' THEN 440  WHEN 'S07' THEN 335
    WHEN 'S08' THEN 220  WHEN 'S09' THEN 355  WHEN 'S10' THEN 150
    WHEN 'S11' THEN 425  WHEN 'S12' THEN 290
    WHEN 'R01' THEN 124  WHEN 'R02' THEN 190  WHEN 'R03' THEN 96
    WHEN 'R05' THEN 154  WHEN 'R06' THEN 66   WHEN 'R07' THEN 178
    WHEN 'R08' THEN 110  ELSE 0
  END,
  CASE s.code
    WHEN 'S01' THEN 78  WHEN 'S02' THEN 55  WHEN 'S03' THEN 92
    WHEN 'S04' THEN 15  WHEN 'S05' THEN 88  WHEN 'S07' THEN 67
    WHEN 'S08' THEN 44  WHEN 'S09' THEN 71  WHEN 'S10' THEN 30
    WHEN 'S11' THEN 85  WHEN 'S12' THEN 58
    WHEN 'R01' THEN 62  WHEN 'R02' THEN 95  WHEN 'R03' THEN 48
    WHEN 'R05' THEN 77  WHEN 'R06' THEN 33  WHEN 'R07' THEN 89
    WHEN 'R08' THEN 55  ELSE 0
  END,
  CURRENT_DATE - (
    CASE s.code
      WHEN 'S01' THEN 45 WHEN 'S04' THEN 60 WHEN 'S09' THEN 33
      WHEN 'R02' THEN 3  WHEN 'R06' THEN 38 ELSE floor(random()*30+1)
    END
  ),
  13.5 + random(),  -- ความชื้นตอนรับเข้า
  'บริษัท สมใจ จำกัด'
FROM silos s
WHERE s.facility_id = fid AND s.code NOT IN ('S06','R04'); -- S06, R04 = ถังว่าง

-- ─── 5. Equipment (สายพาน) ─────────────────────────────────────────────────
INSERT INTO equipment (facility_id, code, name, equipment_type, max_capacity_tph) VALUES
  (fid, 'LINE-1', 'สายพาน LINE-1 (S01–S06)', 'belt',    150),
  (fid, 'LINE-2', 'สายพาน LINE-2 (S07–S12)', 'belt',    150),
  (fid, 'LINE-3', 'Drag Chain LINE-3 (R01–R08)', 'chain', 100),
  (fid, 'MAIN',   'สายพานหลัก MAIN (Cross)',   'main',   200);

-- ─── 6. Energy Meters ───────────────────────────────────────────────────────
INSERT INTO energy_meters (facility_id, meter_code, zone, name, rated_kva) VALUES
  (fid, 'MTR-01', 'A', 'Zone A — S01-S06', 100),
  (fid, 'MTR-02', 'B', 'Zone B — S07-S12', 100),
  (fid, 'MTR-03', 'C', 'Zone C — R01-R04',  50),
  (fid, 'MTR-04', 'D', 'Zone D — R05-R08',  50);

-- ─── 7. Fumigation Records ──────────────────────────────────────────────────
-- S01 อบยาครั้งสุดท้าย 52 วันที่แล้ว (overdue)
INSERT INTO fumigation_records (silo_id, chemical_name, dosage_g_per_ton, status, completed_at)
SELECT s.id, 'Phosphine (PH₃)', 3.0, 'complete',
  now() - interval '52 days'
FROM silos s WHERE s.facility_id = fid AND s.code = 'S01';

-- S07 กำลังอบยาอยู่ตอนนี้
INSERT INTO fumigation_records (silo_id, chemical_name, dosage_g_per_ton, status, started_at)
SELECT s.id, 'Phosphine (PH₃)', 3.0, 'active', now() - interval '2 hours'
FROM silos s WHERE s.facility_id = fid AND s.code = 'S07';

-- ─── 8. Transfer Jobs (ตัวอย่าง) ────────────────────────────────────────────
INSERT INTO transfer_jobs (facility_id, from_silo_id, to_silo_id, grain_type, quantity_tons, route_lines, scheduled_date, scheduled_time, status, started_at, notes)
SELECT
  fid,
  (SELECT id FROM silos WHERE facility_id=fid AND code='S01'),
  (SELECT id FROM silos WHERE facility_id=fid AND code='S06'),
  'Paddy', 200, 'LINE-1',
  CURRENT_DATE, '08:00', 'inprogress', now() - interval '30 minutes',
  'Aeration overdue 12 วัน';

INSERT INTO transfer_jobs (facility_id, from_silo_id, to_silo_id, grain_type, quantity_tons, route_lines, scheduled_date, scheduled_time, status, notes)
SELECT
  fid,
  (SELECT id FROM silos WHERE facility_id=fid AND code='R02'),
  (SELECT id FROM silos WHERE facility_id=fid AND code='R04'),
  'Paddy', 100, 'LINE-3',
  CURRENT_DATE, '10:30', 'scheduled',
  'R02 aeration overdue 14 วัน';

END $$;
