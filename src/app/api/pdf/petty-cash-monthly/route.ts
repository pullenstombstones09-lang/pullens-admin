import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/lib/supabase/server';
import jsPDF from 'jspdf';
import { LOGO_BASE64 } from '@/lib/logo-base64';

// GET /api/pdf/petty-cash-monthly?month=2026-05
// Monthly petty cash summary: ins, outs, categories, outstanding
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

    const [insRes, outsRes, slipsRes] = await Promise.all([
      supabase
        .from('petty_cash_ins')
        .select('*')
        .gte('date', firstDay)
        .lte('date', lastDayStr)
        .order('date'),
      supabase
        .from('petty_cash_outs')
        .select('*, recipient_employee:employees(full_name)')
        .gte('date', firstDay)
        .lte('date', lastDayStr)
        .order('date'),
      supabase
        .from('petty_cash_slips')
        .select('*, petty_cash_out:petty_cash_outs(date)')
        .gte('returned_at', `${firstDay}T00:00:00`)
        .lte('returned_at', `${lastDayStr}T23:59:59`),
    ]);

    const ins = insRes.data ?? [];
    const outs = outsRes.data ?? [];
    const slips = slipsRes.data ?? [];

    const totalIn = ins.reduce((s, i) => s + i.amount, 0);
    const totalOut = outs.reduce((s, o) => s + o.amount, 0);
    const totalSlips = slips.reduce((s, sl) => s + sl.slip_amount, 0);
    const outstanding = totalOut - totalSlips;

    // Category breakdown
    const categories = new Map<string, { count: number; amount: number; squared: number }>();
    for (const o of outs) {
      const cat = o.category || 'other';
      const existing = categories.get(cat) || { count: 0, amount: 0, squared: 0 };
      existing.count++;
      existing.amount += o.amount;
      if (o.status === 'squared') existing.squared += o.amount;
      categories.set(cat, existing);
    }

    // Outstanding transactions
    const outstandingTxns = outs.filter((o) => o.status === 'open' || o.status === 'partial');

    const fmt = (n: number) => `R ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
    const monthName = new Date(year, month - 1).toLocaleString('en-ZA', { month: 'long', year: 'numeric' });
    const catLabels: Record<string, string> = {
      sundries: 'Sundries',
      diesel: 'Diesel',
      tolls: 'Tolls',
      materials: 'Materials',
      airtime: 'Airtime',
      transport: 'Transport',
      other: 'Other',
    };

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
    doc.text('MONTHLY PETTY CASH SUMMARY', pageW - 15, 14, { align: 'right' });

    doc.setFontSize(9);
    doc.setTextColor(102, 102, 102);
    doc.text(`Period: ${monthName}`, pageW - 15, 21, { align: 'right' });

    // Blue + gold lines
    doc.setDrawColor(30, 64, 175);
    doc.setLineWidth(0.8);
    doc.line(margin, 32, pageW - margin, 32);
    doc.setDrawColor(196, 163, 90);
    doc.setLineWidth(0.3);
    doc.line(margin, 33, pageW - margin, 33);

    let y = 40;

    // --- Summary boxes ---
    const boxW = (tableW - 9) / 4;
    const boxH = 22;
    const summaryData = [
      { label: 'Total In', value: fmt(totalIn), color: [16, 185, 129] as [number, number, number] },
      { label: 'Total Out', value: fmt(totalOut), color: [220, 38, 38] as [number, number, number] },
      { label: 'Outstanding', value: fmt(outstanding), color: [245, 158, 11] as [number, number, number] },
      { label: 'Net Balance', value: fmt(totalIn - totalOut), color: [30, 64, 175] as [number, number, number] },
    ];

    for (let i = 0; i < summaryData.length; i++) {
      const bx = margin + i * (boxW + 3);
      const sd = summaryData[i];

      doc.setFillColor(248, 248, 248);
      doc.roundedRect(bx, y, boxW, boxH, 2, 2, 'F');

      doc.setDrawColor(sd.color[0], sd.color[1], sd.color[2]);
      doc.setLineWidth(0.8);
      doc.line(bx, y, bx, y + boxH);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(102, 102, 102);
      doc.text(sd.label, bx + 6, y + 7);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(sd.color[0], sd.color[1], sd.color[2]);
      doc.text(sd.value, bx + 6, y + 16);
    }

    y += boxH + 10;

    // --- Category Breakdown ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(26, 26, 46);
    doc.text('Category Breakdown', margin, y);
    y += 6;

    // Table header
    doc.setFillColor(30, 64, 175);
    doc.rect(margin, y, tableW, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('Category', margin + 4, y + 5.5);
    doc.text('Count', margin + 70, y + 5.5, { align: 'center' });
    doc.text('Amount', margin + 110, y + 5.5, { align: 'right' });
    doc.text('Squared', margin + 150, y + 5.5, { align: 'right' });
    doc.text('Outstanding', margin + tableW - 4, y + 5.5, { align: 'right' });
    y += 10;

    const sortedCats = Array.from(categories.entries()).sort((a, b) => b[1].amount - a[1].amount);
    for (let i = 0; i < sortedCats.length; i++) {
      const [cat, data] = sortedCats[i];

      if (i % 2 === 0) {
        doc.setFillColor(248, 248, 248);
        doc.rect(margin, y - 1, tableW, 7, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 51, 51);
      doc.text(catLabels[cat] || cat, margin + 4, y + 4);
      doc.text(String(data.count), margin + 70, y + 4, { align: 'center' });
      doc.text(fmt(data.amount), margin + 110, y + 4, { align: 'right' });

      doc.setTextColor(16, 185, 129);
      doc.text(fmt(data.squared), margin + 150, y + 4, { align: 'right' });

      const catOutstanding = data.amount - data.squared;
      doc.setTextColor(catOutstanding > 0 ? 245 : 51, catOutstanding > 0 ? 158 : 51, catOutstanding > 0 ? 11 : 51);
      doc.setFont('helvetica', 'bold');
      doc.text(fmt(catOutstanding), margin + tableW - 4, y + 4, { align: 'right' });

      y += 7;
    }

    // --- Outstanding Transactions ---
    if (outstandingTxns.length > 0) {
      y += 10;
      if (y > 230) { doc.addPage(); y = 15; }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(220, 38, 38);
      doc.text(`Outstanding Transactions (${outstandingTxns.length})`, margin, y);
      y += 6;

      doc.setFillColor(30, 64, 175);
      doc.rect(margin, y, tableW, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text('Date', margin + 4, y + 5.5);
      doc.text('Recipient', margin + 30, y + 5.5);
      doc.text('Category', margin + 90, y + 5.5);
      doc.text('Amount', margin + 130, y + 5.5, { align: 'right' });
      doc.text('Status', margin + tableW - 4, y + 5.5, { align: 'right' });
      y += 10;

      for (let i = 0; i < outstandingTxns.length; i++) {
        const txn = outstandingTxns[i];

        if (y > 270) { doc.addPage(); y = 15; }

        if (i % 2 === 0) {
          doc.setFillColor(254, 242, 242);
          doc.rect(margin, y - 1, tableW, 7, 'F');
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(51, 51, 51);

        doc.text(txn.date, margin + 4, y + 4);

        const recipient = txn.recipient_employee
          ? (Array.isArray(txn.recipient_employee) ? txn.recipient_employee[0] : txn.recipient_employee)?.full_name
          : txn.recipient_name_freetext || 'Unknown';
        const displayRecipient = (recipient || 'Unknown').length > 30 ? (recipient || 'Unknown').slice(0, 29) + '...' : (recipient || 'Unknown');
        doc.text(displayRecipient, margin + 30, y + 4);

        doc.text(catLabels[txn.category] || txn.category, margin + 90, y + 4);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38);
        doc.text(fmt(txn.amount), margin + 130, y + 4, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(245, 158, 11);
        doc.text(txn.status.toUpperCase(), margin + tableW - 4, y + 4, { align: 'right' });

        y += 7;
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
        'Content-Disposition': `inline; filename="petty-cash-monthly-${monthParam}.pdf"`,
      },
    });
  } catch (err) {
    console.error('Monthly petty cash PDF error:', err);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
