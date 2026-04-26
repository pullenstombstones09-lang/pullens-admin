import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/lib/supabase/server';

// POST /api/cleanup — wipe all transactional/test data, keep master data
// Master data kept: employees, users, settings, public_holidays, leave_balances
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.secret !== 'pullens-cleanup-2026') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServiceRoleSupabase();
    const results: Record<string, string> = {};

    // Order matters — child tables first to avoid FK violations
    const tables = [
      'payslips',
      'payroll_runs',
      'attendance',
      'petty_cash_outs',
      'petty_cash_ins',
      'hr_incidents',
      'warnings',
      'loans',
      'employee_notes',
      'employee_documents',
      'leave_requests',
      'announcements',
      'audit_log',
    ];

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) {
        results[table] = `ERROR: ${error.message}`;
      } else {
        results[table] = `cleared`;
      }
    }

    return NextResponse.json({
      message: 'Test data cleared. Employees, users, settings, holidays kept.',
      results,
    });
  } catch (err) {
    console.error('Cleanup error:', err);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
