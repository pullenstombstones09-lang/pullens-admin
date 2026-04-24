import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { calculatePayroll, type PayrollInput, type PayrollResult } from '@/lib/payroll-engine';
import type { Employee, Attendance, OvertimeRequest, Loan } from '@/types/database';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { week_start, week_end } = body as {
      week_start: string;
      week_end: string;
    };

    if (!week_start || !week_end) {
      return NextResponse.json(
        { error: 'week_start and week_end are required' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();

    // 1. Fetch all active employees
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('status', 'active')
      .order('pt_code');

    if (empError) {
      return NextResponse.json({ error: empError.message }, { status: 500 });
    }

    if (!employees || employees.length === 0) {
      return NextResponse.json(
        { error: 'No active employees found' },
        { status: 404 }
      );
    }

    // 2. Fetch attendance for the week
    const { data: allAttendance, error: attError } = await supabase
      .from('attendance')
      .select('*')
      .gte('date', week_start)
      .lte('date', week_end);

    if (attError) {
      return NextResponse.json({ error: attError.message }, { status: 500 });
    }

    // 3. Fetch approved overtime for the week
    const { data: allOT, error: otError } = await supabase
      .from('overtime_requests')
      .select('*')
      .gte('date', week_start)
      .lte('date', week_end)
      .eq('status', 'approved');

    if (otError) {
      return NextResponse.json({ error: otError.message }, { status: 500 });
    }

    // 4. Fetch all active loans
    const { data: allLoans, error: loanError } = await supabase
      .from('loans')
      .select('*')
      .eq('status', 'active');

    if (loanError) {
      return NextResponse.json({ error: loanError.message }, { status: 500 });
    }

    // 5. Fetch petty cash shortfalls (open petty_cash_out where status = 'partial' or 'open')
    // Sum by employee to get total shortfall
    const { data: pettyShortfalls, error: pettyError } = await supabase
      .from('petty_cash_out')
      .select('recipient_employee_id, amount')
      .in('status', ['open', 'partial'])
      .not('recipient_employee_id', 'is', null);

    if (pettyError) {
      return NextResponse.json({ error: pettyError.message }, { status: 500 });
    }

    // Build petty shortfall map (employee_id -> total shortfall)
    const pettyMap = new Map<string, number>();
    for (const p of pettyShortfalls ?? []) {
      if (p.recipient_employee_id) {
        const current = pettyMap.get(p.recipient_employee_id) ?? 0;
        pettyMap.set(p.recipient_employee_id, current + (p.amount ?? 0));
      }
    }

    // Index data by employee
    const attendanceMap = new Map<string, Attendance[]>();
    for (const att of (allAttendance ?? []) as Attendance[]) {
      const existing = attendanceMap.get(att.employee_id) ?? [];
      existing.push(att);
      attendanceMap.set(att.employee_id, existing);
    }

    const otMap = new Map<string, OvertimeRequest[]>();
    for (const ot of (allOT ?? []) as OvertimeRequest[]) {
      const existing = otMap.get(ot.employee_id) ?? [];
      existing.push(ot);
      otMap.set(ot.employee_id, existing);
    }

    const loanMap = new Map<string, Loan[]>();
    for (const loan of (allLoans ?? []) as Loan[]) {
      const existing = loanMap.get(loan.employee_id) ?? [];
      existing.push(loan);
      loanMap.set(loan.employee_id, existing);
    }

    // 6. Run payroll calculation for each employee
    const results: PayrollResult[] = [];
    let totalGross = 0;
    let totalNet = 0;

    for (const emp of employees as Employee[]) {
      const input: PayrollInput = {
        employee: emp,
        attendance: attendanceMap.get(emp.id) ?? [],
        overtimeRequests: otMap.get(emp.id) ?? [],
        activeLoans: loanMap.get(emp.id) ?? [],
        pettyShortfall: pettyMap.get(emp.id) ?? 0,
      };

      const result = calculatePayroll(input);
      results.push(result);
      totalGross += result.gross;
      totalNet += result.net;
    }

    // 7. Create payroll_run row
    const { data: runData, error: runError } = await supabase
      .from('payroll_runs')
      .insert({
        week_start,
        week_end,
        run_at: new Date().toISOString(),
        status: 'draft',
        total_gross: Math.round(totalGross * 100) / 100,
        total_net: Math.round(totalNet * 100) / 100,
      })
      .select('id')
      .single();

    if (runError) {
      return NextResponse.json({ error: runError.message }, { status: 500 });
    }

    const runId = runData.id;

    // 8. Create payslip rows for all employees
    const payslipRows = results.map((r) => ({
      payroll_run_id: runId,
      employee_id: r.employee_id,
      ordinary_hours: r.ordinary_hours,
      ot_hours: r.ot_hours,
      ot_amount: r.ot_amount,
      gross: r.gross,
      late_deduction: r.late_deduction,
      uif_employee: r.uif_employee,
      uif_employer: r.uif_employer,
      paye: r.paye,
      loan_deduction: r.loan_deduction,
      garnishee: r.garnishee,
      petty_shortfall: r.petty_shortfall,
      net: r.net,
    }));

    const { error: slipError } = await supabase
      .from('payslips')
      .insert(payslipRows);

    if (slipError) {
      return NextResponse.json({ error: slipError.message }, { status: 500 });
    }

    // 9. Return results
    return NextResponse.json({
      run_id: runId,
      week_start,
      week_end,
      employee_count: results.length,
      total_gross: Math.round(totalGross * 100) / 100,
      total_net: Math.round(totalNet * 100) / 100,
      results,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
