// Pullens Admin — Role-based permission matrix (spec section 4)

import { UserRole } from '@/types/database';

export const PERMISSIONS = {
  // Staff list & profiles
  view_staff_list: ['head_admin', 'head_of_admin', 'head_of_sales'],
  edit_employee: ['head_admin', 'head_of_admin', 'head_of_sales'],

  // Register (attendance)
  view_register: ['head_admin', 'head_of_admin', 'head_of_sales', 'admin'],
  edit_register: ['head_admin', 'head_of_admin', 'head_of_sales', 'admin'],

  // Payroll
  view_payroll: ['head_admin', 'head_of_admin', 'head_of_sales', 'bookkeeper'],
  run_payroll: ['head_admin', 'head_of_admin', 'head_of_sales'],
  approve_payroll: ['head_admin'],
  mark_paid: ['head_admin', 'head_of_admin', 'head_of_sales', 'bookkeeper'],

  // Payslips
  view_payslips: ['head_admin', 'head_of_admin', 'head_of_sales', 'bookkeeper'],

  // Loans
  view_loans: ['head_admin', 'head_of_admin', 'head_of_sales'],
  create_loan: ['head_admin', 'head_of_admin', 'head_of_sales'],

  // Warnings & disciplinary
  view_warnings: ['head_admin', 'head_of_admin', 'head_of_sales'],
  issue_warning: ['head_admin', 'head_of_admin', 'head_of_sales'],

  // HR Advisor
  view_hr_advisor: ['head_admin', 'head_of_admin', 'head_of_sales'],

  // Petty cash
  view_petty_cash: ['head_admin', 'head_of_admin', 'head_of_sales', 'petty_cash'],
  cash_out: ['head_admin', 'head_of_admin', 'head_of_sales', 'petty_cash', 'bookkeeper'],
  cash_in: ['head_admin', 'head_of_admin', 'head_of_sales', 'petty_cash'],

  // Leave
  view_leave: ['head_admin', 'head_of_admin', 'head_of_sales', 'admin'],
  record_leave: ['head_admin', 'head_of_admin', 'head_of_sales'],

  // Documents
  view_documents: ['head_admin', 'head_of_admin', 'head_of_sales', 'admin'],
  upload_document: ['head_admin', 'head_of_admin', 'head_of_sales', 'admin'],
  view_medical_certs: ['head_admin', 'head_of_admin', 'head_of_sales', 'admin'],

  // Settings & admin
  view_settings: ['head_admin'],
  edit_settings: ['head_admin'],
  view_audit_log: ['head_admin', 'head_of_admin', 'head_of_sales'],
  manage_users: ['head_admin'],

  // Compliance exports
  view_exports: ['head_admin', 'head_of_admin', 'head_of_sales'],

  // Notifications
  view_alerts: ['head_admin', 'head_of_admin', 'head_of_sales', 'admin', 'bookkeeper', 'petty_cash'],

  // Final approvals (spec: only Annika)
  final_approve: ['head_admin'],

  // Petty cash override (slip returned after cutoff)
  petty_cash_override: ['head_admin'],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

export function getNavItems(role: UserRole) {
  const items: { label: string; href: string; icon: string; permission: Permission }[] = [
    { label: 'Dashboard', href: '/dashboard', icon: 'home', permission: 'view_staff_list' },
    { label: 'Staff', href: '/staff', icon: 'users', permission: 'view_staff_list' },
    { label: 'Register', href: '/register', icon: 'clipboard-check', permission: 'view_register' },
    { label: 'Payroll', href: '/payroll', icon: 'banknotes', permission: 'view_payroll' },
    { label: 'Petty Cash', href: '/petty-cash', icon: 'wallet', permission: 'view_petty_cash' },
    { label: 'HR Advisor', href: '/hr-advisor', icon: 'scale', permission: 'view_hr_advisor' },
    { label: 'Alerts', href: '/alerts', icon: 'bell', permission: 'view_alerts' },
    { label: 'Exports', href: '/exports', icon: 'download', permission: 'view_exports' },
    { label: 'Settings', href: '/settings', icon: 'cog', permission: 'view_settings' },
  ];

  return items.filter((item) => hasPermission(role, item.permission));
}

// Cash-out permissions (spec section 4): Nisha, Kam, Veshi, Lee-Ann, Annika. NOT Marlyn.
export function canHandOutCash(role: UserRole): boolean {
  return hasPermission(role, 'cash_out') && role !== 'admin';
}
