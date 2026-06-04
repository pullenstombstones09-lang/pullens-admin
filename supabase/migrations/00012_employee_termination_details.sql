-- 00012_employee_termination_details.sql
-- Tier the employee_status enum into specific end-of-employment reasons and add
-- context columns (date, reason, link to source document).
--
-- Run statements individually in the Supabase SQL Editor (annikas82 login).
-- DO NOT wrap in BEGIN/COMMIT: Postgres forbids using an enum value in the same
-- transaction that ALTER TYPE ADD VALUE created it, so the UPDATE at the bottom
-- would fail. Pasting the whole file into the SQL Editor and clicking Run works
-- because each statement is its own implicit transaction there.

-- ─── 1) Expand employee_status enum ──────────────────────────────────────────
ALTER TYPE employee_status ADD VALUE IF NOT EXISTS 'resigned';
ALTER TYPE employee_status ADD VALUE IF NOT EXISTS 'absconded';
ALTER TYPE employee_status ADD VALUE IF NOT EXISTS 'dismissed';
ALTER TYPE employee_status ADD VALUE IF NOT EXISTS 'retrenched';
ALTER TYPE employee_status ADD VALUE IF NOT EXISTS 'retired';
ALTER TYPE employee_status ADD VALUE IF NOT EXISTS 'deceased';

-- 'terminated' stays as a legacy umbrella for any historic rows we haven't
-- reclassified. New terminations should use one of the specific values above.

-- ─── 2) Termination context columns ──────────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS termination_date DATE,
  ADD COLUMN IF NOT EXISTS termination_reason TEXT,
  ADD COLUMN IF NOT EXISTS termination_doc_id UUID
    REFERENCES employee_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_termination_date
  ON employees(termination_date);

-- ─── 3) Retrofit PT023 Sanelisiwe Faith Nxele ────────────────────────────────
-- Resigned with immediate effect per letter dated 24 May 2026.
-- Last working day = Friday 22 May 2026 (confirmed by Annika).
UPDATE employees e
SET
  status = 'resigned',
  termination_date = DATE '2026-05-22',
  termination_reason = 'Personal reasons (immediate effect per letter dated 2026-05-24)',
  termination_doc_id = (
    SELECT id
    FROM employee_documents
    WHERE employee_id = e.id
      AND doc_type = 'other'
      AND notes ILIKE 'Resignation letter%'
    ORDER BY uploaded_at DESC
    LIMIT 1
  )
WHERE pt_code = 'PT023';

-- ─── 4) Audit ────────────────────────────────────────────────────────────────
INSERT INTO audit_log (action, entity_type, entity_id, after_state)
VALUES (
  'migration_00012_employee_termination_details',
  'employees',
  NULL,
  jsonb_build_object(
    'enum_added', jsonb_build_array(
      'resigned', 'absconded', 'dismissed', 'retrenched', 'retired', 'deceased'
    ),
    'columns_added', jsonb_build_array(
      'termination_date', 'termination_reason', 'termination_doc_id'
    ),
    'retrofit', jsonb_build_object(
      'pt_code', 'PT023',
      'old_status', 'terminated',
      'new_status', 'resigned',
      'termination_date', '2026-05-22'
    )
  )
);
