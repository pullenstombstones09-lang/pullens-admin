-- Pullens Admin: Biometric attendance + site assignment
-- Migration 00010 (22 May 2026)
--
-- Adds:
--   employees.site         — where this person primarily works
--   employees.biometric_id — HikVision device employeeNo (matches event.employeeNoString)
--   attendance.time_in_source / time_out_source — 'manual' or 'biometric'
--   biometric_events       — raw audit log of every event pushed from a device
--
-- Strategy: do NOT change device employeeNos; map them via biometric_id on employees.
-- Allandale device is already populated with the existing 27 + 1 (Thabiso slot mis-labelled).
-- The 7 Allandale staff still to enrol get pre-assigned codes here — when enrolling,
-- use these exact employeeNos on the device.

-- ============================================================
-- ENUMS / COLUMNS
-- ============================================================

-- site: text + check (extensible later without ALTER TYPE)
ALTER TABLE employees
  ADD COLUMN site TEXT NOT NULL DEFAULT 'allandale'
  CHECK (site IN ('allandale', 'durban', 'church_street', 'ladysmith'));

-- biometric_id: device's employeeNoString. NULL until enrolled.
ALTER TABLE employees ADD COLUMN biometric_id TEXT;
CREATE UNIQUE INDEX idx_employees_biometric_id
  ON employees(biometric_id) WHERE biometric_id IS NOT NULL;

-- attendance: where did time_in / time_out come from?
ALTER TABLE attendance
  ADD COLUMN time_in_source TEXT NOT NULL DEFAULT 'manual'
  CHECK (time_in_source IN ('manual', 'biometric'));

ALTER TABLE attendance
  ADD COLUMN time_out_source TEXT NOT NULL DEFAULT 'manual'
  CHECK (time_out_source IN ('manual', 'biometric'));

-- ============================================================
-- BIOMETRIC EVENTS — raw push log
-- ============================================================
CREATE TABLE biometric_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id     TEXT NOT NULL,         -- e.g. 'allandale', 'durban'
  device_serial BIGINT NOT NULL,       -- HikVision event.serialNo (monotonic per device)
  employee_id   UUID REFERENCES employees(id) ON DELETE SET NULL,
  biometric_id  TEXT NOT NULL,         -- event.employeeNoString
  raw_name      TEXT,                  -- event.name (device label, may be stale)
  event_time    TIMESTAMPTZ NOT NULL,
  event_date    DATE NOT NULL,         -- denormalised — for fast per-day queries
  event_type    TEXT,                  -- 'checkIn' / 'checkOut' / 'unknown'
  picture_url   TEXT,                  -- device-hosted thumbnail (relative to device)
  raw_payload   JSONB NOT NULL,
  processed_at  TIMESTAMPTZ,           -- when derivation last ran for this row's (employee, date)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, device_serial)
);

CREATE INDEX idx_biometric_events_employee_date
  ON biometric_events(employee_id, event_date);
CREATE INDEX idx_biometric_events_unprocessed
  ON biometric_events(event_date) WHERE processed_at IS NULL;
CREATE INDEX idx_biometric_events_device
  ON biometric_events(device_id, event_time DESC);

-- ============================================================
-- SITE ASSIGNMENTS (everyone defaults to 'allandale' via column default)
-- ============================================================
UPDATE employees SET site = 'durban'
  WHERE pt_code IN ('PT024', 'PT028');  -- Gugu, Randhir
UPDATE employees SET site = 'church_street'
  WHERE pt_code IN ('PT023', 'PT032');  -- Faith, Zandile
UPDATE employees SET site = 'ladysmith'
  WHERE full_name ILIKE '%lungiswa%';

-- ============================================================
-- BIOMETRIC ID — already enrolled on Allandale device (27 confirmed + 1 mislabelled slot)
-- ============================================================
-- Confirmed clean matches (device label = employee name)
UPDATE employees SET biometric_id = '9002' WHERE pt_code = 'PT001';  -- Aaron Mkhize
UPDATE employees SET biometric_id = '9003' WHERE pt_code = 'PT002';  -- Junior Sithole
UPDATE employees SET biometric_id = '9004' WHERE pt_code = 'PT003';  -- Sipho C Mthembu
UPDATE employees SET biometric_id = '9005' WHERE pt_code = 'PT004';  -- William Sihlezane
UPDATE employees SET biometric_id = '9006' WHERE pt_code = 'PT005';  -- Musa Tibana
UPDATE employees SET biometric_id = '9007' WHERE pt_code = 'PT006';  -- Nkululeko Miya
UPDATE employees SET biometric_id = '9008' WHERE pt_code = 'PT007';  -- Damien Seerangum
UPDATE employees SET biometric_id = '9009' WHERE pt_code = 'PT008';  -- Marlyn Naidoo
UPDATE employees SET biometric_id = '9010' WHERE pt_code = 'PT009';  -- Thilen Rengen
UPDATE employees SET biometric_id = '9001' WHERE pt_code = 'PT012';  -- Nicolette David ("Nikki")
UPDATE employees SET biometric_id = '9014' WHERE pt_code = 'PT013';  -- Alli Yessa
UPDATE employees SET biometric_id = '9024' WHERE pt_code = 'PT014';  -- Enrique Munien
UPDATE employees SET biometric_id = '9016' WHERE pt_code = 'PT015';  -- Cherylette Rengan
UPDATE employees SET biometric_id = '9017' WHERE pt_code = 'PT016';  -- Sipho Dion Tibana
UPDATE employees SET biometric_id = '9018' WHERE pt_code = 'PT017';  -- Cosmos Mkhize
UPDATE employees SET biometric_id = '9021' WHERE pt_code = 'PT020';  -- Tiiso Lebata
UPDATE employees SET biometric_id = '9022' WHERE pt_code = 'PT021';  -- Tumelo Lebofa
UPDATE employees SET biometric_id = '9023' WHERE pt_code = 'PT022';  -- Thabani Ximba
UPDATE employees SET biometric_id = '9026' WHERE pt_code = 'PT025';  -- Sinethemba Kweshube
UPDATE employees SET biometric_id = '9027' WHERE pt_code = 'PT026';  -- Philani Mkhize
UPDATE employees SET biometric_id = '9028' WHERE pt_code = 'PT027';  -- Mthokozisi Mchunu
UPDATE employees SET biometric_id = '9031' WHERE pt_code = 'PT030';  -- Sifiso Ndlela
UPDATE employees SET biometric_id = '9036' WHERE pt_code = 'PT031';  -- Xolani
UPDATE employees SET biometric_id = '9032' WHERE pt_code = 'PT033';  -- David Mtshali
UPDATE employees SET biometric_id = '9034' WHERE pt_code = 'PT034';  -- Mlindeni Lamula
UPDATE employees SET biometric_id = '9035' WHERE pt_code = 'PT035';  -- Mduduzi Hlela

-- Mislabelled slot: device shows "Albert Johannes Masindo" but Annika confirms
-- the enrolled face is PT018 Thabiso. Map it; rename device label separately.
UPDATE employees SET biometric_id = '9019' WHERE pt_code = 'PT018';  -- Thabiso Msindo (device label wrong)

-- ============================================================
-- BIOMETRIC ID — pre-assigned for the 7 Allandale staff still to enrol.
-- When enrolling on the device, use these exact employeeNo values.
-- ============================================================
UPDATE employees SET biometric_id = '9025' WHERE pt_code = 'PT010';  -- Sibusiso Mdawe (TO ENROL)
UPDATE employees SET biometric_id = '9029' WHERE pt_code = 'PT011';  -- Lindokuhle Khanyile (TO ENROL)
UPDATE employees SET biometric_id = '9020' WHERE pt_code = 'PT019';  -- Ayanda Mhlongo (TO ENROL)
UPDATE employees SET biometric_id = '9038' WHERE pt_code = 'PT029';  -- Fika Mdlalose (TO ENROL — new code, no legacy match)
UPDATE employees SET biometric_id = '9015' WHERE pt_code = 'PT036';  -- Philani Rasta (TO ENROL)
UPDATE employees SET biometric_id = '9011' WHERE pt_code = 'PT037';  -- Siphiwe Dumakude (TO ENROL)
UPDATE employees SET biometric_id = '9012' WHERE pt_code = 'PT038';  -- Lucky Ndlovu (TO ENROL)

-- Remote staff (Durban / Church Street / Ladysmith) — biometric_id stays NULL
-- until their satellite device arrives and they are enrolled there.

-- ============================================================
-- AUDIT
-- ============================================================
INSERT INTO audit_log (action, entity_type, entity_id, after_state) VALUES (
  'schema_migration',
  'system',
  NULL,
  jsonb_build_object(
    'migration', '00010_biometric_and_sites',
    'summary', 'Added employees.site, employees.biometric_id, attendance source columns, biometric_events table. Mapped 28 Allandale staff (27 enrolled + Thabiso slot) and pre-assigned codes for 7 still to enrol. Remote staff (Durban/Church St/Ladysmith) flagged for manual register editing until satellite devices arrive.'
  )
);
