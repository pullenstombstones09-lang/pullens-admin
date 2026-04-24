-- Pullens Admin: Row Level Security Policies
-- Migration 00003

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE hearings ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_certs ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE petty_cash_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE petty_cash_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE petty_cash_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE casual_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper function: get current user role from JWT
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if user has one of the given roles
CREATE OR REPLACE FUNCTION has_role(allowed_roles user_role[])
RETURNS BOOLEAN AS $$
  SELECT get_user_role() = ANY(allowed_roles);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- ROLE DEFINITIONS (from spec section 4)
-- head_admin: everything
-- head_of_admin: everything except final approvals
-- head_of_sales: same as head_of_admin
-- admin: registers + medical certs only, no payroll/loans/hr advisor
-- bookkeeper: payments tab only (payroll totals, mark paid)
-- petty_cash: petty cash tab only
-- ============================================================

-- Roles that can see everything (management)
CREATE OR REPLACE FUNCTION is_management()
RETURNS BOOLEAN AS $$
  SELECT has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales']::user_role[]);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- USERS table: only management can read, only head_admin can write
-- ============================================================
CREATE POLICY users_select ON users FOR SELECT USING (is_management());
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (get_user_role() = 'head_admin');
CREATE POLICY users_update ON users FOR UPDATE USING (
  get_user_role() = 'head_admin' OR id = auth.uid()
);

-- ============================================================
-- EMPLOYEES: management + admin can read, management can write
-- ============================================================
CREATE POLICY employees_select ON employees FOR SELECT USING (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'admin']::user_role[])
);
CREATE POLICY employees_insert ON employees FOR INSERT WITH CHECK (is_management());
CREATE POLICY employees_update ON employees FOR UPDATE USING (is_management());

-- ============================================================
-- ATTENDANCE: management + admin can read/write
-- ============================================================
CREATE POLICY attendance_select ON attendance FOR SELECT USING (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'admin']::user_role[])
);
CREATE POLICY attendance_insert ON attendance FOR INSERT WITH CHECK (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'admin']::user_role[])
);
CREATE POLICY attendance_update ON attendance FOR UPDATE USING (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'admin']::user_role[])
);

-- ============================================================
-- OVERTIME REQUESTS: management only
-- ============================================================
CREATE POLICY ot_select ON overtime_requests FOR SELECT USING (is_management());
CREATE POLICY ot_insert ON overtime_requests FOR INSERT WITH CHECK (is_management());
CREATE POLICY ot_update ON overtime_requests FOR UPDATE USING (is_management());

-- ============================================================
-- PAYROLL: management + bookkeeper (read only for bookkeeper)
-- ============================================================
CREATE POLICY payroll_runs_select ON payroll_runs FOR SELECT USING (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'bookkeeper']::user_role[])
);
CREATE POLICY payroll_runs_insert ON payroll_runs FOR INSERT WITH CHECK (is_management());
CREATE POLICY payroll_runs_update ON payroll_runs FOR UPDATE USING (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'bookkeeper']::user_role[])
);

CREATE POLICY payslips_select ON payslips FOR SELECT USING (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'bookkeeper']::user_role[])
);
CREATE POLICY payslips_insert ON payslips FOR INSERT WITH CHECK (is_management());
CREATE POLICY payslips_update ON payslips FOR UPDATE USING (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'bookkeeper']::user_role[])
);

-- ============================================================
-- LOANS: management only (admin cannot see)
-- ============================================================
CREATE POLICY loans_select ON loans FOR SELECT USING (is_management());
CREATE POLICY loans_insert ON loans FOR INSERT WITH CHECK (is_management());
CREATE POLICY loans_update ON loans FOR UPDATE USING (is_management());

CREATE POLICY loan_deductions_select ON loan_deductions FOR SELECT USING (is_management());
CREATE POLICY loan_deductions_insert ON loan_deductions FOR INSERT WITH CHECK (is_management());

-- ============================================================
-- WARNINGS: management only
-- ============================================================
CREATE POLICY warnings_select ON warnings FOR SELECT USING (is_management());
CREATE POLICY warnings_insert ON warnings FOR INSERT WITH CHECK (is_management());
CREATE POLICY warnings_update ON warnings FOR UPDATE USING (is_management());

-- ============================================================
-- INCIDENTS: management only (HR advisor)
-- ============================================================
CREATE POLICY incidents_select ON incidents FOR SELECT USING (is_management());
CREATE POLICY incidents_insert ON incidents FOR INSERT WITH CHECK (is_management());
CREATE POLICY incidents_update ON incidents FOR UPDATE USING (is_management());

-- ============================================================
-- HEARINGS: management only
-- ============================================================
CREATE POLICY hearings_select ON hearings FOR SELECT USING (is_management());
CREATE POLICY hearings_insert ON hearings FOR INSERT WITH CHECK (is_management());
CREATE POLICY hearings_update ON hearings FOR UPDATE USING (is_management());

-- ============================================================
-- LEAVE: management + admin
-- ============================================================
CREATE POLICY leave_select ON leave FOR SELECT USING (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'admin']::user_role[])
);
CREATE POLICY leave_insert ON leave FOR INSERT WITH CHECK (is_management());
CREATE POLICY leave_update ON leave FOR UPDATE USING (is_management());

CREATE POLICY leave_balances_select ON leave_balances FOR SELECT USING (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'admin']::user_role[])
);
CREATE POLICY leave_balances_update ON leave_balances FOR UPDATE USING (is_management());

-- ============================================================
-- MEDICAL CERTS: management + admin
-- ============================================================
CREATE POLICY medical_certs_select ON medical_certs FOR SELECT USING (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'admin']::user_role[])
);
CREATE POLICY medical_certs_insert ON medical_certs FOR INSERT WITH CHECK (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'admin']::user_role[])
);

-- ============================================================
-- EMPLOYEE DOCUMENTS: management + admin
-- ============================================================
CREATE POLICY employee_docs_select ON employee_documents FOR SELECT USING (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'admin']::user_role[])
);
CREATE POLICY employee_docs_insert ON employee_documents FOR INSERT WITH CHECK (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'admin']::user_role[])
);
CREATE POLICY employee_docs_update ON employee_documents FOR UPDATE USING (is_management());

-- ============================================================
-- PETTY CASH: management + petty_cash role
-- ============================================================
CREATE POLICY petty_ins_select ON petty_cash_ins FOR SELECT USING (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'petty_cash']::user_role[])
);
CREATE POLICY petty_ins_insert ON petty_cash_ins FOR INSERT WITH CHECK (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'petty_cash']::user_role[])
);

CREATE POLICY petty_outs_select ON petty_cash_outs FOR SELECT USING (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'petty_cash']::user_role[])
);
CREATE POLICY petty_outs_insert ON petty_cash_outs FOR INSERT WITH CHECK (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'petty_cash', 'bookkeeper']::user_role[])
);
CREATE POLICY petty_outs_update ON petty_cash_outs FOR UPDATE USING (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'petty_cash']::user_role[])
);

CREATE POLICY petty_slips_select ON petty_cash_slips FOR SELECT USING (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'petty_cash']::user_role[])
);
CREATE POLICY petty_slips_insert ON petty_cash_slips FOR INSERT WITH CHECK (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'petty_cash', 'bookkeeper']::user_role[])
);

-- ============================================================
-- CASUAL WORKERS: management + petty_cash
-- ============================================================
CREATE POLICY casual_select ON casual_workers FOR SELECT USING (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'petty_cash']::user_role[])
);
CREATE POLICY casual_insert ON casual_workers FOR INSERT WITH CHECK (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'petty_cash']::user_role[])
);
CREATE POLICY casual_update ON casual_workers FOR UPDATE USING (
  has_role(ARRAY['head_admin', 'head_of_admin', 'head_of_sales', 'petty_cash']::user_role[])
);

-- ============================================================
-- AUDIT LOG: management only (read-only via RLS, inserts via service role)
-- ============================================================
CREATE POLICY audit_select ON audit_log FOR SELECT USING (is_management());
-- Inserts bypass RLS using service role key in API routes

-- ============================================================
-- SETTINGS: all authenticated can read, head_admin can write
-- ============================================================
CREATE POLICY settings_select ON settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY settings_update ON settings FOR UPDATE USING (get_user_role() = 'head_admin');
CREATE POLICY settings_insert ON settings FOR INSERT WITH CHECK (get_user_role() = 'head_admin');

-- ============================================================
-- PUBLIC HOLIDAYS: all authenticated can read
-- ============================================================
CREATE POLICY holidays_select ON public_holidays FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY holidays_insert ON public_holidays FOR INSERT WITH CHECK (is_management());

-- ============================================================
-- ANNOUNCEMENTS: all authenticated can read, management can write
-- ============================================================
CREATE POLICY announcements_select ON announcements FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY announcements_insert ON announcements FOR INSERT WITH CHECK (is_management());
