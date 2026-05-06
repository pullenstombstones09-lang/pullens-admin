import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/lib/supabase/server';
import jsPDF from 'jspdf';
import { LOGO_BASE64 } from '@/lib/logo-base64';

// GET /api/pdf/attendance-monthly?month=2026-05
// Monthly attendance summary: present/late/absent/leave/sick/ph counts per employee
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

    // Count working days (Mon-Fri) in month
    let workingDays = 0;
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dow = new Date(year, month - 1, d).getDay();
      if (dow !== 0 && dow !== 6) workingDays++;
    }

    const supabase = await createServiceRoleSupabase();

    const [empRes, attRes] = await Promise.all([
      supabase
        .from('employees')
        .select('id, pt_code, full_name')
        .eq('status', 'active')
        .order('pt_code'),
      supabase
        .from('attendance')
        .select('employee_id, status, late_minutes')
        .gte('date', firstDay)
        .lte('date', lastDayStr),
    ]);

    const employees = empRes.data ?? [];
    const attendance = attRes.data ?? [];

    // Build lookup
    interface AttSummary {
      present: number;
      late: number;
      lateMinutes: number;
      absent: number;
      leave: number;
      sick: number;
      ph: number;
      total: number;
    }

    const attMap = new Map<string, AttSummary>();
    for (const a of attendance) {
      if (!attMap.has(a.employee_id)) {
        attMap.set(a.employee_id, { present: 0, late: 0, lateMinutes: 0, absent: 0, leave: 0, sick: 0, ph: 0, total: 0 });
      }
      const s = attMap.get(a.employee_id)!;
      s.total++;
      if (a.status === 'present') s.present++;
      else if (a.status === 'late') { s.late++; s.lateMinutes += a.late_minutes || 0; }
      else if (a.status === 'absent') s.absent++;
      else if (a.status === 'leave') s.leave++;
      else if (a.status === 'sick') s.sick++;
      else if (a.status === 'ph') s.ph++;
    }

    const monthName = new Date(year, month - 1).toLocaleString('en-ZA', { month: 'long', year: 'numeric' });
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 12;
    const tableW = pageW - margin * 2;

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
    doc.text('MONTHLY ATTENDANCE SUMMARY', pageW - 15, 14, { align: 'right' });

    doc.setFontSize(9);
    doc.setTextColor(102, 102, 102);
    doc.text(`Period: ${monthName}`, pageW - 15, 21, { align: 'right' });
    doc.text(`Working days: ${workingDays}`, pageW - 15, 27, { align: 'right' });

    // Blue + gold lines
    doc.setDrawColor(30, 64, 175);
    doc.setLineWidth(0.8);
    doc.line(margin, 32, pageW - margin, 32);
    doc.setDrawColor(196, 163, 90);
    doc.setLineWidth(0.3);
    doc.line(margin, 33, pageW - margin, 33);

    let y = 38;

    // Column definitions
    const cols = [
      { label: 'Name', x: margin + 2, w: 48, align: 'left' as string },
      { label: 'PT Code', x: margin + 50, w: 16, align: 'left' as string },
      { label: 'Present', x: margin + 68, w: 16, align: 'center' as const },
      { label: 'Late', x: margin + 86, w: 14, align: 'center' as const },
      { label: 'Late Min', x: margin + 102, w: 18, align: 'center' as const },
      { label: 'Absent', x: margin + 122, w: 14, align: 'center' as const },
      { label: 'Leave', x: margin + 138, w: 14, align: 'center' as const },
      { label: 'Sick', x: margin + 154, w: 12, align: 'center' as const },
      { label: 'PH', x: margin + 168, w: 10, align: 'center' as const },
      { label: 'Total', x: margin + 180, w: 14, align: 'center' as const },
    ];

    function drawTableHeader(yPos: number) {
      doc.setFillColor(30, 64, 175);
      doc.rect(margin, yPos, tableW, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      for (const col of cols) {
        if (col.align === 'center') {
          doc.text(col.label, col.x + col.w / 2, yPos + 5.5, { align: 'center' });
        } else if (col.align === 'right') {
          doc.text(col.label, col.x + col.w - 2, yPos + 5.5, { align: 'right' });
        } else {
          doc.text(col.label, col.x, yPos + 5.5);
        }
      }
      return yPos + 10;
    }

    y = drawTableHeader(y);

    // Flagged employees (>2 absent or >5 late)
    const flagged: string[] = [];

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const s = attMap.get(emp.id) || { present: 0, late: 0, lateMinutes: 0, absent: 0, leave: 0, sick: 0, ph: 0, total: 0 };

      const isFlagged = s.absent > 2 || s.late > 5;
      if (isFlagged) flagged.push(`${emp.full_name} (${emp.pt_code})`);

      // Page break
      if (y > 265) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(153, 153, 153);
        doc.text('CONFIDENTIAL', pageW - margin, 286, { align: 'right' });
        doc.addPage();
        y = 15;
        y = drawTableHeader(y);
      }

      // Alternate row
      if (i % 2 === 0) {
        doc.setFillColor(248, 248, 248);
        doc.rect(margin, y - 1, tableW, 7, 'F');
      }

      // Flagged row highlight
      if (isFlagged) {
        doc.setFillColor(254, 242, 242); // light red
        doc.rect(margin, y - 1, tableW, 7, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      // Name
      doc.setTextColor(51, 51, 51);
      const displayName = emp.full_name.length > 28 ? emp.full_name.slice(0, 27) + '...' : emp.full_name;
      doc.text(displayName, cols[0].x, y + 4);

      // PT Code
      doc.setTextColor(130, 130, 130);
      doc.text(emp.pt_code, cols[1].x, y + 4);

      // Present — green
      doc.setTextColor(16, 185, 129);
      doc.setFont('helvetica', 'bold');
      doc.text(String(s.present), cols[2].x + cols[2].w / 2, y + 4, { align: 'center' });

      // Late — amber
      doc.setTextColor(245, 158, 11);
      doc.text(String(s.late), cols[3].x + cols[3].w / 2, y + 4, { align: 'center' });

      // Late minutes
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 120, 0);
      doc.text(s.lateMinutes > 0 ? `${s.lateMinutes}` : '-', cols[4].x + cols[4].w / 2, y + 4, { align: 'center' });

      // Absent — red
      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
      doc.text(String(s.absent), cols[5].x + cols[5].w / 2, y + 4, { align: 'center' });

      // Leave — blue
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(37, 99, 235);
      doc.text(String(s.leave), cols[6].x + cols[6].w / 2, y + 4, { align: 'center' });

      // Sick — blue
      doc.text(String(s.sick), cols[7].x + cols[7].w / 2, y + 4, { align: 'center' });

      // PH — indigo
      doc.setTextColor(99, 102, 241);
      doc.text(String(s.ph), cols[8].x + cols[8].w / 2, y + 4, { align: 'center' });

      // Total
      doc.setTextColor(26, 26, 46);
      doc.setFont('helvetica', 'bold');
      doc.text(String(s.total), cols[9].x + cols[9].w / 2, y + 4, { align: 'center' });

      y += 7;
    }

    // --- Absenteeism rate ---
    y += 6;
    if (y > 260) { doc.addPage(); y = 15; }

    const totalPresent = Array.from(attMap.values()).reduce((sum, s) => sum + s.present + s.late, 0);
    const totalPossible = employees.length * workingDays;
    const attendanceRate = totalPossible > 0 ? ((totalPresent / totalPossible) * 100).toFixed(1) : '0.0';

    doc.setFillColor(30, 64, 175);
    doc.roundedRect(margin, y, tableW, 14, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(`Attendance Rate: ${attendanceRate}%`, margin + 6, y + 9);
    doc.setFontSize(8);
    doc.text(`${totalPresent} present days / ${totalPossible} possible days`, pageW - margin - 6, y + 9, { align: 'right' });

    // --- Flagged employees ---
    if (flagged.length > 0) {
      y += 20;
      if (y > 260) { doc.addPage(); y = 15; }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(220, 38, 38);
      doc.text('FLAGGED EMPLOYEES (>2 absent or >5 late)', margin, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 51, 51);
      for (const name of flagged) {
        if (y > 275) { doc.addPage(); y = 15; }
        doc.text(`- ${name}`, margin + 4, y);
        y += 5;
      }
    }

    // --- Footer ---
    const fy = 282;
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
        'Content-Disposition': `inline; filename="attendance-monthly-${monthParam}.pdf"`,
      },
    });
  } catch (err) {
    console.error('Monthly attendance PDF error:', err);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
