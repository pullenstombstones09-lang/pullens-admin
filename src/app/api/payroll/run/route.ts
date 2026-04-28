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

    // 5. Fetch open petty cash outs and convert shortfalls to loans
    const { data: pettyOuts, error: pettyError } = await supabase
      .from('petty_cash_outs')
      .select('id, recipient_employee_id, amount, category, date')
      .in('status', ['open', 'partial'])
      .not('recipient_employee_id', 'is', null);

    if (pettyError) {
      return NextResponse.json({ error: pettyError.message }, { status: 500 });
    }

    // For each open petty cash out, check slip returns and convert shortfall to loan
    const pettyMap = new Map<string, number>();
    for (const out of pettyOuts ?? []) {
      if (!out.recipient_employee_id) continue;

      // Get slip returns for this transaction
      const { data: slips } = await supabase
        .from('petty_cash_slips')
        .select('slip_amount')
        .eq('petty_cash_out_id', out.id);

      const slipTotal = (slips || []).reduce((sum: number, s: any) => sum + (s.slip_amount || 0), 0);
      const shortfall = out.amount - slipTotal;

      if (shortfall <= 0) {
        // Fully squared — update status
        await supabase
          .from('petty_cash_outs')
          .update({ status: 'squared', updated_at: new Date().toISOString() })
          .eq('id', out.id);
        continue;
      }

      // Create loan for the shortfall
      await supabase.from('loans').insert({
        employee_id: out.recipient_employee_id,
        date_advanced: new Date().toISOString().slice(0, 10),
        amount: shortfall,
        weekly_deduction: shortfall,
        outstanding: shortfall,
        purpose: `Petty cash shortfall — ${out.category} (${out.date})`,
        auto_generated_from_petty: true,
        petty_cash_ref: out.id,
        status: 'active',
      });

      // Mark petty cash out as converted
      await supabase
        .from('petty_cash_outs')
        .update({ status: 'converted_to_loan', updated_at: new Date().toISOString() })
        .eq('id', out.id);

      // Don't add to pettyMap — it's now a loan deduction, not a petty shortfall
      // The loan will be picked up by the existing loan fetch (step 4)
    }

    // Re-fetch loans since we just created new ones from petty cash
    const { data: updatedLoans } = await supabase
      .from('loans')
      .select('*')
      .eq('status', 'active');

    // Replace allLoans with updated list
    const finalLoans = updatedLoans || allLoans || [];

    // 5b. Auto-create PH attendance for public holidays in this week
    const { data: holidays } = await supabase
      .from('public_holidays')
      .select('date, name')
      .gte('date', week_start)
      .lte('date', week_end);

    if (holidays && holidays.length > 0 && employees) {
      for (const hol of holidays) {
        // Check which employees already have attendance for this holiday
        const existingForDay = (allAttendance ?? []).filter(
          (a: any) => a.date === hol.date
        );
        const existingIds = new Set(existingForDay.map((a: any) => a.employee_id));

        // Create PH records for employees missing attendance on this holiday
        const missingEmployees = employees.filter((e: any) => !existingIds.has(e.id));
        if (missingEmployees.length > 0) {
          const phRows = missingEmployees.map((e: any) => ({
            employee_id: e.id,
            date: hol.date,
            status: 'ph',
            time_in: null,
            time_out: null,
            late_minutes: 0,
            reason: hol.name,
          }));

          const { data: inserted } = await supabase
            .from('attendance')
            .upsert(phRows, { onConflict: 'employee_id,date' })
            .select();

          // Add to allAttendance so payroll calc includes them
          if (inserted) {
            (allAttendance as any[]).push(...inserted);
          }
        }
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
    for (const loan of (finalLoans) as Loan[]) {
      const existing = loanMap.get(loan.employee_id) ?? [];
      existing.push(loan);
      loanMap.set(loan.employee_id, existing);
    }

    // 6. Run payroll calculation for each employee
    // Garnishee only deducts when the pay week contains the last day of the month
    const wsDate = new Date(week_start + 'T00:00:00');
    const weDate = new Date(week_end + 'T00:00:00');
    // Last day of the month that week_start falls in
    const lastDayOfMonth = new Date(wsDate.getFullYear(), wsDate.getMonth() + 1, 0);
    const isLastWeekOfMonth = lastDayOfMonth >= wsDate && lastDayOfMonth <= weDate;

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
        isLastWeekOfMonth,
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
