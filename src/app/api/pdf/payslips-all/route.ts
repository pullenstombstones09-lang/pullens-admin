import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/lib/supabase/server';
import { generatePayslipPdf, type PayslipPdfData } from '@/lib/pdf-generator';
import jsPDF from 'jspdf';

// GET /api/pdf/payslips-all?run=<payroll_run_id>
// Returns a single PDF with all payslips for the run (one per page)
export async function GET(request: NextRequest) {
  try {
    const runId = request.nextUrl.searchParams.get('run');
    if (!runId) {
      return NextResponse.json({ error: 'run is required' }, { status: 400 });
    }

    const supabase = await createServiceRoleSupabase();

    // Fetch run + all payslips with employee data
    const [runRes, slipRes] = await Promise.all([
      supabase.from('payroll_runs').select('week_start, week_end').eq('id', runId).single(),
      supabase
        .from('payslips')
        .select('*, employee:employees(full_name, pt_code, id_number, occupation, payment_method, bank_name, bank_acc)')
        .eq('payroll_run_id', runId)
        .order('created_at'),
    ]);

    if (!runRes.data) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    const run = runRes.data;
    const slips = (slipRes.data ?? []).map((s: Record<string, unknown>) => ({
      ...s,
      employee: Array.isArray(s.employee) ? s.employee[0] : s.employee,
    }));

    if (slips.length === 0) {
      return NextResponse.json({ error: 'No payslips in this run' }, { status: 404 });
    }

    // Generate individual PDFs and merge pages into one document
    // jsPDF doesn't support merging, so we generate one big doc
    const { generateAllPayslipsPdf } = await import('@/lib/pdf-generator-all');

    const pdfDataList: PayslipPdfData[] = slips.map((slip: Record<string, unknown>) => {
      const emp = slip.employee as Record<string, unknown> | null;
      const gross = slip.gross as number;
      const ot_amount = slip.ot_amount as number;
      const ot_hours = slip.ot_hours as number;
      const late_deduction = slip.late_deduction as number;
      const uif_employee = slip.uif_employee as number;
      const paye = slip.paye as number;
      const loan_deduction = slip.loan_deduction as number;
      const garnishee = slip.garnishee as number;
      const petty_shortfall = slip.petty_shortfall as number;

      const totalDeductions = uif_employee + paye + late_deduction +
        loan_deduction + garnishee + petty_shortfall;

      return {
        employee_name: (emp?.full_name as string) || 'Unknown',
        pt_code: (emp?.pt_code as string) || '—',
        occupation: (emp?.occupation as string) || 'General Worker',
        id_number: (emp?.id_number as string) || '—',
        payment_method: (emp?.payment_method as string) || 'eft',
        bank_name: (emp?.bank_name as string) || '',
        bank_acc: (emp?.bank_acc as string) || '',
        week_start: run.week_start,
        week_end: run.week_end,
        pay_date: run.week_end,
        weekly_wage: gross - ot_amount,
        ordinary_hours: slip.ordinary_hours as number,
        ot_hours,
        ot_rate: ot_hours > 0 ? ot_amount / (ot_hours * ((gross - ot_amount) / 40)) : 1.5,
        ot_amount,
        gross,
        late_deduction,
        uif_employee,
        uif_employer: slip.uif_employer as number,
        paye,
        loan_deduction,
        garnishee,
        petty_shortfall,
        total_deductions: totalDeductions,
        net: slip.net as number,
      };
    });

    const pdfBuffer = generateAllPayslipsPdf(pdfDataList);

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="payslips-all-${run.week_end}.pdf"`,
      },
    });
  } catch (err) {
    console.error('Print All Payslips error:', err);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
