import { NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/lib/supabase/server';
import { computeLoanRepayments } from '@/lib/loan-repayment';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { payroll_run_id } = body as { payroll_run_id: string };

    if (!payroll_run_id) {
      return NextResponse.json(
        { error: 'payroll_run_id is required' },
        { status: 400 }
      );
    }

    const supabase = await createServiceRoleSupabase();

    // Verify the payroll run exists
    const { data: run, error: runError } = await supabase
      .from('payroll_runs')
      .select('*')
      .eq('id', payroll_run_id)
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { error: 'Payroll run not found' },
        { status: 404 }
      );
    }

    // Fetch all payslips for this run with employee details
    const { data: payslips, error: slipError } = await supabase
      .from('payslips')
      .select('*, employee:employees(full_name, pt_code, id_number, occupation, home_address)')
      .eq('payroll_run_id', payroll_run_id)
      .order('created_at');

    if (slipError) {
      return NextResponse.json({ error: slipError.message }, { status: 500 });
    }

    if (!payslips || payslips.length === 0) {
      return NextResponse.json(
        { error: 'No payslips found for this run' },
        { status: 404 }
      );
    }

    // Set real PDF URLs for each payslip
    const updates = payslips.map((slip: { id: string }) => ({
      id: slip.id,
      pdf_url: `/api/pdf/payslip?id=${slip.id}`,
    }));

    // Batch update payslips with PDF URLs
    for (const update of updates) {
      await supabase
        .from('payslips')
        .update({ pdf_url: update.pdf_url })
        .eq('id', update.id);
    }

    // ── Loan repayment ledger (idempotent) ──────────────────────────────
    // The engine already subtracted loans from net pay on each payslip. This
    // is where that gets written back: log the repayment, reduce the balance,
    // close the loan at R0. Re-runnable — unwind whatever this run recorded
    // before, then re-apply from the final payslips. Re-finalizing or
    // recalculating can never double-charge.
    const employeeIds = Array.from(
      new Set((payslips as { employee_id: string }[]).map((p) => p.employee_id))
    );

    // 1. Unwind any prior recording for this run (restore balances, reopen).
    const { data: priorDeductions, error: priorErr } = await supabase
      .from('loan_deductions')
      .select('loan_id, amount_deducted')
      .eq('payroll_run_id', payroll_run_id);
    if (priorErr) {
      return NextResponse.json({ error: priorErr.message }, { status: 500 });
    }

    if (priorDeductions && priorDeductions.length > 0) {
      const restoreByLoan = new Map<string, number>();
      for (const d of priorDeductions as { loan_id: string; amount_deducted: number }[]) {
        restoreByLoan.set(d.loan_id, (restoreByLoan.get(d.loan_id) ?? 0) + d.amount_deducted);
      }
      const { data: loansToRestore } = await supabase
        .from('loans')
        .select('id, outstanding')
        .in('id', Array.from(restoreByLoan.keys()));
      for (const l of (loansToRestore ?? []) as { id: string; outstanding: number }[]) {
        const restored =
          Math.round((l.outstanding + (restoreByLoan.get(l.id) ?? 0)) * 100) / 100;
        await supabase
          .from('loans')
          .update({ outstanding: restored, status: 'active' })
          .eq('id', l.id);
      }
      await supabase
        .from('loan_deductions')
        .delete()
        .eq('payroll_run_id', payroll_run_id);
    }

    // 2. Re-apply from current active loans for everyone in this run.
    const { data: activeLoans, error: loanFetchErr } = await supabase
      .from('loans')
      .select('id, weekly_deduction, outstanding')
      .eq('status', 'active')
      .in('employee_id', employeeIds);
    if (loanFetchErr) {
      return NextResponse.json({ error: loanFetchErr.message }, { status: 500 });
    }

    const repayments = computeLoanRepayments(activeLoans ?? []);
    if (repayments.length > 0) {
      const { error: insErr } = await supabase.from('loan_deductions').insert(
        repayments.map((r) => ({
          loan_id: r.loan_id,
          payroll_run_id,
          amount_deducted: r.amount_deducted,
        }))
      );
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
      for (const r of repayments) {
        await supabase
          .from('loans')
          .update({
            outstanding: r.new_outstanding,
            status: r.close ? 'closed' : 'active',
          })
          .eq('id', r.loan_id);
      }
    }

    // Update payroll run status to 'generated'
    await supabase
      .from('payroll_runs')
      .update({ status: 'generated' })
      .eq('id', payroll_run_id);

    return NextResponse.json({
      success: true,
      payroll_run_id,
      payslips_generated: payslips.length,
      status: 'generated',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
