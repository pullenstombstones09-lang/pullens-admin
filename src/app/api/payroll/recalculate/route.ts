import { NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/lib/supabase/server';
import { calculatePayroll, type PayrollInput } from '@/lib/payroll-engine';
import type { Employee, Attendance, OvertimeRequest, Loan } from '@/types/database';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { payslip_id } = body as { payslip_id: string };

    if (!payslip_id) {
      return NextResponse.json(
        { error: 'payslip_id is required' },
        { status: 400 }
      );
    }

    const supabase = await createServiceRoleSupabase();

    // 1. Fetch the payslip and its payroll_run (for week_start, week_end)
    const { data: payslip, error: payslipError } = await supabase
      .from('payslips')
      .select('*, payroll_runs(id, week_start, week_end)')
      .eq('id', payslip_id)
      .single();

    if (payslipError || !payslip) {
      return NextResponse.json(
        { error: payslipError?.message ?? 'Payslip not found' },
        { status: 404 }
      );
    }

    const run = payslip.payroll_runs as { id: string; week_start: string; week_end: string };
    const { week_start, week_end } = run;
    const employee_id = payslip.employee_id;

    // 2. Fetch fresh employee data
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employee_id)
      .single();

    if (empError || !employee) {
      return NextResponse.json(
        { error: empError?.message ?? 'Employee not found' },
        { status: 404 }
      );
    }

    // 3. Fetch attendance for this employee for this week
    const { data: attendance, error: attError } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employee_id)
      .gte('date', week_start)
      .lte('date', week_end);

    if (attError) {
      return NextResponse.json({ error: attError.message }, { status: 500 });
    }

    // 4. Fetch approved OT requests for this employee for this week
    const { data: overtimeRequests, error: otError } = await supabase
      .from('overtime_requests')
      .select('*')
      .eq('employee_id', employee_id)
      .gte('date', week_start)
      .lte('date', week_end)
      .eq('status', 'approved');

    if (otError) {
      return NextResponse.json({ error: otError.message }, { status: 500 });
    }

    // 5. Fetch active loans for this employee
    const { data: activeLoans, error: loanError } = await supabase
      .from('loans')
      .select('*')
      .eq('employee_id', employee_id)
      .eq('status', 'active');

    if (loanError) {
      return NextResponse.json({ error: loanError.message }, { status: 500 });
    }

    // 6. Calculate petty cash shortfall for this employee
    const { data: pettyOuts, error: pettyError } = await supabase
      .from('petty_cash_outs')
      .select('id, recipient_employee_id, amount, category, date')
      .in('status', ['open', 'partial'])
      .eq('recipient_employee_id', employee_id);

    if (pettyError) {
      return NextResponse.json({ error: pettyError.message }, { status: 500 });
    }

    let pettyShortfall = 0;
    for (const out of pettyOuts ?? []) {
      const { data: slips } = await supabase
        .from('petty_cash_slips')
        .select('slip_amount')
        .eq('petty_cash_out_id', out.id);

      const slipTotal = (slips || []).reduce((sum: number, s: any) => sum + (s.slip_amount || 0), 0);
      const shortfall = out.amount - slipTotal;
      if (shortfall > 0) {
        pettyShortfall += shortfall;
      }
    }

    // 7. Detect if last week of month (for garnishee)
    const wsDate = new Date(week_start + 'T00:00:00');
    const weDate = new Date(week_end + 'T00:00:00');
    const lastDayOfMonth = new Date(wsDate.getFullYear(), wsDate.getMonth() + 1, 0);
    const isLastWeekOfMonth = lastDayOfMonth >= wsDate && lastDayOfMonth <= weDate;

    // 8. Recalculate payroll
    const input: PayrollInput = {
      employee: employee as Employee,
      attendance: (attendance ?? []) as Attendance[],
      overtimeRequests: (overtimeRequests ?? []) as OvertimeRequest[],
      activeLoans: (activeLoans ?? []) as Loan[],
      pettyShortfall,
      isLastWeekOfMonth,
    };

    const result = calculatePayroll(input);

    // 9. Update the payslip with new values
    const { error: updateError } = await supabase
      .from('payslips')
      .update({
        ordinary_hours: result.ordinary_hours,
        ot_hours: result.ot_hours,
        ot_amount: result.ot_amount,
        gross: result.gross,
        late_deduction: result.late_deduction,
        uif_employee: result.uif_employee,
        uif_employer: result.uif_employer,
        paye: result.paye,
        loan_deduction: result.loan_deduction,
        garnishee: result.garnishee,
        petty_shortfall: result.petty_shortfall,
        net: result.net,
      })
      .eq('id', payslip_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 10. Recalculate run totals (sum all payslips for this run)
    const { data: allPayslips, error: allSlipsError } = await supabase
      .from('payslips')
      .select('gross, net')
      .eq('payroll_run_id', run.id);

    if (allSlipsError) {
      return NextResponse.json({ error: allSlipsError.message }, { status: 500 });
    }

    const totalGross = Math.round(
      (allPayslips ?? []).reduce((sum: number, s: any) => sum + (s.gross || 0), 0) * 100
    ) / 100;
    const totalNet = Math.round(
      (allPayslips ?? []).reduce((sum: number, s: any) => sum + (s.net || 0), 0) * 100
    ) / 100;

    const { error: runUpdateError } = await supabase
      .from('payroll_runs')
      .update({
        total_gross: totalGross,
        total_net: totalNet,
      })
      .eq('id', run.id);

    if (runUpdateError) {
      return NextResponse.json({ error: runUpdateError.message }, { status: 500 });
    }

    // 11. Return the new result
    return NextResponse.json({
      payslip_id,
      run_id: run.id,
      week_start,
      week_end,
      result,
      run_totals: {
        total_gross: totalGross,
        total_net: totalNet,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
