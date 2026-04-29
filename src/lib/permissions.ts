// src/lib/permissions.ts
import { UserRole } from '@/types/database';

export const PERMISSIONS = {
  // Dashboard
  view_dashboard: ['owner', 'supervisor', 'bookkeeper'],

  // Staff
  view_staff_list: ['owner', 'supervisor', 'bookkeeper', 'attendance_clerk'],
  edit_employee: ['owner'],
  view_staff_names: ['owner', 'supervisor', 'bookkeeper', 'attendance_clerk'],

  // Register
  view_register: ['owner', 'supervisor', 'bookkeeper', 'attendance_clerk'],
  edit_register: ['owner', 'attendance_clerk'],
  override_register: ['owner'],

  // Payroll
  view_payroll: ['owner', 'bookkeeper'],
  run_payroll: ['owner', 'bookkeeper'],
  approve_payroll: ['owner'],
  mark_paid: ['owner', 'bookkeeper'],

  // Payslips
  view_payslips: ['owner', 'bookkeeper'],
  sign_payslips: ['owner', 'signer'],
  print_payslips: ['owner', 'bookkeeper'],
  bank_payroll: ['owner', 'bookkeeper'],

  // Loans
  view_loans: ['owner', 'supervisor', 'bookkeeper'],
  create_loan: ['owner', 'supervisor', 'bookkeeper'],

  // Warnings & disciplinary
  view_warnings: ['owner', 'supervisor'],
  issue_warning: ['owner', 'supervisor'],

  // HR Advisor
  view_hr_advisor: ['owner', 'supervisor'],

  // Petty cash
  view_petty_cash: ['owner', 'supervisor', 'bookkeeper', 'cash_clerk'],
  cash_out: ['owner', 'supervisor', 'bookkeeper', 'cash_clerk'],
  cash_in: ['owner', 'supervisor', 'cash_clerk'],

  // Leave
  view_leave: ['owner', 'supervisor', 'attendance_clerk'],
  record_leave: ['owner', 'supervisor'],

  // Documents
  view_documents: ['owner', 'supervisor', 'attendance_clerk'],
  upload_document: ['owner', 'supervisor'],
  view_medical_certs: ['owner', 'supervisor'],

  // Settings & admin
  view_settings: ['owner'],
  edit_settings: ['owner'],
  view_audit_log: ['owner', 'supervisor'],
  manage_users: ['owner'],

  // Exports
  view_exports: ['owner', 'supervisor', 'bookkeeper'],

  // Alerts
  view_alerts: ['owner', 'supervisor', 'bookkeeper', 'attendance_clerk', 'cash_clerk', 'signer'],

  // Overrides
  final_approve: ['owner'],
  petty_cash_override: ['owner'],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

// Role-based home routes
const HOME_ROUTES: Record<UserRole, string> = {
  owner: '/dashboard',
  supervisor: '/dashboard',
  bookkeeper: '/payroll',
  attendance_clerk: '/register',
  cash_clerk: '/petty-cash',
  signer: '/payroll/sign',
};

export function getHomeRoute(role: UserRole): string {
  return HOME_ROUTES[role];
}

export function getNavItems(role: UserRole) {
  const items: { label: string; href: string; icon: string; permission: Permission }[] = [
    { label: 'Dashboard', href: '/dashboard', icon: 'home', permission: 'view_dashboard' },
    { label: 'Staff', href: '/staff', icon: 'users', permission: 'view_staff_list' },
    { label: 'Register', href: '/register', icon: 'clipboard-check', permission: 'view_register' },
    { label: 'Payroll', href: '/payroll', icon: 'banknotes', permission: 'view_payroll' },
    { label: 'Sign Payslips', href: '/payroll/sign', icon: 'clipboard-check', permission: 'sign_payslips' },
    { label: 'Petty Cash', href: '/petty-cash', icon: 'wallet', permission: 'view_petty_cash' },
    { label: 'HR Advisor', href: '/hr-advisor', icon: 'scale', permission: 'view_hr_advisor' },
    { label: 'Alerts', href: '/alerts', icon: 'bell', permission: 'view_alerts' },
    { label: 'Exports', href: '/exports', icon: 'download', permission: 'view_exports' },
    { label: 'Settings', href: '/settings', icon: 'cog', permission: 'view_settings' },
  ];

  return items.filter((item) => hasPermission(role, item.permission));
}

export function canHandOutCash(role: UserRole): boolean {
  return hasPermission(role, 'cash_out') && role !== 'attendance_clerk';
}
