// Pullens Admin — Database types (mirrors Supabase schema)

export type UserRole =
  | 'head_admin'
  | 'head_of_admin'
  | 'head_of_sales'
  | 'admin'
  | 'bookkeeper'
  | 'petty_cash';

export type EmployeeStatus = 'active' | 'inactive' | 'terminated' | 'suspended';
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave' | 'sick' | 'ph' | 'short_time';
export type LoanStatus = 'active' | 'closed';
export type WarningCategory = 'A' | 'B' | 'C';
export type WarningLevel = 'verbal' | 'written' | 'final';
export type WarningStatus = 'active' | 'expired' | 'overturned';
export type LeaveType = 'annual' | 'sick' | 'family' | 'parental' | 'unpaid';
export type PayrollStatus = 'draft' | 'generated' | 'approved' | 'paid';
export type PettyCashCategory = 'diesel' | 'tolls' | 'airtime' | 'materials' | 'casual_wages' | 'taxi' | 'other';
export type PettyCashOutStatus = 'open' | 'squared' | 'partial' | 'converted_to_loan';
export type PettyRecipientType = 'employee' | 'casual' | 'supplier';
export type DocType = 'id_copy' | 'contract' | 'eif' | 'cv' | 'bank' | 'training' | 'ppe' | 'drivers' | 'prdp' | 'annexure_a' | 'medical_cert' | 'other';
export type HearingOutcome = 'not_guilty' | 'verbal_warning' | 'written_warning' | 'final_warning' | 'dismissal' | 'suspension' | 'demotion' | 'other';
export type OtRequestStatus = 'pending' | 'approved' | 'rejected';
export type PaymentMethod = 'eft' | 'cash';
export type BankAccountType = 'savings' | 'cheque' | 'transmission';
export type Gender = 'Male' | 'Female' | 'Other';
export type Race = 'African' | 'Indian' | 'Coloured' | 'White' | 'Other';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  pin_hash: string;
  perms: Record<string, boolean>;
  active: boolean;
  force_pin_change: boolean;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  pt_code: string;
  legacy_code: string | null;
  full_name: string;
  id_number: string | null;
  dob: string | null;
  gender: Gender | null;
  race: Race | null;
  disability: boolean;
  cell: string | null;
  email: string | null;
  home_address: string | null;
  occupation: string | null;
  start_date: string | null;
  weekly_wage: number;
  payment_method: PaymentMethod;
  bank_name: string | null;
  bank_acc: string | null;
  bank_branch: string | null;
  bank_type: BankAccountType | null;
  emergency_name: string | null;
  emergency_rel: string | null;
  emergency_phone: string | null;
  nok_name: string | null;
  nok_rel: string | null;
  nok_phone: string | null;
  tax_number: string | null;
  uif_ref: string | null;
  garnishee: number;
  eif_on_file: boolean;
  eif_signed: boolean;
  eif_date: string | null;
  status: EmployeeStatus;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  employee_id: string;
  date: string;
  status: AttendanceStatus;
  time_in: string | null;
  time_out: string | null;
  late_minutes: number;
  reason: string | null;
  captured_by: string | null;
  captured_at: string;
}

export interface OvertimeRequest {
  id: string;
  employee_id: string;
  date: string;
  hours: number;
  rate_multiplier: number;
  reason: string | null;
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  status: OtRequestStatus;
  created_at: string;
}

export interface Loan {
  id: string;
  employee_id: string;
  date_advanced: string;
  amount: number;
  weekly_deduction: number;
  outstanding: number;
  purpose: string | null;
  auto_generated_from_petty: boolean;
  petty_cash_ref: string | null;
  status: LoanStatus;
  signed_agreement_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoanDeduction {
  id: string;
  loan_id: string;
  payroll_run_id: string | null;
  amount_deducted: number;
  deducted_at: string;
}

export interface Warning {
  id: string;
  employee_id: string;
  issued_date: string;
  category: WarningCategory;
  offence: string;
  level: WarningLevel;
  description: string | null;
  witness: string | null;
  issued_by: string | null;
  expiry_date: string | null;
  signed_pdf_url: string | null;
  status: WarningStatus;
  created_at: string;
}

export interface Incident {
  id: string;
  employee_id: string;
  incident_date: string;
  description: string;
  classification: string | null;
  advisor_output: Record<string, unknown> | null;
  advised_by: string | null;
  advised_at: string | null;
  resolved: boolean;
  resolution: string | null;
  created_at: string;
}

export interface Hearing {
  id: string;
  employee_id: string;
  warning_id: string | null;
  notice_date: string;
  hearing_date: string;
  charge: string;
  chairperson: string | null;
  outcome: HearingOutcome | null;
  outcome_date: string | null;
  signed_pdf_url: string | null;
  created_at: string;
}

export interface Leave {
  id: string;
  employee_id: string;
  leave_type: LeaveType;
  from_date: string;
  to_date: string;
  days: number;
  reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  medical_cert_url: string | null;
  created_at: string;
}

export interface LeaveBalance {
  employee_id: string;
  annual_remaining: number;
  sick_remaining: number;
  family_remaining: number;
  parental_used: number;
  sick_cycle_start: string | null;
  last_accrual_run: string | null;
}

export interface MedicalCert {
  id: string;
  employee_id: string;
  cert_date: string;
  from_date: string;
  to_date: string;
  doctor_name: string | null;
  cert_url: string;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  doc_type: DocType;
  file_url: string;
  uploaded_by: string | null;
  uploaded_at: string;
  expiry_date: string | null;
  notes: string | null;
}

export interface PayrollRun {
  id: string;
  week_start: string;
  week_end: string;
  run_by: string | null;
  run_at: string;
  status: PayrollStatus;
  summary_pdf_url: string | null;
  total_gross: number | null;
  total_net: number | null;
  created_at: string;
}

export interface Payslip {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  ordinary_hours: number;
  ot_hours: number;
  ot_amount: number;
  gross: number;
  late_deduction: number;
  uif_employee: number;
  uif_employer: number;
  paye: number;
  loan_deduction: number;
  garnishee: number;
  petty_shortfall: number;
  net: number;
  pdf_url: string | null;
  signed_at: string | null;
  signature_url: string | null;
  paid_at: string | null;
  payment_ref: string | null;
  created_at: string;
}

export interface PettyCashIn {
  id: string;
  date: string;
  amount: number;
  source: string;
  source_user: string | null;
  notes: string | null;
  created_at: string;
}

export interface PettyCashOut {
  id: string;
  date: string;
  recipient_type: PettyRecipientType;
  recipient_employee_id: string | null;
  recipient_name_freetext: string | null;
  category: PettyCashCategory;
  amount: number;
  reason: string | null;
  issued_by: string | null;
  status: PettyCashOutStatus;
  created_at: string;
  updated_at: string;
}

export interface PettyCashSlip {
  id: string;
  petty_cash_out_id: string;
  slip_amount: number;
  slip_photo_url: string | null;
  returned_at: string;
  squared_by: string | null;
}

export interface CasualWorker {
  id: string;
  name: string;
  first_seen: string;
  last_seen: string;
  times_engaged: number;
  notes: string | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface Setting {
  key: string;
  value: unknown;
  updated_by: string | null;
  updated_at: string;
}

export interface PublicHoliday {
  date: string;
  name: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string | null;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
}
