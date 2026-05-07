import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/lib/supabase/server';
import { generatePayslipPdf, type PayslipPdfData } from '@/lib/pdf-generator';

// GET /api/pdf/payslip?id=<payslip_id>
export async function GET(request: NextRequest) {
  try {
    const payslipId = request.nextUrl.searchParams.get('id');
    if (!payslipId) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const supabase = await createServiceRoleSupabase();

    const { data: slip, error } = await supabase
      .from('payslips')
      .select('*')
      .eq('id', payslipId)
      .single();

    if (error || !slip) {
      return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    }

    const { data: emp } = await supabase
      .from('employees')
      .select('full_name, pt_code, occupation, id_number, payment_method, bank_name, bank_acc, weekly_wage, weekly_hours')
      .eq('id', slip.employee_id)
      .single();

    const { data: run } = await supabase
      .from('payroll_runs')
      .select('week_start, week_end')
      .eq('id', slip.payroll_run_id)
      .single();

    const uif_employee = slip.uif_employee ?? 0;
    const paye = slip.paye ?? 0;
    const late_deduction = slip.late_deduction ?? 0;
    const loan_deduction = slip.loan_deduction ?? 0;
    const garnishee = slip.garnishee ?? 0;
    const petty_shortfall = slip.petty_shortfall ?? 0;
    const ot_hours = slip.ot_hours ?? 0;
    const ot_amount = slip.ot_amount ?? 0;
    const gross = slip.gross ?? 0;
    const ordinary_hours = slip.ordinary_hours ?? 0;
    const weekly_wage = emp?.weekly_wage ?? (gross - ot_amount);
    const weekly_hours = emp?.weekly_hours ?? 40;

    const totalDeductions = uif_employee + paye + late_deduction +
      loan_deduction + garnishee + petty_shortfall;

    const pdfData: PayslipPdfData = {
      employee_name: emp?.full_name || 'Unknown',
      pt_code: emp?.pt_code || '-',
      occupation: emp?.occupation || 'General Worker',
      id_number: emp?.id_number || '-',
      payment_method: emp?.payment_method || 'eft',
      bank_name: emp?.bank_name || '',
      bank_acc: emp?.bank_acc || '',
      week_start: run?.week_start || '-',
      week_end: run?.week_end || '-',
      pay_date: run?.week_end || '-',
      weekly_wage,
      weekly_hours,
      ordinary_hours,
      ot_hours,
      ot_rate: ot_hours > 0 && gross > ot_amount ? ot_amount / (ot_hours * ((gross - ot_amount) / weekly_hours)) : 1.5,
      ot_amount,
      gross,
      late_deduction,
      uif_employee,
      uif_employer: slip.uif_employer ?? 0,
      paye,
      loan_deduction,
      garnishee,
      petty_shortfall,
      total_deductions: totalDeductions,
      net: slip.net ?? 0,
      signature_url: undefined as string | undefined,
      signed_at: slip.signed_at || undefined,
    };

    // Fetch signature image as base64 data URL for PDF embedding
    if (slip.signature_url) {
      try {
        if (slip.signature_url.startsWith('data:')) {
          pdfData.signature_url = slip.signature_url;
        } else {
          const sigRes = await fetch(slip.signature_url);
          if (sigRes.ok) {
            const sigBuf = await sigRes.arrayBuffer();
            const base64 = Buffer.from(sigBuf).toString('base64');
            const contentType = sigRes.headers.get('content-type') || 'image/png';
            pdfData.signature_url = `data:${contentType};base64,${base64}`;
          }
        }
      } catch {
        // Non-blocking — PDF will render without signature image
        console.error('Failed to fetch signature image for PDF');
      }
    }

    const pdfBuffer = generatePayslipPdf(pdfData);

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="payslip-${pdfData.pt_code}-${pdfData.week_end}.pdf"`,
      },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : '';
    console.error('Payslip PDF error:', errMsg, errStack);
    return NextResponse.json({ error: 'Failed to generate PDF', details: errMsg }, { status: 500 });
  }
}
