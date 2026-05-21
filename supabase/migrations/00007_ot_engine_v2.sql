-- 00007_ot_engine_v2.sql
-- Pullens Admin: OT engine v2 schema + NMW-compliant sales wage uplift
-- Date: 2026-05-14 (consolidated + applied 2026-05-21)
-- Refs spec: docs/superpowers/specs/2026-05-14-payroll-engine-ot-and-sales-rate-design.md
--
-- Consolidates the original 00007 + 00008 with the correct ordering — the
-- original split would have errored because the new per-hours chk_nmw
-- rejected R1210/45 (Faith, Gugu) before we got a chance to uplift them.

BEGIN;

-- 1. Drop the old flat-floor NMW check so we can adjust rows freely
ALTER TABLE employees DROP CONSTRAINT IF EXISTS chk_nmw;

-- 2. Move sales staff from 45h to 44h (Mon-Thu 9 + Fri 8 + Sat 4 = 44 ordinary)
UPDATE employees
SET weekly_hours = 44
WHERE pt_code IN ('PT008', 'PT012', 'PT023', 'PT024', 'PT028', 'PT032')
  AND weekly_hours = 45;

-- 3. Uplift the 4 below-NMW sales staff to R1340 (R1340/44 = R30.45 ≥ R30.23)
UPDATE employees SET weekly_wage = 1340.00 WHERE pt_code = 'PT012';  -- Nicolette David
UPDATE employees SET weekly_wage = 1340.00 WHERE pt_code = 'PT023';  -- Sanelisiwe Faith Nxele
UPDATE employees SET weekly_wage = 1340.00 WHERE pt_code = 'PT024';  -- Gugulethu Cele
UPDATE employees SET weekly_wage = 1340.00 WHERE pt_code = 'PT032';  -- Zandile Mchunu

-- 4. Now safe to install the per-hours NMW constraint (R30.23/hr × weekly_hours)
ALTER TABLE employees ADD CONSTRAINT chk_nmw
  CHECK (weekly_wage = 0 OR weekly_wage >= 30.23 * COALESCE(weekly_hours, 40));

-- 5. Audit trail for the uplift
INSERT INTO audit_log (action, entity_type, entity_id, after_state)
SELECT
  'wage_uplift_nmw_2026_05_18',
  'employee',
  id,
  jsonb_build_object('pt_code', pt_code, 'new_weekly_wage', 1340.00, 'effective', '2026-05-18')
FROM employees
WHERE pt_code IN ('PT012','PT023','PT024','PT032');

-- 6. Friday-after-16:00 OT rollover table (engine v2 reads/writes here)
CREATE TABLE friday_ot_rollovers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  source_friday DATE NOT NULL,
  rollover_minutes INTEGER NOT NULL CHECK (rollover_minutes >= 0),
  applied_to_run_id UUID REFERENCES payroll_runs(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ,
  produced_by_run_id UUID REFERENCES payroll_runs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, source_friday)
);

CREATE INDEX idx_friday_rollover_unapplied
  ON friday_ot_rollovers (employee_id, source_friday)
  WHERE applied_to_run_id IS NULL;

COMMIT;
