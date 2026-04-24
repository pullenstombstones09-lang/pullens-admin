-- Pullens Admin: Extensions and Enums
-- Migration 00001

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role AS ENUM (
  'head_admin',
  'head_of_admin',
  'head_of_sales',
  'admin',
  'bookkeeper',
  'petty_cash'
);

CREATE TYPE employee_status AS ENUM ('active', 'inactive', 'terminated', 'suspended');

CREATE TYPE attendance_status AS ENUM (
  'present', 'late', 'absent', 'leave', 'sick', 'ph', 'short_time'
);

CREATE TYPE ot_rate_multiplier AS ENUM ('1.5', '2.0');

CREATE TYPE loan_status AS ENUM ('active', 'closed');

CREATE TYPE warning_category AS ENUM ('A', 'B', 'C');

CREATE TYPE warning_level AS ENUM ('verbal', 'written', 'final');

CREATE TYPE warning_status AS ENUM ('active', 'expired', 'overturned');

CREATE TYPE leave_type AS ENUM (
  'annual', 'sick', 'family', 'parental', 'unpaid'
);

CREATE TYPE payroll_status AS ENUM ('draft', 'generated', 'approved', 'paid');

CREATE TYPE petty_cash_category AS ENUM (
  'diesel', 'tolls', 'airtime', 'materials', 'casual_wages', 'taxi', 'other'
);

CREATE TYPE petty_cash_out_status AS ENUM (
  'open', 'squared', 'partial', 'converted_to_loan'
);

CREATE TYPE petty_recipient_type AS ENUM ('employee', 'casual', 'supplier');

CREATE TYPE doc_type AS ENUM (
  'id_copy', 'contract', 'eif', 'cv', 'bank', 'training', 'ppe',
  'drivers', 'prdp', 'annexure_a', 'medical_cert', 'other'
);

CREATE TYPE hearing_outcome AS ENUM (
  'not_guilty', 'verbal_warning', 'written_warning', 'final_warning',
  'dismissal', 'suspension', 'demotion', 'other'
);

CREATE TYPE ot_request_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE payment_method AS ENUM ('eft', 'cash');

CREATE TYPE bank_account_type AS ENUM ('savings', 'cheque', 'transmission');

CREATE TYPE gender AS ENUM ('Male', 'Female', 'Other');

CREATE TYPE race AS ENUM ('African', 'Indian', 'Coloured', 'White', 'Other');
