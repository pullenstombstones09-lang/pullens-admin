-- Pullens Admin: Core tables
-- Migration 00002

-- ============================================================
-- USERS (6 system users)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  role user_role NOT NULL,
  pin_hash TEXT NOT NULL,
  perms JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  force_pin_change BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- EMPLOYEES (38 staff)
-- ============================================================
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pt_code TEXT NOT NULL UNIQUE,
  legacy_code TEXT,
  full_name TEXT NOT NULL,
  id_number TEXT,
  dob DATE,
  gender gender,
  race race,
  disability BOOLEAN DEFAULT false,
  cell TEXT,
  email TEXT,
  home_address TEXT,
  occupation TEXT,
  start_date DATE,
  weekly_wage NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method payment_method NOT NULL DEFAULT 'eft',
  bank_name TEXT,
  bank_acc TEXT,
  bank_branch TEXT,
  bank_type bank_account_type,
  emergency_name TEXT,
  emergency_rel TEXT,
  emergency_phone TEXT,
  nok_name TEXT,
  nok_rel TEXT,
  nok_phone TEXT,
  tax_number TEXT,
  uif_ref TEXT,
  garnishee NUMERIC(10,2) NOT NULL DEFAULT 0,
  eif_on_file BOOLEAN DEFAULT false,
  eif_signed BOOLEAN DEFAULT false,
  eif_date DATE,
  status employee_status NOT NULL DEFAULT 'active',
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NMW check: R30.23/hr × 40hrs = R1209.20/week minimum
ALTER TABLE employees ADD CONSTRAINT chk_nmw
  CHECK (weekly_wage = 0 OR weekly_wage >= 1209.20);

-- ============================================================
-- ATTENDANCE
-- ============================================================
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status attendance_status NOT NULL DEFAULT 'present',
  time_in TIME,
  time_out TIME,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  captured_by UUID REFERENCES users(id),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_employee ON attendance(employee_id);

-- ============================================================
-- OVERTIME REQUESTS
-- ============================================================
CREATE TABLE overtime_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours NUMERIC(4,2) NOT NULL,
  rate_multiplier NUMERIC(3,1) NOT NULL DEFAULT 1.5 CHECK (rate_multiplier IN (1.5, 2.0)),
  reason TEXT,
  requested_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  status ot_request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- LOANS
-- ============================================================
CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date_advanced DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(10,2) NOT NULL,
  weekly_deduction NUMERIC(10,2) NOT NULL,
  outstanding NUMERIC(10,2) NOT NULL,
  purpose TEXT,
  auto_generated_from_petty BOOLEAN NOT NULL DEFAULT false,
  petty_cash_ref UUID,
  status loan_status NOT NULL DEFAULT 'active',
  signed_agreement_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- LOAN DEDUCTIONS
-- ============================================================
CREATE TABLE loan_deductions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  payroll_run_id UUID, -- FK added after payroll_runs created
  amount_deducted NUMERIC(10,2) NOT NULL,
  deducted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- WARNINGS
-- ============================================================
CREATE TABLE warnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category warning_category NOT NULL,
  offence TEXT NOT NULL,
  level warning_level NOT NULL,
  description TEXT,
  witness TEXT,
  issued_by UUID REFERENCES users(id),
  expiry_date DATE,
  signed_pdf_url TEXT,
  status warning_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_warnings_employee ON warnings(employee_id);

-- ============================================================
-- INCIDENTS (HR Advisor)
-- ============================================================
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  classification TEXT,
  advisor_output JSONB,
  advised_by UUID REFERENCES users(id),
  advised_at TIMESTAMPTZ,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- HEARINGS
-- ============================================================
CREATE TABLE hearings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  warning_id UUID REFERENCES warnings(id),
  notice_date DATE NOT NULL,
  hearing_date DATE NOT NULL,
  charge TEXT NOT NULL,
  chairperson TEXT,
  outcome hearing_outcome,
  outcome_date DATE,
  signed_pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- LEAVE
-- ============================================================
CREATE TABLE leave (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type leave_type NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  days NUMERIC(4,1) NOT NULL,
  reason TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  medical_cert_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- LEAVE BALANCES
-- ============================================================
CREATE TABLE leave_balances (
  employee_id UUID PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  annual_remaining NUMERIC(4,1) NOT NULL DEFAULT 21,
  sick_remaining NUMERIC(4,1) NOT NULL DEFAULT 30,
  family_remaining NUMERIC(4,1) NOT NULL DEFAULT 3,
  parental_used NUMERIC(4,1) NOT NULL DEFAULT 0,
  sick_cycle_start DATE,
  last_accrual_run TIMESTAMPTZ
);

-- ============================================================
-- MEDICAL CERTIFICATES
-- ============================================================
CREATE TABLE medical_certs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  cert_date DATE NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  doctor_name TEXT,
  cert_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- EMPLOYEE DOCUMENTS
-- ============================================================
CREATE TABLE employee_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  doc_type doc_type NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expiry_date DATE,
  notes TEXT
);

CREATE INDEX idx_employee_docs ON employee_documents(employee_id);

-- ============================================================
-- PAYROLL RUNS
-- ============================================================
CREATE TABLE payroll_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  run_by UUID REFERENCES users(id),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status payroll_status NOT NULL DEFAULT 'draft',
  summary_pdf_url TEXT,
  total_gross NUMERIC(12,2),
  total_net NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Now add FK on loan_deductions
ALTER TABLE loan_deductions
  ADD CONSTRAINT fk_loan_deductions_payroll
  FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id);

-- ============================================================
-- PAYSLIPS
-- ============================================================
CREATE TABLE payslips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  ordinary_hours NUMERIC(5,2) NOT NULL DEFAULT 0,
  ot_hours NUMERIC(5,2) NOT NULL DEFAULT 0,
  ot_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  gross NUMERIC(10,2) NOT NULL DEFAULT 0,
  late_deduction NUMERIC(10,2) NOT NULL DEFAULT 0,
  uif_employee NUMERIC(10,2) NOT NULL DEFAULT 0,
  uif_employer NUMERIC(10,2) NOT NULL DEFAULT 0,
  paye NUMERIC(10,2) NOT NULL DEFAULT 0,
  loan_deduction NUMERIC(10,2) NOT NULL DEFAULT 0,
  garnishee NUMERIC(10,2) NOT NULL DEFAULT 0,
  petty_shortfall NUMERIC(10,2) NOT NULL DEFAULT 0,
  net NUMERIC(10,2) NOT NULL DEFAULT 0,
  pdf_url TEXT,
  signed_at TIMESTAMPTZ,
  signature_url TEXT,
  paid_at TIMESTAMPTZ,
  payment_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payroll_run_id, employee_id)
);

CREATE INDEX idx_payslips_employee ON payslips(employee_id);

-- ============================================================
-- PETTY CASH IN
-- ============================================================
CREATE TABLE petty_cash_ins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(10,2) NOT NULL,
  source TEXT NOT NULL DEFAULT 'other',
  source_user UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PETTY CASH OUT
-- ============================================================
CREATE TABLE petty_cash_outs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  recipient_type petty_recipient_type NOT NULL DEFAULT 'employee',
  recipient_employee_id UUID REFERENCES employees(id),
  recipient_name_freetext TEXT,
  category petty_cash_category NOT NULL DEFAULT 'other',
  amount NUMERIC(10,2) NOT NULL,
  reason TEXT,
  issued_by UUID REFERENCES users(id),
  status petty_cash_out_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PETTY CASH SLIPS
-- ============================================================
CREATE TABLE petty_cash_slips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  petty_cash_out_id UUID NOT NULL REFERENCES petty_cash_outs(id) ON DELETE CASCADE,
  slip_amount NUMERIC(10,2) NOT NULL,
  slip_photo_url TEXT,
  returned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  squared_by UUID REFERENCES users(id)
);

-- ============================================================
-- CASUAL WORKERS
-- ============================================================
CREATE TABLE casual_workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  first_seen DATE NOT NULL DEFAULT CURRENT_DATE,
  last_seen DATE NOT NULL DEFAULT CURRENT_DATE,
  times_engaged INTEGER NOT NULL DEFAULT 1,
  notes TEXT
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  before_state JSONB,
  after_state JSONB,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- ============================================================
-- SETTINGS (key-value)
-- ============================================================
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PUBLIC HOLIDAYS
-- ============================================================
CREATE TABLE public_holidays (
  date DATE PRIMARY KEY,
  name TEXT NOT NULL
);

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_loans_updated BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_petty_cash_outs_updated BEFORE UPDATE ON petty_cash_outs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
