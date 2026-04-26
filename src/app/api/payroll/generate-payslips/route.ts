import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

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

    const supabase = await createServerSupabase();

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

    // ---------- PDF generation stub ----------
    // In production, this would use a library like @react-pdf/renderer,
    // puppeteer, or a service like html-pdf to generate actual PDF files.
    // Each payslip PDF must include BCEA Section 33 compliant fields:
    //
    //   - Employer name and address
    //   - Employee name, ID number, PT code
    //   - Pay period (week_start to week_end)
    //   - Ordinary hours worked
    //   - Overtime hours worked
    //   - Gross pay
    //   - Itemized deductions (UIF, PAYE, loans, garnishee, petty shortfall)
    //   - Net pay
    //   - Employer UIF contribution
    //
    // For now, we mark payslips as generated and update the run status.

    // Generate a placeholder PDF URL for each payslip
    const updates = payslips.map((slip: { id: string }) => ({
      id: slip.id,
      pdf_url: `/api/payroll/payslip-pdf/${slip.id}`, // placeholder route
    }));

    // Batch update payslips with PDF URLs
    for (const update of updates) {
      await supabase
        .from('payslips')
        .update({ pdf_url: update.pdf_url })
        .eq('id', update.id);
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
