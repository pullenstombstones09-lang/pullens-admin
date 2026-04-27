import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/lib/supabase/server';
import jsPDF from 'jspdf';
import { LOGO_BASE64 } from '@/lib/logo-base64';

// GET /api/pdf/dol-register?month=2026-04
// Monthly attendance register for Department of Labour compliance
export async function GET(request: NextRequest) {
  try {
    const monthParam = request.nextUrl.searchParams.get('month');
    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json({ error: 'month param required (YYYY-MM)' }, { status: 400 });
    }

    const [year, month] = monthParam.split('-').map(Number);
    const firstDay = `${monthParam}-01`;
    const lastDay = new Date(year, month, 0); // last day of month
    const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
    const daysInMonth = lastDay.getDate();

    const supabase = await createServiceRoleSupabase();

    // Fetch employees and attendance
    const [empRes, attRes] = await Promise.all([
      supabase
        .from('employees')
        .select('id, pt_code, full_name')
        .eq('status', 'active')
        .order('pt_code'),
      supabase
        .from('attendance')
        .select('employee_id, date, status, time_in, time_out, late_minutes')
        .gte('date', firstDay)
        .lte('date', lastDayStr)
        .order('date'),
    ]);

    const employees = empRes.data ?? [];
    const attendance = attRes.data ?? [];

    // Build lookup: employee_id -> date -> record
    const attMap = new Map<string, Map<string, typeof attendance[0]>>();
    for (const a of attendance) {
      if (!attMap.has(a.employee_id)) attMap.set(a.employee_id, new Map());
      attMap.get(a.employee_id)!.set(a.date, a);
    }

    // Generate all dates in month
    const dates: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }

    // Status abbreviations
    const statusAbbr: Record<string, string> = {
      present: 'P', late: 'L', absent: 'A', leave: 'Lv',
      sick: 'S', ph: 'PH', short_time: 'ST',
    };

    // Build PDF — landscape A3 for wide table
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 10;

    // Header
    try {
      doc.addImage(LOGO_BASE64, 'PNG', margin, margin, 30, 15);
    } catch { /* logo optional */ }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 26, 46);
    doc.text('MONTHLY ATTENDANCE REGISTER', margin + 35, margin + 7);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    const monthName = new Date(year, month - 1).toLocaleString('en-ZA', { month: 'long', year: 'numeric' });
    doc.text(`Period: ${monthName}`, margin + 35, margin + 13);
    doc.text("Pullen's Tombstones (Pty) Ltd — Amazon Creek Trading", margin + 35, margin + 18);
    doc.text('Department of Labour — BCEA Section 29', margin + 35, margin + 23);

    // Table setup
    const startY = margin + 30;
    const nameColW = 45;
    const ptColW = 14;
    const dayColW = Math.min(9, (pageW - margin * 2 - nameColW - ptColW - 20) / daysInMonth);
    const totalColW = 12;
    const rowH = 5.5;

    // Column headers — dates
    let x = margin;
    let y = startY;

    // Header row background
    doc.setFillColor(26, 26, 46);
    doc.rect(x, y, pageW - margin * 2, rowH + 1, 'F');

    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255);
    doc.text('Employee', x + 2, y + 4);
    x += nameColW;
    doc.text('PT', x + 1, y + 4);
    x += ptColW;

    for (const date of dates) {
      const dayNum = String(new Date(date + 'T00:00:00').getDate());
      doc.text(dayNum, x + dayColW / 2, y + 4, { align: 'center' });
      x += dayColW;
    }

    // Totals columns
    doc.text('P', x + totalColW / 2, y + 4, { align: 'center' });
    x += totalColW;
    doc.text('A', x + totalColW / 2, y + 4, { align: 'center' });
    x += totalColW;

    y += rowH + 1;

    // Day-of-week sub-header
    doc.setFillColor(240, 240, 235);
    doc.rect(margin, y, pageW - margin * 2, rowH, 'F');
    doc.setTextColor(100);
    doc.setFont('helvetica', 'normal');
    x = margin + nameColW + ptColW;
    for (const date of dates) {
      const dow = new Date(date + 'T00:00:00').toLocaleDateString('en-ZA', { weekday: 'narrow' });
      doc.text(dow, x + dayColW / 2, y + 3.5, { align: 'center' });
      x += dayColW;
    }
    y += rowH;

    // Employee rows
    doc.setFontSize(5.5);
    let pageNum = 1;

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];

      // Check if we need a new page
      if (y + rowH > pageH - 15) {
        // Footer on current page
        doc.setFontSize(6);
        doc.setTextColor(150);
        doc.text(`Page ${pageNum}`, pageW - margin, pageH - 5, { align: 'right' });
        doc.text(`Generated: ${new Date().toLocaleDateString('en-ZA')}`, margin, pageH - 5);
        pageNum++;

        doc.addPage();
        y = margin + 10;

        // Repeat header on new page
        doc.setFillColor(26, 26, 46);
        doc.rect(margin, y, pageW - margin * 2, rowH + 1, 'F');
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255);
        x = margin;
        doc.text('Employee', x + 2, y + 4);
        x += nameColW;
        doc.text('PT', x + 1, y + 4);
        x += ptColW;
        for (const date of dates) {
          doc.text(String(new Date(date + 'T00:00:00').getDate()), x + dayColW / 2, y + 4, { align: 'center' });
          x += dayColW;
        }
        doc.text('P', x + totalColW / 2, y + 4, { align: 'center' });
        x += totalColW;
        doc.text('A', x + totalColW / 2, y + 4, { align: 'center' });
        y += rowH + 1;
      }

      // Alternating row colour
      if (i % 2 === 0) {
        doc.setFillColor(250, 249, 246);
        doc.rect(margin, y, pageW - margin * 2, rowH, 'F');
      }

      // Employee name + PT
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51);
      x = margin;
      const displayName = emp.full_name.length > 25 ? emp.full_name.slice(0, 24) + '…' : emp.full_name;
      doc.text(displayName, x + 2, y + 3.8);
      x += nameColW;
      doc.setTextColor(130);
      doc.text(emp.pt_code, x + 1, y + 3.8);
      x += ptColW;

      // Daily cells
      let presentCount = 0;
      let absentCount = 0;
      const empAtt = attMap.get(emp.id);

      for (const date of dates) {
        const record = empAtt?.get(date);
        const dow = new Date(date + 'T00:00:00').getDay();
        const isWeekend = dow === 0 || dow === 6;

        if (record) {
          const abbr = statusAbbr[record.status] || '?';

          // Color code
          if (record.status === 'present') {
            doc.setTextColor(16, 185, 129); // green
            presentCount++;
          } else if (record.status === 'late') {
            doc.setTextColor(245, 158, 11); // amber
            presentCount++; // late counts as present
          } else if (record.status === 'absent') {
            doc.setTextColor(220, 38, 38); // red
            absentCount++;
          } else if (record.status === 'leave' || record.status === 'sick') {
            doc.setTextColor(37, 99, 235); // blue
          } else if (record.status === 'ph') {
            doc.setTextColor(99, 102, 241); // indigo
          } else {
            doc.setTextColor(107, 114, 128); // gray
          }

          doc.setFont('helvetica', 'bold');
          doc.text(abbr, x + dayColW / 2, y + 3.8, { align: 'center' });
        } else if (isWeekend) {
          doc.setTextColor(200);
          doc.setFont('helvetica', 'normal');
          doc.text('·', x + dayColW / 2, y + 3.8, { align: 'center' });
        } else {
          doc.setTextColor(220);
          doc.setFont('helvetica', 'normal');
          doc.text('—', x + dayColW / 2, y + 3.8, { align: 'center' });
        }

        x += dayColW;
      }

      // Totals
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text(String(presentCount), x + totalColW / 2, y + 3.8, { align: 'center' });
      x += totalColW;
      doc.setTextColor(220, 38, 38);
      doc.text(String(absentCount), x + totalColW / 2, y + 3.8, { align: 'center' });

      y += rowH;
    }

    // Legend
    y += 5;
    if (y > pageH - 25) {
      doc.addPage();
      y = margin + 10;
    }

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51);
    doc.text('Legend:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    const legendItems = 'P = Present  |  L = Late  |  A = Absent  |  Lv = Leave  |  S = Sick  |  PH = Public Holiday  |  ST = Short Time  |  — = No Record  |  · = Weekend';
    doc.text(legendItems, margin + 15, y);

    // Footer
    doc.setFontSize(6);
    doc.setTextColor(150);
    doc.text(`Page ${pageNum}`, pageW - margin, pageH - 5, { align: 'right' });
    doc.text(`Generated: ${new Date().toLocaleDateString('en-ZA')}`, margin, pageH - 5);

    // Signature line
    y += 10;
    doc.setTextColor(51);
    doc.setFontSize(8);
    doc.text('Signed: ____________________________', margin, y);
    doc.text('Date: ________________', margin + 90, y);
    doc.text('Designation: ____________________________', margin + 150, y);

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="DOL-Register-${monthParam}.pdf"`,
      },
    });
  } catch (err) {
    console.error('DOL register PDF error:', err);
    return NextResponse.json({ error: 'Failed to generate register' }, { status: 500 });
  }
}
