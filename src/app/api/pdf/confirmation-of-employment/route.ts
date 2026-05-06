import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/lib/supabase/server';
import jsPDF from 'jspdf';

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const supabase = await createServiceRoleSupabase();
    const { data: emp, error } = await supabase
      .from('employees')
      .select('full_name, id_number, job_title, department, start_date, employment_type, weekly_wage')
      .eq('id', id)
      .single();

    if (error || !emp) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 25;

    // Company header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175); // Royal blue
    doc.text('Amazon Creek Trading (Pty) Ltd', margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('t/a Pullens Tombstones', margin, y);
    y += 5;
    doc.text('Reg: 2011/105461/23', margin, y);
    y += 5;
    doc.text('COID: 990001280518', margin, y);

    // Blue accent line
    y += 8;
    doc.setDrawColor(30, 64, 175);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageW - margin, y);

    // Date
    y += 12;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const today = new Date().toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    doc.text(today, margin, y);

    // Title
    y += 18;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('TO WHOM IT MAY CONCERN', margin, y);
    y += 12;
    doc.setFontSize(13);
    doc.setTextColor(30, 64, 175);
    doc.text('CONFIRMATION OF EMPLOYMENT', margin, y);

    // Body
    y += 14;
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);

    const startDate = emp.start_date
      ? new Date(emp.start_date).toLocaleDateString('en-ZA', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'date not on record';

    const idDisplay = emp.id_number || 'not on file';

    const bodyLines = doc.splitTextToSize(
      `This letter confirms that ${emp.full_name}, ID Number ${idDisplay}, has been employed by Amazon Creek Trading (Pty) Ltd, trading as Pullens Tombstones, since ${startDate}.`,
      pageW - margin * 2
    );
    doc.text(bodyLines, margin, y);
    y += bodyLines.length * 5.5 + 8;

    // Details table
    const details = [
      ['Position', emp.job_title || 'General Worker'],
      ['Department', emp.department || 'Production'],
      ['Employment Type', emp.employment_type === 'part_time' ? 'Part-time' : 'Full-time'],
      ['Current Remuneration', `R${(emp.weekly_wage || 0).toFixed(2)} per week`],
    ];

    for (const [label, value] of details) {
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}:`, margin + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, margin + 52, y);
      y += 7;
    }

    // Disclaimer
    y += 10;
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    const disclaimer = doc.splitTextToSize(
      'This letter is issued at the request of the employee and does not constitute a guarantee of continued employment.',
      pageW - margin * 2
    );
    doc.text(disclaimer, margin, y);

    // Sign-off
    y += 24;
    doc.setTextColor(40, 40, 40);
    doc.text('Yours faithfully,', margin, y);
    y += 20;
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.4);
    doc.line(margin, y, margin + 60, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Annika Gillmer', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('Director', margin, y);
    y += 5;
    doc.text('Amazon Creek Trading (Pty) Ltd', margin, y);

    // Footer
    const footerY = 282;
    doc.setDrawColor(30, 64, 175);
    doc.setLineWidth(0.4);
    doc.line(margin, footerY, pageW - margin, footerY);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated ${new Date().toISOString().slice(0, 10)}`, margin, footerY + 4);
    doc.text('CONFIDENTIAL', pageW - margin, footerY + 4, { align: 'right' });

    const pdfBuffer = doc.output('arraybuffer');
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Confirmation_${emp.full_name.replace(/\s+/g, '_')}.pdf"`,
      },
    });
  } catch (err) {
    console.error('Confirmation PDF error:', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
