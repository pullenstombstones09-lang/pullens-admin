-- 00007_ot_engine_v2.sql
-- Pullens Admin: OT engine v2 schema changes
-- Date: 2026-05-14
-- Refs spec: docs/superpowers/specs/2026-05-14-payroll-engine-ot-and-sales-rate-design.md

BEGIN;

-- 1. Replace the NMW check constraint to use the employee's own weekly_hours
ALTER TABLE employees DROP CONSTRAINT IF EXISTS chk_nmw;
ALTER TABLE employees ADD CONSTRAINT chk_nmw
  CHECK (weekly_wage = 0 OR weekly_wage >= 30.23 * COALESCE(weekly_hours, 40));

-- 2. Update sales staff weekly_hours 45 -> 44
UPDATE employees
SET weekly_hours = 44
WHERE pt_code IN ('PT008', 'PT012', 'PT023', 'PT024', 'PT028', 'PT032')
  AND weekly_hours = 45;

-- 3. New table for Friday-after-16:00 rollover audit trail
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
