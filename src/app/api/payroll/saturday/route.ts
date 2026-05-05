import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { calculateSaturdayPayroll } from '@/lib/payroll-engine';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { date, employees } = await req.json();
    // employees: Array<{ employee_id: string, time_in: string, time_out: string }>

    if (!date || !employees?.length) {
      return NextResponse.json({ error: 'date and employees required' }, { status: 400 });
    }

    // Fetch employee records
    const employeeIds = employees.map((e: any) => e.employee_id);
    const { data: employeeRecords, error: empErr } = await supabase
      .from('employees')
      .select('*')
      .in('id', employeeIds);

    if (empErr || !employeeRecords) {
      return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
    }

    const empMap = new Map(employeeRecords.map((e: any) => [e.id, e]));

    // Calculate for each worker
    const results = [];
    for (const entry of employees) {
      const employee = empMap.get(entry.employee_id);
      if (!employee) continue;
      const result = calculateSaturdayPayroll({
        employee,
        timeIn: entry.time_in || '08:00',
        timeOut: entry.time_out || '14:00',
      });
      results.push(result);
    }

    // Create Saturday payroll run
    const { data: run, error: runErr } = await supabase
      .from('payroll_runs')
      .insert({
        week_start: date,
        week_end: date,
        status: 'generated',
        payroll_type: 'saturday_cash',
        total_gross: results.reduce((s, r) => s + r.gross, 0),
        total_net: results.reduce((s, r) => s + r.net, 0),
        run_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runErr || !run) {
      return NextResponse.json({ error: 'Failed to create Saturday run' }, { status: 500 });
    }

    // Create payslips
    const payslips = results.map(r => ({
      payroll_run_id: run.id,
      employee_id: r.employee_id,
      ordinary_hours: r.ordinary_hours,
      ot_hours: r.ot_hours,
      ot_amount: r.ot_amount,
      gross: r.gross,
      late_deduction: 0,
      uif_employee: 0,
      paye: 0,
      loan_deduction: 0,
      garnishee: 0,
      petty_shortfall: 0,
      net: r.net,
    }));

    const { error: slipErr } = await supabase.from('payslips').insert(payslips);

    if (slipErr) {
      return NextResponse.json({ error: 'Failed to create Saturday payslips' }, { status: 500 });
    }

    return NextResponse.json({ success: true, runId: run.id, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
