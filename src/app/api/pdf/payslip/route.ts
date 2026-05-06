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

    const totalDeductions = slip.uif_employee + slip.paye + slip.late_deduction +
      slip.loan_deduction + slip.garnishee + slip.petty_shortfall;

    const pdfData: PayslipPdfData = {
      employee_name: emp?.full_name || 'Unknown',
      pt_code: emp?.pt_code || '—',
      occupation: emp?.occupation || 'General Worker',
      id_number: emp?.id_number || '—',
      payment_method: emp?.payment_method || 'eft',
      bank_name: emp?.bank_name || '',
      bank_acc: emp?.bank_acc || '',
      week_start: run?.week_start || '—',
      week_end: run?.week_end || '—',
      pay_date: run?.week_end || '—', // paid on Thursday (end of week)
      weekly_wage: emp?.weekly_wage || (slip.gross - slip.ot_amount),
      weekly_hours: emp?.weekly_hours || 40,
      ordinary_hours: slip.ordinary_hours,
      ot_hours: slip.ot_hours,
      ot_rate: slip.ot_hours > 0 ? slip.ot_amount / (slip.ot_hours * ((slip.gross - slip.ot_amount) / 40)) : 1.5,
      ot_amount: slip.ot_amount,
      gross: slip.gross,
      late_deduction: slip.late_deduction,
      uif_employee: slip.uif_employee,
      uif_employer: slip.uif_employer,
      paye: slip.paye,
      loan_deduction: slip.loan_deduction,
      garnishee: slip.garnishee,
      petty_shortfall: slip.petty_shortfall,
      total_deductions: totalDeductions,
      net: slip.net,
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
    console.error('Payslip PDF error:', err);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
