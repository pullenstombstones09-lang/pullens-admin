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
