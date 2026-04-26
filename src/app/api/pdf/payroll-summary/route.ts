import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/lib/supabase/server';
import jsPDF from 'jspdf';
import { LOGO_BASE64 } from '@/lib/logo-base64';

// GET /api/pdf/payroll-summary?run=<payroll_run_id>
// Clean PDF: company header, list of Name + Net Pay, total at bottom
export async function GET(request: NextRequest) {
  try {
    const runId = request.nextUrl.searchParams.get('run');
    if (!runId) {
      return NextResponse.json({ error: 'run is required' }, { status: 400 });
    }

    const supabase = await createServiceRoleSupabase();

    const [runRes, slipRes] = await Promise.all([
      supabase.from('payroll_runs').select('week_start, week_end').eq('id', runId).single(),
      supabase
        .from('payslips')
        .select('net, employee:employees(full_name, pt_code)')
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
    })) as { net: number; employee: { full_name: string; pt_code: string } }[];

    if (slips.length === 0) {
      return NextResponse.json({ error: 'No payslips in this run' }, { status: 404 });
    }

    const fmt = (n: number) => `R ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
    const doc = new jsPDF('p', 'mm', 'a4');

    // --- Header with logo ---
    try {
      doc.addImage(LOGO_BASE64, 'JPEG', 10, 4, 55, 26);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(26, 26, 46);
      doc.text('PULLENS TOMBSTONES', 15, 18);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(26, 26, 46);
    doc.text('PAYROLL SUMMARY', 195, 14, { align: 'right' });

    doc.setFontSize(9);
    doc.setTextColor(102, 102, 102);
    doc.text(`Week: ${run.week_start} — ${run.week_end}`, 195, 21, { align: 'right' });

    // Blue line
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.8);
    doc.line(12, 32, 198, 32);
    doc.setDrawColor(26, 26, 46);
    doc.setLineWidth(0.2);
    doc.line(12, 33, 198, 33);

    let y = 40;

    // --- Table header ---
    doc.setFillColor(26, 26, 46);
    doc.rect(15, y, 180, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('#', 20, y + 5.5);
    doc.text('Employee', 30, y + 5.5);
    doc.text('Net Pay', 190, y + 5.5, { align: 'right' });
    y += 10;

    // --- Rows ---
    let totalNet = 0;
    for (let i = 0; i < slips.length; i++) {
      const slip = slips[i];
      totalNet += slip.net;

      // Page break check
      if (y > 265) {
        // Footer on current page
        doc.setDrawColor(221, 221, 221);
        doc.setLineWidth(0.3);
        doc.line(15, 282, 195, 282);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(153, 153, 153);
        doc.text('CONFIDENTIAL', 195, 286, { align: 'right' });

        doc.addPage();
        y = 15;

        // Re-draw table header
        doc.setFillColor(26, 26, 46);
        doc.rect(15, y, 180, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text('#', 20, y + 5.5);
        doc.text('Employee', 30, y + 5.5);
        doc.text('Net Pay', 190, y + 5.5, { align: 'right' });
        y += 10;
      }

      // Alternate row bg
      if (i % 2 === 0) {
        doc.setFillColor(248, 248, 248);
        doc.rect(15, y - 1, 180, 7, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(102, 102, 102);
      doc.text(String(i + 1), 20, y + 4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 51, 51);
      doc.text(slip.employee.full_name, 30, y + 4);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 26, 46);
      doc.text(fmt(slip.net), 190, y + 4, { align: 'right' });

      y += 7;
    }

    // --- Total row ---
    y += 2;
    doc.setDrawColor(26, 26, 46);
    doc.setLineWidth(0.5);
    doc.line(15, y, 195, y);
    y += 6;

    doc.setFillColor(37, 99, 235);
    doc.roundedRect(15, y, 180, 14, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(26, 26, 46);
    doc.text(`TOTAL (${slips.length} employees)`, 22, y + 9.5);
    doc.text(fmt(totalNet), 190, y + 9.5, { align: 'right' });

    // --- Footer ---
    const fy = 282;
    doc.setDrawColor(221, 221, 221);
    doc.setLineWidth(0.3);
    doc.line(15, fy, 195, fy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(153, 153, 153);
    doc.text('Amazon Creek Trading (Pty) Ltd t/a Pullens Tombstones | 46 Allandale Drive, Pietermaritzburg, KZN', 15, fy + 4);
    doc.text('CONFIDENTIAL', 195, fy + 4, { align: 'right' });

    const pdfBuffer = doc.output('arraybuffer');

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="payroll-summary-${run.week_end}.pdf"`,
      },
    });
  } catch (err) {
    console.error('Payroll summary PDF error:', err);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
