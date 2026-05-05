-- 00005_payroll_batch_and_saturday.sql
-- Adds payroll_type to payroll_runs and creates payroll_batch table

-- 1. Add payroll_type enum
DO $$ BEGIN
  CREATE TYPE payroll_type AS ENUM ('weekly', 'saturday_cash');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add payroll_type column to payroll_runs (default weekly for existing runs)
ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS payroll_type payroll_type NOT NULL DEFAULT 'weekly';

-- 3. Create payroll_batch table for per-employee approval tracking
CREATE TABLE IF NOT EXISTS payroll_batch (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pulled', 'pending')),
  pulled_reason TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (payroll_run_id, employee_id)
);

-- 4. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_payroll_batch_run ON payroll_batch(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_batch_employee ON payroll_batch(employee_id);

-- 5. RLS
ALTER TABLE payroll_batch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management and bookkeeper can read payroll_batch"
  ON payroll_batch FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('head_admin', 'head_of_admin', 'head_of_sales', 'bookkeeper')
    )
  );

CREATE POLICY "Management can write payroll_batch"
  ON payroll_batch FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('head_admin', 'head_of_admin', 'head_of_sales')
    )
  );

-- 6. Updated_at trigger
CREATE TRIGGER update_payroll_batch_updated_at
  BEFORE UPDATE ON payroll_batch
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
