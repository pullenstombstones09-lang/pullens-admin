import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/lib/supabase/server';
import jsPDF from 'jspdf';
import { LOGO_BASE64 } from '@/lib/logo-base64';

// GET /api/pdf/payroll-monthly?month=2026-05
// Monthly payroll summary: all payroll runs in the month, aggregated by employee
export async function GET(request: NextRequest) {
  try {
    const monthParam = request.nextUrl.searchParams.get('month');
    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json({ error: 'month param required (YYYY-MM)' }, { status: 400 });
    }

    const [year, month] = monthParam.split('-').map(Number);
    const firstDay = `${monthParam}-01`;
    const lastDay = new Date(year, month, 0);
    const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

    const supabase = await createServiceRoleSupabase();

    // Get all payroll runs in the month
    const { data: runs } = await supabase
      .from('payroll_runs')
      .select('id, week_start, week_end, status')
      .gte('week_end', firstDay)
      .lte('week_end', lastDayStr)
      .order('week_end');

    if (!runs || runs.length === 0) {
      return NextResponse.json({ error: 'No payroll runs found for this month' }, { status: 404 });
    }

    const runIds = runs.map((r) => r.id);

    // Get all payslips for these runs
    const { data: payslips } = await supabase
      .from('payslips')
      .select(
        'employee_id, ordinary_hours, ot_hours, ot_amount, gross, paye, uif_employee, loan_deduction, garnishee, petty_shortfall, late_deduction, net, employee:employees(full_name, pt_code)'
      )
      .in('payroll_run_id', runIds)
      .order('created_at');

    if (!payslips || payslips.length === 0) {
      return NextResponse.json({ error: 'No payslips found for this month' }, { status: 404 });
    }

    // Aggregate by employee
    interface EmpAgg {
      name: string;
      ptCode: string;
      ordinaryHrs: number;
      otHrs: number;
      gross: number;
      paye: number;
      uif: number;
      loans: number;
      garnishee: number;
      petty: number;
      net: number;
    }

    const empMap = new Map<string, EmpAgg>();
    for (const slip of payslips) {
      const emp = Array.isArray(slip.employee) ? slip.employee[0] : slip.employee;
      if (!emp) continue;
      const existing = empMap.get(slip.employee_id);
      if (existing) {
        existing.ordinaryHrs += slip.ordinary_hours;
        existing.otHrs += slip.ot_hours;
        existing.gross += slip.gross;
        existing.paye += slip.paye;
        existing.uif += slip.uif_employee;
        existing.loans += slip.loan_deduction;
        existing.garnishee += slip.garnishee;
        existing.petty += slip.petty_shortfall;
        existing.net += slip.net;
      } else {
        empMap.set(slip.employee_id, {
          name: (emp as { full_name: string }).full_name,
          ptCode: (emp as { pt_code: string }).pt_code,
          ordinaryHrs: slip.ordinary_hours,
          otHrs: slip.ot_hours,
          gross: slip.gross,
          paye: slip.paye,
          uif: slip.uif_employee,
          loans: slip.loan_deduction,
          garnishee: slip.garnishee,
          petty: slip.petty_shortfall,
          net: slip.net,
        });
      }
    }

    const employees = Array.from(empMap.values()).sort((a, b) => a.ptCode.localeCompare(b.ptCode));

    const fmt = (n: number) => `R ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
    const fmtHrs = (n: number) => n.toFixed(1);
    const monthName = new Date(year, month - 1).toLocaleString('en-ZA', { month: 'long', year: 'numeric' });

    const doc = new jsPDF('l', 'mm', 'a4'); // landscape for wide table
    const pageW = doc.internal.pageSize.getWidth();

    // --- Header ---
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
    doc.text('MONTHLY PAYROLL SUMMARY', pageW - 15, 14, { align: 'right' });

    doc.setFontSize(9);
    doc.setTextColor(102, 102, 102);
    doc.text(`Period: ${monthName}`, pageW - 15, 21, { align: 'right' });
    doc.text(`${runs.length} payroll run(s)`, pageW - 15, 27, { align: 'right' });

    // Blue + gold lines
    doc.setDrawColor(30, 64, 175); // #1E40AF
    doc.setLineWidth(0.8);
    doc.line(12, 32, pageW - 12, 32);
    doc.setDrawColor(196, 163, 90); // #C4A35A
    doc.setLineWidth(0.3);
    doc.line(12, 33, pageW - 12, 33);

    let y = 38;
    const margin = 12;
    const tableW = pageW - margin * 2;

    // Column definitions
    const cols = [
      { label: 'Name', x: margin + 2, w: 50, align: 'left' as const },
      { label: 'PT Code', x: margin + 52, w: 16, align: 'left' as const },
      { label: 'Ord Hrs', x: margin + 70, w: 18, align: 'right' as const },
      { label: 'OT Hrs', x: margin + 88, w: 16, align: 'right' as const },
      { label: 'Gross', x: margin + 106, w: 26, align: 'right' as const },
      { label: 'PAYE', x: margin + 134, w: 22, align: 'right' as const },
      { label: 'UIF', x: margin + 158, w: 20, align: 'right' as const },
      { label: 'Loans', x: margin + 180, w: 22, align: 'right' as const },
      { label: 'Garnishee', x: margin + 204, w: 22, align: 'right' as const },
      { label: 'Petty', x: margin + 228, w: 20, align: 'right' as const },
      { label: 'Net Pay', x: margin + 250, w: 24, align: 'right' as const },
    ];

    function drawTableHeader(yPos: number) {
      doc.setFillColor(30, 64, 175); // #1E40AF
      doc.rect(margin, yPos, tableW, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      for (const col of cols) {
        if (col.align === 'right') {
          doc.text(col.label, col.x + col.w - 2, yPos + 5.5, { align: 'right' });
        } else {
          doc.text(col.label, col.x, yPos + 5.5);
        }
      }
      return yPos + 10;
    }

    y = drawTableHeader(y);

    // Totals accumulators
    const totals = { ordinaryHrs: 0, otHrs: 0, gross: 0, paye: 0, uif: 0, loans: 0, garnishee: 0, petty: 0, net: 0 };

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      totals.ordinaryHrs += emp.ordinaryHrs;
      totals.otHrs += emp.otHrs;
      totals.gross += emp.gross;
      totals.paye += emp.paye;
      totals.uif += emp.uif;
      totals.loans += emp.loans;
      totals.garnishee += emp.garnishee;
      totals.petty += emp.petty;
      totals.net += emp.net;

      // Page break
      if (y > 185) {
        doc.setDrawColor(221, 221, 221);
        doc.setLineWidth(0.3);
        doc.line(margin, 195, pageW - margin, 195);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(153, 153, 153);
        doc.text('CONFIDENTIAL', pageW - margin, 199, { align: 'right' });

        doc.addPage();
        y = 15;
        y = drawTableHeader(y);
      }

      // Alternate row
      if (i % 2 === 0) {
        doc.setFillColor(248, 248, 248);
        doc.rect(margin, y - 1, tableW, 7, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);

      // Name
      doc.setTextColor(51, 51, 51);
      const displayName = emp.name.length > 28 ? emp.name.slice(0, 27) + '...' : emp.name;
      doc.text(displayName, cols[0].x, y + 4);

      // PT Code
      doc.setTextColor(130, 130, 130);
      doc.text(emp.ptCode, cols[1].x, y + 4);

      // Numbers
      doc.setTextColor(51, 51, 51);
      doc.text(fmtHrs(emp.ordinaryHrs), cols[2].x + cols[2].w - 2, y + 4, { align: 'right' });
      doc.text(fmtHrs(emp.otHrs), cols[3].x + cols[3].w - 2, y + 4, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text(fmt(emp.gross), cols[4].x + cols[4].w - 2, y + 4, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 50, 50);
      doc.text(fmt(emp.paye), cols[5].x + cols[5].w - 2, y + 4, { align: 'right' });
      doc.text(fmt(emp.uif), cols[6].x + cols[6].w - 2, y + 4, { align: 'right' });

      doc.setTextColor(51, 51, 51);
      doc.text(fmt(emp.loans), cols[7].x + cols[7].w - 2, y + 4, { align: 'right' });
      doc.text(fmt(emp.garnishee), cols[8].x + cols[8].w - 2, y + 4, { align: 'right' });
      doc.text(fmt(emp.petty), cols[9].x + cols[9].w - 2, y + 4, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 26, 46);
      doc.text(fmt(emp.net), cols[10].x + cols[10].w - 2, y + 4, { align: 'right' });

      y += 7;
    }

    // --- Totals row ---
    y += 2;
    doc.setDrawColor(26, 26, 46);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 4;

    doc.setFillColor(30, 64, 175); // #1E40AF
    doc.roundedRect(margin, y, tableW, 12, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`TOTAL (${employees.length} employees)`, margin + 4, y + 8);
    doc.text(fmtHrs(totals.ordinaryHrs), cols[2].x + cols[2].w - 2, y + 8, { align: 'right' });
    doc.text(fmtHrs(totals.otHrs), cols[3].x + cols[3].w - 2, y + 8, { align: 'right' });
    doc.text(fmt(totals.gross), cols[4].x + cols[4].w - 2, y + 8, { align: 'right' });
    doc.text(fmt(totals.paye), cols[5].x + cols[5].w - 2, y + 8, { align: 'right' });
    doc.text(fmt(totals.uif), cols[6].x + cols[6].w - 2, y + 8, { align: 'right' });
    doc.text(fmt(totals.loans), cols[7].x + cols[7].w - 2, y + 8, { align: 'right' });
    doc.text(fmt(totals.garnishee), cols[8].x + cols[8].w - 2, y + 8, { align: 'right' });
    doc.text(fmt(totals.petty), cols[9].x + cols[9].w - 2, y + 8, { align: 'right' });

    // Gold accent for net total
    doc.setTextColor(196, 163, 90); // #C4A35A
    doc.setFontSize(9);
    doc.text(fmt(totals.net), cols[10].x + cols[10].w - 2, y + 8, { align: 'right' });

    // --- Footer ---
    const fy = 195;
    doc.setDrawColor(221, 221, 221);
    doc.setLineWidth(0.3);
    doc.line(margin, fy, pageW - margin, fy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(153, 153, 153);
    doc.text(
      'Amazon Creek Trading (Pty) Ltd t/a Pullens Tombstones | 46 Allandale Drive, Pietermaritzburg, KZN',
      margin,
      fy + 4
    );
    doc.text('CONFIDENTIAL', pageW - margin, fy + 4, { align: 'right' });
    doc.text(`Generated: ${new Date().toLocaleDateString('en-ZA')}`, margin, fy + 8);

    const pdfBuffer = doc.output('arraybuffer');

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="payroll-monthly-${monthParam}.pdf"`,
      },
    });
  } catch (err) {
    console.error('Monthly payroll PDF error:', err);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
